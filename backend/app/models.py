from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Numeric, Boolean,
    DateTime, Date, ForeignKey,
)
from sqlalchemy.orm import relationship
from app.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    barcode = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    brand = Column(String(150))
    category = Column(String(150))
    image_url = Column(Text)
    description = Column(Text)
    selling_price = Column(Numeric(10, 2))
    unit = Column(String(50))
    # Open Food Facts extra data
    nutriscore_grade = Column(String(2))     # a b c d e
    nova_group = Column(Integer)             # 1-4
    ecoscore_grade = Column(String(20))      # a+ a b c d e (OFF may return 'a-plus' etc.)
    allergens = Column(Text)
    labels = Column(Text)                    # bio, fair-trade…
    nutrition_per_100g = Column(Text)        # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lots = relationship("Lot", back_populates="product", cascade="all, delete-orphan")
    transaction_items = relationship("TransactionItem", back_populates="product")


class Lot(Base):
    __tablename__ = "lots"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    purchase_price = Column(Numeric(10, 2))
    expiry_date = Column(Date)
    supplier = Column(String(150))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="lots")
    transaction_items = relationship("TransactionItem", back_populates="lot")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(10, 2), default=0)
    change_given = Column(Numeric(10, 2), default=0)
    payment_method = Column(String(30))
    status = Column(String(20), default="completed")
    notes = Column(Text)
    is_custom_invoice = Column(Boolean, default=False)

    items = relationship("TransactionItem", back_populates="transaction", cascade="all, delete-orphan")


class TransactionItem(Base):
    __tablename__ = "transaction_items"

    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    lot_id = Column(Integer, ForeignKey("lots.id"), nullable=True)
    product_name = Column(String(255), nullable=False)
    product_barcode = Column(String(50))
    quantity = Column(Numeric(10, 3), nullable=False, default=1)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(10, 2), nullable=False)
    is_custom = Column(Boolean, default=False)

    transaction = relationship("Transaction", back_populates="items")
    product = relationship("Product", back_populates="transaction_items")
    lot = relationship("Lot", back_populates="transaction_items")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    role = Column(String(100))
    email = Column(String(255))
    phone = Column(String(30))
    color = Column(String(7), default="#3B82F6")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    schedules = relationship("Schedule", back_populates="employee", cascade="all, delete-orphan")


class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False)
    start_datetime = Column(DateTime, nullable=False)
    end_datetime = Column(DateTime, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    employee = relationship("Employee", back_populates="schedules")
