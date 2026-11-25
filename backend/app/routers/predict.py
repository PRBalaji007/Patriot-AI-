from io import BytesIO

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    UploadFile,
)

from PIL import (
    Image,
    ImageOps,
    UnidentifiedImageError,
)

from app.config import settings
from app.services.classifier import (
    MODEL_KEYS,
    predict_one,
)


router = APIRouter(
    tags=["AI Classification"]
)


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


# ---------------------------------------------------------
# CANDIDATE
# ---------------------------------------------------------

def build_candidate(
    prediction
):

    return {

        "model":
            prediction[
                "model"
            ],

        "class_index":
            prediction[
                "class_index"
            ],

        "class_name":
            prediction[
                "class_name"
            ],

        "confidence_percent":
            prediction[
                "confidence_percent"
            ],

        "review_recommended":
            prediction[
                "review_recommended"
            ],

        "department_suggestion":
            prediction[
                "department_suggestion"
            ],
    }


# ---------------------------------------------------------
# CROSS MODEL DECISION
# ---------------------------------------------------------

def make_cross_model_decision(
    results
):

    candidate_models = [

        key

        for key, prediction
        in results.items()

        if prediction.get(
            "known_class_candidate",
            False
        )
    ]

    candidates = [

        build_candidate(
            results[key]
        )

        for key in candidate_models
    ]

    # -----------------------------------------------------
    # ONE CANDIDATE
    # -----------------------------------------------------

    if len(candidate_models) == 1:

        selected = candidates[0]

        return {

            "decision":
                "single_model_candidate",

            "selected_candidate":
                selected,

            "candidate_models":
                candidate_models,

            "cross_model_conflict":
                False,

            "decision_reason":
                (
                    "Only one model produced "
                    "an eligible candidate. "
                    "Human confirmation is "
                    "still required."
                ),
        }

    # -----------------------------------------------------
    # MULTIPLE CANDIDATES
    # -----------------------------------------------------

    if len(candidate_models) > 1:

        return {

            "decision":
                "cross_model_conflict",

            "selected_candidate":
                None,

            "candidate_models":
                candidate_models,

            "cross_model_conflict":
                True,

            "decision_reason":
                (
                    "Multiple models produced "
                    "eligible candidates. Their "
                    "raw confidence scores are "
                    "not directly comparable, "
                    "so automatic selection "
                    "was withheld."
                ),
        }

    # -----------------------------------------------------
    # NO CANDIDATE
    # -----------------------------------------------------

    return {

        "decision":
            "uncertain_or_possible_out_of_domain",

        "selected_candidate":
            None,

        "candidate_models":
            [],

        "cross_model_conflict":
            False,

        "decision_reason":
            (
                "No model produced an eligible "
                "candidate. Manual review is required."
            ),
    }


# ---------------------------------------------------------
# PREDICT ENDPOINT
# ---------------------------------------------------------

@router.post("/predict")
async def predict(

    file: UploadFile = File(...),

    model: str = "both",
):

    # -----------------------------------------------------
    # FILE TYPE
    # -----------------------------------------------------

    if file.content_type not in (
        ALLOWED_CONTENT_TYPES
    ):

        raise HTTPException(
            status_code=415,

            detail=(
                "Upload a JPEG, PNG or WEBP image."
            ),
        )

    # -----------------------------------------------------
    # FILE SIZE
    # -----------------------------------------------------

    content = await file.read(
        settings.max_upload_bytes + 1
    )

    if not content:

        raise HTTPException(
            status_code=400,

            detail=(
                "Uploaded image is empty."
            ),
        )

    if (
        len(content)
        > settings.max_upload_bytes
    ):

        raise HTTPException(
            status_code=413,

            detail=(
                "Image exceeds the configured "
                "upload limit."
            ),
        )

    # -----------------------------------------------------
    # ACTUAL IMAGE VALIDATION
    # -----------------------------------------------------

    try:

        probe = Image.open(
            BytesIO(content)
        )

        probe.verify()

        image = Image.open(
            BytesIO(content)
        )

        image.load()

        image = (
            ImageOps
            .exif_transpose(image)
            .convert("RGB")
        )

    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
    ):

        raise HTTPException(
            status_code=400,

            detail=(
                "Uploaded file is not a valid image."
            ),
        )

    # -----------------------------------------------------
    # MODEL SELECTION
    # -----------------------------------------------------

    if model == "both":

        selected_models = MODEL_KEYS

    elif model in MODEL_KEYS:

        selected_models = (
            model,
        )

    else:

        raise HTTPException(
            status_code=400,

            detail=(
                "model must be both, "
                "civic_issues, or "
                "disasters_accidents."
            ),
        )

    # -----------------------------------------------------
    # RUN AI
    # -----------------------------------------------------

    results = {}

    for model_key in selected_models:

        try:

            results[
                model_key
            ] = predict_one(
                model_key,
                image
            )

        except FileNotFoundError as exc:

            raise HTTPException(
                status_code=503,
                detail=str(exc)
            )

        except RuntimeError as exc:

            raise HTTPException(
                status_code=503,
                detail=str(exc)
            )

        except Exception:

            raise HTTPException(
                status_code=500,

                detail=(
                    f"Prediction failed "
                    f"for {model_key}."
                ),
            )

    # -----------------------------------------------------
    # DECISION
    # -----------------------------------------------------

    decision_result = (
        make_cross_model_decision(
            results
        )
    )

    return {

        "success":
            True,

        "filename":
            file.filename,

        "decision":
            decision_result[
                "decision"
            ],

        "selected_candidate":
            decision_result[
                "selected_candidate"
            ],

        "candidate_models":
            decision_result[
                "candidate_models"
            ],

        "cross_model_conflict":
            decision_result[
                "cross_model_conflict"
            ],

        "decision_reason":
            decision_result[
                "decision_reason"
            ],

        "review_required":
            True,

        "predictions":
            results,

        "limitations": [

            "A high softmax score does not prove "
            "that an image belongs to a known class.",

            "Raw confidence scores from different "
            "models are not directly comparable.",

            "Cross-model conflict detection is a "
            "preliminary decision mechanism.",

            "The system does not currently have "
            "a calibrated out-of-domain detector.",

            "Human confirmation is required before "
            "final report routing.",

            "Model confidence is not model accuracy.",
        ],
    }