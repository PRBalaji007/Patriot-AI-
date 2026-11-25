from typing import Any

from pydantic import BaseModel, Field


class ModelPrediction(BaseModel):

    model: str

    class_index: int = Field(
        ge=0
    )

    class_name: str | None = None

    confidence: float = Field(
        ge=0,
        le=1
    )

    confidence_percent: float = Field(
        ge=0,
        le=100
    )

    second_confidence_percent: float | None = Field(
        default=None,
        ge=0,
        le=100
    )

    confidence_margin: float | None = None

    normalized_entropy: float | None = None

    known_class_candidate: bool = False

    review_recommended: bool = True

    is_normal_class: bool | None = None

    department_suggestion: str | None = None

    top_three: list[dict[str, Any]] = Field(
        default_factory=list
    )


class PredictionResponse(BaseModel):

    success: bool

    filename: str

    decision: str

    selected_candidate: dict[str, Any] | None

    candidate_models: list[str]

    cross_model_conflict: bool

    decision_reason: str

    review_required: bool

    predictions: dict[str, ModelPrediction]

    limitations: list[str]


class ReportAIResult(BaseModel):

    decision: str

    selected_candidate: dict[str, Any] | None

    review_required: bool

    predictions: dict[str, ModelPrediction]


class ReportSubmissionResponse(BaseModel):

    success: bool

    message: str

    report: dict[str, Any]

    ai: ReportAIResult