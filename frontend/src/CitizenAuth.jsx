
import { useEffect, useState } from "react";
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input";

import "react-phone-number-input/style.css";

import { supabase } from "./lib/supabaseClient";
import "./CitizenAuth.css";

export default function CitizenAuth() {
  const [mode, setMode] = useState("signin");

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [session, setSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) setError(error.message);
      setSession(data?.session ?? null);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function clearFeedback() {
    setError("");
    setMessage("");
  }

  function changeMode(nextMode) {
    clearFeedback();
    setMode(nextMode);
    setPassword("");
  }

  // CITIZEN REGISTRATION
  async function handleSignup(event) {
    event.preventDefault();
    clearFeedback();

    const cleanName = displayName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName) {
      setError("Enter your full name.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (!phone || !isValidPhoneNumber(phone)) {
      setError("Enter a valid phone number with country code.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error: signupError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: {
              display_name: cleanName,
              phone: phone,
              role: "citizen",
            },
          },
        });

      if (signupError) throw signupError;

      if (!data.user) {
        throw new Error("Supabase did not return a registration account.");
      }

      // Supabase may return an existing account without an identity.
      if (
        data.user.identities &&
        data.user.identities.length === 0
      ) {
        throw new Error(
          "This email may already be registered. Try signing in instead."
        );
      }

      // Do not treat signup as a completed login.
      // The citizen must confirm their email first.
      if (data.session) {
        await supabase.auth.signOut();
      }

      setEmail(cleanEmail);
      setPassword("");
      setMode("verify");

      setMessage(
        `Registration received. Check ${cleanEmail} for the confirmation link.`
      );
    } catch (err) {
      console.error("Citizen registration error:", err);
      setError(
        err.message || "Registration failed. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  // RESEND CONFIRMATION EMAIL
  async function handleResendEmail() {
    clearFeedback();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setError("Enter your registered email address.");
      return;
    }

    setBusy(true);

    try {
      const { error: resendError } =
        await supabase.auth.resend({
          type: "signup",
          email: cleanEmail,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

      if (resendError) throw resendError;

      setMessage(
        "If your account is awaiting verification, a new confirmation email has been requested. Check your inbox and spam folder."
      );
    } catch (err) {
      console.error("Resend confirmation error:", err);
      setError(
        err.message || "Unable to resend the confirmation email."
      );
    } finally {
      setBusy(false);
    }
  }

  // EMAIL AND PASSWORD LOGIN
  async function handleSignin(event) {
    event.preventDefault();
    clearFeedback();
    setBusy(true);

    try {
      const cleanEmail = email.trim().toLowerCase();

      const { data, error: signinError } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (signinError) throw signinError;

      if (!data.user?.email_confirmed_at) {
        await supabase.auth.signOut();

        setMode("verify");
        setError(
          "Please verify your email before signing in. Check your inbox or resend the confirmation email."
        );

        return;
      }

      setPassword("");
      setMessage("Signed in successfully.");
    } catch (err) {
      console.error("Citizen login error:", err);

      setError(
        err.message || "Sign-in failed. Check your email and password."
      );
    } finally {
      setBusy(false);
    }
  }

  // SIGN OUT
  async function handleSignOut() {
    clearFeedback();
    setBusy(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      setSession(null);
      setMode("signin");
      setMessage("You have signed out.");
    } catch (err) {
      setError(err.message || "Could not sign out.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="patriot-auth-page">
      <header className="patriot-topbar">
        <a className="patriot-brand" href="#home" aria-label="PATRIOT home">
          <span className="patriot-brand-mark" aria-hidden="true">P</span>
          <span>PATRIOT</span>
        </a>

        <span className="patriot-topbar-label">
          AI Civic Response Platform
        </span>
      </header>

      <section className="patriot-auth-layout">
        <div className="patriot-intro">
          <span className="patriot-eyebrow">
            YOUR CITY. YOUR VOICE.
          </span>

          <h1>
            Report an issue.
            <br />
            Help make a difference.
          </h1>

          <p>
            Sign in to report civic issues, share evidence, and follow
            updates from the responsible department.
          </p>

          <div className="patriot-trust-list">
            <div><span>✓</span> Track your own reports</div>
            <div><span>✓</span> Share a location and evidence</div>
            <div><span>✓</span> Receive status updates</div>
          </div>
        </div>

        <section className="patriot-auth-card" aria-labelledby="auth-heading">
          {!session ? (
            <>
              <div className="patriot-card-icon" aria-hidden="true">↗</div>

              <p className="patriot-card-kicker">
                {mode === "signup"
                  ? "CREATE YOUR ACCOUNT"
                  : mode === "verify"
                    ? "EMAIL VERIFICATION"
                    : "CITIZEN ACCESS"}
              </p>

              <h2 id="auth-heading">
                {mode === "signup"
                  ? "Create account"
                  : mode === "verify"
                    ? "Check your email"
                    : "Welcome back"}
              </h2>

              <p className="patriot-card-description">
                {mode === "signup"
                  ? "Create your account with your contact details and password."
                  : mode === "verify"
                    ? `Check your inbox for the confirmation link sent to ${email}.`
                    : "Sign in using your verified email and password."}
              </p>

              {mode === "signup" && (
                <form onSubmit={handleSignup}>
                  <label htmlFor="patriot-name">Full name</label>
                  <input
                    id="patriot-name"
                    type="text"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    required
                    maxLength={100}
                  />

                  <label htmlFor="patriot-signup-email">Email address</label>
                  <input
                    id="patriot-signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <label htmlFor="patriot-signup-phone">Phone number</label>
                  <div className="patriot-phone-field">
                    <PhoneInput
                      id="patriot-signup-phone"
                      international
                      defaultCountry="IN"
                      countryCallingCodeEditable={false}
                      value={phone || undefined}
                      onChange={(value) => setPhone(value || "")}
                      placeholder="Enter phone number"
                      autoComplete="tel"
                      aria-label="Phone number with country calling code"
                    />
                  </div>

                  <p className="patriot-field-hint">
                    Select your country; the calling code is added automatically.
                  </p>

                  <label htmlFor="patriot-signup-password">Password</label>
                  <input
                    id="patriot-signup-password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button className="patriot-primary-button" disabled={busy}>
                    {busy ? "Creating account..." : "Create account"}
                  </button>

                  <button
                    className="patriot-secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => changeMode("signin")}
                  >
                    Already registered? Sign in
                  </button>
                </form>
              )}

              {mode === "verify" && (
                <div className="patriot-verification-pending">
                  <div className="patriot-success-icon" aria-hidden="true">
                    ✉
                  </div>

                  <p>
                    We sent a confirmation link to <strong>{email}</strong>.
                  </p>

                  <p>
                    Open the email and click the confirmation link.
                    Then return to PATRIOT and sign in with your email
                    and password.
                  </p>

                  <button
                    className="patriot-primary-button"
                    type="button"
                    disabled={busy}
                    onClick={handleResendEmail}
                  >
                    {busy ? "Sending..." : "Resend confirmation email"}
                  </button>

                  <button
                    className="patriot-secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => changeMode("signin")}
                  >
                    Back to sign in
                  </button>
                </div>
              )}

              {mode === "signin" && (
                <form onSubmit={handleSignin}>
                  <label htmlFor="patriot-login-email">Email address</label>
                  <input
                    id="patriot-login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />

                  <label htmlFor="patriot-login-password">Password</label>
                  <input
                    id="patriot-login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />

                  <button className="patriot-primary-button" disabled={busy}>
                    {busy ? "Signing in..." : "Sign in"}
                  </button>

                  <button
                    className="patriot-secondary-button"
                    type="button"
                    disabled={busy}
                    onClick={() => changeMode("signup")}
                  >
                    Create a new account
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="patriot-signed-in">
              <div className="patriot-success-icon" aria-hidden="true">✓</div>

              <p className="patriot-card-kicker">AUTHENTICATED</p>

              <h2 id="auth-heading">You're signed in</h2>

              <p className="patriot-card-description">
                Your PATRIOT session is active. The correct citizen or
                department dashboard still needs to be connected.
              </p>

              <button
                className="patriot-secondary-button"
                type="button"
                disabled={busy}
                onClick={handleSignOut}
              >
                {busy ? "Signing out..." : "Sign out"}
              </button>
            </div>
          )}

          {error && (
            <p className="patriot-feedback patriot-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="patriot-feedback patriot-message" role="status">
              {message}
            </p>
          )}

          <p className="patriot-legal-note">
            Email verification is required for registration. Sign-in uses
            your password without recurring OTP verification.
          </p>

          <div className="patriot-company-watermark">
            A <strong>Bubble CO</strong> project
          </div>
        </section>
      </section>

      <footer className="patriot-auth-footer">
        <span>© {new Date().getFullYear()} PATRIOT · Prototype</span>
        <span>Responsible reporting · Privacy-aware design</span>
      </footer>
    </main>
  );
}
