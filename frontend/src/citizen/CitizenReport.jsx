import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import CitizenAIAnalysis from "./CitizenAIAnalysis";
import "./Citizen.css";
import { submitCitizenReport } from "../lib/aiService";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const INITIAL_FORM = {
  description: "",
  priority: "medium",
  address: "",
};

export default function CitizenReport() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");

  const [location, setLocation] = useState({
    latitude: null,
    longitude: null,
  });

  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        setUser(data?.user || null);
      } catch (err) {
        setError(err.message || "Unable to verify your session.");
      } finally {
        setAuthLoading(false);
      }
    }

    loadUser();
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleImageChange = (event) => {
    setError("");
    setMessage("");

    const selected = event.target.files?.[0] || null;

    if (!selected) {
      setImage(null);
      setImagePreview("");
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      setError(
        "Unsupported image format. Please choose JPG, PNG, or WEBP."
      );

      event.target.value = "";
      setImage(null);
      setImagePreview("");
      return;
    }

    if (selected.size > MAX_IMAGE_BYTES) {
      setError("The selected image exceeds the 5 MB size limit.");

      event.target.value = "";
      setImage(null);
      setImagePreview("");
      return;
    }

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(selected);
    setImagePreview(URL.createObjectURL(selected));
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const captureLocation = () => {
    setError("");
    setMessage("");

    if (!navigator.geolocation) {
      setError("This browser does not support location access.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        setLocating(false);
        setMessage("Location captured successfully.");
      },

      (geoError) => {
        setLocating(false);

        setError(
          geoError.message ||
            "Location could not be captured. You may still submit without it."
        );
      },

      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  };

  const clearLocation = () => {
    setLocation({
      latitude: null,
      longitude: null,
    });
  };

  const validateForm = () => {
    if (!user) {
      return "Please sign in before submitting a report.";
    }

    if (form.description.trim().length < 10) {
      return "Please provide at least 10 characters describing the issue.";
    }

    if (form.description.trim().length > 3000) {
      return "The description cannot exceed 3000 characters.";
    }

    if (!["low", "medium", "high", "urgent"].includes(form.priority)) {
      return "Please select a valid priority.";
    }

    if (form.address.trim().length > 300) {
      return "The address or landmark must be 300 characters or fewer.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
  event.preventDefault();

  setError("");
  setMessage("");

  const validationError = validateForm();

  if (validationError) {
    setError(validationError);
    return;
  }

  setSubmitting(true);

  try {
    // Get the current authenticated Supabase session
    const {
      data: sessionData,
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const accessToken = sessionData?.session?.access_token;

    // Make absolutely sure the authenticated session exists
    if (!accessToken) {
      throw new Error(
        "Your session is not available. Please sign in again."
      );
    }

    console.log("PATRIOT: submitting report...");
    console.log("PATRIOT: authenticated user:", sessionData.session.user.email);
    console.log("PATRIOT: access token available:", !!accessToken);

    // Submit report to backend
    const result = await submitCitizenReport({
      accessToken: accessToken,
      description: form.description.trim(),
      priority: form.priority,
      address: form.address.trim() || null,
      latitude: location.latitude,
      longitude: location.longitude,
      image: image,
    });

    console.log("PATRIOT: report submission response:", result);

    const reportId = result?.report?.id;

    // Reset form
    setForm(INITIAL_FORM);

    setLocation({
      latitude: null,
      longitude: null,
    });

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImage(null);
    setImagePreview("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage(
      reportId
        ? `Report submitted successfully! Report ID: ${reportId}`
        : "Report submitted successfully!"
    );

  } catch (err) {
    console.error("PATRIOT report submission error:", err);

    setError(
      err?.message ||
        "Your report could not be submitted. Please try again."
    );

  } finally {
    setSubmitting(false);
  }
};

  if (authLoading) {
    return (
      <main className="citizen-page">
        <div className="citizen-loading-panel">
          <span className="citizen-spinner" />
          <p>Checking your account...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="citizen-page citizen-form-page">

      <header className="citizen-page-header">
        <div>
          <p className="citizen-eyebrow">
            CITIZEN SERVICES / NEW REPORT
          </p>

          <h1>Report a Civic Issue</h1>

          <p className="citizen-page-subtitle">
            Provide accurate information so the responsible department
            can understand and review the issue.
          </p>
        </div>
      </header>

      {error && (
        <div className="citizen-alert citizen-alert-error" role="alert">
          <strong>Something needs your attention</strong>
          <p>{error}</p>
        </div>
      )}

      {message && (
        <div className="citizen-alert citizen-alert-success" role="status">
          <strong>Report update</strong>
          <p>{message}</p>
        </div>
      )}

      {!user && (
        <div className="citizen-alert citizen-alert-warning">
          You are not signed in. Please sign in to submit a civic report.
        </div>
      )}

      <form
        className="citizen-card citizen-report-form"
        onSubmit={handleSubmit}
      >

        {/* STEP 01 */}

        <div className="citizen-form-section-heading">
          <span className="citizen-step-number">01</span>

          <div>
            <h2>Issue description</h2>

            <p>
              Explain what happened and why it needs attention.
            </p>
          </div>
        </div>

        <label
          className="citizen-field-label"
          htmlFor="citizen-report-description"
        >
          Description <span className="required-mark">*</span>
        </label>

        <textarea
          id="citizen-report-description"
          value={form.description}
          onChange={(event) =>
            updateField("description", event.target.value)
          }
          rows={7}
          minLength={10}
          maxLength={3000}
          required
          placeholder="Example: A large pothole has formed near the main road and is creating difficulty for two-wheelers and pedestrians..."
        />

        <div className="citizen-field-footer">
          <small>
            Include the issue, approximate location, and its impact.
          </small>

          <small>
            {form.description.length}/3000
          </small>
        </div>

        <label
          className="citizen-field-label"
          htmlFor="citizen-report-priority"
        >
          Priority
        </label>

        <select
          id="citizen-report-priority"
          value={form.priority}
          onChange={(event) =>
            updateField("priority", event.target.value)
          }
        >
          <option value="low">
            Low — Minor inconvenience
          </option>

          <option value="medium">
            Medium — Needs attention
          </option>

          <option value="high">
            High — Significant public impact
          </option>

          <option value="urgent">
            Urgent — Immediate safety concern
          </option>
        </select>

        <p className="citizen-field-help">
          Priority is your assessment when submitting. The responsible
          team may review it as part of their workflow.
        </p>

        <div className="citizen-form-divider" />

        {/* STEP 02 */}

        <div className="citizen-form-section-heading">
          <span className="citizen-step-number">02</span>

          <div>
            <h2>Photo evidence</h2>

            <p>
              Add an image that helps explain the reported issue.
            </p>
          </div>
        </div>

        <label
          className="citizen-field-label"
          htmlFor="citizen-report-image"
        >
          Upload image{" "}
          <span className="optional-mark">
            (optional)
          </span>
        </label>

        <input
          ref={fileInputRef}
          id="citizen-report-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageChange}
        />

        <p className="citizen-field-help">
          Accepted formats: JPG, PNG, WEBP. Maximum size: 5 MB.
        </p>

        {imagePreview && (
          <div className="citizen-image-preview-wrap">

            <img
              src={imagePreview}
              className="citizen-image-preview"
              alt="Preview of selected evidence"
            />

            <div className="citizen-image-preview-details">

              <strong>
                {image?.name}
              </strong>

              <small>
                {image
                  ? `${(image.size / (1024 * 1024)).toFixed(2)} MB`
                  : ""}
              </small>

              <button
                type="button"
                className="citizen-text-button"
                onClick={removeImage}
              >
                Remove image
              </button>

            </div>
          </div>
        )}

        {/* AI ANALYSIS */}

        {image && (
          <CitizenAIAnalysis file={image} />
        )}

        <div className="citizen-form-divider" />

        {/* STEP 03 */}

        <div className="citizen-form-section-heading">
          <span className="citizen-step-number">03</span>

          <div>
            <h2>Issue location</h2>

            <p>
              Help the department identify where the issue is located.
            </p>
          </div>
        </div>

        <div className="citizen-location-panel">

          <div>
            <strong>
              Current device location
            </strong>

            <p>
              Allow location access to attach coordinates to this
              report. Location sharing is optional.
            </p>
          </div>

          <button
            type="button"
            className="citizen-button citizen-button-secondary"
            onClick={captureLocation}
            disabled={locating}
          >
            {locating
              ? "Capturing..."
              : "◎ Use my location"}
          </button>

        </div>

        {location.latitude !== null && (
          <div className="citizen-location-captured">

            <span>
              ✓ Coordinates captured
            </span>

            <small>
              {location.latitude.toFixed(6)},{" "}
              {location.longitude.toFixed(6)}
            </small>

            <button
              type="button"
              className="citizen-text-button"
              onClick={clearLocation}
            >
              Clear location
            </button>

          </div>
        )}

        <label
          className="citizen-field-label"
          htmlFor="citizen-report-address"
        >
          Address or nearby landmark{" "}
          <span className="optional-mark">
            (optional)
          </span>
        </label>

        <input
          id="citizen-report-address"
          type="text"
          maxLength={300}
          value={form.address}
          onChange={(event) =>
            updateField("address", event.target.value)
          }
          placeholder="Street, neighbourhood, building, or landmark"
        />

        <p className="citizen-field-help">
          Do not include private information that is not needed to
          locate the issue.
        </p>

        {/* SUBMIT */}

        <div className="citizen-submit-panel">

          <div>
            <strong>
              Ready to submit?
            </strong>

            <p>
              You can review the status of this report later in
              My Reports.
            </p>
          </div>

          <button
          className="citizen-button citizen-button-primary"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Submitting report..."
            : "Submit civic report"}
          </button>

        </div>

      </form>
    </main>
  );
}