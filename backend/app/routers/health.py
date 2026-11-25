from fastapi import APIRouter

from app.config import (
    settings,
    load_class_names,
)

from app.services.classifier import (
    MODEL_KEYS,
    model_status,
)


router = APIRouter(
    tags=["Health"]
)


@router.get("/health")
async def health():

    statuses = model_status()

    mappings = load_class_names()

    class_mapping_configured = {}

    for key in MODEL_KEYS:

        labels = mappings.get(
            key
        )

        class_mapping_configured[
            key
        ] = (

            isinstance(
                labels,
                list
            )

            and len(labels) == 6

            and not any(
                str(label).startswith(
                    "UNMAPPED_CLASS_"
                )

                for label in labels
            )
        )

    all_model_files_present = all(
        status[
            "file_present"
        ]

        for status
        in statuses.values()
    )

    supabase_configured = bool(
        settings.supabase_url
        and settings.supabase_service_role_key
    )

    return {

        "status":
            "online",

        "service":
            "PATRIOT AI Backend",

        "version":
            "2.0.0",

        "environment":
            settings.app_env,

        "configuration": {

            "max_upload_mb":
                settings.max_upload_mb,

            "confidence_threshold":
                settings.confidence_threshold,

            "margin_threshold":
                settings.margin_threshold,

            "image_size":
                "224x224 RGB",

            "frontend_origins":
                settings.cors_origins,

            "supabase_configured":
                supabase_configured,

            "storage_bucket":
                settings.report_storage_bucket,
        },

        "models":
            statuses,

        "all_model_files_present":
            all_model_files_present,

        "class_mapping_configured":
            class_mapping_configured,

        "storage_bucket":
            settings.report_storage_bucket,
    }