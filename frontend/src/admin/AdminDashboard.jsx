import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import './AdminDashboard.css'

function formatDate(value) {
  if (!value) return 'Date unavailable'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Date unavailable'
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLabel(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 'Unknown'
  }

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    )
}

export default function AdminDashboard() {
  const [stats, setStats] =
    useState({
      citizens: 0,
      departments: 0,
      reports: 0,
      pendingApplications: 0,
    })

  const [reportStats, setReportStats] =
    useState({
      pending: 0,
      inProgress: 0,
      resolved: 0,
    })

  const [recentReports, setRecentReports] =
    useState([])

  const [
    recentApplications,
    setRecentApplications,
  ] = useState([])

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [authorized, setAuthorized] =
    useState(false)

  const [error, setError] =
    useState('')

  const loadAdminDashboard =
    useCallback(
      async (isRefresh = false) => {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }

        setError('')

        try {
          const {
            data: authData,
            error: authError,
          } =
            await supabase.auth.getUser()

          if (authError) {
            throw authError
          }

          const user =
            authData?.user

          if (!user) {
            throw new Error(
              'Please sign in to access the admin dashboard.'
            )
          }

          const {
            data: profile,
            error:
              profileError,
          } = await supabase
            .from('profiles')
            .select('role')
            .eq(
              'id',
              user.id
            )
            .single()

          if (profileError) {
            throw profileError
          }

          if (
            profile?.role !==
            'admin'
          ) {
            setAuthorized(
              false
            )

            throw new Error(
              'Access denied. Administrator permissions are required.'
            )
          }

          setAuthorized(
            true
          )

          const [
            citizenCount,
            departmentCount,
            reportCount,
            applicationCount,
            pendingReports,
            inProgressReports,
            resolvedReports,
            reportResult,
            applicationResult,
            departmentResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'profiles'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .eq(
                  'role',
                  'citizen'
                ),

              supabase
                .from(
                  'departments'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .eq(
                  'active',
                  true
                ),

              supabase
                .from(
                  'reports'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                ),

              supabase
                .from(
                  'department_applications'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .eq(
                  'status',
                  'pending'
                ),

              supabase
                .from(
                  'reports'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .in(
                  'status',
                  [
                    'pending',
                    'submitted',
                    'under_review',
                  ]
                ),

              supabase
                .from(
                  'reports'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .in(
                  'status',
                  [
                    'in_progress',
                    'in progress',
                  ]
                ),

              supabase
                .from(
                  'reports'
                )
                .select(
                  'id',
                  {
                    count:
                      'exact',
                    head: true,
                  }
                )
                .eq(
                  'status',
                  'resolved'
                ),

              supabase
                .from(
                  'reports'
                )
                .select(
                  `
                    id,
                    description,
                    predicted_category,
                    priority,
                    status,
                    created_at
                  `
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(5),

              supabase
                .from(
                  'department_applications'
                )
                .select(
                  `
                    id,
                    applicant_id,
                    department_id,
                    contact_name,
                    official_email,
                    status,
                    created_at
                  `
                )
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(5),

              supabase
                .from(
                  'departments'
                )
                .select(
                  'id, name'
                ),
            ])

          const results = [
            citizenCount,
            departmentCount,
            reportCount,
            applicationCount,
            pendingReports,
            inProgressReports,
            resolvedReports,
            reportResult,
            applicationResult,
            departmentResult,
          ]

          const failedResult =
            results.find(
              (result) =>
                result.error
            )

          if (
            failedResult
          ) {
            throw failedResult.error
          }

          setStats({
            citizens:
              citizenCount.count ||
              0,

            departments:
              departmentCount.count ||
              0,

            reports:
              reportCount.count ||
              0,

            pendingApplications:
              applicationCount.count ||
              0,
          })

          setReportStats({
            pending:
              pendingReports.count ||
              0,

            inProgress:
              inProgressReports.count ||
              0,

            resolved:
              resolvedReports.count ||
              0,
          })

          setRecentReports(
            reportResult.data ||
            []
          )

          const departmentNames =
            new Map(
              (
                departmentResult.data ||
                []
              ).map(
                (
                  department
                ) => [
                  department.id,
                  department.name,
                ]
              )
            )

          setRecentApplications(
            (
              applicationResult.data ||
              []
            ).map(
              (
                application
              ) => ({
                ...application,

                departmentName:
                  departmentNames.get(
                    application.department_id
                  ) ||
                  'Department unavailable',
              })
            )
          )
        } catch (err) {
          setError(
            err?.message ||
              'Unable to load the admin dashboard.'
          )
        } finally {
          setLoading(
            false
          )

          setRefreshing(
            false
          )
        }
      },
      []
    )

  useEffect(() => {
    loadAdminDashboard()
  }, [
    loadAdminDashboard,
  ])

  if (loading) {
    return (
      <section className="admin-dashboard-page">
        <div className="admin-dashboard-message">
          Loading administrative dashboard...
        </div>
      </section>
    )
  }

  if (!authorized) {
    return (
      <section className="admin-dashboard-page">
        <div
          className="admin-dashboard-error"
          role="alert"
        >
          <h2>
            Administrator Access Required
          </h2>

          <p>
            {error ||
              'You are not authorized to access this page.'}
          </p>

          <button
            type="button"
            onClick={() =>
              loadAdminDashboard()
            }
          >
            Try Again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="admin-dashboard-page">
      <header className="admin-dashboard-header">
        <div>
          <p className="admin-dashboard-eyebrow">
            PATRIOT ADMINISTRATION
          </p>

          <h1>
            Admin Dashboard
          </h1>

          <p className="admin-dashboard-subtitle">
            Monitor civic reports, citizens
            and department operations.
          </p>
        </div>

        <button
          type="button"
          className="admin-dashboard-refresh"
          onClick={() =>
            loadAdminDashboard(
              true
            )
          }
          disabled={refreshing}
        >
          {refreshing
            ? 'Refreshing...'
            : 'Refresh Dashboard'}
        </button>
      </header>

      {error && (
        <div
          className="admin-dashboard-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="admin-dashboard-stats">
        <article className="admin-stat-card">
          <span>
            Total Citizens
          </span>

          <strong>
            {stats.citizens}
          </strong>

          <small>
            Registered citizen accounts
          </small>
        </article>

        <article className="admin-stat-card">
          <span>
            Active Departments
          </span>

          <strong>
            {stats.departments}
          </strong>

          <small>
            Currently active departments
          </small>
        </article>

        <article className="admin-stat-card">
          <span>
            Total Reports
          </span>

          <strong>
            {stats.reports}
          </strong>

          <small>
            Civic reports submitted
          </small>
        </article>

        <article className="admin-stat-card admin-stat-highlight">
          <span>
            Pending Applications
          </span>

          <strong>
            {stats.pendingApplications}
          </strong>

          <small>
            Awaiting administrator review
          </small>
        </article>
      </div>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section-heading">
          <div>
            <h2>
              Report Overview
            </h2>

            <p>
              Current status of civic
              complaints across the
              platform.
            </p>
          </div>
        </div>

        <div className="admin-report-overview">
          <div>
            <span className="admin-overview-dot pending-dot" />
            <span>
              Pending
            </span>

            <strong>
              {reportStats.pending}
            </strong>
          </div>

          <div>
            <span className="admin-overview-dot progress-dot" />
            <span>
              In Progress
            </span>

            <strong>
              {reportStats.inProgress}
            </strong>
          </div>

          <div>
            <span className="admin-overview-dot resolved-dot" />
            <span>
              Resolved
            </span>

            <strong>
              {reportStats.resolved}
            </strong>
          </div>
        </div>
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section-heading">
          <div>
            <h2>
              Recent Civic Reports
            </h2>

            <p>
              The five most recently
              submitted reports.
            </p>
          </div>
        </div>

        {recentReports.length ===
        0 ? (
          <div className="admin-dashboard-empty">
            No civic reports available.
          </div>
        ) : (
          <div className="admin-dashboard-table-wrapper">
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>
                    Category
                  </th>

                  <th>
                    Description
                  </th>

                  <th>
                    Priority
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Submitted
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentReports.map(
                  (report) => (
                    <tr
                      key={
                        report.id
                      }
                    >
                      <td>
                        {formatLabel(
                          report.predicted_category
                        )}
                      </td>

                      <td className="admin-report-description">
                        {report.description ||
                          'No description provided.'}
                      </td>

                      <td>
                        {formatLabel(
                          report.priority
                        )}
                      </td>

                      <td>
                        <span className="admin-table-status">
                          {formatLabel(
                            report.status
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          report.created_at
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-dashboard-section">
        <div className="admin-dashboard-section-heading">
          <div>
            <h2>
              Recent Department Applications
            </h2>

            <p>
              The five latest department
              registration requests.
            </p>
          </div>
        </div>

        {recentApplications.length ===
        0 ? (
          <div className="admin-dashboard-empty">
            No department applications
            available.
          </div>
        ) : (
          <div className="admin-dashboard-table-wrapper">
            <table className="admin-dashboard-table">
              <thead>
                <tr>
                  <th>
                    Contact Person
                  </th>

                  <th>
                    Department
                  </th>

                  <th>
                    Official Email
                  </th>

                  <th>
                    Status
                  </th>

                  <th>
                    Applied On
                  </th>
                </tr>
              </thead>

              <tbody>
                {recentApplications.map(
                  (
                    application
                  ) => (
                    <tr
                      key={
                        application.id
                      }
                    >
                      <td>
                        {application.contact_name ||
                          'Not provided'}
                      </td>

                      <td>
                        {
                          application.departmentName
                        }
                      </td>

                      <td>
                        {application.official_email ||
                          'Not provided'}
                      </td>

                      <td>
                        <span className="admin-table-status">
                          {formatLabel(
                            application.status
                          )}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          application.created_at
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}