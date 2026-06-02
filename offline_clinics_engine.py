"""Offline clinic lead generator using OpenStreetMap data.

This script:
1. Geocodes a city in Pakistan to a bounding box using Nominatim.
2. Pulls clinic-like places from the Overpass API inside that box.
3. Filters out any place that has a website tag.
4. Saves the remaining offline clinics to CSV.

This is a free alternative to Google Places and is better suited to a
city-by-city lead workflow when you want clinic names plus contact info.
"""

from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import pandas as pd
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


DEFAULT_CITY = "Lahore"
DEFAULT_COUNTRY = "Pakistan"
DEFAULT_OUTPUT = "offline_clinics_poc.csv"
DEFAULT_MIN_SCORE = 0

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
OVERPASS_INTERPRETER_URL = "https://overpass-api.de/api/interpreter"

REQUEST_TIMEOUT_SECONDS = 30
OVERPASS_TIMEOUT_SECONDS = 240
NOMINATIM_DELAY_SECONDS = 1.1

USER_AGENT = "LeadGeneratorClinicFinder/1.0"


class DataAcquisitionError(RuntimeError):
    """Raised when the geocoder or Overpass API fails."""


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
    )


def build_session() -> requests.Session:
    """Create a requests session with retry support."""

    session = requests.Session()
    retry = Retry(
        total=3,
        connect=3,
        read=3,
        status=3,
        backoff_factor=1.0,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET", "POST"}),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    session.headers.update(
        {
            "User-Agent": USER_AGENT,
            "Accept-Language": "en",
        }
    )
    return session


def request_json(
    session: requests.Session,
    url: str,
    *,
    method: str = "GET",
    params: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    description: str,
) -> Dict[str, Any]:
    """Perform a request and normalize network, HTTP, and JSON errors."""

    try:
        if method.upper() == "GET":
            response = session.get(
                url,
                params=params,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        else:
            response = session.post(
                url,
                params=params,
                data=data,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
    except requests.RequestException as exc:
        raise DataAcquisitionError(f"Network error while fetching {description}: {exc}") from exc

    if not response.ok:
        raise DataAcquisitionError(
            f"HTTP {response.status_code} while fetching {description}: {response.text[:500]}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise DataAcquisitionError(
            f"Non-JSON response while fetching {description}: {response.text[:500]}"
        ) from exc

    if isinstance(payload, dict) and payload.get("error"):
        raise DataAcquisitionError(
            f"API error while fetching {description}: {payload['error']}"
        )

    if isinstance(payload, list):
        return {"items": payload}

    return payload


def normalize_phone_number(raw_value: str) -> str:
    """Return a cleaned phone number string for Pakistan-facing outreach."""

    value = raw_value.strip()
    if not value:
        return ""

    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        return value

    # Normalize obvious Pakistani mobile formats to +92 when possible.
    if digits.startswith("03") and len(digits) == 11:
        return f"+92{digits[1:]}"
    if digits.startswith("92") and len(digits) >= 12:
        return f"+{digits}"
    if digits.startswith("0") and len(digits) >= 10:
        return f"+92{digits[1:]}"

    return value


def geocode_city_bbox(
    session: requests.Session, city: str, country: str
) -> Tuple[float, float, float, float, str]:
    """Resolve a city to a bounding box using Nominatim."""

    query = f"{city}, {country}".strip(", ")
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": 1,
        "addressdetails": 1,
        "countrycodes": "pk" if country.lower() == "pakistan" else None,
    }
    params = {key: value for key, value in params.items() if value is not None}

    payload = request_json(
        session,
        NOMINATIM_SEARCH_URL,
        params=params,
        description=f"Nominatim lookup for {query}",
    )

    results = payload if isinstance(payload, list) else payload.get("items", [])
    if not results:
        raise DataAcquisitionError(
            f"No location found for {query}. Try a different city name."
        )

    best_match = results[0]
    bbox = best_match.get("boundingbox")
    if not bbox or len(bbox) != 4:
        raise DataAcquisitionError(
            f"Nominatim did not return a bounding box for {query}."
        )

    south = float(bbox[0])
    north = float(bbox[1])
    west = float(bbox[2])
    east = float(bbox[3])

    display_name = best_match.get("display_name") or query
    time.sleep(NOMINATIM_DELAY_SECONDS)
    return south, west, north, east, display_name


def build_overpass_query(
    south: float, west: float, north: float, east: float
) -> str:
    """Construct the Overpass QL query for clinic-like healthcare places."""

    bbox = f"{south},{west},{north},{east}"
    return f"""
    [out:json][timeout:{OVERPASS_TIMEOUT_SECONDS}];
    (
      nwr["amenity"="clinic"]({bbox});
      nwr["amenity"="doctors"]({bbox});
      nwr["healthcare"="clinic"]({bbox});
      nwr["healthcare"="doctor"]({bbox});
      nwr["healthcare"="centre"]({bbox});
      nwr["healthcare"="center"]({bbox});
      nwr["healthcare"="dispensary"]({bbox});
    );
    out body center;
    """


def fetch_overpass_places(
    session: requests.Session, query: str
) -> List[Dict[str, Any]]:
    """Fetch place objects from the Overpass API."""

    payload = request_json(
        session,
        OVERPASS_INTERPRETER_URL,
        method="POST",
        data={"data": query},
        description="Overpass clinic search",
    )

    elements = payload.get("elements", [])
    if not isinstance(elements, list):
        raise DataAcquisitionError("Overpass returned an unexpected payload shape.")
    return elements


def has_website(tags: Dict[str, Any]) -> bool:
    """Return True when a place has any website-related tag."""

    website_keys = ("website", "contact:website", "url", "contact:url")
    for key in website_keys:
        value = str(tags.get(key, "") or "").strip()
        if value:
            return True
    return False


def collect_contact_info(tags: Dict[str, Any]) -> Dict[str, str]:
    """Collect phone and email contact data from OSM tags."""

    phone_keys = (
        "contact:phone",
        "phone",
        "contact:mobile",
        "mobile",
        "contact:whatsapp",
        "whatsapp",
    )
    email_keys = ("contact:email", "email")

    phones = [normalize_phone_number(str(tags.get(key, "") or "")) for key in phone_keys]
    emails = [str(tags.get(key, "") or "").strip() for key in email_keys]

    phones = [value for value in phones if value]
    emails = [value for value in emails if value]

    contact_parts = phones + emails

    return {
        "Contact Info": " | ".join(contact_parts),
        "Phone": " | ".join(phones),
        "Email": " | ".join(emails),
    }


def build_address(tags: Dict[str, Any]) -> str:
    """Create a readable address from available OSM address tags."""

    parts: List[str] = []
    full_address = str(tags.get("addr:full", "") or "").strip()
    if full_address:
        return full_address

    for key in (
        "addr:housenumber",
        "addr:street",
        "addr:place",
        "addr:suburb",
        "addr:neighbourhood",
        "addr:city",
        "addr:district",
        "addr:state",
        "addr:postcode",
    ):
        value = str(tags.get(key, "") or "").strip()
        if value and value not in parts:
            parts.append(value)

    return ", ".join(parts)


def get_lat_lon(element: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    """Get a representative point for a node/way/relation."""

    if "lat" in element and "lon" in element:
        return element.get("lat"), element.get("lon")

    center = element.get("center") or {}
    return center.get("lat"), center.get("lon")


def normalize_place(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Normalize a raw OSM element into a CSV row, skipping websites."""

    tags = element.get("tags") or {}
    if not isinstance(tags, dict):
        return None

    if has_website(tags):
        return None

    name = str(tags.get("name", "") or "").strip()
    if not name:
        return None

    latitude, longitude = get_lat_lon(element)
    if latitude is None or longitude is None:
        return None

    contact_info = collect_contact_info(tags)
    category = infer_clinic_category(tags, name)
    score = calculate_offline_score(tags, name, contact_info)
    tier = score_to_tier(score)
    website_status = "No website tag found"

    return {
        "Clinic Name": name,
        "Contact Info": contact_info["Contact Info"],
        "Phone": contact_info["Phone"],
        "Email": contact_info["Email"],
        "Address": build_address(tags),
        "City": str(tags.get("addr:city", "") or "").strip(),
        "Clinic Category": category,
        "Website Status": website_status,
        "Offline Score": score,
        "Lead Tier": tier,
        "Latitude": latitude,
        "Longitude": longitude,
        "OSM Type": element.get("type", ""),
        "OSM ID": element.get("id", ""),
    }


def infer_clinic_category(tags: Dict[str, Any], name: str) -> str:
    """Guess the clinic subtype from tags and the name."""

    name_lower = name.lower()
    healthcare = str(tags.get("healthcare", "") or "").lower()
    amenity = str(tags.get("amenity", "") or "").lower()

    if any(term in name_lower for term in ("pediatric", "paediatric", "children", "child", "peds")):
        return "Pediatric"
    if "dispensary" in name_lower or healthcare == "dispensary":
        return "Dispensary"
    if healthcare == "doctor" or amenity == "doctors":
        return "General Physician"
    if healthcare == "clinic" or amenity == "clinic":
        return "Clinic"
    if healthcare == "centre" or healthcare == "center":
        return "Health Center"
    return "Unknown"


def calculate_offline_score(
    tags: Dict[str, Any], name: str, contact_info: Dict[str, str]
) -> int:
    """Score the lead on how actionable it looks for outreach."""

    score = 0

    # Offline by design because the record has no website tag.
    score += 40

    if contact_info.get("Phone"):
        score += 25
    if contact_info.get("Email"):
        score += 10
    if build_address(tags):
        score += 10

    category = infer_clinic_category(tags, name)
    if category in {"Clinic", "General Physician", "Dispensary", "Pediatric"}:
        score += 10

    if any(term in name.lower() for term in ("clinic", "doctor", "dispensary", "medical", "pediatric", "paediatric")):
        score += 5

    return min(score, 100)


def score_to_tier(score: int) -> str:
    """Map numeric score to a simple lead tier."""

    if score >= 80:
        return "A"
    if score >= 60:
        return "B"
    if score >= 40:
        return "C"
    return "D"


def deduplicate_rows(rows: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicates by OSM type and ID."""

    seen: set[Tuple[Any, Any]] = set()
    unique_rows: List[Dict[str, Any]] = []

    for row in rows:
        key = (row.get("OSM Type"), row.get("OSM ID"))
        if key in seen:
            continue
        seen.add(key)
        unique_rows.append(row)

    return unique_rows


def acquire_offline_clinics(city: str, country: str) -> List[Dict[str, Any]]:
    """Orchestrate city lookup, clinic extraction, and website filtering."""

    with build_session() as session:
        logging.info("Geocoding city: %s, %s", city, country)
        south, west, north, east, display_name = geocode_city_bbox(session, city, country)
        logging.info("City resolved to: %s", display_name)
        logging.info("Searching within bbox: %s", (south, west, north, east))

        overpass_query = build_overpass_query(south, west, north, east)
        elements = fetch_overpass_places(session, overpass_query)
        logging.info("Found %s raw OSM clinic candidates.", len(elements))

    rows = [normalize_place(element) for element in elements]
    rows = [row for row in rows if row is not None]
    rows = deduplicate_rows(rows)
    rows.sort(key=lambda row: (-int(row.get("Offline Score", 0)), row.get("Clinic Name", "")))

    logging.info("Kept %s offline clinics after website filtering.", len(rows))
    return rows


def save_to_csv(rows: List[Dict[str, Any]], output_path: Path) -> pd.DataFrame:
    """Write the final dataset to CSV and return the DataFrame."""

    columns = [
        "Clinic Name",
        "Contact Info",
        "Phone",
        "Email",
        "Address",
        "City",
        "Clinic Category",
        "Website Status",
        "Offline Score",
        "Lead Tier",
        "Latitude",
        "Longitude",
        "OSM Type",
        "OSM ID",
    ]
    dataframe = pd.DataFrame(rows, columns=columns)
    dataframe.to_csv(output_path, index=False, encoding="utf-8")
    return dataframe


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a CSV of offline clinics from OpenStreetMap data."
    )
    parser.add_argument(
        "--city",
        default=DEFAULT_CITY,
        help=f"City to search (default: {DEFAULT_CITY!r})",
    )
    parser.add_argument(
        "--country",
        default=DEFAULT_COUNTRY,
        help=f"Country to search within (default: {DEFAULT_COUNTRY!r})",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help=f"CSV output path (default: {DEFAULT_OUTPUT!r})",
    )
    parser.add_argument(
        "--min-score",
        type=int,
        default=DEFAULT_MIN_SCORE,
        help="Minimum offline score to keep (default: 0, keeps all offline leads).",
    )
    return parser.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    configure_logging()
    args = parse_args(argv)

    try:
        rows = acquire_offline_clinics(args.city, args.country)
        rows = [row for row in rows if int(row.get("Offline Score", 0)) >= args.min_score]
        output_path = Path(args.output).expanduser().resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        dataframe = save_to_csv(rows, output_path)
        logging.info("Saved %s offline clinics to %s", len(dataframe), output_path)
        return 0

    except DataAcquisitionError as exc:
        logging.error(str(exc))
        return 1
    except KeyboardInterrupt:
        logging.warning("Interrupted by user.")
        return 130
    except Exception:
        logging.exception("Unexpected failure while building the clinic dataset.")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
