import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import settings
from app.database import engine, Base
from app.routers import auth, products, stock, caisse, planning, dashboard

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

_MIGRATIONS = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS nutriscore_grade VARCHAR(2)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS nova_group INTEGER",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS ecoscore_grade VARCHAR(20)",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS allergens TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS labels TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS nutrition_per_100g TEXT",
    # Widen ecoscore_grade if it was created as VARCHAR(5) by an earlier deployment
    "ALTER TABLE products ALTER COLUMN ecoscore_grade TYPE VARCHAR(20)",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _MIGRATIONS:
            await conn.execute(text(stmt))
    logger.info("OMAR API demarree — tables OK")
    yield
    await engine.dispose()


app = FastAPI(
    title="OMAR — Gestion Stock & Caisse",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url=None,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def timing_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    response.headers["X-Process-Time"] = f"{(time.time() - start):.4f}s"
    return response


app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Produits"])
app.include_router(stock.router, prefix="/api/v1/stock", tags=["Stock"])
app.include_router(caisse.router, prefix="/api/v1/caisse", tags=["Caisse"])
app.include_router(planning.router, prefix="/api/v1/planning", tags=["Planning"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["Dashboard"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "OMAR"}
