import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './DepartmentApprovals.css';

function formatDate(value) {
  if (!value) return 'Not reviewed';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Not reviewed';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLabel(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Unknown';
  }

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DepartmentApprovals() {
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('pending');

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadApplications();
  }, []);

  async function loadApplications(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }

    setError('');
    setMessage('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in.');
      }

      const { data: profile, error: profileError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

      if (profileError) throw profileError;

      if (profile?.role !== 'admin') {
        throw new Error('Administrator access is required.');
      }

      const [
        { data: applicationData, error: applicationError },
        { data: departmentData, error: departmentError },
      ] = await Promise.all([
        supabase
          .from('department_applications')
          .select(`
            id,
            applicant_id,
            department_id,
            official_email,
            contact_name,
            notes,
            status,
            reviewed_by,
            reviewed_at,
            created_at
          `)
          .order('created_at', { ascending: false }),

        supabase
          .from('departments')
          .select('id, name, category, service_area')
          .order('name', { ascending: true }),
      ]);

      if (applicationError) throw applicationError;
      if (departmentError) throw departmentError;

      const departmentMap = new Map(
        (departmentData || []).map((department) => [
          department.id,
          department,
        ])
      );

      setApplications(
        (applicationData || []).map((application) => ({
          ...application,
          department:
            departmentMap.get(application.department_id) || null,
        }))
      );
    } catch (err) {
      setError(
        err.message || 'Unable to load department applications.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function reviewApplication(applicationId, decision) {
    const action =
      decision === 'approved' ? 'approve' : 'reject';

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this department application?`
    );

    if (!confirmed) return;

    setProcessingId(applicationId);
    setError('');
    setMessage('');

    try {
      const { error: reviewError } = await supabase.rpc(
        'review_department_application',
        {
          p_application_id: applicationId,
          p_decision: decision,
        }
      );

      if (reviewError) throw reviewError;

      await loadApplications(false);

      setMessage(
        decision === 'approved'
          ? 'Application approved and department membership activated.'
          : 'Department application rejected.'
      );
    } catch (err) {
      setError(
        err.message || 'Unable to process the application.'
      );
    } finally {
      setProcessingId(null);
    }
  }

  const counts = useMemo(
    () => ({
      pending: applications.filter(
        (item) => item.status === 'pending'
      ).length,

      approved: applications.filter(
        (item) => item.status === 'approved'
      ).length,

      rejected: applications.filter(
        (item) => item.status === 'rejected'
      ).length,
    }),
    [applications]
  );

  const filteredApplications = useMemo(
    () =>
      applications.filter(
        (application) => application.status === filter
      ),
    [applications, filter]
  );

  if (loading) {
    return (
      <section className="department-approvals-page">
        <div className="department-approvals-message">
          Loading department applications...
        </div>
      </section>
    );
  }

  return (
    <section className="department-approvals-page">
      <header className="department-approvals-header">
        <div>
          <p className="department-approvals-eyebrow">
            PATRIOT ADMINISTRATION / DEPARTMENTS
          </p>

          <h1>Department Approvals</h1>

          <p>
            Review registration requests and authorize verified
            department members.
          </p>
        </div>

        <button
          type="button"
          className="department-approvals-refresh"
          onClick={() => loadApplications()}
          disabled={Boolean(processingId)}
        >
          Refresh Applications
        </button>
      </header>

      <div className="department-approval-summary">
        <div>
          <span>Pending Review</span>
          <strong>{counts.pending}</strong>
        </div>

        <div>
          <span>Approved</span>
          <strong>{counts.approved}</strong>
        </div>

        <div>
          <span>Rejected</span>
          <strong>{counts.rejected}</strong>
        </div>
      </div>

      <nav className="department-approval-filters">
        {['pending', 'approved', 'rejected'].map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'active' : ''}
            onClick={() => setFilter(status)}
          >
            {formatLabel(status)}
            <span>{counts[status]}</span>
          </button>
        ))}
      </nav>

      {message && (
        <div
          className="department-approvals-success"
          role="status"
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div
          className="department-approvals-error"
          role="alert"
        >
          <strong>Action failed</strong>
          <p>{error}</p>
        </div>
      )}

      {filter === 'pending' && counts.pending > 0 && (
        <div
          style={{
            marginBottom: '18px',
            padding: '13px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            background: 'rgba(245, 158, 11, 0.08)',
            color: '#f5c76b',
            fontSize: '12px',
          }}
        >
          <strong>{counts.pending} application(s)</strong> are
          waiting for administrator review.
        </div>
      )}

      {filteredApplications.length === 0 ? (
        <div className="department-approvals-empty">
          <h3>
            No {formatLabel(filter).toLowerCase()} applications
          </h3>

          <p>
            There are currently no applications in this category.
          </p>
        </div>
      ) : (
        <div className="department-approval-list">
          {filteredApplications.map((application) => (
            <article
              className="department-approval-card"
              key={application.id}
            >
              <div className="department-approval-card-header">
                <div>
                  <span className="department-approval-id">
                    APPLICATION #{String(application.id).slice(0, 8)}
                  </span>

                  <h3>
                    {application.contact_name ||
                      'Unnamed applicant'}
                  </h3>

                  <p>
                    {application.official_email ||
                      'Email unavailable'}
                  </p>
                </div>

                <span
                  className={`department-approval-status status-${application.status}`}
                >
                  {formatLabel(application.status)}
                </span>
              </div>

              <div className="department-approval-details">
                <div>
                  <span>Requested Department</span>

                  <strong>
                    {application.department?.name ||
                      'Department unavailable'}
                  </strong>
                </div>

                <div>
                  <span>Department Category</span>

                  <strong>
                    {formatLabel(
                      application.department?.category
                    )}
                  </strong>
                </div>

                <div>
                  <span>Service Area</span>

                  <strong>
                    {application.department?.service_area ||
                      'Not specified'}
                  </strong>
                </div>

                <div>
                  <span>Applicant User ID</span>

                  <strong>
                    {application.applicant_id}
                  </strong>
                </div>

                <div>
                  <span>Application Submitted</span>

                  <strong>
                    {formatDate(application.created_at)}
                  </strong>
                </div>

                {application.reviewed_at && (
                  <div>
                    <span>Reviewed</span>

                    <strong>
                      {formatDate(application.reviewed_at)}
                    </strong>
                  </div>
                )}
              </div>

              {application.notes && (
                <div className="department-approval-notes">
                  <span>Applicant Notes</span>

                  <p>{application.notes}</p>
                </div>
              )}

              {application.status === 'pending' && (
                <div className="department-approval-actions">
                  <button
                    type="button"
                    className="department-approval-reject"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      reviewApplication(
                        application.id,
                        'rejected'
                      )
                    }
                  >
                    {processingId === application.id
                      ? 'Processing...'
                      : 'Reject Application'}
                  </button>

                  <button
                    type="button"
                    className="department-approval-approve"
                    disabled={Boolean(processingId)}
                    onClick={() =>
                      reviewApplication(
                        application.id,
                        'approved'
                      )
                    }
                  >
                    {processingId === application.id
                      ? 'Processing...'
                      : 'Approve Application'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}