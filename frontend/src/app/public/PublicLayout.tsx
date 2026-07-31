import { NavLink, Link, Outlet } from 'react-router-dom';
import { useStatsQuery } from '../../generated/graphql';
import './public.css';

const LAST_UPDATED = 'Jul 2026';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/lineages', label: 'Lineages', end: false },
  { to: '/search', label: 'Search', end: false },
  { to: '/haplogroups', label: 'Haplogroups', end: false },
];

export function PublicLayout() {
  const [{ data }] = useStatsQuery();
  const personCount = data?.stats?.personCount;

  return (
    <div className="kent-root">
      <a href="#kent-main" className="kent-skip">
        Skip to content
      </a>

      {/* Top nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: '#fbfbfa',
          borderBottom: '1px solid #cccccc',
        }}
      >
        <div
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '0 22px',
            height: 68,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <Link
            to="/"
            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                border: '1.5px solid #191919',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: "'Source Serif 4', serif",
                fontWeight: 700,
                fontSize: 18,
                background: '#87c2c4',
                color: '#191919',
              }}
            >
              K
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, lineHeight: 1.15 }}>
              <span
                style={{
                  fontFamily: "'Source Serif 4', serif",
                  fontWeight: 700,
                  fontSize: 18,
                  letterSpacing: '0.2px',
                  color: '#191919',
                }}
              >
                Kent Family &amp; DNA Project
              </span>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  color: '#555555',
                  fontWeight: 600,
                }}
              >
                Genetic Genealogy · Est. 2004
              </span>
            </span>
          </Link>

          <nav
            className="kent-desktop-nav"
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <span className="kent-nav-items" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {NAV.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="kent-navlink">
                  {item.label}
                </NavLink>
              ))}
            </span>
            <Link
              to="/#participate"
              className="kent-cta"
              style={{
                marginLeft: 10,
                padding: '9px 18px',
                background: '#ffdead',
                border: '1.5px solid #191919',
                fontWeight: 700,
                fontSize: 15,
                color: '#191919',
                textDecoration: 'none',
              }}
            >
              Join the Project
            </Link>
          </nav>
        </div>
      </header>

      <main id="kent-main">
        <Outlet />
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #cccccc', background: '#fbfbfa' }}>
        <div
          className="kent-footer-grid"
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '44px 22px 30px',
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr',
            gap: 32,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Source Serif 4', serif",
                fontWeight: 700,
                fontSize: 19,
                marginBottom: 10,
              }}
            >
              Kent Family &amp; DNA Project
            </div>
            <p
              style={{
                margin: 0,
                color: '#555',
                fontSize: 14.5,
                maxWidth: 420,
                lineHeight: 1.6,
              }}
            >
              A free, volunteer-run community of genealogy researchers collaborating on the KENT
              surname, connecting documented lineages with Y-DNA and autosomal evidence.
            </p>
          </div>
          <div>
            <div style={footerHeadStyle}>Learn more</div>
            <div style={footerLinkColStyle}>
              <a href="#" style={{ color: '#333' }}>Background</a>
              <a href="#" style={{ color: '#333' }}>Project goals</a>
              <a href="#" style={{ color: '#333' }}>FAQ</a>
              <a href="#" style={{ color: '#333' }}>FamilyTreeDNA group</a>
            </div>
          </div>
          <div>
            <div style={footerHeadStyle}>Navigate</div>
            <div style={footerLinkColStyle}>
              <Link to="/" style={{ color: '#333' }}>Home</Link>
              <Link to="/lineages" style={{ color: '#333' }}>Lineages</Link>
              <Link to="/search" style={{ color: '#333' }}>Search</Link>
              <Link to="/haplogroups" style={{ color: '#333' }}>Haplogroups</Link>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e4e4e4' }}>
          <div
            style={{
              maxWidth: 1240,
              margin: '0 auto',
              padding: '16px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              fontSize: 13,
              color: '#777',
            }}
          >
            <span>
              Last updated {LAST_UPDATED}
              {personCount != null ? ` · ${personCount.toLocaleString()} individuals catalogued` : ''}
            </span>
            <span style={{ fontStyle: 'italic' }}>
              Living individuals are privacy-masked before data leaves the server.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const footerHeadStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.8px',
  textTransform: 'uppercase',
  color: '#555',
  marginBottom: 12,
};
const footerLinkColStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  fontSize: 14.5,
};
