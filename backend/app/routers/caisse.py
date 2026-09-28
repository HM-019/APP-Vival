from datetime import datetime
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Transaction, TransactionItem, Product, Lot
from app.schemas import TransactionCreate, TransactionOut
from app.auth import require_auth

router = APIRouter()


def generate_invoice_number() -> str:
    now = datetime.utcnow()
    return f"FAC-{now.strftime('%Y%m%d-%H%M%S')}"


async def apply_fifo(db: AsyncSession, product_id: int, quantity: Decimal) -> list[tuple[int, Decimal]]:
    result = await db.execute(
        select(Lot)
        .where(Lot.product_id == product_id, Lot.quantity > 0)
        .order_by(Lot.created_at.asc())
    )
    lots = result.scalars().all()

    remaining = quantity
    deductions = []
    for lot in lots:
        if remaining <= 0:
            break
        take = min(Decimal(lot.quantity), remaining)
        lot.quantity = int(lot.quantity - take)
        remaining -= take
        deductions.append((lot.id, take))

    if remaining > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuffisant pour le produit (manque {remaining} unités)"
        )
    return deductions


@router.post("/", response_model=TransactionOut)
async def create_transaction(
    body: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    if not body.items:
        raise HTTPException(status_code=400, detail="Le panier est vide")

    total = sum(item.unit_price * item.quantity for item in body.items)
    change = max(Decimal("0"), body.amount_paid - total)

    transaction = Transaction(
        invoice_number=generate_invoice_number(),
        total=total,
        amount_paid=body.amount_paid,
        change_given=change,
        payment_method=body.payment_method,
        status="completed" if body.amount_paid >= total else "partial",
        notes=body.notes,
        is_custom_invoice=body.is_custom_invoice,
    )
    db.add(transaction)
    await db.flush()

    for item in body.items:
        lot_id = None
        if item.product_id and not item.is_custom:
            deductions = await apply_fifo(db, item.product_id, item.quantity)
            if deductions:
                lot_id = deductions[0][0]

        ti = TransactionItem(
            transaction_id=transaction.id,
            product_id=item.product_id if not item.is_custom else None,
            lot_id=lot_id,
            product_name=item.product_name,
            product_barcode=item.product_barcode,
            quantity=item.quantity,
            unit_price=item.unit_price,
            total_price=item.unit_price * item.quantity,
            is_custom=item.is_custom,
        )
        db.add(ti)

    await db.flush()
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction.id)
        .options(selectinload(Transaction.items))
    )
    return TransactionOut.model_validate(result.scalar_one())


@router.get("/history", response_model=list[TransactionOut])
async def transaction_history(
    skip: int = 0,
    limit: int = 50,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    q = select(Transaction).options(selectinload(Transaction.items))
    if date_from:
        q = q.where(Transaction.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        q = q.where(Transaction.created_at <= datetime.fromisoformat(date_to))
    if payment_method:
        q = q.where(Transaction.payment_method == payment_method)
    q = q.order_by(desc(Transaction.created_at)).offset(skip).limit(limit)
    result = await db.execute(q)
    return [TransactionOut.model_validate(t) for t in result.scalars().all()]


@router.get("/{transaction_id}", response_model=TransactionOut)
async def get_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id)
        .options(selectinload(Transaction.items))
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    return TransactionOut.model_validate(t)


@router.delete("/{transaction_id}")
async def cancel_transaction(
    transaction_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id)
        .options(selectinload(Transaction.items))
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Transaction introuvable")

    # Restore stock
    for item in t.items:
        if item.lot_id and not item.is_custom:
            lot = await db.get(Lot, item.lot_id)
            if lot:
                lot.quantity += int(item.quantity)

    t.status = "cancelled"
    return {"ok": True, "invoice_number": t.invoice_number}
