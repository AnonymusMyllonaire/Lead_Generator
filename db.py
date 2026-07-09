"""Lightweight sqlite persistence for Polar subscription status, keyed by email."""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone

from config import DATABASE_PATH

# Statuses that still grant access. "revoked" and "none" (no row / never subscribed) do not.
_ACTIVE_STATUSES = {"active", "canceled", "past_due", "trialing"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    dirname = os.path.dirname(DATABASE_PATH)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS customers (
                email TEXT PRIMARY KEY,
                polar_customer_id TEXT,
                polar_subscription_id TEXT,
                status TEXT NOT NULL DEFAULT 'none',
                product_id TEXT,
                current_period_end TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def get_customer(email: str) -> dict | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT * FROM customers WHERE email = ?", (_normalize_email(email),)
        ).fetchone()
        return dict(row) if row else None


def create_customer_if_missing(email: str) -> dict:
    email = _normalize_email(email)
    existing = get_customer(email)
    if existing:
        return existing
    now = _now()
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO customers (email, status, created_at, updated_at)
            VALUES (?, 'none', ?, ?)
            """,
            (email, now, now),
        )
    return get_customer(email)


def upsert_subscription(
    email: str,
    *,
    polar_customer_id: str | None = None,
    polar_subscription_id: str | None = None,
    status: str | None = None,
    product_id: str | None = None,
    current_period_end: str | None = None,
) -> None:
    email = _normalize_email(email)
    create_customer_if_missing(email)
    now = _now()
    with _connect() as conn:
        conn.execute(
            """
            UPDATE customers SET
                polar_customer_id = COALESCE(?, polar_customer_id),
                polar_subscription_id = COALESCE(?, polar_subscription_id),
                status = COALESCE(?, status),
                product_id = COALESCE(?, product_id),
                current_period_end = COALESCE(?, current_period_end),
                updated_at = ?
            WHERE email = ?
            """,
            (
                polar_customer_id,
                polar_subscription_id,
                status,
                product_id,
                current_period_end,
                now,
                email,
            ),
        )


def is_subscribed(email: str | None) -> bool:
    if not email:
        return False
    customer = get_customer(email)
    if not customer:
        return False
    return customer["status"] in _ACTIVE_STATUSES
