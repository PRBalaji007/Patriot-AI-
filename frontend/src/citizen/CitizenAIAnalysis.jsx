import { useEffect, useState } from "react";
import { classifyImage } from "../lib/aiService";

const MODEL_LABELS = {
  civic_issues: "Civic Issues Model",
  disasters_accidents: "Disasters & Accidents Model",
};

function formatName(value) {
  if (typeof value !== "string") {
    return "Unknown";
  }

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ModelCard({ prediction }) {
  return (
    <article className="citizen-ai-model-card">

      <div className="citizen-ai-model-heading">

        <strong>
          {MODEL_LABELS[prediction.model] || prediction.model}
        </strong>

        <span
          className={
            prediction.known_class_candidate
              ? "citizen-ai-status candidate"
              : "citizen-ai-status review"
          }
        >
          {prediction.known_class_candidate
            ? "Candidate"
            : "Needs review"}
        </span>

      </div>

      <div className="citizen-ai-result">

        <div>
          <small>TOP PREDICTION</small>

          <strong>
            {formatName(prediction.class_name)}
          </strong>
        </div>

        <b>
          {Number(
            prediction.confidence_percent || 0
          ).toFixed(2)}
          %
        </b>

      </div>

      <div className="citizen-ai-alternatives">

        <small>
          Alternative predictions
        </small>

        {prediction.top_three?.slice(1).map((item) => (
          <div key={item.class_index}>

            <span>
              {formatName(item.class_name)}
            </span>

            <span>
              {Number(
                item.confidence_percent || 0
              ).toFixed(2)}
              %
            </span>

          </div>
        ))}

      </div>

      <div className="citizen-ai-department">

        <small>
          Suggested department
        </small>

        <strong>
          {prediction.department_suggestion ||
            "Manual department review"}
        </strong>

      </div>

    </article>
  );
}

export default function CitizenAIAnalysis({ file }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (!file) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }

    let active = true;

    async function analyse() {
      setLoading(true);
      setError("");
      setResult(null);

      try {
        const response = await classifyImage(file, "both");

        if (active) {
          setResult(response);
        }
      } catch (err) {
        if (active) {
          setError(
            err.message || "AI analysis failed."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    analyse();

    return () => {
      active = false;
    };
  }, [file, retryCount]);

  if (!file) {
    return null;
  }

  const predictions = Object.values(
    result?.predictions || {}
  );

  const conflict =
    result?.decision === "cross_model_conflict";

  const uncertain =
    result?.decision ===
    "uncertain_or_possible_out_of_domain";

  return (
    <section
      className="citizen-ai-panel"
      aria-live="polite"
    >

      <div className="citizen-ai-heading">

        <span className="citizen-ai-symbol">
          ✦
        </span>

        <div>
          <h3>
            PATRIOT AI Analysis
          </h3>

          <p>
            Automated image classification
          </p>
        </div>

      </div>

      {loading && (
        <div className="citizen-ai-loading">

          <span className="citizen-spinner" />

          <span>
            Analysing your image with both AI models...
          </span>

        </div>
      )}

      {error && (
        <div className="citizen-ai-warning">

          <strong>
            AI analysis unavailable
          </strong>

          <p>
            {error}
          </p>

          <button
            type="button"
            className="citizen-button citizen-button-secondary"
            onClick={() =>
              setRetryCount((count) => count + 1)
            }
          >
            Retry analysis
          </button>

          <small>
            You may still submit your report with a clear
            description.
          </small>

        </div>
      )}

      {result && (
        <>

          {result.selected_candidate && (
            <div className="citizen-ai-selected">

              <small>
                PROVISIONAL AI CANDIDATE
              </small>

              <div>

                <strong>
                  {formatName(
                    result.selected_candidate.class_name
                  )}
                </strong>

                <b>
                  {Number(
                    result.selected_candidate
                      .confidence_percent || 0
                  ).toFixed(2)}
                  %
                </b>

              </div>

              <p>
                {
                  MODEL_LABELS[
                    result.selected_candidate.model
                  ]
                }

                {" · "}

                {result.selected_candidate
                  .department_suggestion ||
                  "Manual review"}
              </p>

            </div>
          )}

          {conflict && (
            <div className="citizen-ai-warning">

              <strong>
                Model disagreement detected
              </strong>

              <p>
                Both models produced eligible predictions.
                No category was automatically selected.
                Manual confirmation is required.
              </p>

            </div>
          )}

          {uncertain && (
            <div className="citizen-ai-warning">

              <strong>
                Category could not be determined reliably
              </strong>

              <p>
                The image may be unrelated, unclear, or
                outside the trained categories. Please
                verify the evidence.
              </p>

            </div>
          )}

          {!conflict && !uncertain && (
            <div className="citizen-ai-information">
              AI classification is a suggestion. The
              responsible department must verify the
              reported issue.
            </div>
          )}

          <div className="citizen-ai-grid">
            {predictions.map((prediction) => (
              <ModelCard
                key={prediction.model}
                prediction={prediction}
              />
            ))}
          </div>

          <small className="citizen-ai-footnote">
            {result.decision_reason} Model confidence is
            not model accuracy. Human confirmation is
            required before report routing.
          </small>

        </>
      )}

    </section>
  );
}