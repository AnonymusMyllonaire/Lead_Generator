"""Central place to load and validate environment configuration."""
from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "")
POLAR_WEBHOOK_SECRET = os.getenv("POLAR_WEBHOOK_SECRET", "")
DATABASE_PATH = os.getenv("DATABASE_PATH", "./data/subscribers.db")

if not JWT_SECRET:
    logging.warning("JWT_SECRET is not set — session tokens will not be secure.")
if not POLAR_WEBHOOK_SECRET:
    logging.warning("POLAR_WEBHOOK_SECRET is not set — webhook signatures cannot be verified.")
