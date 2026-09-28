from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Lot, Product
from app.schemas import LotCreate, LotUpdate, LotOut, ProductOut
from app.auth import require_auth

router = APIRouter()


@router.post("/lots", response_model=LotOut)
async def add_lot(
    body: LotCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    lot = Lot(**body.model_dump())
    db.add(lot)
    await db.flush()
    await db.refresh(lot)
    return LotOut.model_validate(lot)


@router.patch("/lots/{lot_id}", response_model=LotOut)
async def update_lot(
    lot_id: int,
    body: LotUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(lot, k, v)
    return LotOut.model_validate(lot)


@router.delete("/lots/{lot_id}")
async def delete_lot(
    lot_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    lot = await db.get(Lot, lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot introuvable")
    await db.delete(lot)
    return {"ok": True}


@router.put("/products/{product_id}/quantity")
async def set_product_quantity(
    product_id: int,
    new_qty: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    """Set the total stock count for a product via a correction lot."""
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(selectinload(Product.lots))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")

    current = sum(lot.quantity for lot in product.lots)
    delta = new_qty - current
    if delta == 0:
        return {"ok": True, "total": current}

    if delta > 0:
        lot = Lot(product_id=product_id, quantity=delta, notes="Correction manuelle")
        db.add(lot)
    else:
        to_remove = abs(delta)
        for lot in sorted(product.lots, key=lambda l: l.created_at):
            if to_remove <= 0:
                break
            if lot.quantity >= to_remove:
                lot.quantity -= to_remove
                to_remove = 0
            else:
                to_remove -= lot.quantity
                lot.quantity = 0

    await db.commit()
    return {"ok": True, "total": new_qty}


@router.get("/low-stock", response_model=list[ProductOut])
async def low_stock_products(
    threshold: int = 5,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Product).options(selectinload(Product.lots))
    )
    products = result.scalars().all()
    low = []
    for p in products:
        total = sum(lot.quantity for lot in p.lots)
        if total <= threshold:
            po = ProductOut.model_validate(p)
            po.total_stock = total
            low.append(po)
    return low


@router.get("/expiry-alerts", response_model=list[LotOut])
async def expiry_alerts(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    from datetime import datetime, timedelta
    limit_date = (datetime.utcnow() + timedelta(days=days)).date()
    result = await db.execute(
        select(Lot)
        .where(Lot.expiry_date != None, Lot.expiry_date <= limit_date, Lot.quantity > 0)
        .order_by(Lot.expiry_date.asc())
    )
    return [LotOut.model_validate(lot) for lot in result.scalars().all()]
