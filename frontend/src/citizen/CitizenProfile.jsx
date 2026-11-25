import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import "./Citizen.css";

function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getInitials(name, email) {
  const source =
    typeof name === "string" && name.trim()
      ? name.trim()
      : typeof email === "string" && email.trim()
        ? email.trim()
        : "Citizen";

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.charAt(0).toUpperCase();
}

export default function CitizenProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = useCallback(async (isRefresh = false) => {
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
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      const currentUser = authData?.user;

      if (!currentUser) {
        throw new Error(
          "Please sign in to view your profile."
        );
      }

      setUser(currentUser);

      const {
        data,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "display_name, phone, role, created_at"
        )
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!data) {
        throw new Error(
          "Your profile record could not be found."
        );
      }

      if (data.role !== "citizen") {
        throw new Error(
          "This profile page is available to citizen accounts."
        );
      }

      setProfile(data);
    } catch (err) {
      setError(
        err?.message ||
          "Unable to load profile details."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const initials = getInitials(
    profile?.display_name,
    user?.email
  );

  if (loading) {
    return (
      <main className="citizen-page">
        <div className="citizen-loading-panel">
          <span className="citizen-spinner" />
          <p>Loading your profile...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="citizen-page">
      <header className="citizen-page-header">
        <div>
          <p className="citizen-eyebrow">
            ACCOUNT / PROFILE
          </p>

          <h1>My Profile</h1>

          <p className="citizen-page-subtitle">
            View the account information associated
            with your PATRIOT citizen account.
          </p>
        </div>

        <button
          type="button"
          className="citizen-button citizen-button-secondary"
          onClick={() => loadProfile(true)}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing..."
            : "↻ Refresh"}
        </button>
      </header>

      {error && (
        <div
          className="citizen-alert citizen-alert-error"
          role="alert"
        >
          <strong>Profile unavailable</strong>
          <p>{error}</p>

          <button
            type="button"
            onClick={() => loadProfile()}
          >
            Try again
          </button>
        </div>
      )}

      {profile && (
        <div className="citizen-profile-layout">
          <section className="citizen-card citizen-profile-identity">
            <div className="citizen-profile-avatar">
              {initials}
            </div>

            <h2>
              {profile.display_name ||
                "Citizen"}
            </h2>

            <span className="citizen-role-pill">
              Citizen account
            </span>

            <p>
              Your PATRIOT account allows you to
              submit civic reports and follow their
              progress.
            </p>

            <div className="citizen-profile-verification">
              <span
                className={
                  user?.email_confirmed_at
                    ? "verification-good"
                    : "verification-pending"
                }
              >
                {user?.email_confirmed_at
                  ? "✓ Email verified"
                  : "○ Email not verified"}
              </span>
            </div>
          </section>

          <section className="citizen-card citizen-profile-information">
            <div className="citizen-card-heading">
              <div>
                <h2>Personal information</h2>

                <p>
                  Details currently stored in your
                  citizen profile
                </p>
              </div>
            </div>

            <div className="citizen-profile-fields">
              <div className="citizen-profile-field">
                <span>Full name</span>

                <strong>
                  {profile.display_name ||
                    "Not provided"}
                </strong>
              </div>

              <div className="citizen-profile-field">
                <span>Email address</span>

                <strong>
                  {user?.email ||
                    "Not available"}
                </strong>
              </div>

              <div className="citizen-profile-field">
                <span>Phone number</span>

                <strong>
                  {profile.phone ||
                    "Not provided"}
                </strong>
              </div>

              <div className="citizen-profile-field">
                <span>Account role</span>

                <strong>
                  {profile.role ||
                    "citizen"}
                </strong>
              </div>

              <div className="citizen-profile-field">
                <span>Account created</span>

                <strong>
                  {formatDate(
                    profile.created_at
                  )}
                </strong>
              </div>

              <div className="citizen-profile-field">
                <span>Email confirmation</span>

                <strong>
                  {formatDate(
                    user?.email_confirmed_at
                  )}
                </strong>
              </div>
            </div>

            <div className="citizen-profile-readonly-note">
              <strong>
                Profile editing is not enabled here.
              </strong>

              <p>
                This module currently displays
                profile information in read-only
                mode. Profile editing can be
                connected after the required
                database permissions are confirmed.
              </p>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}