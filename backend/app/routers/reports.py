# backend/app/routers/reports.py

from __future__ import annotations

import inspect
import json
import logging
import os
import uuid
from io import BytesIO
from typing import Any, Optional
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.services.classifier import predict_both


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/api",
    tags=["Reports"],
)

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)


# ============================================================
# CONFIG HELPERS
# ============================================================

def _service_role_key() -> str:
    """
    Supports both lowercase and uppercase settings names.
    """
    value = getattr(settings, "supabase_service_role_key", None)

    if not value:
        value = getattr(settings, "SUPABASE_SERVICE_ROLE_KEY", None)

    if not value:
        value = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not value:
        raise HTTPException(
            status_code=500,
            detail="Supabase service role key is not configured.",
        )

    return value.strip()


def _supabase_url() -> str:
    """
    Returns the Supabase project URL without REST/storage suffixes.
    """
    value = getattr(settings, "supabase_url", None)

    if not value:
        value = getattr(settings, "SUPABASE_URL", None)

    if not value:
        value = os.getenv("SUPABASE_URL")

    if not value:
        raise HTTPException(
            status_code=500,
            detail="Supabase URL is not configured.",
        )

    value = value.strip().rstrip("/")

    value = value.replace("/rest/v1", "")
    value = value.replace("/storage/v1", "")

    return value.rstrip("/")


def _storage_bucket() -> str:
    value = getattr(settings, "report_storage_bucket", None)

    if not value:
        value = getattr(settings, "REPORT_STORAGE_BUCKET", None)

    if not value:
        value = os.getenv(
            "REPORT_STORAGE_BUCKET",
            "report-images",
        )

    return value.strip()


def _max_upload_bytes() -> int:
    value = getattr(settings, "max_upload_mb", None)

    if value is None:
        value = getattr(settings, "MAX_UPLOAD_MB", None)

    if value is None:
        value = os.getenv("MAX_UPLOAD_MB", "5")

    try:
        mb = float(value)
    except Exception:
        mb = 5.0

    return int(mb * 1024 * 1024)


def _confidence_threshold() -> float:
    value = getattr(settings, "confidence_threshold", None)

    if value is None:
        value = getattr(settings, "CONFIDENCE_THRESHOLD", None)

    if value is None:
        value = os.getenv("CONFIDENCE_THRESHOLD", "0.60")

    try:
        return float(value)
    except Exception:
        return 0.60


def _margin_threshold() -> float:
    value = getattr(settings, "margin_threshold", None)

    if value is None:
        value = getattr(settings, "MARGIN_THRESHOLD", None)

    if value is None:
        value = os.getenv("MARGIN_THRESHOLD", "0.20")

    try:
        return float(value)
    except Exception:
        return 0.20


# ============================================================
# SUPABASE HEADERS
# ============================================================

def _service_headers() -> dict[str, str]:
    key = _service_role_key()

    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _user_headers(access_token: str) -> dict[str, str]:
    return {
        "apikey": _service_role_key(),
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }


# ============================================================
# BASIC HELPERS
# ============================================================

def _normalize(value: Any) -> Optional[str]:
    if value is None:
        return None

    value = str(value).strip()

    return value if value else None


def _json_safe(value: Any) -> Any:
    """
    Makes prediction objects safe for JSON/PostgreSQL JSONB.
    """
    try:
        json.dumps(value)
        return value
    except Exception:
        try:
            return json.loads(json.dumps(value, default=str))
        except Exception:
            return str(value)


# ============================================================
# AUTHENTICATION
# ============================================================

async def _get_current_user(
    credentials: HTTPAuthorizationCredentials | None,
) -> dict[str, Any]:

    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )

    access_token = credentials.credentials

    url = f"{_supabase_url()}/auth/v1/user"

    headers = _user_headers(access_token)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers=headers,
            )
    except httpx.RequestError as exc:
        logger.exception("Supabase auth request failed.")

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase authentication.",
        ) from exc

    if response.status_code != 200:
        logger.error(
            "Supabase authentication failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session.",
        )

    try:
        user = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Supabase returned an invalid authentication response.",
        ) from exc

    if not user or not user.get("id"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to identify the authenticated user.",
        )

    return user


# ============================================================
# PROFILE
# ============================================================

async def _get_profile(user_id: str) -> dict[str, Any]:

    url = (
        f"{_supabase_url()}/rest/v1/profiles"
        f"?select=id,display_name,phone,role"
        f"&id=eq.{quote(user_id, safe='')}"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                url,
                headers=_service_headers(),
            )
    except httpx.RequestError as exc:
        logger.exception("Profile lookup request failed.")

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase profiles.",
        ) from exc

    if response.status_code != 200:
        logger.error(
            "Profile lookup failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=f"Profile lookup failed: {response.text}",
        )

    try:
        rows = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Supabase returned an invalid profile response.",
        ) from exc

    if not rows:
        raise HTTPException(
            status_code=403,
            detail="Your user profile was not found.",
        )

    return rows[0]


# ============================================================
# AI DEPARTMENT EXTRACTION
# ============================================================

def _department_name_from_ai(predictions: Any) -> Optional[str]:

    if not isinstance(predictions, dict):
        return None

    # Direct possible fields
    direct_keys = [
        "suggested_department",
        "department",
        "recommended_department",
        "department_name",
    ]

    for key in direct_keys:
        value = predictions.get(key)

        if isinstance(value, str) and value.strip():
            return value.strip()

    # Search inside model results
    for key, value in predictions.items():

        if isinstance(value, dict):

            for nested_key in direct_keys:
                nested_value = value.get(nested_key)

                if isinstance(nested_value, str) and nested_value.strip():
                    return nested_value.strip()

            result = _department_name_from_ai(value)

            if result:
                return result

        elif isinstance(value, list):

            for item in value:
                result = _department_name_from_ai(item)

                if result:
                    return result

    return None


# ============================================================
# DEPARTMENT MAPPING
# ============================================================

DEPARTMENT_ALIASES = {
    "fire": "Fire & Rescue",
    "fire and rescue": "Fire & Rescue",
    "fire rescue": "Fire & Rescue",
    "fire department": "Fire & Rescue",

    "water": "Water & Drainage",
    "water drainage": "Water & Drainage",
    "water & drainage": "Water & Drainage",
    "drainage": "Water & Drainage",

    "sanitation": "Municipality & Sanitation",
    "municipality": "Municipality & Sanitation",
    "municipality sanitation": "Municipality & Sanitation",
    "garbage": "Municipality & Sanitation",
    "waste": "Municipality & Sanitation",

    "medical": "Medical Emergency Services",
    "medical emergency": "Medical Emergency Services",
    "ambulance": "Medical Emergency Services",
    "health": "Medical Emergency Services",

    "roads": "Roads & Public Works",
    "road": "Roads & Public Works",
    "public works": "Roads & Public Works",
    "potholes": "Roads & Public Works",

    "electricity": "Electricity Department",
    "electric": "Electricity Department",
    "streetlight": "Electricity Department",
    "street light": "Electricity Department",

    "police": "Police & Traffic",
    "traffic": "Police & Traffic",
    "police traffic": "Police & Traffic",

    "disaster": "Disaster Management",
    "disaster management": "Disaster Management",
    "landslide": "Disaster Management",
}


async def _find_department(
    ai_department: Optional[str],
) -> Optional[str]:

    if not ai_department:
        return None

    normalized = ai_department.strip().lower()

    target_name = DEPARTMENT_ALIASES.get(
        normalized,
        ai_department.strip(),
    )

    # Exact name lookup
    exact_url = (
        f"{_supabase_url()}/rest/v1/departments"
        f"?select=id,name,category"
        f"&name=eq.{quote(target_name, safe='')}"
        f"&limit=1"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                exact_url,
                headers=_service_headers(),
            )
    except httpx.RequestError as exc:
        logger.exception("Department lookup failed.")

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase departments.",
        ) from exc

    if response.status_code == 200:
        rows = response.json()

        if rows:
            return rows[0]["id"]

    # Fallback: get all departments and compare normalized names
    all_url = (
        f"{_supabase_url()}/rest/v1/departments"
        f"?select=id,name,category"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                all_url,
                headers=_service_headers(),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve departments.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Department lookup failed: {response.text}",
        )

    rows = response.json()

    for row in rows:

        name = str(row.get("name", "")).strip().lower()

        if name == normalized or name == target_name.lower():
            return row["id"]

    # Partial matching
    for row in rows:

        name = str(row.get("name", "")).strip().lower()

        if normalized in name or name in normalized:
            return row["id"]

    return None


# ============================================================
# AI PREDICTION
# ============================================================

def _run_predict_both(image: Image.Image) -> dict[str, Any]:

    """
    Calls the existing synchronous predict_both() service.

    IMPORTANT:
    Do NOT use await here because the current classifier
    returns a normal Python dictionary.
    """

    try:
        signature = inspect.signature(predict_both)

        parameter_names = list(signature.parameters.keys())

        if parameter_names:
            first_parameter = parameter_names[0]

            # Common form:
            # predict_both(image)
            if first_parameter in {"image", "img", "pil_image"}:
                result = predict_both(image)

            else:
                # Alternative keyword form
                try:
                    result = predict_both(
                        image=image,
                        model="both",
                    )
                except TypeError:
                    result = predict_both(image)

        else:
            result = predict_both(image)

    except TypeError:
        # Fallback for different classifier signatures
        try:
            result = predict_both(
                image=image,
                model="both",
            )
        except TypeError:
            result = predict_both(image)

    except Exception as exc:
        logger.exception("AI prediction failed.")

        raise HTTPException(
            status_code=500,
            detail=f"AI prediction failed: {str(exc)}",
        ) from exc

    if inspect.isawaitable(result):
        raise HTTPException(
            status_code=500,
            detail=(
                "Classifier returned an asynchronous result unexpectedly. "
                "Please verify app.services.classifier.predict_both."
            ),
        )

    if not isinstance(result, dict):
        raise HTTPException(
            status_code=500,
            detail="AI classifier returned an invalid prediction format.",
        )

    return _json_safe(result)


# ============================================================
# IMAGE STORAGE
# ============================================================

async def _upload_image(
    image_bytes: bytes,
    content_type: str,
    user_id: str,
) -> str:

    bucket = _storage_bucket()

    extension = "jpg"

    content_type_lower = (
        content_type or ""
    ).lower()

    if "png" in content_type_lower:
        extension = "png"
    elif "webp" in content_type_lower:
        extension = "webp"
    elif "jpeg" in content_type_lower or "jpg" in content_type_lower:
        extension = "jpg"

    filename = (
        f"{uuid.uuid4().hex}.{extension}"
    )

    storage_path = (
        f"citizens/{user_id}/{filename}"
    )

    encoded_path = quote(
        storage_path,
        safe="/",
    )

    url = (
        f"{_supabase_url()}/storage/v1/object/"
        f"{quote(bucket, safe='')}/{encoded_path}"
    )

    headers = _service_headers()

    headers["Content-Type"] = (
        content_type or "image/jpeg"
    )

    headers["x-upsert"] = "false"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                url,
                headers=headers,
                content=image_bytes,
            )
    except httpx.RequestError as exc:
        logger.exception("Image upload request failed.")

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase Storage.",
        ) from exc

    if response.status_code not in (200, 201):
        logger.error(
            "Image upload failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=f"Image upload failed: {response.text}",
        )

    return storage_path


# ============================================================
# DELETE IMAGE
# ============================================================

async def _delete_image(
    image_path: Optional[str],
) -> None:

    if not image_path:
        return

    bucket = _storage_bucket()

    url = (
        f"{_supabase_url()}/storage/v1/object/"
        f"{quote(bucket, safe='')}"
    )

    headers = _service_headers()

    payload = {
        "prefixes": [image_path],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.request(
                "DELETE",
                url,
                headers=headers,
                json=payload,
            )

        if response.status_code not in (200, 204):
            logger.warning(
                "Could not delete uploaded image %s: %s",
                image_path,
                response.text,
            )

    except Exception:
        logger.exception(
            "Failed to delete image after report insertion failure."
        )


# ============================================================
# INSERT REPORT
# ============================================================

async def _insert_report(
    report_payload: dict[str, Any],
) -> dict[str, Any]:

    url = (
        f"{_supabase_url()}/rest/v1/reports"
    )

    headers = _service_headers()

    headers["Prefer"] = "return=representation"

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                url,
                headers=headers,
                json=report_payload,
            )
    except httpx.RequestError as exc:
        logger.exception("Report insertion request failed.")

        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase reports.",
        ) from exc

    if response.status_code not in (200, 201):
        logger.error(
            "Report insertion failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=f"Report insertion failed: {response.text}",
        )

    try:
        rows = response.json()
    except Exception:
        rows = []

    if isinstance(rows, list) and rows:
        return rows[0]

    if isinstance(rows, dict):
        return rows

    return report_payload


# ============================================================
# CITIZEN REPORT SUBMISSION
# ============================================================

@router.post("/submit")
async def submit_citizen_report(
    description: str = Form(...),
    priority: str = Form(...),
    address: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Complete citizen report workflow:

    1. Authenticate citizen
    2. Validate profile
    3. Validate report data
    4. Read and validate image
    5. Run both AI models
    6. Determine department
    7. Upload image to Supabase Storage
    8. Insert report into PostgreSQL
    9. Return saved report
    """

    # --------------------------------------------------------
    # 1. AUTHENTICATION
    # --------------------------------------------------------

    user = await _get_current_user(credentials)

    user_id = user["id"]

    # --------------------------------------------------------
    # 2. PROFILE
    # --------------------------------------------------------

    profile = await _get_profile(user_id)

    role = str(
        profile.get("role", "")
    ).strip().lower()

    if role != "citizen":
        raise HTTPException(
            status_code=403,
            detail="Only citizen accounts can submit reports.",
        )

    # --------------------------------------------------------
    # 3. VALIDATE DESCRIPTION
    # --------------------------------------------------------

    description = (description or "").strip()

    if len(description) < 10:
        raise HTTPException(
            status_code=400,
            detail="Description must contain at least 10 characters.",
        )

    if len(description) > 3000:
        raise HTTPException(
            status_code=400,
            detail="Description cannot exceed 3000 characters.",
        )

    # --------------------------------------------------------
    # 4. NORMALIZE PRIORITY
    # --------------------------------------------------------

    # --------------------------------------------------------
# 4. NORMALIZE PRIORITY FOR DATABASE
# --------------------------------------------------------

    # --------------------------------------------------------
    # 4. NORMALIZE PRIORITY FOR DATABASE
    # --------------------------------------------------------

    raw_priority = (priority or "").strip().lower()

    priority_map = {
        "low": "normal",
        "medium": "normal",
        "normal": "normal",
        "high": "high",
        "urgent": "urgent",
    }

    priority = priority_map.get(raw_priority)

    if priority is None:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid priority. "
                "Allowed values are low, medium, high and urgent."
            ),
        )

    # --------------------------------------------------------
    # 5. NORMALIZE LOCATION
    # --------------------------------------------------------

    address = _normalize(address)

    # --------------------------------------------------------
    # VARIABLES USED THROUGHOUT THE WORKFLOW
    # --------------------------------------------------------

    image_bytes: Optional[bytes] = None
    image_path: Optional[str] = None
    predictions: dict[str, Any] = {}

    # --------------------------------------------------------
    # 6. IMAGE PROCESSING + AI
    # --------------------------------------------------------

    if file is not None:

        # Read uploaded file.
        #
        # IMPORTANT:
        # This await is INSIDE the async submit function.
        #
        image_bytes = await file.read()

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty.",
            )

        # Maximum file size
        if len(image_bytes) > _max_upload_bytes():
            max_mb = _max_upload_bytes() / (
                1024 * 1024
            )

            raise HTTPException(
                status_code=400,
                detail=(
                    f"Image is too large. "
                    f"Maximum allowed size is {max_mb:.1f} MB."
                ),
            )

        # Decode image
        try:
            pil_image = Image.open(
                BytesIO(image_bytes)
            )

            # Force actual image loading
            pil_image.load()

            # Convert to RGB because the AI model expects RGB
            pil_image = pil_image.convert("RGB")

        except (UnidentifiedImageError, OSError) as exc:

            raise HTTPException(
                status_code=400,
                detail="The uploaded file is not a valid image.",
            ) from exc

        # ----------------------------------------------------
        # RUN BOTH AI MODELS
        # ----------------------------------------------------

        predictions = _run_predict_both(
            pil_image
        )

    # --------------------------------------------------------
    # 7. DETERMINE DEPARTMENT
    # --------------------------------------------------------

    ai_department = _department_name_from_ai(
        predictions
    )

    department_id = await _find_department(
        ai_department
    )

    # --------------------------------------------------------
    # 8. UPLOAD IMAGE
    # --------------------------------------------------------

    if image_bytes is not None:

        content_type = (
            file.content_type
            if file is not None
            else "image/jpeg"
        )

        image_path = await _upload_image(
            image_bytes=image_bytes,
            content_type=content_type,
            user_id=user_id,
        )

    # --------------------------------------------------------
    # 9. CREATE DATABASE REPORT
    # --------------------------------------------------------

    report_payload = {
        "citizen_id": user_id,
        "department_id": department_id,
        "description": description,
        "image_path": image_path,
        "address": address,
        "latitude": latitude,
        "longitude": longitude,

        # IMPORTANT:
        # Database constraint is handled using uppercase values.
        "priority": priority,

        "status": "submitted",

        # AI result stored in JSONB
        "ai_result": predictions,
    }

    # --------------------------------------------------------
    # 10. INSERT REPORT
    # --------------------------------------------------------

    try:

        report = await _insert_report(
            report_payload
        )

    except HTTPException:

        # If database insertion fails after image upload,
        # remove the uploaded image to avoid orphan files.
        if image_path:
            await _delete_image(
                image_path
            )

        raise

    # --------------------------------------------------------
    # 11. SUCCESS RESPONSE
    # --------------------------------------------------------

    return {
        "success": True,
        "message": "Citizen report submitted successfully.",
        "report": report,
        "ai": predictions,
        "department": {
            "id": department_id,
            "name": ai_department,
        },
    }


# ============================================================
# ADMIN REPORTS
# ============================================================

@router.get("/admin/reports")
async def get_admin_reports(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Returns all reports for the admin dashboard.
    """

    user = await _get_current_user(credentials)

    user_id = user["id"]

    profile = await _get_profile(user_id)

    role = str(
        profile.get("role", "")
    ).strip().lower()

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    # --------------------------------------------------------
    # GET REPORTS
    # --------------------------------------------------------

    reports_url = (
        f"{_supabase_url()}/rest/v1/reports"
        f"?select=*"
        f"&order=created_at.desc"
    )

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(
                reports_url,
                headers=_service_headers(),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to Supabase reports.",
        ) from exc

    if response.status_code != 200:

        logger.error(
            "Admin reports lookup failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=f"Admin reports lookup failed: {response.text}",
        )

    try:
        reports = response.json()
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Supabase returned an invalid reports response.",
        ) from exc

    if not isinstance(reports, list):
        reports = []

    # --------------------------------------------------------
    # ENRICH CITIZEN INFORMATION
    # --------------------------------------------------------

    citizen_ids = {
        report.get("citizen_id")
        for report in reports
        if report.get("citizen_id")
    }

    department_ids = {
        report.get("department_id")
        for report in reports
        if report.get("department_id")
    }

    citizen_map: dict[str, dict[str, Any]] = {}
    department_map: dict[str, dict[str, Any]] = {}

    # --------------------------------------------------------
    # CITIZENS
    # --------------------------------------------------------

    for citizen_id in citizen_ids:

        url = (
            f"{_supabase_url()}/rest/v1/profiles"
            f"?select=id,display_name,phone,role"
            f"&id=eq.{quote(str(citizen_id), safe='')}"
            f"&limit=1"
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    url,
                    headers=_service_headers(),
                )

            if response.status_code == 200:

                rows = response.json()

                if rows:
                    citizen_map[
                        str(citizen_id)
                    ] = rows[0]

        except Exception:
            logger.exception(
                "Could not retrieve citizen profile %s",
                citizen_id,
            )

    # --------------------------------------------------------
    # DEPARTMENTS
    # --------------------------------------------------------

    for department_id in department_ids:

        url = (
            f"{_supabase_url()}/rest/v1/departments"
            f"?select=id,name,category"
            f"&id=eq.{quote(str(department_id), safe='')}"
            f"&limit=1"
        )

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    url,
                    headers=_service_headers(),
                )

            if response.status_code == 200:

                rows = response.json()

                if rows:
                    department_map[
                        str(department_id)
                    ] = rows[0]

        except Exception:
            logger.exception(
                "Could not retrieve department %s",
                department_id,
            )

    # --------------------------------------------------------
    # BUILD ADMIN RESPONSE
    # --------------------------------------------------------

    enriched_reports = []

    for report in reports:

        citizen_id = report.get(
            "citizen_id"
        )

        department_id = report.get(
            "department_id"
        )

        report_copy = dict(report)

        report_copy["citizen"] = (
            citizen_map.get(
                str(citizen_id)
            )
            if citizen_id
            else None
        )

        report_copy["department"] = (
            department_map.get(
                str(department_id)
            )
            if department_id
            else None
        )

        enriched_reports.append(
            report_copy
        )

    return {
        "success": True,
        "count": len(enriched_reports),
        "reports": enriched_reports,
    }


# ============================================================
# ADMIN IMAGE SIGNED URL
# ============================================================

@router.get("/admin/reports/{report_id}/image-url")
async def get_admin_report_image_url(
    report_id: str,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    """
    Creates a temporary signed URL for a report image.
    """

    user = await _get_current_user(credentials)

    profile = await _get_profile(
        user["id"]
    )

    role = str(
        profile.get("role", "")
    ).strip().lower()

    if role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required.",
        )

    # --------------------------------------------------------
    # GET REPORT
    # --------------------------------------------------------

    report_url = (
        f"{_supabase_url()}/rest/v1/reports"
        f"?select=id,image_path"
        f"&id=eq.{quote(report_id, safe='')}"
        f"&limit=1"
    )

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                report_url,
                headers=_service_headers(),
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to retrieve report.",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Report lookup failed: {response.text}",
        )

    rows = response.json()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Report not found.",
        )

    image_path = rows[0].get(
        "image_path"
    )

    if not image_path:
        raise HTTPException(
            status_code=404,
            detail="This report does not contain an image.",
        )

    # --------------------------------------------------------
    # CREATE SIGNED URL
    # --------------------------------------------------------

    bucket = _storage_bucket()

    encoded_path = quote(
        image_path,
        safe="/",
    )

    sign_url = (
        f"{_supabase_url()}/storage/v1/object/sign/"
        f"{quote(bucket, safe='')}/{encoded_path}"
    )

    payload = {
        "expiresIn": 3600
    }

    headers = _service_headers()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                sign_url,
                headers=headers,
                json=payload,
            )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=502,
            detail="Unable to create signed image URL.",
        ) from exc

    if response.status_code not in (200, 201):
        logger.error(
            "Signed URL creation failed: %s %s",
            response.status_code,
            response.text,
        )

        raise HTTPException(
            status_code=502,
            detail=f"Signed URL creation failed: {response.text}",
        )

    result = response.json()

    signed_path = (
        result.get("signedURL")
        or result.get("signedUrl")
        or result.get("signed_url")
    )

    if not signed_path:
        raise HTTPException(
            status_code=502,
            detail="Supabase did not return a signed image URL.",
        )

    # Supabase sometimes returns a relative path
    if signed_path.startswith("/"):
        signed_url = (
            f"{_supabase_url()}"
            f"{signed_path}"
        )
    else:
        signed_url = signed_path

    return {
        "success": True,
        "report_id": report_id,
        "image_url": signed_url,
        "expires_in": 3600,
    }