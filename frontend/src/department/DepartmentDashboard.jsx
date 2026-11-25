import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import "./DepartmentDashboard.css";

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

function formatStatus(value) {
  if (!value) return "Pending";

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export default function DepartmentDashboard({
  departmentId: selectedDepartmentId,
}) {
  const [department, setDepartment] =
    useState(null);

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
  });

  const [recentReports, setRecentReports] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadDashboard = useCallback(
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

        const user = authData?.user;

        if (
          !user ||
          !user.email_confirmed_at
        ) {
          throw new Error(
            "Please sign in with a verified account."
          );
        }

        const {
          data: membership,
          error: membershipError,
        } = await supabase
          .from("department_members")
          .select("department_id")
          .eq("user_id", user.id)
          .eq("active", true)
          .maybeSingle();

        if (membershipError) {
          throw membershipError;
        }

        if (!membership) {
          throw new Error(
            "No active department membership was found."
          );
        }

        if (
          selectedDepartmentId &&
          selectedDepartmentId !==
            membership.department_id
        ) {
          throw new Error(
            "You are not authorized for this department."
          );
        }

        const departmentId =
          membership.department_id;

        const {
          data: departmentData,
          error: departmentError,
        } = await supabase
          .from("departments")
          .select(
            "id, name, category, service_area"
          )
          .eq("id", departmentId)
          .eq("active", true)
          .single();

        if (departmentError) {
          throw departmentError;
        }

        setDepartment(
          departmentData
        );

        const {
          data: reports,
          error: reportsError,
        } = await supabase
          .from("reports")
          .select("*")
          .eq(
            "department_id",
            departmentId
          )
          .order("created_at", {
            ascending: false,
          });

        if (reportsError) {
          throw reportsError;
        }

        const reportList =
          Array.isArray(reports)
            ? reports
            : [];

        const pendingCount =
          reportList.filter(
            (report) =>
              [
                "pending",
                "submitted",
                "under_review",
              ].includes(
                normalizeStatus(
                  report.status
                )
              )
          ).length;

        const inProgressCount =
          reportList.filter(
            (report) =>
              normalizeStatus(
                report.status
              ) === "in_progress"
          ).length;

        const resolvedCount =
          reportList.filter(
            (report) =>
              normalizeStatus(
                report.status
              ) === "resolved"
          ).length;

        setStats({
          total: reportList.length,
          pending: pendingCount,
          inProgress:
            inProgressCount,
          resolved:
            resolvedCount,
        });

        setRecentReports(
          reportList.slice(0, 5)
        );
      } catch (err) {
        setError(
          err?.message ||
            "Unable to load department dashboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDepartmentId]
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const resolutionRate = useMemo(() => {
    if (!stats.total) {
      return 0;
    }

    return Math.round(
      (stats.resolved /
        stats.total) *
        100
    );
  }, [
    stats.total,
    stats.resolved,
  ]);

  if (loading) {
    return (
      <section className="dept-dashboard">
        <div className="dept-dashboard-message">
          Loading department dashboard...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dept-dashboard">
        <div className="dept-dashboard-error">
          <h2>
            Department access unavailable
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              loadDashboard()
            }
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="dept-dashboard">
      <header className="dept-dashboard-header">
        <div>
          <span className="dept-eyebrow">
            PATRIOT AUTHORITY PORTAL
          </span>

          <h1>
            {department?.name ||
              "Department Dashboard"}
          </h1>

          <p>
            {department?.category ||
              "Department"}

            {department?.service_area
              ? ` · ${department.service_area}`
              : ""}
          </p>
        </div>

        <button
          type="button"
          className="dept-refresh-button"
          onClick={() =>
            loadDashboard(true)
          }
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh"}
        </button>
      </header>

      <div className="dept-welcome">
        <div>
          <span>
            DEPARTMENT OVERVIEW
          </span>

          <h2>
            Welcome to your workspace.
          </h2>

          <p>
            Monitor assigned civic reports
            and follow their progress.
          </p>
        </div>

        <div
          className="dept-welcome-icon"
          aria-hidden="true"
        >
          ⌂
        </div>
      </div>

      <div className="dept-stats-grid">
        <article className="dept-stat-card">
          <span className="dept-stat-icon">
            ▤
          </span>

          <span className="dept-stat-label">
            Total Reports
          </span>

          <strong>
            {stats.total}
          </strong>
        </article>

        <article className="dept-stat-card">
          <span className="dept-stat-icon">
            ◷
          </span>

          <span className="dept-stat-label">
            Pending
          </span>

          <strong>
            {stats.pending}
          </strong>
        </article>

        <article className="dept-stat-card">
          <span className="dept-stat-icon">
            ↻
          </span>

          <span className="dept-stat-label">
            In Progress
          </span>

          <strong>
            {stats.inProgress}
          </strong>
        </article>

        <article className="dept-stat-card">
          <span className="dept-stat-icon">
            ✓
          </span>

          <span className="dept-stat-label">
            Resolved
          </span>

          <strong>
            {stats.resolved}
          </strong>
        </article>
      </div>

      <div className="dept-reports-card">
        <div className="dept-card-heading">
          <div>
            <h2>
              Recent Assigned Reports
            </h2>

            <p>
              Latest reports available to
              your department.
            </p>
          </div>

          <span className="dept-report-count">
            {recentReports.length} shown
          </span>
        </div>

        {recentReports.length === 0 ? (
          <div className="dept-empty-state">
            <span>▤</span>

            <h3>
              No reports available
            </h3>

            <p>
              Assigned civic reports will
              appear here.
            </p>
          </div>
        ) : (
          <div className="dept-report-list">
            {recentReports.map(
              (report) => {
                const status =
                  normalizeStatus(
                    report.status
                  ) || "pending";

                return (
                  <article
                    className="dept-report-row"
                    key={report.id}
                  >
                    <div className="dept-report-info">
                      <h3>
                        {report.predicted_category ||
                          report.title ||
                          report.category ||
                          "Civic Report"}
                      </h3>

                      <p>
                        {report.description ||
                          "No description provided."}
                      </p>

                      <small>
                        {formatDate(
                          report.created_at
                        )}
                      </small>
                    </div>

                    <span
                      className={`dept-report-status ${status}`}
                    >
                      {formatStatus(
                        report.status
                      )}
                    </span>
                  </article>
                );
              }
            )}
          </div>
        )}
      </div>

      <div className="dept-dashboard-footer">
        <div>
          <span>Resolution rate</span>

          <strong>
            {resolutionRate}%
          </strong>
        </div>

        <p>
          Based on the current reports assigned
          to this department.
        </p>
      </div>
    </section>
  );
}