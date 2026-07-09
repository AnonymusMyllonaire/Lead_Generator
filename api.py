"""FastAPI backend that exposes the offline_clinics_engine as a REST API."""
from __future__ import annotations

import csv
import io
import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

import db
from auth import get_current_email_optional
from offline_clinics_engine import (
    DataAcquisitionError,
    acquire_offline_clinics,
    configure_logging,
)
from routers import billing

configure_logging()
db.init_db()

# Unsubscribed callers only get a preview of the results; full data still gets
# computed so stats/counts stay accurate, but leads beyond this are withheld.
PREVIEW_LEAD_COUNT = 5

app = FastAPI(title="Lead Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(billing.router)


class ScrapeRequest(BaseModel):
    city: str = Field(default="Lahore", min_length=1)
    country: str = Field(default="Pakistan", min_length=1)
    min_score: int = Field(default=0, ge=0, le=100)


def _compute_stats(rows: list) -> dict:
    tier_counts: dict = {"A": 0, "B": 0, "C": 0, "D": 0}
    category_counts: dict = {}
    for row in rows:
        tier = row.get("Lead Tier", "D")
        if tier in tier_counts:
            tier_counts[tier] += 1
        cat = row.get("Clinic Category", "Unknown")
        category_counts[cat] = category_counts.get(cat, 0) + 1
    return {"tiers": tier_counts, "categories": category_counts}


@app.post("/api/scrape")
def scrape(request: ScrapeRequest, current_email: str | None = Depends(get_current_email_optional)):
    try:
        rows = acquire_offline_clinics(request.city, request.country)
        rows = [r for r in rows if int(r.get("Offline Score", 0)) >= request.min_score]
        subscribed = db.is_subscribed(current_email)
        stats = _compute_stats(rows)
        if subscribed:
            return {"leads": rows, "total": len(rows), "stats": stats, "subscribed": True, "locked_count": 0}
        preview = rows[:PREVIEW_LEAD_COUNT]
        return {
            "leads": preview,
            "total": len(rows),
            "stats": stats,
            "subscribed": False,
            "locked_count": max(0, len(rows) - len(preview)),
        }
    except DataAcquisitionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logging.exception("Unexpected error in /api/scrape")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")


@app.post("/api/download")
def download(request: ScrapeRequest, current_email: str | None = Depends(get_current_email_optional)):
    """Re-run the scrape and return results as a CSV file download."""
    if not db.is_subscribed(current_email):
        raise HTTPException(status_code=402, detail="Subscription required to download full results")
    try:
        rows = acquire_offline_clinics(request.city, request.country)
        rows = [r for r in rows if int(r.get("Offline Score", 0)) >= request.min_score]
        if not rows:
            raise HTTPException(status_code=404, detail="No leads found for these parameters.")

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
        output.seek(0)

        city_slug = request.city.lower().replace(" ", "_")
        filename = f"leads_{city_slug}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )
    except HTTPException:
        raise
    except DataAcquisitionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logging.exception("Unexpected error in /api/download")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")
