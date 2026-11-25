import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import './DepartmentProfile.css'

function formatDate(value) {
  if (!value) return 'Not available'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Not available'
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return 'D'
  }

  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  return parts[0][0].toUpperCase()
}

export default function DepartmentProfile() {
  const [profile, setProfile] = useState(null)
  const [department, setDepartment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async (isRefresh = false) => {
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
      } = await supabase.auth.getUser()

      if (authError) throw authError

      const user = authData?.user

      if (!user || !user.email_confirmed_at) {
        throw new Error(
          'Please sign in with a verified account.'
        )
      }

      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from('profiles')
        .select(
          'id, display_name, phone, role, created_at'
        )
        .eq('id', user.id)
        .single()

      if (profileError) throw profileError

      if (profileData?.role !== 'department') {
        throw new Error(
          'An authorized department account is required.'
        )
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from('department_members')
        .select('department_id')
        .eq('user_id', user.id)
        .eq('active', true)
        .maybeSingle()

      if (membershipError) throw membershipError

      if (!membership?.department_id) {
        throw new Error(
          'No active department membership was found.'
        )
      }

      const {
        data: departmentData,
        error: departmentError,
      } = await supabase
        .from('departments')
        .select(
          'id, name, category, service_area, created_at'
        )
        .eq('id', membership.department_id)
        .eq('active', true)
        .single()

      if (departmentError) throw departmentError

      setProfile({
        ...profileData,
        email: user.email,
      })

      setDepartment(departmentData)
    } catch (err) {
      setError(
        err?.message ||
          'Unable to load department profile.'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  if (loading) {
    return (
      <section className="dept-profile-page">
        <div className="dept-profile-message">
          Loading department profile...
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="dept-profile-page">
        <div className="dept-profile-error">
          <h2>Profile unavailable</h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => loadProfile()}
          >
            Try again
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="dept-profile-page">
      <header className="dept-profile-header">
        <div>
          <span>PATRIOT AUTHORITY PORTAL</span>

          <h1>Department Profile</h1>

          <p>
            View your registered department and
            account information.
          </p>
        </div>

        <button
          type="button"
          className="dept-profile-refresh"
          onClick={() => loadProfile(true)}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </header>

      <div className="dept-profile-identity">
        <div className="dept-profile-avatar">
          {getInitials(
            profile?.display_name
          )}
        </div>

        <div>
          <h2>
            {profile?.display_name ||
              'Department Member'}
          </h2>

          <p>{profile?.email}</p>

          <span className="dept-profile-role">
            Authorized Department Member
          </span>
        </div>
      </div>

      <div className="dept-profile-grid">
        <article className="dept-profile-card">
          <span className="dept-profile-card-label">
            OFFICIAL DEPARTMENT
          </span>

          <h3>
            {department?.name ||
              'Department'}
          </h3>

          <p>
            {department?.category ||
              'Department'}
          </p>
        </article>

        <article className="dept-profile-card">
          <span className="dept-profile-card-label">
            SERVICE AREA
          </span>

          <h3>
            {department?.service_area ||
              'Not specified'}
          </h3>

          <p>
            Registered operational area
          </p>
        </article>
      </div>

      <div className="dept-profile-details">
        <div className="dept-profile-details-heading">
          <div>
            <h2>Account Information</h2>

            <p>
              Information associated with your
              authorized department account.
            </p>
          </div>
        </div>

        <div className="dept-profile-detail-row">
          <span>Full Name</span>

          <strong>
            {profile?.display_name ||
              'Not available'}
          </strong>
        </div>

        <div className="dept-profile-detail-row">
          <span>Email Address</span>

          <strong>
            {profile?.email ||
              'Not available'}
          </strong>
        </div>

        <div className="dept-profile-detail-row">
          <span>Phone Number</span>

          <strong>
            {profile?.phone ||
              'Not provided'}
          </strong>
        </div>

        <div className="dept-profile-detail-row">
          <span>Account Role</span>

          <strong>
            {profile?.role ||
              'department'}
          </strong>
        </div>

        <div className="dept-profile-detail-row">
          <span>Member Since</span>

          <strong>
            {formatDate(
              profile?.created_at
            )}
          </strong>
        </div>

        <div className="dept-profile-detail-row">
          <span>Department Registered</span>

          <strong>
            {formatDate(
              department?.created_at
            )}
          </strong>
        </div>
      </div>

      <div className="dept-profile-security-note">
        <span>✓</span>

        <p>
          Department access is based on your
          active membership and the permissions
          assigned to your account.
        </p>
      </div>
    </section>
  )
}