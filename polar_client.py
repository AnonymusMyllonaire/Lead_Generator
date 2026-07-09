"""Thin wrapper around polar-sdk: webhook verification and checkout session creation."""
from __future__ import annotations

from polar_sdk import Polar
from polar_sdk.webhooks import (
    WebhookUnknownTypeError,
    WebhookVerificationError,
    validate_event,
)

from config import POLAR_ACCESS_TOKEN, POLAR_ENVIRONMENT, POLAR_PRODUCT_ID, POLAR_WEBHOOK_SECRET

__all__ = [
    "validate_webhook",
    "create_checkout",
    "WebhookVerificationError",
    "WebhookUnknownTypeError",
]


def validate_webhook(body: bytes, headers) -> object:
    """Verify the signature and parse a Polar webhook payload.

    Raises WebhookVerificationError on a bad/missing signature, and
    WebhookUnknownTypeError for event types this SDK version doesn't recognize
    (callers should ack those, not treat them as errors).
    """
    return validate_event(body=body, headers=headers, secret=POLAR_WEBHOOK_SECRET)


def create_checkout(email: str, embed_origin: str) -> str:
    """Create a Polar Checkout Session scoped to embed_origin and return its URL.

    A dynamic session (rather than a static Checkout Link) is required for the
    embedded overlay: Polar only allows framing a checkout page from the exact
    origin set here.
    """
    with Polar(access_token=POLAR_ACCESS_TOKEN, server=POLAR_ENVIRONMENT) as polar:
        checkout = polar.checkouts.create(
            request={
                "products": [POLAR_PRODUCT_ID],
                "customer_email": email,
                "embed_origin": embed_origin,
            }
        )
        return checkout.url
