import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { supabase } from '../lib/supabaseClient'
import './AdminNotifications.css'

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

export default function AdminNotifications() {
  const [activities, setActivities] =
    useState([])

  const [filter, setFilter] =
    useState('all')

  const [loading, setLoading] =
    useState(true)

  const [refreshing, setRefreshing] =
    useState(false)

  const [error, setError] =
    useState('')

  const loadActivities =
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
              'Please sign in to continue.'
            )
          }

          const {
            data: profile,
            error:
              profileError,
          } = await supabase
            .from('profiles')
            .select(
              'role'
            )
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
            throw new Error(
              'Administrator access is required.'
            )
          }

          const [
            reportResult,
            applicationResult,
            departmentResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  'reports'
                )
                .select(`
                  id,
                  description,
                  predicted_category,
                  priority,
                  status,
                  created_at,
                  updated_at
                `)
                .order(
                  'updated_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(100),

              supabase
                .from(
                  'department_applications'
                )
                .select(`
                  id,
                  department_id,
                  contact_name,
                  official_email,
                  status,
                  created_at,
                  reviewed_at
                `)
                .order(
                  'created_at',
                  {
                    ascending:
                      false,
                  }
                )
                .limit(100),

              supabase
                .from(
                  'departments'
                )
                .select(
                  'id, name'
                ),
            ])

          if (
            reportResult.error
          ) {
            throw reportResult.error
          }

          if (
            applicationResult.error
          ) {
            throw applicationResult.error
          }

          if (
            departmentResult.error
          ) {
            throw departmentResult.error
          }

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

          const reportActivities =
            (
              reportResult.data ||
              []
            ).map(
              (report) => {
                const createdTime =
                  report.created_at
                    ? new Date(
                        report.created_at
                      ).getTime()
                    : 0

                const updatedTime =
                  report.updated_at
                    ? new Date(
                        report.updated_at
                      ).getTime()
                    : createdTime

                const isUpdated =
                  updatedTime >
                  createdTime +
                    60_000

                const priority =
                  String(
                    report.priority ||
                      ''
                  ).toLowerCase()

                const isHighPriority =
                  [
                    'high',
                    'critical',
                    'urgent',
                  ].includes(
                    priority
                  )

                let type =
                  'report'

                let title =
                  'New civic report submitted'

                let message =
                  'A citizen submitted a civic report.'

                if (
                  isHighPriority
                ) {
                  type =
                    'priority'

                  title = `${formatLabel(
                    report.priority
                  )} priority report`

                  message =
                    'A high-priority civic issue requires administrator attention.'
                } else if (
                  isUpdated
                ) {
                  type =
                    'update'

                  title =
                    'Civic report updated'

                  message = `Current status: ${formatLabel(
                    report.status
                  )}.`
                }

                return {
                  id: `report-${report.id}`,
                  type,
                  title,
                  message,
                  category:
                    formatLabel(
                      report.predicted_category
                    ),
                  status:
                    formatLabel(
                      report.status
                    ),
                  priority:
                    formatLabel(
                      report.priority
                    ),
                  reference:
                    report.id,
                  time:
                    isUpdated
                      ? report.updated_at
                      : report.created_at,
                }
              }
            )

          const applicationActivities =
            (
              applicationResult.data ||
              []
            ).map(
              (application) => {
                const status =
                  String(
                    application.status ||
                      ''
                  ).toLowerCase()

                const reviewed =
                  [
                    'approved',
                    'rejected',
                  ].includes(
                    status
                  )

                return {
                  id: `application-${application.id}`,
                  type:
                    reviewed
                      ? 'review'
                      : 'application',

                  title:
                    reviewed
                      ? `Department application ${formatLabel(
                          status
                        ).toLowerCase()}`
                      : 'New department application',

                  message:
                    reviewed
                      ? `The application submitted by ${
                          application.contact_name ||
                          'an applicant'
                        } was ${status}.`
                      : `${
                          application.contact_name ||
                          'An applicant'
                        } submitted a department registration request.`,

                  category:
                    departmentNames.get(
                      application.department_id
                    ) ||
                    'Unknown department',

                  status:
                    formatLabel(
                      application.status
                    ),

                  priority:
                    'Normal',

                  reference:
                    application.id,

                  time:
                    application.reviewed_at ||
                    application.created_at,

                  contact:
                    application.contact_name,

                  email:
                    application.official_email,
                }
              }
            )

          const combinedActivities = [
            ...reportActivities,
            ...applicationActivities,
          ].sort(
            (a, b) => {
              const timeA =
                new Date(
                  a.time
                ).getTime()

              const timeB =
                new Date(
                  b.time
                ).getTime()

              return (
                timeB -
                timeA
              )
            }
          )

          setActivities(
            combinedActivities
          )
        } catch (err) {
          setError(
            err?.message ||
              'Unable to load administrative activity.'
          )
        } finally {
          setLoading(false)
          setRefreshing(false)
        }
      },
      []
    )

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  const counts =
    useMemo(
      () => ({
        all:
          activities.length,

        report:
          activities.filter(
            (item) =>
              item.type ===
              'report'
          ).length,

        priority:
          activities.filter(
            (item) =>
              item.type ===
              'priority'
          ).length,

        application:
          activities.filter(
            (item) =>
              item.type ===
              'application'
          ).length,

        review:
          activities.filter(
            (item) =>
              item.type ===
              'review'
          ).length,

        update:
          activities.filter(
            (item) =>
              item.type ===
              'update'
          ).length,
      }),
      [activities]
    )

  const filteredActivities =
    useMemo(() => {
      if (
        filter ===
        'all'
      ) {
        return activities
      }

      return activities.filter(
        (item) =>
          item.type ===
          filter
      )
    }, [
      activities,
      filter,
    ])

  if (loading) {
    return (
      <section className="admin-notifications-page">
        <div className="admin-notifications-message">
          Loading administrative activity...
        </div>
      </section>
    )
  }

  return (
    <section className="admin-notifications-page">
      <header className="admin-notifications-header">
        <div>
          <p className="admin-notifications-eyebrow">
            PATRIOT ADMINISTRATION
          </p>

          <h1>
            Notifications & Activity
          </h1>

          <p>
            Monitor recent reports and
            department application activity.
          </p>
        </div>

        <button
          type="button"
          className="admin-notifications-refresh"
          onClick={() =>
            loadActivities(
              true
            )
          }
          disabled={refreshing}
        >
          {refreshing
            ? 'Refreshing...'
            : 'Refresh Activity'}
        </button>
      </header>

      {error && (
        <div
          className="admin-notifications-error"
          role="alert"
        >
          <span>
            {error}
          </span>

          <button
            type="button"
            onClick={() =>
              loadActivities()
            }
          >
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="admin-notification-summary">
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
                {counts.report}
              </strong>
            </div>

            <div>
              <span>
                Priority Alerts
              </span>

              <strong>
                {counts.priority}
              </strong>
            </div>

            <div>
              <span>
                Applications
              </span>

              <strong>
                {counts.application}
              </strong>
            </div>
          </div>

          <nav className="admin-notification-filters">
            {[
              [
                'all',
                'All Activity',
              ],
              [
                'report',
                'New Reports',
              ],
              [
                'priority',
                'Priority Alerts',
              ],
              [
                'application',
                'Applications',
              ],
              [
                'review',
                'Application Reviews',
              ],
              [
                'update',
                'Report Updates',
              ],
            ].map(
              ([
                value,
                label,
              ]) => (
                <button
                  type="button"
                  key={
                    value
                  }
                  className={
                    filter ===
                    value
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setFilter(
                      value
                    )
                  }
                >
                  {label}

                  <span>
                    {
                      counts[
                        value
                      ]
                    }
                  </span>
                </button>
              )
            )}
          </nav>

          {filteredActivities.length ===
          0 ? (
            <div className="admin-notifications-empty">
              <h3>
                No activity available
              </h3>

              <p>
                There are no activities
                in this category.
              </p>
            </div>
          ) : (
            <div className="admin-notification-list">
              {filteredActivities.map(
                (activity) => (
                  <article
                    className={`admin-notification-card notification-${activity.type}`}
                    key={
                      activity.id
                    }
                  >
                    <div className="admin-notification-icon">
                      {activity.type ===
                      'priority'
                        ? '!'
                        : activity.type ===
                          'application'
                          ? 'A'
                          : activity.type ===
                            'review'
                            ? '✓'
                            : activity.type ===
                              'update'
                              ? '↻'
                              : 'R'}
                    </div>

                    <div className="admin-notification-content">
                      <div className="admin-notification-heading">
                        <h3>
                          {
                            activity.title
                          }
                        </h3>

                        <time>
                          {formatDate(
                            activity.time
                          )}
                        </time>
                      </div>

                      <p>
                        {
                          activity.message
                        }
                      </p>

                      <div className="admin-notification-meta">
                        <span>
                          {
                            activity.category
                          }
                        </span>

                        <span>
                          Status:{' '}
                          {
                            activity.status
                          }
                        </span>

                        <span>
                          Priority:{' '}
                          {
                            activity.priority
                          }
                        </span>

                        <span>
                          Reference:{' '}
                          {String(
                            activity.reference ||
                              ''
                          ).slice(
                            0,
                            8
                          )}
                        </span>
                      </div>

                      {activity.email && (
                        <p className="admin-notification-contact">
                          Contact:{' '}
                          {activity.contact ||
                            'Not provided'}{' '}
                          ·{' '}
                          {
                            activity.email
                          }
                        </p>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}

          <p className="admin-notifications-count">
            Showing{' '}
            {
              filteredActivities.length
            }{' '}
            of{' '}
            {
              activities.length
            }{' '}
            activities
          </p>
        </>
      )}
    </section>
  )
}