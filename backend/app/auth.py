import hmac
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings

security = HTTPBearer()


def verify_credentials(username: str, password: str) -> bool:
    username_ok = hmac.compare_digest(username.strip(), settings.ADMIN_USERNAME)
    password_ok = hmac.compare_digest(password, settings.ADMIN_PASSWORD)
    return username_ok and password_ok


def create_access_token() -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": settings.ADMIN_USERNAME, "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_auth(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> bool:
    decode_token(credentials.credentials)
    return True
