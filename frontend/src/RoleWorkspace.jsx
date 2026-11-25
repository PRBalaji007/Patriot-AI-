import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'

import CitizenDashboard from './citizen/CitizenDashboard'
import CitizenReport from './citizen/CitizenReport'
import CitizenMyReports from './citizen/CitizenMyReports'
import CitizenProfile from './citizen/CitizenProfile'
import CitizenNotifications from './citizen/CitizenNotifications'

import DepartmentApplication from './department/DepartmentApplication'
import DepartmentDashboard from './department/DepartmentDashboard'
import DepartmentProfile from './department/DepartmentProfile'
import DepartmentReports from './department/DepartmentReports'
import DepartmentNotifications from './department/DepartmentNotifications'

import AdminDashboard from './admin/AdminDashboard'
import DepartmentApprovals from './admin/DepartmentApprovals'
import UserManagement from './admin/UserManagement'
import AdminReports from './admin/AdminReports'
import AdminNotifications from './admin/AdminNotifications'
import AdminSettings from './admin/AdminSettings'

import './RoleWorkspace.css'

const NAVIGATION = {
  citizen: [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'report', label: 'Submit a Report', icon: '＋' },
    { id: 'reports', label: 'My Reports', icon: '▤' },
    { id: 'notifications', label: 'Notifications', icon: '◉' },
    { id: 'profile', label: 'My Profile', icon: '○' },
  ],
  department: [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'reports', label: 'Assigned Reports', icon: '▤' },
    { id: 'application', label: 'Department Access', icon: '＋' },
    { id: 'notifications', label: 'Notifications', icon: '◉' },
    { id: 'profile', label: 'Department Profile', icon: '○' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: '▦' },
    { id: 'approvals', label: 'Department Approvals', icon: '✓' },
    { id: 'reports', label: 'All Reports', icon: '▤' },
    { id: 'users', label: 'User Management', icon: '♙' },
    { id: 'notifications', label: 'Activity', icon: '◉' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ],
}

const ROLE_LABELS = {
  citizen: 'Citizen workspace',
  department: 'Department workspace',
  admin: 'Administration',
}

const PAGE_TITLES = {
  dashboard: 'Dashboard',
  report: 'Submit a Report',
  reports: 'Reports',
  notifications: 'Notifications',
  profile: 'Profile',
  application: 'Department Access',
  approvals: 'Department Approvals',
  users: 'User Management',
  settings: 'Settings',
}

function getDisplayName(profile, session) {
  return (
    profile?.display_name ||
    session?.user?.user_metadata?.display_name ||
    session?.user?.email ||
    'PATRIOT User'
  )
}

export default function RoleWorkspace({ session, profile, theme, onToggleTheme }) {
  const role = profile?.role
  const [activePage, setActivePage] = useState('dashboard')
  const [menuOpen, setMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

  const navigation = NAVIGATION[role] || []

  useEffect(() => {
    setActivePage('dashboard')
    setMenuOpen(false)
  }, [role])

  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError('')

    const { error } = await supabase.auth.signOut()

    if (error) {
      setSignOutError(error.message)
      setSigningOut(false)
    }
  }

  function renderPage() {
    if (role === 'citizen') {
      switch (activePage) {
        case 'report': return <CitizenReport />
        case 'reports': return <CitizenMyReports />
        case 'notifications': return <CitizenNotifications />
        case 'profile': return <CitizenProfile />
        default: return <CitizenDashboard />
      }
    }

    if (role === 'department') {
      switch (activePage) {
        case 'reports':
          return <DepartmentReports isAdmin={false} departmentId={profile?.department_id} />
        case 'application': return <DepartmentApplication />
        case 'notifications': return <DepartmentNotifications />
        case 'profile': return <DepartmentProfile />
        default: return <DepartmentDashboard />
      }
    }

    if (role === 'admin') {
      switch (activePage) {
        case 'approvals': return <DepartmentApprovals />
        case 'reports': return <AdminReports />
        case 'users': return <UserManagement />
        case 'notifications': return <AdminNotifications />
        case 'settings': return <AdminSettings />
        default: return <AdminDashboard />
      }
    }

    return (
      <section className="workspace-message">
        <h2>Workspace access unavailable</h2>
        <p>Your account does not currently have a recognized PATRIOT role.</p>
        <p>{session?.user?.email}</p>
      </section>
    )
  }

  return (
    <div className={`workspace ${collapsed ? 'workspace-collapsed' : ''}`}>
      {menuOpen && (
        <button
          className="workspace-mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`workspace-sidebar ${menuOpen ? 'workspace-sidebar-open' : ''}`}>
        <a
          className="workspace-brand"
          href="#workspace"
          onClick={() => {
            setActivePage('dashboard')
            setMenuOpen(false)
          }}
        >
          <span className="workspace-brand-mark">P</span>
          <span className="workspace-brand-name">PATRIOT<span>.</span></span>
        </a>

        <div className="workspace-role-label">
          {ROLE_LABELS[role] || 'Account'}
        </div>

        <nav className="workspace-nav" aria-label="Workspace navigation">
          {navigation.map(item => (
            <button
              key={item.id}
              type="button"
              title={collapsed ? item.label : undefined}
              className={`workspace-nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => {
                setActivePage(item.id)
                setMenuOpen(false)
              }}
            >
              <span className="workspace-nav-icon">{item.icon}</span>
              <span className="workspace-nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="workspace-sidebar-bottom">
          <div className="workspace-sidebar-note">
            <span className="workspace-online-dot" />
            <div className="workspace-sidebar-note-text">
              <strong>PATRIOT system</strong>
              <small>Connected workspace</small>
            </div>
          </div>

          <button
            type="button"
            className="workspace-signout"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <span>↪</span>
            <span className="workspace-nav-label">
              {signingOut ? 'Signing out…' : 'Sign out'}
            </span>
          </button>

          {signOutError && (
            <p className="workspace-signout-error">{signOutError}</p>
          )}
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-menu-button"
            onClick={() => {
              if (window.innerWidth <= 760) {
                setMenuOpen(open => !open)
              } else {
                setCollapsed(value => !value)
              }
            }}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
          >
            ☰
          </button>

          <div className="workspace-breadcrumb">
            <span>{ROLE_LABELS[role] || 'Account'}</span>
            <span className="workspace-breadcrumb-separator">/</span>
            <strong>{PAGE_TITLES[activePage] || 'Workspace'}</strong>
          </div>

          <button
            type="button"
            className="workspace-theme-button"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            <span aria-hidden="true">{theme === 'light' ? '☾' : '☀'}</span>
            <span className="workspace-theme-label">
              {theme === 'light' ? 'Dark mode' : 'Light mode'}
            </span>
          </button>

          <div className="workspace-user">
            <div className="workspace-avatar">
              {getDisplayName(profile, session).charAt(0).toUpperCase()}
            </div>
            <div className="workspace-user-details">
              <strong>{getDisplayName(profile, session)}</strong>
              <span>{session?.user?.email}</span>
            </div>
          </div>
        </header>

        <main className="workspace-content">
          {renderPage()}
        </main>

        <footer className="workspace-footer">
          <span>© {new Date().getFullYear()} PATRIOT</span>
          <span>Citizen-powered civic response platform</span>
        </footer>
      </div>
    </div>
  )
}
