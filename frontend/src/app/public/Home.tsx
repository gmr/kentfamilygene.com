import { Link } from 'react-router-dom';
import {
  useStatsQuery,
  usePublicNewestMembersQuery,
  usePublicRegionOverviewQuery,
} from '../../generated/graphql';
import { formatLastUpdated, membershipLabel, membershipPill } from './format';

const serif = "'Source Serif 4', serif";
const mono = "'Spline Sans Mono', monospace";

export function Home() {
  const [{ data: statsData }] = useStatsQuery();
  const [{ data: membersData }] = usePublicNewestMembersQuery({ variables: { limit: 8 } });
  const [{ data: regionData }] = usePublicRegionOverviewQuery();

  const s = statsData?.stats;
  const heroStats = [
    { value: s?.lineageCount, label: 'Lineages' },
    { value: s?.participantCount, label: 'Participants' },
    { value: s?.regionCount, label: 'Regions' },
    { value: s?.haplogroupCount, label: 'Haplogroups' },
  ];
  // Ordered newest-first by the server; see participants(newestFirst:).
  const members = membersData?.participants.items ?? [];

  const regionCounts = new Map<string, number>();
  for (const l of regionData?.lineages.items ?? []) {
    if (l.region) regionCounts.set(l.region, (regionCounts.get(l.region) ?? 0) + 1);
  }
  const regions = Array.from(regionCounts.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div>
      {/* Hero */}
      <section style={{ background: '#fbfbfa', borderBottom: '1px solid #cccccc' }}>
        <div
          className="kent-hero-grid"
          style={{
            maxWidth: 1240,
            margin: '0 auto',
            padding: '64px 22px 56px',
            display: 'grid',
            gridTemplateColumns: '1.35fr 1fr',
            gap: 48,
            alignItems: 'center',
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 52,
                lineHeight: 1.06,
                margin: '0 0 20px',
                letterSpacing: '-0.5px',
              }}
            >
              Tracing the <span style={{ fontStyle: 'italic', color: '#2b6c6e' }}>Kent</span>{' '}
              surname, one lineage at a time.
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: '#333', maxWidth: 560, margin: '0 0 30px' }}>
              A <strong>free</strong> community of genealogy researchers collaborating on the KENT
              surname — connecting DNA evidence with documented family lines across four centuries
              and two continents.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <Link
                to="/lineages"
                className="kent-btn-dark"
                style={{ padding: '13px 24px', background: '#191919', color: '#fbfbfa', fontWeight: 600, fontSize: 16 }}
              >
                Browse the lineages →
              </Link>
              <Link
                to="/search"
                className="kent-btn-outline"
                style={{
                  padding: '13px 24px',
                  background: 'transparent',
                  color: '#191919',
                  border: '1.5px solid #191919',
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                Search a name
              </Link>
            </div>
          </div>

          <div style={{ border: '1px solid #cccccc', background: '#fff' }}>
            <div
              style={{
                padding: '14px 18px',
                borderBottom: '1px solid #cccccc',
                background: '#87c2c4',
                fontFamily: serif,
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              Project at a glance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              {heroStats.map((st) => (
                <div
                  key={st.label}
                  style={{ padding: '20px 18px', borderBottom: '1px solid #e4e4e4', borderRight: '1px solid #e4e4e4' }}
                >
                  <div style={{ fontFamily: mono, fontSize: 30, fontWeight: 600, lineHeight: 1 }}>
                    {st.value ?? '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                      color: '#555',
                      marginTop: 8,
                      fontWeight: 600,
                    }}
                  >
                    {st.label}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 18px', fontSize: 13, color: '#555', fontStyle: 'italic' }}>
              Last updated {formatLastUpdated(s?.lastUpdated)}. Living individuals are privacy-masked.
            </div>
          </div>
        </div>
      </section>

      {/* Newest members */}
      <section style={{ maxWidth: 1240, margin: '0 auto', padding: '52px 22px 20px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: 30, margin: 0 }}>Newest members</h2>
          <span style={{ fontSize: 14, color: '#555' }}>Researchers who recently joined the project</span>
        </div>
        <div
          className="kent-member-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}
        >
          {members.map((m) => {
            const membership = m.lineageMemberships?.[0]?.lineage;
            return (
              <div
                key={m.id}
                style={{ border: '1px solid #cccccc', borderTop: '3px solid #87a4c4', background: '#fff', padding: 18 }}
              >
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, lineHeight: 1.2 }}>
                  {m.displayName}
                </div>
                <div
                  style={{
                    display: 'inline-block',
                    margin: '10px 0 12px',
                    padding: '3px 9px',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.4px',
                    textTransform: 'uppercase',
                    background: membershipPill(m.membershipType),
                    border: '1px solid #191919',
                  }}
                >
                  {membershipLabel(m.membershipType)}
                </div>
                {m.joinDate && (
                  <div style={{ fontSize: 13, color: '#555', fontFamily: mono }}>Joined {m.joinDate}</div>
                )}
                {membership && (
                  <div style={{ fontSize: 13.5, color: '#333', marginTop: 8 }}>{membership.displayName}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* How to participate */}
      <section id="participate" style={{ maxWidth: 1240, margin: '0 auto', padding: '40px 22px 20px', scrollMarginTop: 84 }}>
        <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: 30, margin: '0 0 8px' }}>How to participate</h2>
        <p style={{ fontSize: 16, color: '#555', margin: '0 0 24px', maxWidth: 640 }}>
          There are two ways to contribute. Both are free — the project is run entirely by volunteers.
        </p>
        <div
          className="kent-part-grid"
          style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}
        >
          <ParticipateCard
            badge="Project Member"
            badgeBg="#87c2c4"
            title="Y-DNA test the Kent line"
            body="Take a Y-DNA test through FamilyTreeDNA and link your documented Kent ancestry. Your results place you within a genetic lineage and help break through brick walls."
            bullets={['Direct paternal Kent-surname line', '67 or 111 marker test recommended', 'Matched against every project lineage']}
          />
          <ParticipateCard
            badge="Associate Researcher"
            badgeBg="#f5deb3"
            title="Contribute research & atDNA"
            body="Not descended through an unbroken Kent male line? You can still contribute documented trees and autosomal (Family Finder) results to strengthen the evidence."
            bullets={['Any relationship to a Kent line', 'atDNA / Family Finder welcome', 'Share GEDCOMs and source records']}
          />
        </div>
      </section>

      {/* Browse by region */}
      <section style={{ maxWidth: 1240, margin: '0 auto', padding: '44px 22px 72px' }}>
        <div
          style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}
        >
          <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: 30, margin: 0 }}>Browse by region</h2>
          <Link to="/lineages" style={{ fontSize: 15, fontWeight: 600 }}>View all lineages →</Link>
        </div>
        <div
          className="kent-region-grid"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}
        >
          {regions.map((r) => (
            <Link
              key={r}
              to={`/lineages?region=${encodeURIComponent(r)}`}
              className="kent-region-tile"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: 16,
                background: '#fff',
                border: '1px solid #cccccc',
                color: '#191919',
                textDecoration: 'none',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: 15.5 }}>{r}</span>
              <span
                style={{
                  fontFamily: mono,
                  fontSize: 13,
                  color: '#555',
                  background: '#f0f0f0',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {regionCounts.get(r) ?? 0}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ParticipateCard({
  badge,
  badgeBg,
  title,
  body,
  bullets,
}: {
  badge: string;
  badgeBg: string;
  title: string;
  body: string;
  bullets: string[];
}) {
  return (
    <div style={{ border: '1px solid #cccccc', background: '#fff', padding: 26 }}>
      <div
        style={{
          display: 'inline-block',
          padding: '4px 10px',
          background: badgeBg,
          border: '1px solid #191919',
          fontSize: 12,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {badge}
      </div>
      <h3 style={{ fontFamily: serif, fontWeight: 600, fontSize: 21, margin: '16px 0 10px' }}>{title}</h3>
      <p style={{ margin: '0 0 14px', color: '#333', fontSize: 15.5 }}>{body}</p>
      <ul style={{ margin: 0, paddingLeft: 18, color: '#444', fontSize: 15, lineHeight: 1.7 }}>
        {bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}
