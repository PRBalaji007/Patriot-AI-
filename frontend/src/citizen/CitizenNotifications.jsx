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

export default function CitizenNotifications() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  const loadActivity = useCallback(
    async (isRefresh = false) => {
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
            "Please sign in to view your activity."
          );
        }

        const {
          data,
          error: queryError,
        } = await supabase
          .from("reports")
          .select(
            "id, description, status, priority, created_at, updated_at, resolution_notes, predicted_category"
          )
          .eq("citizen_id", currentUser.id)
          .order("updated_at", {
            ascending: false,
          })
          .limit(100);

        if (queryError) {
          throw queryError;
        }

        const activityItems = (data || []).map(
          (report) => {
            const createdTime = report.created_at
              ? new Date(
                  report.created_at
                ).getTime()
              : 0;

            const updatedTime = report.updated_at
              ? new Date(
                  report.updated_at
                ).getTime()
              : createdTime;

            const wasUpdated =
              updatedTime >
              createdTime + 1000;

            return {
              id: report.id,
              type: wasUpdated
                ? "update"
                : "submitted",

              title: wasUpdated
                ? "Report activity updated"
                : "Report submitted",

              description: wasUpdated
                ? report.resolution_notes ||
                  `The current report status is ${
                    getStatusLabel(
                      report.status
                    )
                  }.`
                : "Your civic report has been recorded in PATRIOT.",

              status: report.status,
              priority: report.priority,
              category:
                report.predicted_category ||
                "Civic issue",

              date: wasUpdated
                ? report.updated_at
                : report.created_at,
            };
          }
        );

        setEvents(activityItems);
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load your activity."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return events;
    }

    return events.filter(
      (event) => event.type === filter
    );
  }, [events, filter]);

  const updateCount = events.filter(
    (event) => event.type === "update"
  ).length;

  const submissionCount = events.filter(
    (event) => event.type === "submitted"
  ).length;

  if (loading) {
    return (
      <main className="citizen-page">
        <div className="citizen-loading-panel">
          <span className="citizen-spinner" />
          <p>Loading your activity...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="citizen-page">
      <header className="citizen-page-header">
        <div>
          <p className="citizen-eyebrow">
            CITIZEN PORTAL / ACTIVITY
          </p>

          <h1>Notifications & Activity</h1>

          <p className="citizen-page-subtitle">
            Review report submissions and activity
            reflected by the latest report records.
          </p>
        </div>

        <button
          type="button"
          className="citizen-button citizen-button-secondary"
          onClick={() => loadActivity(true)}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div
          className="citizen-alert citizen-alert-error"
          role="alert"
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => loadActivity()}
          >
            Retry
          </button>
        </div>
      )}

      <section className="citizen-notification-summary">
        <div>
          <strong>{events.length}</strong>
          <span>Activity items</span>
        </div>

        <div>
          <strong>{submissionCount}</strong>
          <span>Submissions</span>
        </div>

        <div>
          <strong>{updateCount}</strong>
          <span>Updated records</span>
        </div>
      </section>

      <section className="citizen-card citizen-notification-panel">
        <div className="citizen-filter-heading">
          <div>
            <h2>Recent activity</h2>

            <p>
              Activity is generated from your report
              records.
            </p>
          </div>

          <div className="citizen-filter-buttons">
            {[
              ["all", "All"],
              ["submitted", "Submissions"],
              ["update", "Updates"],
            ].map(([value, label]) => (
              <button
                type="button"
                key={value}
                className={
                  filter === value
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setFilter(value)
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="citizen-empty-state">
            <div className="citizen-empty-icon">
              ◉
            </div>

            <h3>
              No activity to display
            </h3>

            <p>
              {events.length
                ? "There are no items in this activity filter."
                : "When you submit reports, related activity will appear here."}
            </p>
          </div>
        ) : (
          <div className="citizen-activity-list">
            {filteredEvents.map((event) => (
              <article
                className="citizen-activity-item"
                key={`${event.id}-${event.type}`}
              >
                <div
                  className={`citizen-activity-symbol ${event.type}`}
                >
                  {event.type === "submitted"
                    ? "↗"
                    : "↻"}
                </div>

                <div className="citizen-activity-content">
                  <div className="citizen-activity-heading">
                    <div>
                      <h3>{event.title}</h3>

                      <span>
                        {event.category}
                      </span>
                    </div>

                    <time>
                      {formatDate(
                        event.date
                      )}
                    </time>
                  </div>

                  <p>
                    {event.description}
                  </p>

                  <div className="citizen-activity-tags">
                    <span
                      className={`citizen-status-badge status-${
                        event.status ||
                        "unknown"
                      }`}
                    >
                      {getStatusLabel(
                        event.status
                      )}
                    </span>

                    <span className="citizen-priority-tag">
                      Priority:{" "}
                      {event.priority ||
                        "Not specified"}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="citizen-information-note">
        <strong>
          About this activity feed
        </strong>

        <p>
          The current PATRIOT database does not
          contain a dedicated notifications table.
          This page derives activity from report
          creation and update timestamps, along
          with the current status and department
          notes. It does not store read/unread state
          or reconstruct every individual status
          change.
        </p>
      </div>
    </main>
  );
}