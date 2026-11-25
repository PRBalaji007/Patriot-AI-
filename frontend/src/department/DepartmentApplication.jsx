import { useEffect, useState } from "react";
import {
  getActiveDepartments,
  getMyDepartmentApplications,
  submitDepartmentApplication,
} from "../lib/departmentService";
import "./DepartmentApplication.css";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(value) {
  if (!value) return "Unknown";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

export default function DepartmentApplication() {
  const [departments, setDepartments] =
    useState([]);

  const [applications, setApplications] =
    useState([]);

  const [departmentId, setDepartmentId] =
    useState("");

  const [officialEmail, setOfficialEmail] =
    useState("");

  const [contactName, setContactName] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function loadApplicationData() {
    setLoading(true);
    setError("");

    try {
      const [
        departmentData,
        applicationData,
      ] = await Promise.all([
        getActiveDepartments(),
        getMyDepartmentApplications(),
      ]);

      setDepartments(
        Array.isArray(departmentData)
          ? departmentData
          : []
      );

      setApplications(
        Array.isArray(applicationData)
          ? applicationData
          : []
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load department information."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadApplicationData();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const trimmedEmail =
      officialEmail.trim();

    const trimmedContact =
      contactName.trim();

    const trimmedNotes =
      notes.trim();

    if (
      !departmentId ||
      !trimmedEmail ||
      !trimmedContact
    ) {
      setError(
        "Please complete all required fields."
      );
      return;
    }

    if (trimmedContact.length < 2) {
      setError(
        "Please enter a valid authorized contact name."
      );
      return;
    }

    if (trimmedNotes.length > 1000) {
      setError(
        "Additional information must be 1000 characters or less."
      );
      return;
    }

    setSubmitting(true);

    try {
      await submitDepartmentApplication({
        departmentId,
        officialEmail:
          trimmedEmail,
        contactName:
          trimmedContact,
        notes:
          trimmedNotes,
      });

      setSuccess(
        "Your department application has been submitted successfully."
      );

      setOfficialEmail("");
      setContactName("");
      setNotes("");
      setDepartmentId("");

      await loadApplicationData();
    } catch (err) {
      setError(
        err?.message ||
          "Application submission failed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <section className="department-page">
        <div className="department-loading">
          Loading department portal...
        </div>
      </section>
    );
  }

  return (
    <section className="department-page">
      <div className="department-header">
        <div>
          <span className="department-eyebrow">
            PATRIOT AUTHORITY PORTAL
          </span>

          <h1>Department Registration</h1>

          <p>
            Apply for authorized access to manage
            civic services within your department.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="department-alert error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="department-alert success"
          role="status"
        >
          {success}
        </div>
      )}

      <div className="department-layout">
        <div className="department-form-card">
          <h2>Department Application</h2>

          <p className="department-muted">
            Submit your official details for
            administrator review.
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="department-select">
              Select Department *
            </label>

            <select
              id="department-select"
              value={departmentId}
              onChange={(event) =>
                setDepartmentId(
                  event.target.value
                )
              }
              required
              disabled={submitting}
            >
              <option value="">
                Choose a department
              </option>

              {departments.map(
                (department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.name}
                  </option>
                )
              )}
            </select>

            {departments.length === 0 && (
              <p className="department-muted">
                No active departments are
                currently available for
                registration.
              </p>
            )}

            <label htmlFor="contact-name">
              Authorized Contact Name *
            </label>

            <input
              id="contact-name"
              type="text"
              value={contactName}
              onChange={(event) =>
                setContactName(
                  event.target.value
                )
              }
              placeholder="Enter official contact name"
              autoComplete="name"
              maxLength={120}
              required
              disabled={submitting}
            />

            <label htmlFor="official-email">
              Official Department Email *
            </label>

            <input
              id="official-email"
              type="email"
              value={officialEmail}
              onChange={(event) =>
                setOfficialEmail(
                  event.target.value
                )
              }
              placeholder="department@example.gov.in"
              autoComplete="email"
              maxLength={254}
              required
              disabled={submitting}
            />

            <label htmlFor="department-notes">
              Additional Information
            </label>

            <textarea
              id="department-notes"
              value={notes}
              onChange={(event) =>
                setNotes(
                  event.target.value
                )
              }
              placeholder="Provide department identification or relevant details"
              rows={4}
              maxLength={1000}
              disabled={submitting}
            />

            <div className="department-form-actions">
              <button
                type="submit"
                disabled={
                  submitting ||
                  departments.length === 0
                }
              >
                {submitting
                  ? "Submitting..."
                  : "Submit Application"}
              </button>
            </div>
          </form>
        </div>

        <div className="department-history-card">
          <h2>Application History</h2>

          <p className="department-muted">
            Track the status of your department
            applications.
          </p>

          {applications.length === 0 ? (
            <div className="department-empty">
              <span>📄</span>

              <p>
                No department applications
                submitted yet.
              </p>
            </div>
          ) : (
            <div className="department-application-list">
              {applications.map(
                (application) => (
                  <article
                    className="department-application-item"
                    key={application.id}
                  >
                    <div>
                      <h3>
                        {application
                          .departments?.name ||
                          "Department"}
                      </h3>

                      <p>
                        {application.official_email ||
                          "Email not provided"}
                      </p>

                      {application.contact_name && (
                        <p>
                          Contact:{" "}
                          {
                            application.contact_name
                          }
                        </p>
                      )}

                      <small>
                        Submitted{" "}
                        {formatDate(
                          application.created_at
                        )}
                      </small>
                    </div>

                    <span
                      className={`department-status ${String(
                        application.status ||
                          "unknown"
                      )
                        .toLowerCase()
                        .replace(/\s+/g, "_")}`}
                    >
                      {formatStatus(
                        application.status
                      )}
                    </span>
                  </article>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}