import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import httpx

from app.database import get_db
from app.models import Product, Lot
from app.schemas import ProductCreate, ProductUpdate, ProductOut
from app.auth import require_auth

router = APIRouter()

OFF_URL = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"

_NUTRITION_KEYS = [
    "energy-kcal_100g", "fat_100g", "saturated-fat_100g",
    "carbohydrates_100g", "sugars_100g", "fiber_100g",
    "proteins_100g", "salt_100g",
]


async def fetch_from_openfoodfacts(barcode: str) -> dict:
    async with httpx.AsyncClient(timeout=8.0) as client:
        try:
            r = await client.get(OFF_URL.format(barcode=barcode))
            if r.status_code != 200:
                return {}
            data = r.json()
            if data.get("status") != 1:
                return {}
            p = data["product"]

            nutriments = p.get("nutriments", {})
            nutrition = {k: nutriments[k] for k in _NUTRITION_KEYS if k in nutriments and nutriments[k] is not None}

            cats = p.get("categories_tags", [])
            category = None
            if cats:
                cat = cats[0]
                category = cat.replace("en:", "").replace("fr:", "").replace("-", " ").capitalize()

            return {
                "barcode": barcode,
                "name": (p.get("product_name_fr") or p.get("product_name") or p.get("generic_name") or "Produit inconnu").strip(),
                "brand": p.get("brands"),
                "category": category,
                "image_url": p.get("image_front_url") or p.get("image_url"),
                "description": p.get("ingredients_text_fr") or p.get("ingredients_text"),
                "unit": p.get("quantity"),
                "nutriscore_grade": p.get("nutriscore_grade") or p.get("nutrition_grade_fr"),
                "nova_group": p.get("nova_group"),
                "ecoscore_grade": p.get("ecoscore_grade"),
                "allergens": p.get("allergens_from_ingredients") or p.get("allergens") or None,
                "labels": p.get("labels") or None,
                "nutrition_per_100g": json.dumps(nutrition) if nutrition else None,
            }
        except Exception:
            return {}


@router.get("/scan/{barcode}", response_model=ProductOut)
async def scan_product(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Product)
        .where(Product.barcode == barcode)
        .options(selectinload(Product.lots))
    )
    product = result.scalar_one_or_none()

    if product is None:
        external = await fetch_from_openfoodfacts(barcode)
        if not external:
            raise HTTPException(status_code=404, detail="Produit introuvable")
        product = Product(**external)
        db.add(product)
        await db.flush()
        await db.refresh(product)
        result2 = await db.execute(
            select(Product).where(Product.id == product.id).options(selectinload(Product.lots))
        )
        product = result2.scalar_one()

    total_stock = sum(lot.quantity for lot in product.lots)
    out = ProductOut.model_validate(product)
    out.total_stock = total_stock
    return out


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(selectinload(Product.lots))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    out = ProductOut.model_validate(product)
    out.total_stock = sum(lot.quantity for lot in product.lots)
    return out


@router.get("/", response_model=list[ProductOut])
async def list_products(
    search: str = "",
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    q = select(Product).options(selectinload(Product.lots))
    if search:
        q = q.where(
            Product.name.ilike(f"%{search}%") |
            Product.barcode.ilike(f"%{search}%") |
            Product.brand.ilike(f"%{search}%")
        )
    q = q.offset(skip).limit(limit).order_by(Product.name)
    result = await db.execute(q)
    products = result.scalars().all()
    out = []
    for p in products:
        po = ProductOut.model_validate(p)
        po.total_stock = sum(lot.quantity for lot in p.lots)
        out.append(po)
    return out


@router.post("/", response_model=ProductOut)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    existing = await db.execute(select(Product).where(Product.barcode == body.barcode))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Code-barre déjà enregistré")
    product = Product(**body.model_dump())
    db.add(product)
    await db.flush()
    result = await db.execute(
        select(Product).where(Product.id == product.id).options(selectinload(Product.lots))
    )
    return ProductOut.model_validate(result.scalar_one())


@router.delete("/{product_id}")
async def delete_product(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(selectinload(Product.lots))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    await db.delete(product)
    return {"ok": True}


@router.patch("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: int,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(require_auth),
):
    result = await db.execute(
        select(Product).where(Product.id == product_id).options(selectinload(Product.lots))
    )
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(product, k, v)
    out = ProductOut.model_validate(product)
    out.total_stock = sum(lot.quantity for lot in product.lots)
    return out
