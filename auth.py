"""JWT-based email session tokens (no passwords — see plan for the accepted tradeoff)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException

from config import JWT_SECRET

_ALGORITHM = "HS256"
_TOKEN_TTL_DAYS = 30


def create_session_token(email: str) -> str:
    payload = {
        "sub": email.strip().lower(),
        "exp": datetime.now(timezone.utc) + timedelta(days=_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=_ALGORITHM)


def _decode(token: str) -> str:
    payload = jwt.decode(token, JWT_SECRET, algorithms=[_ALGORITHM])
    return payload["sub"]


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return authorization[len("Bearer "):].strip() or None


def get_current_email_optional(authorization: str | None = Header(default=None)) -> str | None:
    token = _extract_bearer_token(authorization)
    if not token:
        return None
    try:
        return _decode(token)
    except jwt.PyJWTError:
        return None


def get_current_email_required(authorization: str | None = Header(default=None)) -> str:
    token = _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Missing session token")
    try:
        return _decode(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session token")
