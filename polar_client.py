"""Thin wrapper around polar-sdk, isolating the webhook verification call."""
from __future__ import annotations

from polar_sdk.webhooks import (
    WebhookUnknownTypeError,
    WebhookVerificationError,
    validate_event,
)

from config import POLAR_WEBHOOK_SECRET

__all__ = ["validate_webhook", "WebhookVerificationError", "WebhookUnknownTypeError"]


def validate_webhook(body: bytes, headers) -> object:
    """Verify the signature and parse a Polar webhook payload.

    Raises WebhookVerificationError on a bad/missing signature, and
    WebhookUnknownTypeError for event types this SDK version doesn't recognize
    (callers should ack those, not treat them as errors).
    """
    return validate_event(body=body, headers=headers, secret=POLAR_WEBHOOK_SECRET)
