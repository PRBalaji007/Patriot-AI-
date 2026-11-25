import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './AdminReports.css'

export default function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    loadReports()
  }, [])

  async function loadReports() {
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          citizen_id,
          department_id,
          description,
          image_path,
          priority,
          status,
          address,
          latitude,
          longitude,
          created_at
        `)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setReports(data || [])
    } catch (err) {
      console.error('Admin reports error:', err)
      setError(err.message || 'Unable to load reports.')
    } finally {
      setLoading(false)
    }
  }

  async function getImageUrl(imagePath) {
    if (!imagePath) return null

    const { data, error } = await supabase.storage
      .from('report-images')
      .createSignedUrl(imagePath, 3600)

    if (error) {
      console.error('Image URL error:', error)
      return null
    }

    return data?.signedUrl || null
  }

  async function openReport(report) {
    setSelectedReport({
      ...report,
      imageUrl: null,
    })

    if (report.image_path) {
      const imageUrl = await getImageUrl(report.image_path)

      setSelectedReport(current =>
        current
          ? {
              ...current,
              imageUrl,
            }
          : null
      )
    }
  }

  function formatDate(date) {
    if (!date) return '-'

    return new Date(date).toLocaleString()
  }

  function statusLabel(status) {
    if (!status) return 'Submitted'

    return status
      .replaceAll('_', ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
  }

  function priorityLabel(priority) {
    if (!priority) return 'Normal'

    return priority
      .replaceAll('_', ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase())
  }

  return (
    <section className="admin-reports-page">

      <div className="admin-reports-header">
        <div>
          <p className="admin-eyebrow">ADMINISTRATION / REPORTS</p>

          <h1>Citizen Reports</h1>

          <p className="admin-reports-subtitle">
            Review civic issues submitted by citizens through PATRIOT.
          </p>
        </div>

        <button
          type="button"
          className="admin-refresh-button"
          onClick={loadReports}
          disabled={loading}
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      <div className="admin-report-summary">
        <div className="admin-summary-card">
          <span>Total Reports</span>
          <strong>{reports.length}</strong>
        </div>

        <div className="admin-summary-card">
          <span>Pending</span>
          <strong>
            {reports.filter(report => !report.status || report.status === 'pending').length}
          </strong>
        </div>

        <div className="admin-summary-card">
          <span>High Priority</span>
          <strong>
            {reports.filter(report => report.priority === 'high').length}
          </strong>
        </div>
      </div>

      {error && (
        <div className="admin-report-error">
          <strong>Unable to load reports</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="admin-report-empty">
          <div className="admin-loading-spinner" />
          <p>Loading citizen reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="admin-report-empty">
          <div className="admin-empty-icon">▤</div>

          <h2>No reports yet</h2>

          <p>
            Citizen reports submitted through PATRIOT will appear here.
          </p>
        </div>
      ) : (
        <div className="admin-reports-table-wrapper">

          <table className="admin-reports-table">

            <thead>
              <tr>
                <th>Report</th>
                <th>Description</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Location</th>
                <th>Submitted</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {reports.map(report => (
                <tr key={report.id}>

                  <td>
                    <div className="admin-report-id">
                      #{report.id.slice(0, 8)}
                    </div>

                    {report.image_path ? (
                      <span className="admin-image-badge">
                        Image attached
                      </span>
                    ) : (
                      <span className="admin-no-image">
                        No image
                      </span>
                    )}
                  </td>

                  <td>
                    <div className="admin-description-cell">
                      {report.description || '-'}
                    </div>
                  </td>

                  <td>
                    <span
                      className={`admin-priority admin-priority-${report.priority || 'normal'}`}
                    >
                      {priorityLabel(report.priority)}
                    </span>
                  </td>

                  <td>
                    <span
                      className={`admin-status admin-status-${report.status || 'pending'}`}
                    >
                      {statusLabel(report.status)}
                    </span>
                  </td>

                  <td>
                    <div className="admin-location-cell">
                      {report.address || 'Location captured'}
                    </div>
                  </td>

                  <td>
                    {formatDate(report.created_at)}
                  </td>

                  <td>
                    <button
                      type="button"
                      className="admin-view-button"
                      onClick={() => openReport(report)}
                    >
                      View
                    </button>
                  </td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}

      {selectedReport && (
        <div
          className="admin-report-modal-overlay"
          onClick={() => setSelectedReport(null)}
        >
          <div
            className="admin-report-modal"
            onClick={event => event.stopPropagation()}
          >

            <div className="admin-modal-header">
              <div>
                <p className="admin-eyebrow">REPORT DETAILS</p>

                <h2>
                  #{selectedReport.id.slice(0, 8)}
                </h2>
              </div>

              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedReport(null)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-content">

              <div className="admin-detail-section">

                <h3>Citizen Report</h3>

                <p className="admin-detail-description">
                  {selectedReport.description}
                </p>

              </div>

              <div className="admin-detail-grid">

                <div>
                  <span>Priority</span>

                  <strong>
                    {priorityLabel(selectedReport.priority)}
                  </strong>
                </div>

                <div>
                  <span>Status</span>

                  <strong>
                    {statusLabel(selectedReport.status)}
                  </strong>
                </div>

                <div>
                  <span>Address</span>

                  <strong>
                    {selectedReport.address || 'Not provided'}
                  </strong>
                </div>

                <div>
                  <span>Submitted</span>

                  <strong>
                    {formatDate(selectedReport.created_at)}
                  </strong>
                </div>

              </div>

              {selectedReport.image_path && (
                <div className="admin-detail-section">

                  <h3>Evidence Image</h3>

                  {selectedReport.imageUrl ? (
                    <img
                      src={selectedReport.imageUrl}
                      alt="Citizen submitted evidence"
                      className="admin-report-image"
                    />
                  ) : (
                    <div className="admin-image-loading">
                      Loading image...
                    </div>
                  )}

                </div>
              )}

              {(selectedReport.latitude !== null ||
                selectedReport.longitude !== null) && (
                <div className="admin-detail-section">

                  <h3>Location Coordinates</h3>

                  <p>
                    Latitude: {selectedReport.latitude ?? '-'}
                  </p>

                  <p>
                    Longitude: {selectedReport.longitude ?? '-'}
                  </p>

                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </section>
  )
}