import json
import os
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BACKEND_DIR / ".env")


def _csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)

    return [
        value.strip()
        for value in raw.split(",")
        if value.strip()
    ]


def _float_env(name: str, default: str) -> float:
    try:
        return float(os.getenv(name, default))
    except (TypeError, ValueError):
        return float(default)


def _int_env(name: str, default: str) -> int:
    try:
        return int(os.getenv(name, default))
    except (TypeError, ValueError):
        return int(default)


def normalize_supabase_url(url: str) -> str:
    """
    Accept either:

        https://project.supabase.co

    or accidentally supplied:

        https://project.supabase.co/rest/v1/

    and normalize both to the project root.
    """

    value = (url or "").strip().rstrip("/")

    for suffix in (
        "/rest/v1",
        "/auth/v1",
        "/storage/v1",
    ):
        if value.endswith(suffix):
            value = value[: -len(suffix)]

    return value.rstrip("/")


class Settings:
    app_env: str = os.getenv(
        "APP_ENV",
        "development",
    )

    host: str = os.getenv(
        "HOST",
        "127.0.0.1",
    )

    port: int = _int_env(
        "PORT",
        "8000",
    )

    cors_origins: list[str] = _csv_env(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    max_upload_mb: int = _int_env(
        "MAX_UPLOAD_MB",
        "5",
    )

    max_upload_bytes: int = (
        max_upload_mb * 1024 * 1024
    )

    confidence_threshold: float = _float_env(
        "CONFIDENCE_THRESHOLD",
        "0.60",
    )

    margin_threshold: float = _float_env(
        "MARGIN_THRESHOLD",
        "0.20",
    )

    image_size: tuple[int, int] = (
        224,
        224,
    )

    model_paths = {
        "civic_issues": (
            BACKEND_DIR
            / "models"
            / "civic_issues_mobilenetv3.keras"
        ),

        "disasters_accidents": (
            BACKEND_DIR
            / "models"
            / "disasters_accidents_mobilenetv3.keras"
        ),
    }

    class_map_path = (
        BACKEND_DIR
        / "models"
        / "class_names.json"
    )

    supabase_url: str = normalize_supabase_url(
        os.getenv(
            "SUPABASE_URL",
            "",
        )
    )

    supabase_service_role_key: str = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        "",
    )

    report_storage_bucket: str = os.getenv(
        "REPORT_STORAGE_BUCKET",
        "report-images",
    )


settings = Settings()


def load_class_names() -> dict[str, list[str]]:
    try:
        data = json.loads(
            settings.class_map_path.read_text(
                encoding="utf-8"
            )
        )

        if not isinstance(data, dict):
            raise ValueError(
                "class_names.json must be a JSON object."
            )

        return data

    except FileNotFoundError:
        return {}

    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "models/class_names.json contains invalid JSON."
        ) from exc