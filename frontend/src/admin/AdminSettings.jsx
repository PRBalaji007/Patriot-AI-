import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./AdminSettings.css";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadAdminDetails();
  }, []);

  async function loadAdminDetails() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!currentUser) {
        setError("No active session found. Please sign in again.");
        return;
      }

      setUser(currentUser);

      const { data, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, phone, role, created_at")
        .eq("id", currentUser.id)
        .single();

      if (profileError) throw profileError;

      if (data?.role !== "admin") {
        setError("Access denied. This page is for administrators only.");
        return;
      }

      setProfile(data);
    } catch (err) {
      setError(err.message || "Unable to load account details.");
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = useMemo(() => {
    if (!newPassword) {
      return {
        label: "Enter a password",
        score: 0,
      };
    }

    let score = 0;

    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;

    if (score <= 1) {
      return { label: "Weak", score };
    }

    if (score === 2) {
      return { label: "Fair", score };
    }

    if (score === 3) {
      return { label: "Good", score };
    }

    return { label: "Strong", score };
  }, [newPassword]);

  async function handlePasswordUpdate(event) {
    event.preventDefault();

    setMessage("");
    setError("");

    if (newPassword.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setUpdating(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage("Your administrator password has been updated successfully.");

      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.message || "Password update failed.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSignOut() {
    setError("");
    setMessage("");

    const { error: signOutError } = await supabase.auth.signOut();

    if (signOutError) {
      setError(signOutError.message);
    }
  }

  if (loading) {
    return (
      <div className="admin-settings-loading">
        Loading administrator settings...
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="admin-settings-error">
        <strong>Settings unavailable</strong>
        <p>{error}</p>

        <button type="button" onClick={loadAdminDetails}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="admin-settings">
      <div className="admin-settings-header">
        <div>
          <p
            style={{
              margin: "0 0 7px",
              color: "#2563eb",
              fontSize: "11px",
              fontWeight: 700,
              letterSpacing: "1.5px",
            }}
          >
            PATRIOT ADMINISTRATION
          </p>

          <h1>Admin Settings</h1>

          <p>
            Manage your administrator account, security and session.
          </p>
        </div>
      </div>

      {error && (
        <div className="settings-alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="settings-alert success" role="status">
          {message}
        </div>
      )}

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon">👤</div>

          <div>
            <h2>Administrator Profile</h2>

            <p>
              Your current PATRIOT administrator account information.
            </p>
          </div>
        </div>

        <div className="settings-info-grid">
          <div className="settings-info-item">
            <span>Full Name</span>
            <strong>
              {profile?.display_name || "Not provided"}
            </strong>
          </div>

          <div className="settings-info-item">
            <span>Email Address</span>
            <strong>
              {user?.email || "Not available"}
            </strong>
          </div>

          <div className="settings-info-item">
            <span>Phone Number</span>
            <strong>
              {profile?.phone || "Not provided"}
            </strong>
          </div>

          <div className="settings-info-item">
            <span>Account Role</span>

            <strong className="admin-role-label">
              {profile?.role || "Unknown"}
            </strong>
          </div>

          <div className="settings-info-item">
            <span>Account Created</span>

            <strong>
              {formatDate(profile?.created_at)}
            </strong>
          </div>

          <div className="settings-info-item">
            <span>Email Verification</span>

            <strong>
              {user?.email_confirmed_at
                ? "✓ Verified"
                : "⚠ Not verified"}
            </strong>
          </div>
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon">🔐</div>

          <div>
            <h2>Security</h2>

            <p>
              Change the password used to access the administrator account.
            </p>
          </div>
        </div>

        <form
          className="settings-password-form"
          onSubmit={handlePasswordUpdate}
        >
          <label htmlFor="admin-new-password">
            New Password
          </label>

          <input
            id="admin-new-password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Enter a new password"
            minLength={8}
            autoComplete="new-password"
            required
          />

          {newPassword && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color:
                  passwordStrength.score >= 3
                    ? "#166534"
                    : passwordStrength.score === 2
                    ? "#92400e"
                    : "#b91c1c",
              }}
            >
              Password strength:{" "}
              <strong>{passwordStrength.label}</strong>
            </div>
          )}

          <label htmlFor="admin-confirm-password">
            Confirm New Password
          </label>

          <input
            id="admin-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Re-enter the new password"
            minLength={8}
            autoComplete="new-password"
            required
          />

          {confirmPassword && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "12px",
                color:
                  newPassword === confirmPassword
                    ? "#166534"
                    : "#b91c1c",
              }}
            >
              {newPassword === confirmPassword
                ? "✓ Passwords match"
                : "⚠ Passwords do not match"}
            </div>
          )}

          <button type="submit" disabled={updating}>
            {updating ? "Updating Security..." : "Update Password"}
          </button>
        </form>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <div className="settings-icon">🛡️</div>

          <div>
            <h2>Session Security</h2>

            <p>
              Your current session is authenticated through Supabase.
            </p>
          </div>
        </div>

        <div className="settings-info-grid">
          <div className="settings-info-item">
            <span>Authentication Status</span>
            <strong>✓ Active session</strong>
          </div>

          <div className="settings-info-item">
            <span>Account Access</span>
            <strong>Administrator</strong>
          </div>
        </div>
      </section>

      <section className="settings-card settings-logout-card">
        <div>
          <h2>Sign Out</h2>

          <p>
            End your current administrator session on this device.
          </p>
        </div>

        <button
          type="button"
          className="settings-logout-button"
          onClick={handleSignOut}
        >
          Sign Out
        </button>
      </section>
    </div>
  );
}