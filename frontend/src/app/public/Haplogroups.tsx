import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePublicHaplogroupsQuery } from '../../generated/graphql';

const serif = "'Source Serif 4', serif";
const mono = "'Spline Sans Mono', monospace";

function typeLabel(t?: string | null): string {
  const up = (t ?? '').toUpperCase();
  if (up.includes('MT')) return 'mtDNA';
  if (up.includes('Y')) return 'Y-DNA';
  return t ?? '';
}

export function Haplogroups() {
  const [{ data, fetching }] = usePublicHaplogroupsQuery();
  const [open, setOpen] = useState<string | null>(null);

  const items = data?.haplogroups.items ?? [];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 22px 72px' }}>
      <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 36, margin: '0 0 6px' }}>Haplogroups</h1>
      <p style={{ margin: '0 0 26px', color: '#555', fontSize: 16, maxWidth: 640 }}>
        Genetic classifications from Y-DNA and mtDNA testing. Each haplogroup groups participants who
        share a deep common ancestor.
      </p>

      {fetching && <p style={{ color: '#555' }}>Loading…</p>}

      <div className="kent-haplo-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {items.map((h) => {
          const isOpen = open === h.id;
          const confirmed = (h.confirmationStatus ?? '').toUpperCase() === 'CONFIRMED';
          return (
            <div key={h.id} style={{ border: '1px solid #cccccc', background: '#fff' }}>
              <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #eee' }}>
                <div
                  style={{
                    fontFamily: mono,
                    fontWeight: 600,
                    fontSize: 30,
                    padding: '8px 14px',
                    background: '#f0f8f8',
                    border: '1px solid #87c2c4',
                    color: '#1f5658',
                  }}
                >
                  {h.abbreviation ?? h.name}
                </div>
                <div style={{ flex: '1 1 auto' }}>
                  <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 17 }}>{h.name}</div>
                  <div style={{ fontSize: 13, color: '#555', marginTop: 2 }}>{typeLabel(h.haplogroupType)}</div>
                </div>
              </div>

              <div style={{ padding: '14px 20px', display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontFamily: mono, fontSize: 20, fontWeight: 600 }}>{h.participantCount}</span>{' '}
                  <span style={{ fontSize: 13, color: '#555' }}>participants</span>
                </div>
                <span
                  style={{
                    padding: '2px 9px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    background: confirmed ? '#87c2c4' : '#d5aba9',
                    border: '1px solid #191919',
                  }}
                >
                  {confirmed ? 'Confirmed' : 'Predicted'}
                </span>
                {h.participants.length > 0 && (
                  <button
                    onClick={() => setOpen(isOpen ? null : h.id)}
                    style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 13.5, fontWeight: 600, color: '#2b6c6e', background: 'none', border: 'none' }}
                  >
                    {isOpen ? '▾' : '▸'} Participants
                  </button>
                )}
              </div>

              {isOpen && (
                <div style={{ padding: '4px 20px 18px' }}>
                  {h.participants.map((m) => {
                    const lineage = m.lineageMemberships?.[0]?.lineage;
                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '8px 0',
                          borderTop: '1px solid #f0f0f0',
                        }}
                      >
                        <span style={{ fontWeight: 600, fontSize: 14.5 }}>{m.displayName}</span>
                        {lineage && (
                          <Link to={`/lineages/${lineage.id}`} style={{ fontSize: 13, color: '#2b6c6e' }}>
                            {lineage.displayName} →
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
