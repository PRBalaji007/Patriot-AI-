
import './PatriotFooter.css'

const footerGroups = [
  {
    title: 'PLATFORM',
    links: [
      { label: 'Home', href: '#home' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Trust & privacy', href: '#trust' },
    ],
  },
  {
    title: 'CIVIC SERVICES',
    links: [
      { label: 'Municipality & sanitation', href: '#services' },
      { label: 'Roads & public works', href: '#services' },
      { label: 'Water & drainage', href: '#services' },
      { label: 'Electricity & utilities', href: '#services' },
    ],
  },
  {
    title: 'HELP',
    links: [
      { label: 'Reporting guide', href: '#how-it-works' },
      { label: 'Contact & support', href: '#contact' },
      { label: 'Accessibility', href: '#accessibility' },
    ],
  },
  {
    title: 'LEGAL',
    links: [
      { label: 'Privacy policy', href: '/privacy' },
      { label: 'Terms of use', href: '/terms' },
      { label: 'Security', href: '#trust' },
    ],
  },
]

export default function PatriotFooter() {
  return (
    <footer className="patriot-site-footer">
      <div className="patriot-footer-main">
        <div className="patriot-footer-brand">
          <a href="#home" className="patriot-footer-logo">
            <span className="patriot-footer-symbol" aria-hidden="true">
              P
            </span>
            <span>
              <strong>PATRIOT</strong>
              <small>AI CIVIC RESPONSE PLATFORM</small>
            </span>
          </a>

          <p>
            A simpler way to report civic issues, share relevant
            information, and follow progress.
          </p>

          <span className="patriot-footer-caption">
            Designed for a more responsive civic experience.
          </span>
        </div>

        <nav
          className="patriot-footer-links"
          aria-label="Footer navigation"
        >
          {footerGroups.map((group) => (
            <div className="patriot-footer-group" key={group.title}>
              <h2>{group.title}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>

      <div className="patriot-footer-bottom">
        <span>© {new Date().getFullYear()} PATRIOT · Prototype</span>

        <span className="patriot-footer-watermark">
          A <strong>Bubble CO</strong> project
        </span>

        <a href="#home" className="patriot-footer-top">
          Back to top ↑
        </a>
      </div>

      <p className="patriot-footer-disclaimer">
        PATRIOT is a prototype and is not an official government website
        or emergency-response service. For immediate danger, contact
        the appropriate local emergency service.
      </p>
    </footer>
  )
}
