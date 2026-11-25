import { useEffect, useState } from "react";

import { supabase } from "./lib/supabaseClient";
import CitizenAuth from "./CitizenAuth";
import RoleWorkspace from "./RoleWorkspace";
import PatriotFooter from "./components/PatriotFooter";

import "./App.css";

const FEATURES = [
  {
    number: "01",
    icon: "↗",
    title: "Report a problem",
    description:
      "Submit a description, location and supporting photo of a civic issue.",
  },
  {
    number: "02",
    icon: "✳",
    title: "AI-assisted analysis",
    description:
      "Identify supported issue categories and flag uncertain results for review.",
  },
  {
    number: "03",
    icon: "⌁",
    title: "Track the response",
    description:
      "Follow report status and departmental updates.",
  },
];

function SaluteLogo() {
  return (
    <svg
      className="salute-logo"
      viewBox="0 0 100 100"
      role="img"
      aria-label="PATRIOT saluting emblem"
    >
      <circle cx="42" cy="23" r="15" fill="currentColor" />

      <path
        fill="currentColor"
        d="M27 40 Q17 43 13 57 L5 83 Q4 91 13 93 L64 93 Q76 92 77 81 L81 65 L91 57 Q96 53 92 48 L75 38 L60 30 L53 36 L67 48 L77 53 L70 58 L54 49 L50 40 Q41 34 27 40Z"
      />

      <path
        fill="currentColor"
        d="M47 32 L56 27 L69 31 L81 38 L77 45 L64 40 L53 39Z"
      />

      <path
        fill="currentColor"
        d="M49 31 L57 23 L67 24 L75 31 L71 36 L61 32 L54 38Z"
      />
    </svg>
  );
}

function LoadingScreen({ message = "Loading PATRIOT..." }) {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-content">
        <div className="app-loading-logo">
          <SaluteLogo />
        </div>

        <h2>PATRIOT</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}

function ErrorScreen({ message, onRetry, onSignOut }) {
  return (
    <div className="app-loading-screen">
      <div className="app-error-content">
        <div className="app-error-icon">!</div>

        <h2>Unable to load your workspace</h2>

        <p>{message}</p>

        <div className="app-error-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={onRetry}
          >
            Try again
          </button>

          <button
            type="button"
            className="button button-secondary"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("patriot-theme") || "light";
    } catch {
      return "light";
    }
  });

  const [menuOpen, setMenuOpen] = useState(false);

  /*
   * Controls the citizen authentication modal.
   *
   * IMPORTANT:
   * Report an issue -> openReport() -> CitizenAuth
   */
  const [reportOpen, setReportOpen] = useState(false);

  // Supabase authentication state.
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  // User profile loaded from public.profiles.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileRetry, setProfileRetry] = useState(0);

  /*
   * ==========================================================
   * THEME
   * ==========================================================
   */

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    try {
      localStorage.setItem("patriot-theme", theme);
    } catch {
      // Theme still works if browser storage is unavailable.
    }
  }, [theme]);

  /*
   * ==========================================================
   * SUPABASE AUTHENTICATION
   * ==========================================================
   */

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setAuthLoading(false);
      setAuthError("");

      if (event === "SIGNED_OUT") {
        setProfile(null);
        setProfileError("");
        setProfileLoading(false);
        setReportOpen(false);
      }

      /*
       * If the user successfully signs in from CitizenAuth,
       * close the authentication modal.
       */
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        setReportOpen(false);
      }
    });

    async function restoreSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          throw error;
        }

        setSession(data.session || null);
      } catch (error) {
        if (mounted) {
          setAuthError(
            error.message || "Unable to restore your login session."
          );
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * ==========================================================
   * LOAD USER PROFILE
   * ==========================================================
   */

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user?.id) {
        setProfile(null);
        setProfileError("");
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      setProfileError("");
      setProfile(null);

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, phone, role")
          .eq("id", session.user.id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        if (!data) {
          throw new Error(
            "Your account profile was not found. Please contact the PATRIOT administrator."
          );
        }

        if (data.id !== session.user.id) {
          throw new Error(
            "Your profile does not match your authenticated account."
          );
        }

        if (!["citizen", "department", "admin"].includes(data.role)) {
          throw new Error(
            "Your account does not have an active PATRIOT workspace role."
          );
        }

        if (active) {
          setProfile(data);
        }
      } catch (error) {
        if (active) {
          setProfileError(
            error.message || "Unable to retrieve your account profile."
          );
        }
      } finally {
        if (active) {
          setProfileLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [session?.user?.id, profileRetry]);

  /*
   * ==========================================================
   * REPORT MODAL
   * ==========================================================
   */

  useEffect(() => {
    if (!reportOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setReportOpen(false);
      }
    }

    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [reportOpen]);

  /*
   * This is the important function.
   *
   * Every "Report an issue" button calls this function.
   *
   * It opens CitizenAuth instead of doing nothing.
   */
  function openReport(event) {
    if (event) {
      event.preventDefault();
    }

    setMenuOpen(false);
    setReportOpen(true);
  }

  function closeReport() {
    setReportOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function toggleTheme() {
    setTheme((current) =>
      current === "light" ? "dark" : "light"
    );
  }

  async function handleRetryProfile() {
    setProfileRetry((count) => count + 1);
  }

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
    }
  }

  /*
   * ==========================================================
   * INITIAL AUTH CHECK
   * ==========================================================
   */

  if (authLoading) {
    return (
      <LoadingScreen message="Restoring your session..." />
    );
  }

  if (authError && !session) {
    return (
      <ErrorScreen
        message={authError}
        onRetry={() => window.location.reload()}
        onSignOut={handleSignOut}
      />
    );
  }

  /*
   * ==========================================================
   * AUTHENTICATED USER
   * ==========================================================
   */

  if (session) {
    if (profileLoading || (!profile && !profileError)) {
      return (
        <LoadingScreen message="Loading your PATRIOT workspace..." />
      );
    }

    if (profileError) {
      return (
        <ErrorScreen
          message={profileError}
          onRetry={handleRetryProfile}
          onSignOut={handleSignOut}
        />
      );
    }

    if (profile) {
      return (
        <RoleWorkspace
          key={`${session.user.id}-${profile.role}`}
          session={session}
          profile={profile}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
      );
    }
  }

  /*
   * ==========================================================
   * NOT AUTHENTICATED
   * LANDING PAGE
   * ==========================================================
   */

  return (
    <div className="app">

      {/* ======================================================
          NAVIGATION
          ====================================================== */}

      <header className="navbar">

        <a
          className="brand"
          href="#home"
          onClick={closeMenu}
          aria-label="PATRIOT home"
        >
          <span className="brand-mark">
            <SaluteLogo />
          </span>

          <span>
            PATRIOT<span className="brand-period">.</span>
          </span>
        </a>

        <button
          className="menu-toggle"
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="patriot-navigation"
          aria-label={
            menuOpen ? "Close navigation" : "Open navigation"
          }
        >
          {menuOpen ? "✕" : "☰"}
        </button>

        <nav
          id="patriot-navigation"
          className={`nav-links ${menuOpen ? "open" : ""}`}
          aria-label="Main navigation"
        >
          <a
            href="#home"
            onClick={closeMenu}
          >
            Home
          </a>

          <a
            href="#how-it-works"
            onClick={closeMenu}
          >
            How it works
          </a>

          <a
            href="#trust"
            onClick={closeMenu}
          >
            Trust &amp; privacy
          </a>

          <button
            className="theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${
              theme === "light" ? "dark" : "light"
            } mode`}
          >
            <span aria-hidden="true">
              {theme === "light" ? "☾" : "☀"}
            </span>

            {theme === "light"
              ? "Dark mode"
              : "Light mode"}
          </button>

          {/* REPORT BUTTON */}
          <button
            className="button button-primary nav-cta"
            type="button"
            onClick={openReport}
          >
            Report an issue{" "}
            <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <main>

        {/* ====================================================
            HERO
            ==================================================== */}

        <section
          className="hero page-width"
          id="home"
        >
          <div className="hero-copy">

            <div className="eyebrow">
              <span className="eyebrow-dot" />
              CITIZEN-POWERED CIVIC TECHNOLOGY
            </div>

            <h1>
              Your city deserves
              <br />
              <span>to be heard.</span>
            </h1>

            <p className="hero-description">
              Report civic issues with clarity. PATRIOT helps identify
              problems from images, organize reports and connect them
              with appropriate response teams.
            </p>

            <div className="hero-actions">

              <button
                className="button button-primary"
                type="button"
                onClick={openReport}
              >
                Start a report{" "}
                <span aria-hidden="true">↗</span>
              </button>

              <a
                className="button button-secondary"
                href="#how-it-works"
              >
                Explore the platform
              </a>

            </div>

            <div className="hero-note">
              <SaluteLogo />

              <span>
                Built for communities. Designed for accountability.
              </span>
            </div>

          </div>

          {/* APPROACH PANEL */}

          <div className="hero-panel">

            <div className="panel-heading">

              <div>
                <span className="overline">
                  THE PATRIOT APPROACH
                </span>

                <h2>
                  From observation to action.
                </h2>
              </div>

              <span className="panel-emblem">
                <SaluteLogo />
              </span>

            </div>

            <div className="process-list">

              <div className="process-row">

                <span className="process-number">
                  01
                </span>

                <div>
                  <h3>
                    Capture the issue
                  </h3>

                  <p>
                    Provide a photo, description and location.
                  </p>
                </div>

                <span
                  className="process-icon"
                  aria-hidden="true"
                >
                  ↗
                </span>

              </div>

              <div className="process-row">

                <span className="process-number">
                  02
                </span>

                <div>
                  <h3>
                    Analyse with AI
                  </h3>

                  <p>
                    Suggest a category and flag uncertain predictions.
                  </p>
                </div>

                <span
                  className="process-icon"
                  aria-hidden="true"
                >
                  ✳
                </span>

              </div>

              <div className="process-row">

                <span className="process-number">
                  03
                </span>

                <div>
                  <h3>
                    Review and route
                  </h3>

                  <p>
                    Support appropriate departmental follow-up.
                  </p>
                </div>

                <span
                  className="process-icon"
                  aria-hidden="true"
                >
                  ⌁
                </span>

              </div>

            </div>

            <div className="panel-footnote">
              <span className="status-dot" />
              PATRIOT civic reporting platform
            </div>

          </div>
        </section>

        {/* ====================================================
            FEATURES
            ==================================================== */}

        <section
          className="features-section"
          id="how-it-works"
        >
          <div className="page-width">

            <div className="section-intro">

              <span className="overline">
                A CLEARER WAY TO REPORT
              </span>

              <h2>
                Simple for citizens.
                <br />
                <span>Useful for responders.</span>
              </h2>

              <p>
                Every step should be understandable, accessible and
                transparent.
              </p>

            </div>

            <div
              className="feature-grid"
              id="features"
            >
              {FEATURES.map((feature) => (
                <article
                  className="feature-card"
                  key={feature.number}
                >
                  <div className="feature-top">

                    <span className="feature-number">
                      {feature.number}
                    </span>

                    <span
                      className="feature-icon"
                      aria-hidden="true"
                    >
                      {feature.icon}
                    </span>

                  </div>

                  <h3>
                    {feature.title}
                  </h3>

                  <p>
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>

          </div>
        </section>

        {/* ====================================================
            TRUST
            ==================================================== */}

        <section
          className="trust-section page-width"
          id="trust"
        >

          <div className="trust-copy">

            <span className="overline">
              BUILT WITH RESPONSIBILITY
            </span>

            <h2>
              Trust is part of the product.
            </h2>

            <p>
              PATRIOT is designed around responsible data handling,
              accessible interactions, transparent AI-assisted decisions,
              and appropriate control over civic reports.
            </p>

            {/* THIS BUTTON ALSO OPENS LOGIN */}
            <button
              className="button button-secondary"
              type="button"
              onClick={openReport}
            >
              Get started{" "}
              <span aria-hidden="true">↗</span>
            </button>

          </div>

          <div className="trust-card">

            <div
              className="trust-card-icon"
              aria-hidden="true"
            >
              <SaluteLogo />
            </div>

            <span className="overline">
              OUR APPROACH
            </span>

            <h3>
              Designed with people in mind.
            </h3>

            <p>
              Citizens should understand what they submit, why it is
              needed, and how to follow the progress of a report.
            </p>

            <a
              className="trust-card-link"
              href="#how-it-works"
            >
              Explore how it works{" "}
              <span aria-hidden="true">→</span>
            </a>

          </div>

        </section>

      </main>

      {/* ======================================================
          FOOTER
          ====================================================== */}

      <PatriotFooter />

      {/* ======================================================
          CITIZEN AUTHENTICATION MODAL
          ====================================================== */}

      {reportOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReport();
            }
          }}
        >
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Citizen authentication"
          >

            <button
              className="modal-close"
              type="button"
              onClick={closeReport}
              aria-label="Close authentication dialog"
            >
              ×
            </button>

            <CitizenAuth />

          </section>
        </div>
      )}

    </div>
  );
}