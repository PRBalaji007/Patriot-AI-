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

const STATUS_DESCRIPTIONS = {
  submitted: "Your report has been received.",
  under_review: "The responsible team is reviewing your report.",
  in_progress: "Work is currently in progress.",
  resolved: "The reported issue has been marked as resolved.",
  rejected: "The report was closed without further action.",
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

export default function CitizenDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async (isRefresh = false) => {
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
        setUser(null);
        setProfile(null);
        setReports([]);

        throw new Error(
          "Your session is unavailable. Please sign in again."
        );
      }

      setUser(currentUser);

      const [profileResult, reportResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, phone, role, created_at"
          )
          .eq("id", currentUser.id)
          .maybeSingle(),

        supabase
          .from("reports")
          .select(
            "id, description, priority, status, created_at, updated_at, predicted_category, address"
          )
          .eq("citizen_id", currentUser.id)
          .order("created_at", {
            ascending: false,
          })
          .limit(100),
      ]);

      if (profileResult.error) {
        throw profileResult.error;
      }

      if (reportResult.error) {
        throw reportResult.error;
      }

      if (
        profileResult.data &&
        profileResult.data.role &&
        profileResult.data.role !== "citizen"
      ) {
        throw new Error(
          "This dashboard is available to citizen accounts."
        );
      }

      setProfile(profileResult.data || null);
      setReports(reportResult.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load your dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const statistics = useMemo(() => {
    const count = (status) =>
      reports.filter(
        (report) => report.status === status
      ).length;

    return {
      total: reports.length,
      submitted: count("submitted"),
      underReview: count("under_review"),
      inProgress: count("in_progress"),
      resolved: count("resolved"),
      rejected: count("rejected"),
      active:
        count("submitted") +
        count("under_review") +
        count("in_progress"),
    };
  }, [reports]);

  const recentReports = useMemo(
    () => reports.slice(0, 5),
    [reports]
  );

  const displayName =
    profile?.display_name ||
    user?.email?.split("@")[0] ||
    "Citizen";

  if (loading) {
    return (
      <main className="citizen-page">
        <div className="citizen-loading-panel">
          <span className="citizen-spinner" />
          <p>Loading your citizen dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="citizen-page citizen-dashboard-page">
      <header className="citizen-page-header">
        <div>
          <p className="citizen-eyebrow">
            PATRIOT / CITIZEN PORTAL
          </p>

          <h1>Welcome back, {displayName}</h1>

          <p className="citizen-page-subtitle">
            Your civic reports, their progress, and the latest
            activity in one place.
          </p>
        </div>

        <button
          className="citizen-button citizen-button-secondary"
          type="button"
          onClick={() => loadDashboard(true)}
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
          <strong>Unable to load dashboard</strong>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => loadDashboard()}
          >
            Try again
          </button>
        </div>
      )}

      <section className="citizen-welcome-strip">
        <div>
          <span className="citizen-welcome-kicker">
            YOUR CIVIC CONTRIBUTION
          </span>

          <h2>
            Every report helps improve your community.
          </h2>

          <p>
            Submit clear details, attach supporting evidence,
            and follow the progress of your reports from this
            dashboard.
          </p>
        </div>

        <div
          className="citizen-welcome-mark"
          aria-hidden="true"
        >
          P
        </div>
      </section>

      <section className="citizen-section">
        <div className="citizen-section-heading">
          <div>
            <h2>Report overview</h2>
            <p>
              Current summary of your submitted reports
            </p>
          </div>
        </div>

        <div className="citizen-stat-grid">
          <article className="citizen-stat-card">
            <div className="citizen-stat-icon blue">
              ▤
            </div>

            <div>
              <span>Total reports</span>
              <strong>{statistics.total}</strong>
              <small>All reports submitted</small>
            </div>
          </article>

          <article className="citizen-stat-card">
            <div className="citizen-stat-icon violet">
              ◷
            </div>

            <div>
              <span>Under review</span>
              <strong>{statistics.underReview}</strong>
              <small>
                Awaiting review or assessment
              </small>
            </div>
          </article>

          <article className="citizen-stat-card">
            <div className="citizen-stat-icon amber">
              ⚙
            </div>

            <div>
              <span>In progress</span>
              <strong>{statistics.inProgress}</strong>
              <small>Being addressed by a team</small>
            </div>
          </article>

          <article className="citizen-stat-card">
            <div className="citizen-stat-icon green">
              ✓
            </div>

            <div>
              <span>Resolved</span>
              <strong>{statistics.resolved}</strong>
              <small>Marked as resolved</small>
            </div>
          </article>
        </div>
      </section>

      <section className="citizen-dashboard-columns">
        <div className="citizen-card citizen-recent-card">
          <div className="citizen-card-heading">
            <div>
              <h2>Recent reports</h2>
              <p>Your five latest submissions</p>
            </div>

            <span className="citizen-count-chip">
              {recentReports.length} shown
            </span>
          </div>

          {recentReports.length === 0 ? (
            <div className="citizen-empty-state">
              <div className="citizen-empty-icon">
                ▤
              </div>

              <h3>No reports submitted yet</h3>

              <p>
                Your report history will appear here after
                you submit your first civic issue.
              </p>
            </div>
          ) : (
            <div className="citizen-recent-list">
              {recentReports.map((report) => (
                <article
                  className="citizen-recent-item"
                  key={report.id}
                >
                  <div className="citizen-recent-item-main">
                    <div className="citizen-recent-title-row">
                      <strong>
                        {report.predicted_category ||
                          "Civic issue"}
                      </strong>

                      <span
                        className={`citizen-status-badge status-${
                          report.status || "unknown"
                        }`}
                      >
                        {getStatusLabel(report.status)}
                      </span>
                    </div>

                    <p>
                      {report.description ||
                        "No description provided."}
                    </p>

                    <div className="citizen-report-meta-line">
                      <span>
                        {formatDate(report.created_at)}
                      </span>

                      {report.address && (
                        <span>
                          • {report.address}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="citizen-card citizen-progress-card">
          <div className="citizen-card-heading">
            <div>
              <h2>Report status</h2>
              <p>
                Distribution by current status
              </p>
            </div>
          </div>

          <div className="citizen-progress-summary">
            <strong>{statistics.active}</strong>

            <span>
              reports requiring attention or action
            </span>
          </div>

          {[
            [
              "Submitted",
              statistics.submitted,
              "submitted",
            ],
            [
              "Under review",
              statistics.underReview,
              "under_review",
            ],
            [
              "In progress",
              statistics.inProgress,
              "in_progress",
            ],
            [
              "Resolved",
              statistics.resolved,
              "resolved",
            ],
            [
              "Rejected",
              statistics.rejected,
              "rejected",
            ],
          ].map(([label, value, key]) => {
            const percentage = statistics.total
              ? Math.round(
                  (value / statistics.total) * 100
                )
              : 0;

            return (
              <div
                className="citizen-progress-row"
                key={key}
              >
                <div className="citizen-progress-label">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>

                <div className="citizen-progress-track">
                  <span
                    className={`citizen-progress-fill fill-${key}`}
                    style={{
                      width: `${percentage}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}

          <p className="citizen-progress-footnote">
            Counts are calculated from the latest report
            records available to your account.
          </p>
        </aside>
      </section>

      <section className="citizen-card citizen-status-guide">
        <div className="citizen-card-heading">
          <div>
            <h2>Understanding report statuses</h2>

            <p>
              What each status means after you submit a
              report
            </p>
          </div>
        </div>

        <div className="citizen-status-guide-grid">
          {Object.entries(STATUS_LABELS).map(
            ([key, label]) => (
              <div
                className="citizen-status-guide-item"
                key={key}
              >
                <span
                  className={`citizen-status-dot dot-${key}`}
                />

                <div>
                  <strong>{label}</strong>

                  <p>
                    {STATUS_DESCRIPTIONS[key]}
                  </p>
                </div>
              </div>
            )
          )}
        </div>
      </section>

      <footer className="citizen-dashboard-footer">
        <span>
          {lastUpdated
            ? `Last refreshed: ${lastUpdated.toLocaleTimeString()}`
            : "Dashboard data"}
        </span>

        <span>
          Signed in as {user?.email || "Citizen"}
        </span>
      </footer>
    </main>
  );
}