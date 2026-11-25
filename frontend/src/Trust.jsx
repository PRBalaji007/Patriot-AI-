import "./Trust.css";

export default function Trust() {
  function goToCitizenAuth() {
    // Restore the working citizen login navigation.
    window.location.hash = "citizen-auth";

    // Force the hash listener to react immediately if App.jsx
    // is already listening for hash changes.
    window.dispatchEvent(new Event("hashchange"));
  }

  function goHome() {
    window.location.hash = "home";
  }

  return (
    <main className="trust-page">

      {/* =========================
          HEADER
      ========================= */}
      <header className="trust-header">
        <button
          className="trust-brand"
          onClick={goHome}
          type="button"
          aria-label="Go to PATRIOT home"
        >
          <span className="trust-brand-mark">P</span>
          <span className="trust-brand-name">PATRIOT</span>
        </button>

        <nav className="trust-nav">
          <button onClick={goHome} type="button">
            Home
          </button>

          <button
            onClick={() => {
              window.location.hash = "how-it-works";
            }}
            type="button"
          >
            How it works
          </button>

          <button
            className="active"
            onClick={() => {
              window.location.hash = "trust";
            }}
            type="button"
          >
            Trust & privacy
          </button>

          <button
            className="trust-report-nav"
            onClick={goToCitizenAuth}
            type="button"
          >
            Report an issue
            <span>↗</span>
          </button>
        </nav>

        <button
          className="trust-mobile-report"
          onClick={goToCitizenAuth}
          type="button"
        >
          Report an issue
        </button>
      </header>

      {/* =========================
          HERO
      ========================= */}
      <section className="trust-hero">

        <div className="trust-hero-content">

          <div className="trust-eyebrow">
            BUILT WITH RESPONSIBILITY
          </div>

          <h1>
            Trust is part of
            <br />
            the product.
          </h1>

          <p className="trust-hero-text">
            PATRIOT is designed around responsible data handling,
            accessible interactions, transparent AI-assisted decisions,
            and appropriate control over civic reports.
          </p>

          <button
            className="trust-primary-button"
            onClick={goToCitizenAuth}
            type="button"
          >
            Report an issue
            <span>→</span>
          </button>

        </div>

        {/* =========================
            VISUAL
        ========================= */}
        <div className="trust-visual">

          <div className="trust-orbit trust-orbit-one"></div>
          <div className="trust-orbit trust-orbit-two"></div>

          <div className="trust-shield">

            <div className="trust-shield-top">
              <div className="trust-shield-circle"></div>
            </div>

            <div className="trust-shield-body">

              <div className="trust-person-head"></div>

              <div className="trust-person-body"></div>

              <div className="trust-person-arm trust-arm-left"></div>

              <div className="trust-person-arm trust-arm-right"></div>

            </div>

          </div>

        </div>

      </section>

      {/* =========================
          APPROACH
      ========================= */}
      <section className="trust-approach">

        <div className="trust-section-label">
          OUR APPROACH
        </div>

        <div className="trust-approach-grid">

          <div className="trust-approach-main">

            <h2>
              Designed with people in mind.
            </h2>

            <p>
              Citizens should understand what they submit, why it is
              needed, and how to follow the progress of a report.
            </p>

          </div>

          <div className="trust-principles">

            <div className="trust-principle">
              <span className="trust-principle-number">01</span>

              <div>
                <h3>Explain how it works</h3>

                <p>
                  PATRIOT presents AI-assisted analysis as decision
                  support rather than hiding the reasoning from users.
                </p>
              </div>
            </div>

            <div className="trust-principle">
              <span className="trust-principle-number">02</span>

              <div>
                <h3>Keep citizens in control</h3>

                <p>
                  Citizens decide what information and evidence they
                  provide when submitting a civic report.
                </p>
              </div>
            </div>

            <div className="trust-principle">
              <span className="trust-principle-number">03</span>

              <div>
                <h3>Use AI responsibly</h3>

                <p>
                  AI predictions are treated as assistance for
                  classification and routing, with uncertainty
                  considered before decisions are made.
                </p>
              </div>
            </div>

          </div>

        </div>

      </section>

      {/* =========================
          TRUST CARDS
      ========================= */}
      <section className="trust-cards-section">

        <div className="trust-card">

          <div className="trust-card-icon">
            ◉
          </div>

          <h3>
            Privacy-aware
          </h3>

          <p>
            Report information is handled through authenticated
            access and controlled application workflows.
          </p>

        </div>

        <div className="trust-card">

          <div className="trust-card-icon">
            ✓
          </div>

          <h3>
            Transparent
          </h3>

          <p>
            AI-assisted results can be presented with confidence
            information so users understand that predictions are not
            absolute decisions.
          </p>

        </div>

        <div className="trust-card">

          <div className="trust-card-icon">
            →
          </div>

          <h3>
            Accountable
          </h3>

          <p>
            Reports are connected to authenticated citizens and can
            move through the appropriate civic response workflow.
          </p>

        </div>

      </section>

      {/* =========================
          CTA
      ========================= */}
      <section className="trust-cta">

        <div>
          <span className="trust-section-label">
            READY TO PARTICIPATE?
          </span>

          <h2>
            Your city.
            <br />
            Your voice.
          </h2>
        </div>

        <button
          className="trust-cta-button"
          onClick={goToCitizenAuth}
          type="button"
        >
          Report an issue
          <span>↗</span>
        </button>

      </section>

      {/* =========================
          FOOTER
      ========================= */}
      <footer className="trust-footer">

        <div className="trust-footer-brand">

          <div className="trust-footer-logo">
            <span>P</span>
            PATRIOT
          </div>

          <p>
            An AI-assisted civic response platform designed
            for responsible reporting and community participation.
          </p>

        </div>

        <div className="trust-footer-column">

          <h4>PLATFORM</h4>

          <button onClick={goHome} type="button">
            Home
          </button>

          <button
            onClick={() => {
              window.location.hash = "how-it-works";
            }}
            type="button"
          >
            How it works
          </button>

          <button
            onClick={() => {
              window.location.hash = "trust";
            }}
            type="button"
          >
            Trust & privacy
          </button>

        </div>

        <div className="trust-footer-column">

          <h4>CIVIC SERVICES</h4>

          <button onClick={goToCitizenAuth} type="button">
            Report an issue
          </button>

          <button onClick={goToCitizenAuth} type="button">
            Track a report
          </button>

          <button onClick={goToCitizenAuth} type="button">
            Citizen access
          </button>

        </div>

        <div className="trust-footer-column">

          <h4>LEGAL</h4>

          <button type="button">
            Privacy policy
          </button>

          <button type="button">
            Terms of use
          </button>

          <button type="button">
            Security
          </button>

        </div>

      </footer>

      <div className="trust-bottom">
        <span>
          © {new Date().getFullYear()} PATRIOT
        </span>

        <span>
          Responsible reporting · Privacy-aware design
        </span>
      </div>

    </main>
  );
}