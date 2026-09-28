from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field


# ── Auth ─────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── Product ───────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    barcode: str
    name: str
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    selling_price: Optional[Decimal] = None
    unit: Optional[str] = None
    nutriscore_grade: Optional[str] = None
    nova_group: Optional[int] = None
    ecoscore_grade: Optional[str] = None
    allergens: Optional[str] = None
    labels: Optional[str] = None
    nutrition_per_100g: Optional[str] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    description: Optional[str] = None
    selling_price: Optional[Decimal] = None
    unit: Optional[str] = None

class LotOut(BaseModel):
    id: int
    quantity: int
    purchase_price: Optional[Decimal]
    expiry_date: Optional[date]
    supplier: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class ProductOut(ProductBase):
    id: int
    created_at: datetime
    updated_at: datetime
    lots: List[LotOut] = []
    total_stock: int = 0

    class Config:
        from_attributes = True


# ── Lot ───────────────────────────────────────────────────────────────────────

class LotCreate(BaseModel):
    product_id: int
    quantity: int
    purchase_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None

class LotUpdate(BaseModel):
    quantity: Optional[int] = None
    purchase_price: Optional[Decimal] = None
    expiry_date: Optional[date] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None


# ── Caisse ────────────────────────────────────────────────────────────────────

class CartItem(BaseModel):
    product_id: Optional[int] = None
    product_name: str
    product_barcode: Optional[str] = None
    quantity: Decimal = Field(default=1, gt=0)
    unit_price: Decimal
    is_custom: bool = False

class TransactionCreate(BaseModel):
    items: List[CartItem]
    payment_method: str
    amount_paid: Decimal
    notes: Optional[str] = None
    is_custom_invoice: bool = False

class TransactionItemOut(BaseModel):
    id: int
    product_name: str
    product_barcode: Optional[str]
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal
    is_custom: bool

    class Config:
        from_attributes = True

class TransactionOut(BaseModel):
    id: int
    invoice_number: str
    created_at: datetime
    total: Decimal
    amount_paid: Decimal
    change_given: Decimal
    payment_method: Optional[str]
    status: str
    notes: Optional[str]
    is_custom_invoice: bool
    items: List[TransactionItemOut] = []

    class Config:
        from_attributes = True


# ── Planning ──────────────────────────────────────────────────────────────────

class EmployeeCreate(BaseModel):
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    color: str = "#3B82F6"

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None

class EmployeeOut(BaseModel):
    id: int
    name: str
    role: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    color: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ScheduleCreate(BaseModel):
    employee_id: int
    start_datetime: datetime
    end_datetime: datetime
    notes: Optional[str] = None

class ScheduleOut(BaseModel):
    id: int
    employee_id: int
    start_datetime: datetime
    end_datetime: datetime
    notes: Optional[str]
    created_at: datetime
    employee: EmployeeOut

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    revenue_today: Decimal
    revenue_yesterday: Decimal
    transactions_today: int
    transactions_yesterday: int
    stock_total_value: Decimal
    stock_items_count: int
    low_stock_alerts: int
    expiry_alerts: int
    profit_today: Decimal
    profit_week: Decimal
    avg_basket_today: Decimal
    payment_breakdown_today: dict
    weekly_revenue: List[dict]
    daily_stats: List[dict]
    recent_transactions: List[TransactionOut]
    top_products: List[dict]
