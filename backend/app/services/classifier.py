from threading import RLock

import numpy as np
from PIL import Image, ImageOps

from app.config import (
    settings,
    load_class_names,
)


# ---------------------------------------------------------
# MODEL CONFIGURATION
# ---------------------------------------------------------

MODEL_KEYS = (
    "civic_issues",
    "disasters_accidents",
)


NORMAL_CLASSES = {

    "civic_issues": {
        "road_normal",
        "streetlight_good",
    },

    "disasters_accidents": {
        "non_damage",
    },
}


# ---------------------------------------------------------
# MODEL CACHE
# ---------------------------------------------------------

_model_cache = {}

_class_names_cache = None

_model_lock = RLock()

_class_names_lock = RLock()


# ---------------------------------------------------------
# CLASS NAMES
# ---------------------------------------------------------

def _load_class_names():

    global _class_names_cache

    with _class_names_lock:

        if _class_names_cache is None:

            mapping = load_class_names()

            if not isinstance(mapping, dict):
                raise RuntimeError(
                    "Invalid class_names.json format."
                )

            for model_key in MODEL_KEYS:

                names = mapping.get(
                    model_key
                )

                if (
                    not isinstance(names, list)
                    or len(names) != 6
                ):
                    raise RuntimeError(
                        f"Invalid class mapping for "
                        f"{model_key}. Exactly six "
                        f"class names are required."
                    )

            _class_names_cache = mapping

        return _class_names_cache


# ---------------------------------------------------------
# LOAD MODEL
# ---------------------------------------------------------

def _load_model(model_key: str):

    if model_key not in MODEL_KEYS:

        raise ValueError(
            f"Unknown model: {model_key}"
        )

    with _model_lock:

        if model_key in _model_cache:
            return _model_cache[model_key]

        model_path = (
            settings.model_paths[model_key]
        )

        if not model_path.is_file():

            raise FileNotFoundError(
                f"Model file not found: "
                f"{model_path.name}"
            )

        try:

            import tensorflow as tf

        except ImportError as exc:

            raise RuntimeError(
                "TensorFlow is not installed "
                "in the active environment."
            ) from exc

        try:

            model = tf.keras.models.load_model(
                model_path,
                compile=False
            )

        except Exception as exc:

            raise RuntimeError(
                f"Unable to load model "
                f"{model_key}: {exc}"
            ) from exc

        # -------------------------------------------------
        # INPUT VALIDATION
        # -------------------------------------------------

        input_shape = model.input_shape

        if isinstance(
            input_shape,
            list
        ):
            input_shape = input_shape[0]

        if tuple(
            input_shape[1:]
        ) != (
            224,
            224,
            3
        ):

            raise RuntimeError(
                f"Unexpected input shape for "
                f"{model_key}: {input_shape}"
            )

        # -------------------------------------------------
        # OUTPUT VALIDATION
        # -------------------------------------------------

        output_shape = model.output_shape

        if isinstance(
            output_shape,
            list
        ):
            output_shape = output_shape[0]

        if int(
            output_shape[-1]
        ) != 6:

            raise RuntimeError(
                f"{model_key} must produce "
                f"exactly six class scores."
            )

        _model_cache[
            model_key
        ] = model

        return model


# ---------------------------------------------------------
# MODEL STATUS
# ---------------------------------------------------------

def model_status():

    result = {}

    for key in MODEL_KEYS:

        result[key] = {

            "file_present":
                settings.model_paths[
                    key
                ].is_file(),

            "loaded":
                key in _model_cache,

            "expected_input":
                "224x224 RGB",

            "expected_classes":
                6,

            "confidence_threshold":
                settings.confidence_threshold,

            "margin_threshold":
                settings.margin_threshold,
        }

    return result


# ---------------------------------------------------------
# IMAGE PREPROCESSING
# ---------------------------------------------------------

def _prepare_image(
    image: Image.Image
):

    if not isinstance(
        image,
        Image.Image
    ):

        raise TypeError(
            "Expected a PIL Image object."
        )

    image = (
        ImageOps
        .exif_transpose(image)
        .convert("RGB")
    )

    image = image.resize(
        settings.image_size,
        Image.Resampling.BILINEAR
    )

    image_array = np.asarray(
        image,
        dtype=np.float32
    )

    return np.expand_dims(
        image_array,
        axis=0
    )


# ---------------------------------------------------------
# UNCERTAINTY
# ---------------------------------------------------------

def _calculate_uncertainty(
    probabilities
):

    sorted_probabilities = (
        np.sort(probabilities)[::-1]
    )

    top_probability = float(
        sorted_probabilities[0]
    )

    second_probability = float(
        sorted_probabilities[1]
    )

    margin = (
        top_probability
        - second_probability
    )

    epsilon = 1e-10

    entropy = -float(
        np.sum(
            probabilities
            * np.log(
                probabilities
                + epsilon
            )
        )
    )

    normalized_entropy = (
        entropy
        / np.log(
            len(probabilities)
        )
    )

    return {

        "top_confidence":
            top_probability,

        "second_confidence":
            second_probability,

        "confidence_margin":
            float(margin),

        "normalized_entropy":
            float(
                normalized_entropy
            ),
    }


# ---------------------------------------------------------
# CLASS NAME
# ---------------------------------------------------------

def _get_class_name(
    model_key,
    class_index
):

    mapping = _load_class_names()

    class_names = mapping.get(
        model_key,
        []
    )

    if not (
        0 <= class_index
        < len(class_names)
    ):

        return None

    return class_names[
        class_index
    ]


# ---------------------------------------------------------
# NORMALIZE LABEL
# ---------------------------------------------------------

def _normalize_label(
    class_name
):

    if not class_name:
        return ""

    return str(
        class_name
    ).strip().lower()


# ---------------------------------------------------------
# NORMAL CLASS
# ---------------------------------------------------------

def _is_normal_prediction(
    model_key,
    class_name
):

    label = _normalize_label(
        class_name
    )

    return (
        label
        in NORMAL_CLASSES.get(
            model_key,
            set()
        )
    )


# ---------------------------------------------------------
# DEPARTMENT SUGGESTION
# ---------------------------------------------------------

def _department_suggestion(
    class_name
):

    """
    AI recommendation only.

    Final department assignment must be
    validated by the application/admin workflow.
    """

    label = _normalize_label(
        class_name
    )

    routing_rules = [

        (
            (
                "streetlight",
                "electric",
                "power_line",
            ),
            "Electricity Department",
        ),

        (
            (
                "pothole",
                "road",
                "highway",
            ),
            "Roads and Public Works",
        ),

        (
            (
                "garbage",
                "waste",
                "litter",
                "dump",
            ),
            "Waste Management",
        ),

        (
            (
                "fire",
                "smoke",
            ),
            "Fire and Rescue",
        ),

        (
            (
                "flood",
                "land_disaster",
                "landslide",
            ),
            "Disaster Management",
        ),

        (
            (
                "water",
                "leak",
                "drain",
                "sewage",
            ),
            "Water and Sanitation",
        ),

        (
            (
                "traffic",
                "accident",
            ),
            "Traffic Management",
        ),

        (
            (
                "human_damage",
            ),
            "Emergency and Public Safety",
        ),

        (
            (
                "manhole",
            ),
            "Roads and Public Works",
        ),
    ]

    for keywords, department in routing_rules:

        if any(
            keyword in label
            for keyword in keywords
        ):

            return department

    return "Manual department review"


# ---------------------------------------------------------
# SINGLE MODEL PREDICTION
# ---------------------------------------------------------

def predict_one(
    model_key: str,
    image: Image.Image
):

    model = _load_model(
        model_key
    )

    image_batch = _prepare_image(
        image
    )

    raw_predictions = model.predict(
        image_batch,
        verbose=0
    )

    probabilities = np.asarray(
        raw_predictions,
        dtype=np.float64
    ).reshape(-1)

    if probabilities.size != 6:

        raise RuntimeError(
            f"Invalid output size from "
            f"{model_key}."
        )

    if not np.all(
        np.isfinite(
            probabilities
        )
    ):

        raise RuntimeError(
            f"Non-finite prediction "
            f"values from {model_key}."
        )

    # -----------------------------------------------------
    # HANDLE OUTPUT
    # -----------------------------------------------------

    if (
        np.any(probabilities < 0)
        or np.any(probabilities > 1)
        or not np.isclose(
            np.sum(probabilities),
            1.0,
            atol=1e-3
        )
    ):

        # Some models may output logits.
        # Convert them safely to probabilities.

        shifted = (
            probabilities
            - np.max(probabilities)
        )

        exp_values = np.exp(
            shifted
        )

        probabilities = (
            exp_values
            / np.sum(exp_values)
        )

    else:

        probability_sum = float(
            np.sum(probabilities)
        )

        if probability_sum <= 0:

            raise RuntimeError(
                "Invalid probability distribution."
            )

        probabilities /= (
            probability_sum
        )

    # -----------------------------------------------------
    # TOP PREDICTION
    # -----------------------------------------------------

    best_index = int(
        np.argmax(
            probabilities
        )
    )

    uncertainty = (
        _calculate_uncertainty(
            probabilities
        )
    )

    class_name = _get_class_name(
        model_key,
        best_index
    )

    confidence_ok = (
        uncertainty[
            "top_confidence"
        ]
        >= settings.confidence_threshold
    )

    margin_ok = (
        uncertainty[
            "confidence_margin"
        ]
        >= settings.margin_threshold
    )

    candidate = (
        confidence_ok
        and margin_ok
        and class_name is not None
    )

    # -----------------------------------------------------
    # TOP THREE
    # -----------------------------------------------------

    top_three_indices = (
        np.argsort(
            probabilities
        )[::-1][:3]
    )

    top_three = []

    for index in top_three_indices:

        index = int(index)

        top_three.append({

            "class_index":
                index,

            "class_name":
                _get_class_name(
                    model_key,
                    index
                ),

            "confidence_percent":
                round(
                    float(
                        probabilities[
                            index
                        ]
                    ) * 100,
                    2
                ),
        })

    # -----------------------------------------------------
    # NORMAL CLASS
    # -----------------------------------------------------

    is_normal = (
        _is_normal_prediction(
            model_key,
            class_name
        )
        if candidate
        else None
    )

    # -----------------------------------------------------
    # DEPARTMENT
    # -----------------------------------------------------

    department = None

    if (
        candidate
        and not is_normal
    ):

        department = (
            _department_suggestion(
                class_name
            )
        )

    # -----------------------------------------------------
    # RESULT
    # -----------------------------------------------------

    return {

        "model":
            model_key,

        "class_index":
            best_index,

        "class_name":
            class_name,

        "confidence":
            round(
                uncertainty[
                    "top_confidence"
                ],
                6
            ),

        "confidence_percent":
            round(
                uncertainty[
                    "top_confidence"
                ] * 100,
                2
            ),

        "second_confidence_percent":
            round(
                uncertainty[
                    "second_confidence"
                ] * 100,
                2
            ),

        "confidence_margin":
            round(
                uncertainty[
                    "confidence_margin"
                ],
                6
            ),

        "normalized_entropy":
            round(
                uncertainty[
                    "normalized_entropy"
                ],
                6
            ),

        "top_three":
            top_three,

        "known_class_candidate":
            candidate,

        "review_recommended":
            not candidate,

        "is_normal_class":
            is_normal,

        "department_suggestion":
            department,
    }


# ---------------------------------------------------------
# BOTH MODELS
# ---------------------------------------------------------

def predict_both(
    image: Image.Image
):

    civic_result = predict_one(
        "civic_issues",
        image
    )

    disaster_result = predict_one(
        "disasters_accidents",
        image
    )

    predictions = {

        "civic_issues":
            civic_result,

        "disasters_accidents":
            disaster_result,
    }

    issue_predictions = []

    normal_predictions = []

    uncertain_predictions = []

    for model_key, result in predictions.items():

        if not result[
            "known_class_candidate"
        ]:

            uncertain_predictions.append(
                model_key
            )

            continue

        if result[
            "is_normal_class"
        ]:

            normal_predictions.append(
                model_key
            )

        else:

            issue_predictions.append(
                model_key
            )

    # -----------------------------------------------------
    # BOTH MODELS IDENTIFY AN ISSUE
    # -----------------------------------------------------

    if len(issue_predictions) == 2:

        cross_model_status = (
            "multiple_issue_signals"
        )

        decision = (
            "multiple_issue_candidates_review"
        )

        review_recommended = True

        explanation = (
            "Both models produced confident "
            "non-normal predictions. Their "
            "findings require human verification "
            "before final classification."
        )

    # -----------------------------------------------------
    # ONE ISSUE MODEL
    # -----------------------------------------------------

    elif len(issue_predictions) == 1:

        issue_model = (
            issue_predictions[0]
        )

        other_model = (
            "disasters_accidents"
            if issue_model
            == "civic_issues"
            else "civic_issues"
        )

        if other_model in normal_predictions:

            cross_model_status = (
                "single_domain_issue"
            )

            decision = (
                "single_domain_issue_candidate"
            )

            review_recommended = False

            explanation = (
                f"The {issue_model} model "
                "identified a potential issue, "
                "while the other model identified "
                "a normal-class image."
            )

        else:

            cross_model_status = (
                "issue_with_uncertainty"
            )

            decision = (
                "issue_candidate_review"
            )

            review_recommended = True

            explanation = (
                f"The {issue_model} model identified "
                "a potential issue, but the other "
                "model was uncertain. Manual "
                "verification is recommended."
            )

    # -----------------------------------------------------
    # BOTH NORMAL
    # -----------------------------------------------------

    elif len(normal_predictions) == 2:

        cross_model_status = (
            "both_models_normal"
        )

        decision = (
            "no_supported_issue_detected"
        )

        review_recommended = False

        explanation = (
            "Both models produced confident "
            "normal-class predictions. No "
            "supported issue was identified."
        )

    # -----------------------------------------------------
    # INSUFFICIENT EVIDENCE
    # -----------------------------------------------------

    else:

        cross_model_status = (
            "insufficient_evidence"
        )

        decision = (
            "insufficient_evidence_review"
        )

        review_recommended = True

        explanation = (
            "The available model predictions "
            "do not provide sufficient evidence "
            "for a reliable combined classification."
        )

    suggested_issue = None

    if len(issue_predictions) == 1:

        model_key = (
            issue_predictions[0]
        )

        suggested_issue = {

            "model":
                model_key,

            "class_name":
                predictions[
                    model_key
                ][
                    "class_name"
                ],

            "confidence_percent":
                predictions[
                    model_key
                ][
                    "confidence_percent"
                ],

            "department_suggestion":
                predictions[
                    model_key
                ][
                    "department_suggestion"
                ],
        }

    return {

        "predictions":
            predictions,

        "combined_decision": {

            "decision":
                decision,

            "cross_model_status":
                cross_model_status,

            "review_recommended":
                review_recommended,

            "explanation":
                explanation,

            "issue_models":
                issue_predictions,

            "normal_models":
                normal_predictions,

            "uncertain_models":
                uncertain_predictions,

            "suggested_issue":
                suggested_issue,

            "department_suggestion":
                (
                    suggested_issue[
                        "department_suggestion"
                    ]
                    if suggested_issue
                    else None
                ),
        },

        "analysis_metadata": {

            "models_used":
                list(MODEL_KEYS),

            "input_size":
                "224x224",

            "confidence_threshold":
                settings.confidence_threshold,

            "margin_threshold":
                settings.margin_threshold,

            "decision_type":
                "uncertainty_aware_dual_model",

            "confidence_is_calibrated":
                False,

            "out_of_distribution_detection":
                False,
        },
    }