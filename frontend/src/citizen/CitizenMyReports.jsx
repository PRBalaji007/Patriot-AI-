import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Citizen.css";

const STATUS_LABELS = {
  submitted: "Submitted",
  under_review: "Under Review",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};

const PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Unknown";
}

function getPriorityLabel(priority) {
  return PRIORITY_LABELS[priority] || "Not specified";
}

export default function CitizenMyReports() {
  const [reports, setReports] = useState([]);
  const [imageUrls, setImageUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedReport, setSelectedReport] = useState(null);

  const loadReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const currentUser = authData?.user;

      if (!currentUser) {
        throw new Error(
          "Please sign in to view your reports."
        );
      }

      const {
        data,
        error: queryError,
      } = await supabase
        .from("reports")
        .select(
          "id, description, image_path, latitude, longitude, address, predicted_category, priority, status, resolution_notes, created_at, updated_at"
        )
        .eq("citizen_id", currentUser.id)
        .order("created_at", {
          ascending: false,
        });

      if (queryError) {
        throw queryError;
      }

      const rows = data || [];

      setReports(rows);

      const signedUrlEntries =
        await Promise.all(
          rows
            .filter((report) => report.image_path)
            .map(async (report) => {
              try {
                const {
                  data: signedData,
                  error: signedError,
                } = await supabase.storage
                  .from("report-images")
                  .createSignedUrl(
                    report.image_path,
                    30 * 60
                  );

                return [
                  report.id,
                  signedError
                    ? null
                    : signedData?.signedUrl ||
                      null,
                ];
              } catch {
                return [report.id, null];
              }
            })
        );

      setImageUrls(
        Object.fromEntries(signedUrlEntries)
      );
    } catch (err) {
      setError(
        err?.message ||
          "Unable to retrieve your reports."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === "all" ||
        report.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        report.priority === priorityFilter;

      const searchableText = [
        report.description,
        report.address,
        report.predicted_category,
        report.resolution_notes,
      ]
        .filter(
          (value) =>
            typeof value === "string" &&
            value.trim()
        )
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        matchesPriority &&
        (!term || searchableText.includes(term))
      );
    });
  }, [
    reports,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setPriorityFilter("all");
  };

  const inProgressCount = reports.filter(
    (report) => report.status === "in_progress"
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved"
  ).length;

  if (loading) {
    return (
      <main className="citizen-page">
        <div className="citizen-loading-panel">
          <span className="citizen-spinner" />
          <p>Loading your report history...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="citizen-page">
      <header className="citizen-page-header">
        <div>
          <p className="citizen-eyebrow">
            CITIZEN PORTAL / HISTORY
          </p>

          <h1>My Reports</h1>

          <p className="citizen-page-subtitle">
            View submitted issues, check their latest
            status, and read department updates.
          </p>
        </div>

        <button
          type="button"
          className="citizen-button citizen-button-secondary"
          onClick={() => loadReports(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div
          className="citizen-alert citizen-alert-error"
          role="alert"
        >
          {error}

          <button
            type="button"
            onClick={() => loadReports()}
          >
            Retry
          </button>
        </div>
      )}

      <section className="citizen-report-summary-row">
        <div>
          <strong>{reports.length}</strong>
          <span>Total reports</span>
        </div>

        <div>
          <strong>{inProgressCount}</strong>
          <span>In progress</span>
        </div>

        <div>
          <strong>{resolvedCount}</strong>
          <span>Resolved</span>
        </div>
      </section>

      <section className="citizen-card citizen-report-filter-card">
        <div className="citizen-filter-heading">
          <div>
            <h2>Find a report</h2>
            <p>
              Search and filter your report history.
            </p>
          </div>

          <button
            type="button"
            className="citizen-text-button"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>

        <div className="citizen-filter-grid">
          <label>
            <span>Search</span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Description, category, or location"
            />
          </label>

          <label>
            <span>Status</span>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="all">
                All statuses
              </option>

              {Object.entries(STATUS_LABELS).map(
                ([value, label]) => (
                  <option
                    value={value}
                    key={value}
                  >
                    {label}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span>Priority</span>

            <select
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value)
              }
            >
              <option value="all">
                All priorities
              </option>

              {Object.entries(
                PRIORITY_LABELS
              ).map(([value, label]) => (
                <option
                  value={value}
                  key={value}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="citizen-filter-result-count">
          Showing {filteredReports.length} of{" "}
          {reports.length} reports
        </p>
      </section>

      {filteredReports.length === 0 ? (
        <section className="citizen-card citizen-empty-state">
          <div className="citizen-empty-icon">
            ▤
          </div>

          <h2>
            {reports.length
              ? "No matching reports"
              : "No reports submitted"}
          </h2>

          <p>
            {reports.length
              ? "Try changing your search term or filters."
              : "Once you submit a civic issue, it will be listed here."}
          </p>

          {reports.length > 0 && (
            <button
              type="button"
              className="citizen-button citizen-button-secondary"
              onClick={clearFilters}
            >
              Reset filters
            </button>
          )}
        </section>
      ) : (
        <section className="citizen-my-report-list">
          {filteredReports.map((report) => {
            const description =
              typeof report.description === "string"
                ? report.description
                : "No description provided.";

            return (
              <article
                className="citizen-card citizen-my-report-card"
                key={report.id}
              >
                <div className="citizen-my-report-top">
                  <div>
                    <span className="citizen-report-category">
                      {report.predicted_category ||
                        "Civic issue"}
                    </span>

                    <h2>
                      {description.slice(0, 100)}
                      {description.length > 100
                        ? "…"
                        : ""}
                    </h2>

                    <small>
                      Submitted{" "}
                      {formatDate(
                        report.created_at
                      )}
                    </small>
                  </div>

                  <span
                    className={`citizen-status-badge status-${
                      report.status || "unknown"
                    }`}
                  >
                    {getStatusLabel(
                      report.status
                    )}
                  </span>
                </div>

                {imageUrls[report.id] && (
                  <img
                    className="citizen-report-evidence"
                    src={imageUrls[report.id]}
                    alt="Evidence attached to this civic report"
                  />
                )}

                <div className="citizen-report-details-grid">
                  <div>
                    <span>Priority</span>

                    <strong>
                      {getPriorityLabel(
                        report.priority
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Location</span>

                    <strong>
                      {report.address ||
                        "Not provided"}
                    </strong>
                  </div>

                  <div>
                    <span>Last updated</span>

                    <strong>
                      {formatDate(
                        report.updated_at
                      )}
                    </strong>
                  </div>
                </div>

                {report.resolution_notes && (
                  <div className="citizen-department-update">
                    <strong>
                      Department update
                    </strong>

                    <p>
                      {report.resolution_notes}
                    </p>
                  </div>
                )}

                <div className="citizen-report-card-actions">
                  <button
                    type="button"
                    className="citizen-button citizen-button-secondary"
                    onClick={() =>
                      setSelectedReport(
                        report
                      )
                    }
                  >
                    View full details
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {selectedReport && (
        <div
          className="citizen-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedReport(null);
            }
          }}
        >
          <section
            className="citizen-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="citizen-report-modal-title"
          >
            <div className="citizen-modal-header">
              <div>
                <p className="citizen-eyebrow">
                  REPORT DETAILS
                </p>

                <h2 id="citizen-report-modal-title">
                  {selectedReport.predicted_category ||
                    "Civic issue"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedReport(null)
                }
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="citizen-modal-body">
              <div className="citizen-modal-status-row">
                <span
                  className={`citizen-status-badge status-${
                    selectedReport.status ||
                    "unknown"
                  }`}
                >
                  {getStatusLabel(
                    selectedReport.status
                  )}
                </span>

                <span>
                  Priority:{" "}
                  {getPriorityLabel(
                    selectedReport.priority
                  )}
                </span>
              </div>

              <h3>Description</h3>

              <p className="citizen-modal-description">
                {selectedReport.description ||
                  "No description supplied."}
              </p>

              {imageUrls[selectedReport.id] && (
                <img
                  className="citizen-modal-image"
                  src={
                    imageUrls[
                      selectedReport.id
                    ]
                  }
                  alt="Uploaded report evidence"
                />
              )}

              <h3>Location</h3>

              <p>
                {selectedReport.address ||
                  "No address supplied."}
              </p>

              {selectedReport.latitude !==
                null &&
                selectedReport.latitude !==
                  undefined &&
                selectedReport.longitude !==
                  null &&
                selectedReport.longitude !==
                  undefined && (
                  <p>
                    Coordinates:{" "}
                    {Number(
                      selectedReport.latitude
                    ).toFixed(6)}
                    ,{" "}
                    {Number(
                      selectedReport.longitude
                    ).toFixed(6)}
                  </p>
                )}

              <h3>Department notes</h3>

              <p>
                {selectedReport.resolution_notes ||
                  "No department notes are available yet."}
              </p>

              <div className="citizen-modal-dates">
                <span>
                  Submitted:{" "}
                  {formatDate(
                    selectedReport.created_at
                  )}
                </span>

                <span>
                  Updated:{" "}
                  {formatDate(
                    selectedReport.updated_at
                  )}
                </span>
              </div>
            </div>

            <div className="citizen-modal-footer">
              <button
                type="button"
                className="citizen-button citizen-button-primary"
                onClick={() =>
                  setSelectedReport(null)
                }
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}