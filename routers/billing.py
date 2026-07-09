"""Session issuance, subscription status, and the Polar webhook receiver."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

import db
import polar_client
from auth import create_session_token, get_current_email_required

router = APIRouter()

# Event types Polar sends for subscription lifecycle changes. "revoked" always
# forces access off; the rest trust the status embedded in the payload.
_SUBSCRIPTION_EVENT_PREFIX = "subscription."


class SessionRequest(BaseModel):
    email: str = Field(min_length=3, max_length=320)


def _validate_email(email: str) -> str:
    email = email.strip().lower()
    if "@" not in email or " " in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    return email


@router.post("/api/session")
def create_session(request: SessionRequest):
    email = _validate_email(request.email)
    db.create_customer_if_missing(email)
    token = create_session_token(email)
    subscribed = db.is_subscribed(email)
    customer = db.get_customer(email)
    return {
        "token": token,
        "email": email,
        "status": customer["status"] if customer else "none",
        "subscribed": subscribed,
    }


@router.post("/api/checkout")
def create_checkout(request: SessionRequest, http_request: Request):
    email = _validate_email(request.email)
    origin = http_request.headers.get("origin")
    if not origin:
        raise HTTPException(status_code=400, detail="Missing Origin header")
    try:
        url = polar_client.create_checkout(email, embed_origin=origin)
    except Exception:
        logging.exception("Failed to create Polar checkout session")
        raise HTTPException(status_code=502, detail="Could not start checkout")
    return {"url": url}


@router.get("/api/subscription/status")
def subscription_status(email: str = Depends(get_current_email_required)):
    customer = db.get_customer(email)
    return {
        "email": email,
        "status": customer["status"] if customer else "none",
        "subscribed": db.is_subscribed(email),
        "current_period_end": customer["current_period_end"] if customer else None,
    }


@router.post("/api/webhooks/polar")
async def polar_webhook(request: Request):
    body = await request.body()
    try:
        event = polar_client.validate_webhook(body, request.headers)
    except polar_client.WebhookVerificationError:
        raise HTTPException(status_code=403, detail="Invalid webhook signature")
    except polar_client.WebhookUnknownTypeError:
        return {"status": "ignored"}

    if not event.type.startswith(_SUBSCRIPTION_EVENT_PREFIX):
        return {"status": "ignored"}

    subscription = event.data
    customer = getattr(subscription, "customer", None)
    email = getattr(customer, "email", None)
    if not email:
        logging.warning("Polar webhook %s had no customer email; skipping", event.type)
        return {"status": "ignored"}

    status = "revoked" if event.type == "subscription.revoked" else getattr(subscription, "status", None)
    current_period_end = getattr(subscription, "current_period_end", None)

    db.upsert_subscription(
        email,
        polar_customer_id=getattr(subscription, "customer_id", None),
        polar_subscription_id=getattr(subscription, "id", None),
        status=status,
        product_id=getattr(subscription, "product_id", None),
        current_period_end=current_period_end.isoformat() if current_period_end else None,
    )
    return {"status": "ok"}
