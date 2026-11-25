import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import './UserManagement.css';

function formatDate(value) {
  if (!value) return 'Unavailable';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 'Unavailable';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
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

export default function UserManagement() {
  const [users, setUsers] = useState([]);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    setError('');

    if (users.length === 0) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error('Please sign in.');
      }

      const { data: adminProfile, error: adminError } =
        await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

      if (adminError) throw adminError;

      if (adminProfile?.role !== 'admin') {
        throw new Error(
          'Administrator access is required.'
        );
      }

      const [
        { data: profileData, error: profileError },
        { data: membershipData, error: membershipError },
        { data: departmentData, error: departmentError },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, display_name, phone, role, created_at'
          )
          .order('created_at', { ascending: false }),

        supabase
          .from('department_members')
          .select('user_id, department_id, active'),

        supabase
          .from('departments')
          .select('id, name'),
      ]);

      if (profileError) throw profileError;
      if (membershipError) throw membershipError;
      if (departmentError) throw departmentError;

      const departmentNames = new Map(
        (departmentData || []).map((department) => [
          department.id,
          department.name,
        ])
      );

      const membershipsByUser = new Map();

      (membershipData || []).forEach((membership) => {
        const current =
          membershipsByUser.get(membership.user_id) || [];

        current.push({
          name:
            departmentNames.get(membership.department_id) ||
            'Unknown department',
          active: membership.active,
        });

        membershipsByUser.set(
          membership.user_id,
          current
        );
      });

      setUsers(
        (profileData || []).map((profile) => ({
          ...profile,
          memberships:
            membershipsByUser.get(profile.id) || [],
        }))
      );
    } catch (err) {
      setError(
        err.message ||
          'Unable to load user information.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesRole =
        roleFilter === 'all' ||
        String(user.role || '').toLowerCase() ===
          roleFilter.toLowerCase();

      const matchesSearch =
        !query ||
        String(user.display_name || '')
          .toLowerCase()
          .includes(query) ||
        String(user.phone || '')
          .toLowerCase()
          .includes(query) ||
        String(user.id || '')
          .toLowerCase()
          .includes(query);

      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const roleCounts = useMemo(
    () => ({
      all: users.length,

      citizen: users.filter(
        (user) => user.role === 'citizen'
      ).length,

      department: users.filter(
        (user) => user.role === 'department'
      ).length,

      admin: users.filter(
        (user) => user.role === 'admin'
      ).length,
    }),
    [users]
  );

  const activeDepartmentMembers = useMemo(
    () =>
      users.filter((user) =>
        user.memberships.some(
          (membership) => membership.active
        )
      ).length,
    [users]
  );

  if (loading) {
    return (
      <section className="user-management-page">
        <div className="user-management-message">
          Loading user directory...
        </div>
      </section>
    );
  }

  return (
    <section className="user-management-page">
      <header className="user-management-header">
        <div>
          <p className="user-management-eyebrow">
            PATRIOT ADMINISTRATION
          </p>

          <h1>User Management</h1>

          <p>
            Monitor registered citizens, department members
            and administrators.
          </p>
        </div>

        <button
          type="button"
          className="user-management-refresh"
          onClick={loadUsers}
          disabled={refreshing}
        >
          {refreshing ? 'Refreshing...' : 'Refresh Directory'}
        </button>
      </header>

      {error && (
        <div
          className="user-management-error"
          role="alert"
        >
          <strong>Unable to load users</strong>

          <p>{error}</p>

          <button type="button" onClick={loadUsers}>
            Try Again
          </button>
        </div>
      )}

      {!error && (
        <>
          <div className="user-management-summary">
            <div>
              <span>Total Users</span>

              <strong>{roleCounts.all}</strong>

              <small>Registered accounts</small>
            </div>

            <div>
              <span>Citizens</span>

              <strong>{roleCounts.citizen}</strong>

              <small>Public users</small>
            </div>

            <div>
              <span>Department Members</span>

              <strong>{roleCounts.department}</strong>

              <small>Department accounts</small>
            </div>

            <div>
              <span>Administrators</span>

              <strong>{roleCounts.admin}</strong>

              <small>Admin accounts</small>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '16px',
              padding: '13px 16px',
              border: '1px solid var(--border-color, rgba(150,165,185,0.2))',
              borderRadius: '10px',
              background:
                'var(--surface-color, rgba(25,39,56,0.8))',
              color:
                'var(--text-secondary, #9ba8b8)',
              fontSize: '12px',
            }}
          >
            <span>
              Active department memberships
            </span>

            <strong
              style={{
                color: 'var(--text-primary, #e8edf5)',
              }}
            >
              {activeDepartmentMembers}
            </strong>
          </div>

          <div className="user-management-toolbar">
            <input
              type="search"
              placeholder="Search by name, phone or user ID..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              aria-label="Search users"
            />

            <select
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value)
              }
              aria-label="Filter users by role"
            >
              <option value="all">
                All roles
              </option>

              <option value="citizen">
                Citizens
              </option>

              <option value="department">
                Department members
              </option>

              <option value="admin">
                Administrators
              </option>
            </select>
          </div>

          <div className="user-management-table-wrapper">
            {filteredUsers.length === 0 ? (
              <div className="user-management-empty">
                <strong>
                  No matching users found
                </strong>

                <p>
                  Try changing the search term or role
                  filter.
                </p>
              </div>
            ) : (
              <table className="user-management-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Phone</th>
                    <th>Role</th>
                    <th>Department Membership</th>
                    <th>Registered</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <strong>
                          {user.display_name ||
                            'Unnamed user'}
                        </strong>

                        <small>
                          {user.id}
                        </small>
                      </td>

                      <td>
                        {user.phone ||
                          'Not provided'}
                      </td>

                      <td>
                        <span
                          className={`user-role role-${String(
                            user.role || 'unknown'
                          ).toLowerCase()}`}
                        >
                          {formatLabel(user.role)}
                        </span>
                      </td>

                      <td>
                        {user.memberships.length ===
                        0 ? (
                          <span
                            style={{
                              color:
                                'var(--text-secondary, #9ba8b8)',
                              fontSize: '11px',
                            }}
                          >
                            No department
                          </span>
                        ) : (
                          <div className="user-membership-list">
                            {user.memberships.map(
                              (
                                membership,
                                index
                              ) => (
                                <span
                                  key={`${user.id}-${index}`}
                                >
                                  {membership.name}
                                  {' · '}
                                  {membership.active
                                    ? 'Active'
                                    : 'Inactive'}
                                </span>
                              )
                            )}
                          </div>
                        )}
                      </td>

                      <td>
                        {formatDate(
                          user.created_at
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p className="user-management-count">
            Showing {filteredUsers.length} of{' '}
            {users.length} users
          </p>
        </>
      )}
    </section>
  );
}