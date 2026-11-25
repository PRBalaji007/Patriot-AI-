import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "../lib/supabaseClient";
import "./DepartmentNotifications.css";

function formatDate(value) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLabel(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Unknown";
  }

  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}

function getNotification(report) {
  const status = String(
    report.status || ""
  ).toLowerCase();

  const priority = String(
    report.priority || ""
  ).toLowerCase();

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
    createdTime + 60_000;

  if (
    ["critical", "urgent", "high"].includes(
      priority
    )
  ) {
    return {
      type: "priority",
      title: `${formatLabel(
        priority
      )} priority report`,
      message:
        "A high-priority civic report requires department attention.",
      time:
        report.updated_at ||
        report.created_at,
      icon: "!",
    };
  }

  if (wasUpdated) {
    return {
      type: "update",
      title: "Report updated",
      message: `The report status is currently ${formatLabel(
        status
      )}.`,
      time:
        report.updated_at ||
        report.created_at,
      icon: "↻",
    };
  }

  return {
    type: "new",
    title: "New report received",
    message:
      "A new civic report has been assigned to your department.",
    time: report.created_at,
    icon: "＋",
  };
}

export default function DepartmentNotifications() {
  const [notifications, setNotifications] =
    useState([]);

  const [departments, setDepartments] =
    useState([]);

  const [selectedDepartment, setSelectedDepartment] =
    useState("");

  const [filter, setFilter] =
    useState("all");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const fetchNotifications =
    useCallback(async (departmentId) => {
      if (!departmentId) {
        setNotifications([]);
        return;
      }

      const {
        data,
        error: reportError,
      } = await supabase
        .from("reports")
        .select(`
          id,
          department_id,
          description,
          predicted_category,
          priority,
          status,
          created_at,
          updated_at
        `)
        .eq(
          "department_id",
          departmentId
        )
        .order("updated_at", {
          ascending: false,
        });

      if (reportError) {
        throw reportError;
      }

      const generatedNotifications =
        (data || []).map(
          (report) => ({
            id: report.id,
            reportId: report.id,
            category:
              report.predicted_category,
            status: report.status,
            priority:
              report.priority,
            description:
              report.description,
            ...getNotification(
              report
            ),
          })
        );

      setNotifications(
        generatedNotifications
      );
    }, []);

  const loadNotifications =
    useCallback(
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
          } =
            await supabase.auth.getUser();

          if (authError) {
            throw authError;
          }

          const user =
            authData?.user;

          if (!user) {
            throw new Error(
              "Please sign in to view notifications."
            );
          }

          const {
            data: memberships,
            error:
              membershipError,
          } = await supabase
            .from(
              "department_members"
            )
            .select(
              "department_id"
            )
            .eq(
              "user_id",
              user.id
            )
            .eq(
              "active",
              true
            );

          if (
            membershipError
          ) {
            throw membershipError;
          }

          const departmentIds =
            [
              ...new Set(
                (
                  memberships ||
                  []
                ).map(
                  (item) =>
                    item.department_id
                )
              ),
            ].filter(Boolean);

          if (
            departmentIds.length ===
            0
          ) {
            setDepartments([]);
            setNotifications([]);

            throw new Error(
              "No active department membership was found for your account."
            );
          }

          const {
            data:
              departmentData,
            error:
              departmentError,
          } = await supabase
            .from("departments")
            .select(
              "id, name"
            )
            .in(
              "id",
              departmentIds
            )
            .order(
              "name",
              {
                ascending:
                  true,
              }
            );

          if (
            departmentError
          ) {
            throw departmentError;
          }

          const availableDepartments =
            departmentData ||
            [];

          setDepartments(
            availableDepartments
          );

          const departmentId =
            departmentIds.includes(
              selectedDepartment
            )
              ? selectedDepartment
              : departmentIds[0];

          setSelectedDepartment(
            departmentId
          );

          await fetchNotifications(
            departmentId
          );
        } catch (err) {
          setError(
            err?.message ||
              "Unable to load notifications."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        fetchNotifications,
        selectedDepartment,
      ]
    );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  async function handleDepartmentChange(
    event
  ) {
    const departmentId =
      event.target.value;

    setSelectedDepartment(
      departmentId
    );

    setFilter("all");
    setLoading(true);
    setError("");

    try {
      await fetchNotifications(
        departmentId
      );
    } catch (err) {
      setNotifications([]);

      setError(
        err?.message ||
          "Unable to load notifications."
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredNotifications =
    useMemo(() => {
      if (
        filter === "all"
      ) {
        return notifications;
      }

      return notifications.filter(
        (notification) =>
          notification.type ===
          filter
      );
    }, [
      notifications,
      filter,
    ]);

  const counts = useMemo(
    () => ({
      all:
        notifications.length,

      new:
        notifications.filter(
          (item) =>
            item.type ===
            "new"
        ).length,

      priority:
        notifications.filter(
          (item) =>
            item.type ===
            "priority"
        ).length,

      update:
        notifications.filter(
          (item) =>
            item.type ===
            "update"
        ).length,
    }),
    [notifications]
  );

  if (loading) {
    return (
      <section className="department-notifications-page">
        <div className="department-notifications-message">
          Loading department notifications...
        </div>
      </section>
    );
  }

  return (
    <section className="department-notifications-page">
      <header className="department-notifications-header">
        <div>
          <p className="department-notifications-eyebrow">
            DEPARTMENT ACTIVITY
          </p>

          <h1>
            Notifications
          </h1>

          <p className="department-notifications-subtitle">
            Stay informed about reports assigned
            to your department.
          </p>
        </div>

        <button
          type="button"
          className="department-notifications-refresh"
          onClick={() =>
            loadNotifications(
              true
            )
          }
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </header>

      {departments.length >
        1 && (
        <div className="department-notifications-department">
          <label htmlFor="notification-department">
            Select Department
          </label>

          <select
            id="notification-department"
            value={
              selectedDepartment
            }
            onChange={
              handleDepartmentChange
            }
          >
            {departments.map(
              (department) => (
                <option
                  key={
                    department.id
                  }
                  value={
                    department.id
                  }
                >
                  {
                    department.name
                  }
                </option>
              )
            )}
          </select>
        </div>
      )}

      <div className="department-notification-summary">
        <div>
          <span>
            Total Activity
          </span>

          <strong>
            {counts.all}
          </strong>
        </div>

        <div>
          <span>
            New Reports
          </span>

          <strong>
            {counts.new}
          </strong>
        </div>

        <div>
          <span>
            High Priority
          </span>

          <strong>
            {counts.priority}
          </strong>
        </div>

        <div>
          <span>
            Updated Reports
          </span>

          <strong>
            {counts.update}
          </strong>
        </div>
      </div>

      <nav
        className="department-notification-filters"
        aria-label="Notification filters"
      >
        {[
          {
            value: "all",
            label: "All Activity",
          },
          {
            value: "new",
            label: "New Reports",
          },
          {
            value: "priority",
            label: "High Priority",
          },
          {
            value: "update",
            label: "Updates",
          },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            className={
              filter ===
              item.value
                ? "active"
                : ""
            }
            onClick={() =>
              setFilter(
                item.value
              )
            }
          >
            {item.label}

            <span>
              {counts[
                item.value
              ]}
            </span>
          </button>
        ))}
      </nav>

      {error && (
        <div
          className="department-notifications-error"
          role="alert"
        >
          {error}

          <button
            type="button"
            onClick={() =>
              loadNotifications()
            }
          >
            Retry
          </button>
        </div>
      )}

      {!error &&
        filteredNotifications.length ===
          0 && (
          <div className="department-notifications-empty">
            <div className="department-notifications-empty-icon">
              ✓
            </div>

            <h3>
              No notifications
              available
            </h3>

            <p>
              There is no report
              activity to display
              for this department.
            </p>
          </div>
        )}

      {!error &&
        filteredNotifications.length >
          0 && (
          <div className="department-notification-list">
            {filteredNotifications.map(
              (notification) => (
                <article
                  key={`${notification.id}-${notification.type}`}
                  className={`department-notification-card notification-${notification.type}`}
                >
                  <div className="department-notification-icon">
                    {
                      notification.icon
                    }
                  </div>

                  <div className="department-notification-content">
                    <div className="department-notification-title-row">
                      <h3>
                        {
                          notification.title
                        }
                      </h3>

                      <time>
                        {formatDate(
                          notification.time
                        )}
                      </time>
                    </div>

                    <p>
                      {
                        notification.message
                      }
                    </p>

                    <div className="department-notification-meta">
                      <span>
                        Category:{" "}
                        {formatLabel(
                          notification.category
                        )}
                      </span>

                      <span>
                        Priority:{" "}
                        {formatLabel(
                          notification.priority
                        )}
                      </span>

                      <span>
                        Status:{" "}
                        {formatLabel(
                          notification.status
                        )}
                      </span>

                      <span>
                        Report:{" "}
                        {String(
                          notification.reportId ||
                            ""
                        ).slice(
                          0,
                          8
                        )}
                      </span>
                    </div>
                  </div>
                </article>
              )
            )}
          </div>
        )}
    </section>
  );
}