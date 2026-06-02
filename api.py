"""FastAPI backend that exposes the offline_clinics_engine as a REST API."""
from __future__ import annotations

import csv
import io
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from offline_clinics_engine import (
    DataAcquisitionError,
    acquire_offline_clinics,
    configure_logging,
)

configure_logging()

app = FastAPI(title="Lead Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


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
def scrape(request: ScrapeRequest):
    try:
        rows = acquire_offline_clinics(request.city, request.country)
        rows = [r for r in rows if int(r.get("Offline Score", 0)) >= request.min_score]
        return {"leads": rows, "total": len(rows), "stats": _compute_stats(rows)}
    except DataAcquisitionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logging.exception("Unexpected error in /api/scrape")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {exc}")


@app.post("/api/download")
def download(request: ScrapeRequest):
    """Re-run the scrape and return results as a CSV file download."""
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
