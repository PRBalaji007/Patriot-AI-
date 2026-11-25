
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './DepartmentReports.css';

function formatDate(value) {
  if (!value) return 'Date unavailable';

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatConfidence(value) {
  if (value === null || value === undefined) return 'Not available';

  const percentage = value <= 1 ? value * 100 : value;
  return `${percentage.toFixed(1)}%`;
}

function formatLabel(value) {
  if (!value) return 'Unknown';

  return value
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function DepartmentReports() {
  const [reports, setReports] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDepartmentReports();
  }, []);

  async function loadDepartmentReports() {
    setLoading(true);
    setError('');

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error('Please sign in to view department reports.');

      const { data: memberships, error: membershipError } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('user_id', user.id)
        .eq('active', true);

      if (membershipError) throw membershipError;

      const departmentIds = [
        ...new Set((memberships || []).map((item) => item.department_id)),
      ].filter(Boolean);

      if (departmentIds.length === 0) {
        setDepartments([]);
        setReports([]);
        setError('No active department membership was found for your account.');
        return;
      }

      const { data: departmentData, error: departmentError } = await supabase
        .from('departments')
        .select('id, name, category, service_area')
        .in('id', departmentIds);

      if (departmentError) throw departmentError;

      setDepartments(departmentData || []);

     const initialDepartmentId = departmentIds.includes(selectedDepartment)
        ? selectedDepartment
         : departmentIds[0];

    setSelectedDepartment(initialDepartmentId);

      await fetchReports(initialDepartmentId);
    } catch (err) {
      setError(err.message || 'Unable to load department reports.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchReports(departmentId) {
    if (!departmentId) {
      setReports([]);
      return;
    }

    const { data, error: reportError } = await supabase
      .from('reports')
      .select(`
        id,
        citizen_id,
        department_id,
        description,
        image_path,
        latitude,
        longitude,
        address,
        predicted_category,
        model_name,
        confidence,
        priority,
        status,
        resolution_notes,
        created_at,
        updated_at
      `)
      .eq('department_id', departmentId)
      .order('created_at', { ascending: false });

    if (reportError) throw reportError;

    setReports(data || []);
  }

  async function handleDepartmentChange(event) {
    const departmentId = event.target.value;
    setSelectedDepartment(departmentId);
    setStatusFilter('all');
    setPriorityFilter('all');
    setSearchTerm('');

    setLoading(true);
    setError('');

    try {
      await fetchReports(departmentId);
    } catch (err) {
      setReports([]);
      setError(err.message || 'Unable to load reports.');
    } finally {
      setLoading(false);
    }
  }

  const statuses = useMemo(
    () => [...new Set(reports.map((report) => report.status).filter(Boolean))],
    [reports]
  );

  const priorities = useMemo(
    () => [...new Set(reports.map((report) => report.priority).filter(Boolean))],
    [reports]
  );

  const filteredReports = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return reports.filter((report) => {
      const matchesStatus =
        statusFilter === 'all' || report.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || report.priority === priorityFilter;

      const matchesSearch =
        !query ||
        (report.description || '').toLowerCase().includes(query) ||
        (report.address || '').toLowerCase().includes(query) ||
        (report.predicted_category || '').toLowerCase().includes(query);

      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [reports, statusFilter, priorityFilter, searchTerm]);

  const selectedDepartmentName =
    departments.find((department) => department.id === selectedDepartment)?.name ||
    'Department';

  if (loading) {
    return (
      <section className="department-reports-page">
        <div className="department-reports-message">Loading department reports...</div>
      </section>
    );
  }

  return (
    <section className="department-reports-page">
      <div className="department-reports-header">
        <div>
          <p className="department-reports-eyebrow">DEPARTMENT MANAGEMENT</p>
          <h1>Citizen Reports</h1>
          <p className="department-reports-subtitle">
            View and review civic issues assigned to your department.
          </p>
        </div>

        <button
          type="button"
          className="department-reports-refresh"
          onClick={loadDepartmentReports}
        >
          Refresh Reports
        </button>
      </div>

      {departments.length > 1 && (
        <div className="department-reports-department-select">
          <label htmlFor="department-report-select">Select Department</label>
          <select
            id="department-report-select"
            value={selectedDepartment}
            onChange={handleDepartmentChange}
          >
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="department-reports-summary">
        <div className="department-reports-summary-card">
          <span>Total Reports</span>
          <strong>{reports.length}</strong>
        </div>
        <div className="department-reports-summary-card">
          <span>Pending</span>
          <strong>
            {reports.filter((report) => report.status?.toLowerCase() === 'pending').length}
          </strong>
        </div>
        <div className="department-reports-summary-card">
          <span>In Progress</span>
          <strong>
            {reports.filter((report) =>
              ['in_progress', 'in progress'].includes(report.status?.toLowerCase())
            ).length}
          </strong>
        </div>
        <div className="department-reports-summary-card">
          <span>Resolved</span>
          <strong>
            {reports.filter((report) => report.status?.toLowerCase() === 'resolved').length}
          </strong>
        </div>
      </div>

      <div className="department-reports-toolbar">
        <input
          type="search"
          placeholder="Search description, category or address..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search reports"
        />

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {formatLabel(status)}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">All priorities</option>
          {priorities.map((priority) => (
            <option key={priority} value={priority}>
              {formatLabel(priority)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="department-reports-error" role="alert">
          {error}
        </div>
      )}

      {!error && filteredReports.length === 0 && (
        <div className="department-reports-empty">
          <h3>No reports found</h3>
          <p>
            {reports.length === 0
              ? `There are currently no reports assigned to ${selectedDepartmentName}.`
              : 'Try changing your search or filters.'}
          </p>
        </div>
      )}

      <div className="department-reports-list">
        {filteredReports.map((report) => (
          <article className="department-report-card" key={report.id}>
            <div className="department-report-card-header">
              <div>
                <span className="department-report-id">
                  Report ID: {report.id.slice(0, 8)}
                </span>
                <h3>{formatLabel(report.predicted_category || 'Unclassified report')}</h3>
              </div>

              <div className="department-report-badges">
                <span className={`department-report-priority priority-${report.priority.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  {formatLabel(report.priority)}
                </span>
                <span className={`department-report-status status-${report.status.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                  {formatLabel(report.status)}
                </span>
              </div>
            </div>

            <p className="department-report-description">
              {report.description}
            </p>

            <div className="department-report-details">
              <div>
                <span>Location</span>
                <strong>{report.address || 'Address not provided'}</strong>
              </div>

              <div>
                <span>Coordinates</span>
                <strong>
                  {report.latitude !== null && report.longitude !== null
                    ? `${report.latitude}, ${report.longitude}`
                    : 'Not available'}
                </strong>
              </div>

              <div>
                <span>AI Model</span>
                <strong>{report.model_name || 'Not available'}</strong>
              </div>

              <div>
                <span>AI Confidence</span>
                <strong>{formatConfidence(report.confidence)}</strong>
              </div>

              <div>
                <span>Submitted</span>
                <strong>{formatDate(report.created_at)}</strong>
              </div>

              <div>
                <span>Last Updated</span>
                <strong>{formatDate(report.updated_at)}</strong>
              </div>
            </div>

            {report.resolution_notes && (
              <div className="department-report-resolution">
                <span>Resolution Notes</span>
                <p>{report.resolution_notes}</p>
              </div>
            )}
          </article>
        ))}
      </div>

      <p className="department-reports-count">
        Showing {filteredReports.length} of {reports.length} reports
      </p>
    </section>
  );
}
