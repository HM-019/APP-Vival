from fastapi import APIRouter, HTTPException, Request, status
from app.schemas import LoginRequest, TokenResponse
from app.auth import verify_credentials, create_access_token
from app.redis_client import get_redis

router = APIRouter()

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300  # 5 minutes


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, request: Request):
    ip = request.client.host if request.client else "unknown"
    key = f"login_fail:{ip}"

    redis = await get_redis()

    attempts_raw = await redis.get(key)
    attempts = int(attempts_raw) if attempts_raw else 0

    if attempts >= MAX_ATTEMPTS:
        ttl = await redis.ttl(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives. Réessayez dans {ttl} secondes.",
        )

    if not verify_credentials(body.username, body.password):
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        await pipe.execute()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    await redis.delete(key)
    return TokenResponse(access_token=create_access_token())


@router.post("/verify")
async def verify_token_endpoint(body: dict):
    from app.auth import decode_token
    decode_token(body.get("token", ""))
    return {"valid": True}
