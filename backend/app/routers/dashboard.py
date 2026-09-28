from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Transaction, TransactionItem, Product, Lot
from app.schemas import DashboardStats, TransactionOut
from app.auth import require_auth

router = APIRouter()


async def _revenue_cost(db: AsyncSession, start: datetime, end: datetime) -> tuple[Decimal, Decimal]:
    r = await db.execute(
        select(
            func.coalesce(func.sum(TransactionItem.total_price), 0),
            func.coalesce(func.sum(TransactionItem.quantity * Lot.purchase_price), 0),
        )
        .select_from(TransactionItem)
        .join(Transaction, TransactionItem.transaction_id == Transaction.id)
        .outerjoin(Lot, TransactionItem.lot_id == Lot.id)
        .where(Transaction.created_at >= start, Transaction.created_at < end, Transaction.status != "cancelled")
    )
    row = r.one()
    return (row[0] or Decimal(0)), (row[1] or Decimal(0))


@router.get("/stats", response_model=DashboardStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_start = today_start - timedelta(days=6)
    tomorrow = today_start + timedelta(days=1)

    # ── Revenue today / yesterday ──────────────────────────────────────────────
    r = await db.execute(
        select(func.coalesce(func.sum(Transaction.total), 0))
        .where(Transaction.created_at >= today_start, Transaction.status != "cancelled")
    )
    revenue_today = r.scalar() or Decimal(0)

    r = await db.execute(
        select(func.coalesce(func.sum(Transaction.total), 0))
        .where(Transaction.created_at >= yesterday_start, Transaction.created_at < today_start, Transaction.status != "cancelled")
    )
    revenue_yesterday = r.scalar() or Decimal(0)

    # ── Transaction counts ─────────────────────────────────────────────────────
    r = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.created_at >= today_start, Transaction.status != "cancelled")
    )
    transactions_today = r.scalar() or 0

    r = await db.execute(
        select(func.count(Transaction.id))
        .where(Transaction.created_at >= yesterday_start, Transaction.created_at < today_start, Transaction.status != "cancelled")
    )
    transactions_yesterday = r.scalar() or 0

    # ── Profit today ───────────────────────────────────────────────────────────
    rev_today_raw, cost_today = await _revenue_cost(db, today_start, tomorrow)
    profit_today = rev_today_raw - cost_today

    # ── Profit this week ───────────────────────────────────────────────────────
    rev_week_raw, cost_week = await _revenue_cost(db, week_start, tomorrow)
    profit_week = rev_week_raw - cost_week

    # ── Average basket today ───────────────────────────────────────────────────
    avg_basket_today = revenue_today / transactions_today if transactions_today > 0 else Decimal(0)

    # ── Payment breakdown today ────────────────────────────────────────────────
    payment_breakdown_today: dict = {}
    for method in ("cash", "card", "check", "mixed"):
        r = await db.execute(
            select(func.coalesce(func.sum(Transaction.total), 0))
            .where(
                Transaction.created_at >= today_start,
                Transaction.status != "cancelled",
                Transaction.payment_method == method,
            )
        )
        payment_breakdown_today[method] = float(r.scalar() or 0)

    # ── Stock ──────────────────────────────────────────────────────────────────
    r = await db.execute(
        select(func.coalesce(func.sum(Lot.quantity * Lot.purchase_price), 0))
        .where(Lot.quantity > 0, Lot.purchase_price != None)
    )
    stock_total_value = r.scalar() or Decimal(0)

    r = await db.execute(select(func.count(Product.id)))
    stock_items_count = r.scalar() or 0

    all_products = await db.execute(select(Product).options(selectinload(Product.lots)))
    products = all_products.scalars().all()
    # Only count products that have been ordered at least once (have lots)
    low_stock = sum(1 for p in products if p.lots and sum(l.quantity for l in p.lots) < 5)

    limit_date = (now + timedelta(days=30)).date()
    r = await db.execute(
        select(func.count(Lot.id))
        .where(Lot.expiry_date != None, Lot.expiry_date <= limit_date, Lot.quantity > 0)
    )
    expiry_alerts = r.scalar() or 0

    # ── Daily stats (last 7 days) ──────────────────────────────────────────────
    daily_stats = []
    weekly_revenue = []
    for i in range(6, -1, -1):
        day_start = today_start - timedelta(days=i)
        day_end = day_start + timedelta(days=1)

        r = await db.execute(
            select(func.coalesce(func.sum(Transaction.total), 0), func.count(Transaction.id))
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end, Transaction.status != "cancelled")
        )
        row = r.one()
        day_rev = float(row[0] or 0)
        day_tx = row[1] or 0

        r = await db.execute(
            select(func.coalesce(func.sum(Transaction.total), 0))
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end, Transaction.status != "cancelled", Transaction.payment_method == "cash")
        )
        day_cash = float(r.scalar() or 0)

        r = await db.execute(
            select(func.coalesce(func.sum(Transaction.total), 0))
            .where(Transaction.created_at >= day_start, Transaction.created_at < day_end, Transaction.status != "cancelled", Transaction.payment_method == "card")
        )
        day_card = float(r.scalar() or 0)

        _, day_cost = await _revenue_cost(db, day_start, day_end)
        day_profit = day_rev - float(day_cost)

        label = day_start.strftime("%a %d/%m")
        weekly_revenue.append({"date": label, "revenue": day_rev})
        daily_stats.append({
            "date": label,
            "revenue": day_rev,
            "profit": day_profit,
            "transactions": day_tx,
            "cash": day_cash,
            "card": day_card,
        })

    # ── Recent transactions ────────────────────────────────────────────────────
    r = await db.execute(
        select(Transaction)
        .options(selectinload(Transaction.items))
        .where(Transaction.status != "cancelled")
        .order_by(desc(Transaction.created_at))
        .limit(10)
    )
    recent_transactions = [TransactionOut.model_validate(t) for t in r.scalars().all()]

    # ── Top products (last 30 days) ────────────────────────────────────────────
    month_ago = now - timedelta(days=30)
    r = await db.execute(
        select(
            TransactionItem.product_name,
            func.sum(TransactionItem.total_price).label("total"),
            func.sum(TransactionItem.quantity).label("qty")
        )
        .join(Transaction)
        .where(Transaction.created_at >= month_ago, Transaction.status != "cancelled")
        .group_by(TransactionItem.product_name)
        .order_by(desc("total"))
        .limit(5)
    )
    top_products = [
        {"name": row[0], "total": float(row[1] or 0), "qty": float(row[2] or 0)}
        for row in r.all()
    ]

    return DashboardStats(
        revenue_today=revenue_today,
        revenue_yesterday=revenue_yesterday,
        transactions_today=transactions_today,
        transactions_yesterday=transactions_yesterday,
        stock_total_value=stock_total_value,
        stock_items_count=stock_items_count,
        low_stock_alerts=low_stock,
        expiry_alerts=expiry_alerts,
        profit_today=profit_today,
        profit_week=profit_week,
        avg_basket_today=avg_basket_today,
        payment_breakdown_today=payment_breakdown_today,
        weekly_revenue=weekly_revenue,
        daily_stats=daily_stats,
        recent_transactions=recent_transactions,
        top_products=top_products,
    )
