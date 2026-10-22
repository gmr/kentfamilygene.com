import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usePublicLineagesQuery } from '../../generated/graphql';
import {
  REGIONS,
  compareLineages,
  countyList,
  lifeDates,
  lineageTitle,
  migrationPath,
  personName,
  regionOf,
  type PersonLike,
} from './format';

const serif = "'Source Serif 4', serif";
const mono = "'Spline Sans Mono', monospace";
const TEAL = '#87c2c4';
const SALMON = '#d5aba9';

interface Badge {
  label: string;
  bg: string;
  fg: string;
  border: string;
}

type LineageItem = NonNullable<
  ReturnType<typeof usePublicLineagesQuery>[0]['data']
>['lineages']['items'][number];

function badgesFor(l: LineageItem): Badge[] {
  const badges: Badge[] = [];
  badges.push(
    l.hasYDnaParticipant
      ? { label: 'Haplogroup Confirmed', bg: TEAL, fg: '#191919', border: '#191919' }
      : { label: 'Haplogroup Unconfirmed', bg: SALMON, fg: '#191919', border: '#191919' },
  );
  if (l.brickWallAncestor?.isImmigrantAncestor)
    badges.push({ label: 'Immigrant line', bg: '#f5deb3', fg: '#191919', border: '#191919' });
  if (l.isNew) badges.push({ label: 'NEW', bg: '#ffdead', fg: '#191919', border: '#191919' });
  return badges;
}

export function LineageBrowser() {
  const [params, setParams] = useSearchParams();
  const [{ data, fetching }] = usePublicLineagesQuery();
  const [q, setQ] = useState('');
  const region = params.get('region');

  const items = useMemo(() => [...(data?.lineages.items ?? [])].sort(compareLineages), [data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((l) => {
      if (region && regionOf(l) !== region) return false;
      if (needle) {
        const hay = [
          l.displayName,
          l.brickWallAncestor ? personName(l.brickWallAncestor) : '',
          migrationPath(l.migrationStops),
          countyList(l.migrationStops),
          l.haplogroups.map((h) => h.abbreviation ?? h.name).join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, region, q]);

  // Region -> state -> lineages. `items` is already sorted, so insertion order
  // is display order; only regions missing from REGIONS need placing last.
  const byRegion = useMemo(() => {
    const map = new Map<string, Map<string, LineageItem[]>>(REGIONS.map((r) => [r.name, new Map()]));
    items.forEach((l) => {
      const r = regionOf(l);
      const states = map.get(r) ?? map.set(r, new Map()).get(r)!;
      const state = l.originState ?? l.displayName;
      states.set(state, [...(states.get(state) ?? []), l]);
    });
    return Array.from(map.entries()).filter(([, states]) => states.size > 0);
  }, [items]);

  const clearRegion = () => {
    const next = new URLSearchParams(params);
    next.delete('region');
    setParams(next, { replace: true });
  };

  return (
    <div
      className="kent-browse-grid"
      style={{
        maxWidth: 1240,
        margin: '0 auto',
        padding: '26px 22px 64px',
        display: 'grid',
        gridTemplateColumns: '268px 1fr',
        gap: 28,
        alignItems: 'start',
      }}
    >
      {/* Sidebar */}
      <aside
        className="kent-scroll kent-sidebar"
        style={{
          position: 'sticky',
          top: 88,
          border: '1px solid #cccccc',
          background: '#fff',
          maxHeight: 'calc(100vh - 110px)',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            padding: '14px 16px',
            borderBottom: '1px solid #cccccc',
            fontFamily: serif,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            background: '#f6f6f6',
          }}
        >
          Regions
        </div>
        {byRegion.map(([name, states]) => (
          <details key={name} open={name === region} style={{ borderBottom: '1px solid #eee' }}>
            <summary
              style={{
                padding: '11px 16px 8px',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.8px',
                textTransform: 'uppercase',
                color: '#2b6c6e',
                cursor: 'pointer',
              }}
            >
              {name}{' '}
              <span style={{ color: '#999' }}>
                ({Array.from(states.values()).reduce((n, ls) => n + ls.length, 0)})
              </span>
            </summary>
            {Array.from(states.entries()).map(([state, lineages]) => (
              <div key={state}>
                <div style={{ padding: '6px 16px 2px 22px', fontSize: 13.5, fontWeight: 700, color: '#333' }}>
                  {state}
                </div>
                {lineages.map((l) => (
                  <Link
                    key={l.id}
                    to={`/lineages/${l.id}`}
                    className="kent-sidebar-link"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 16px 6px 32px',
                      fontSize: 14,
                      color: '#333',
                      borderLeft: `3px solid ${l.hasYDnaParticipant ? TEAL : SALMON}`,
                      textDecoration: 'none',
                    }}
                  >
                    {l.lineageNumber != null ? `Lineage No. ${l.lineageNumber}` : l.displayName}
                  </Link>
                ))}
              </div>
            ))}
          </details>
        ))}
      </aside>

      {/* Main */}
      <div>
        <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 34, margin: '0 0 6px' }}>
          Lineage browser
        </h1>
        <p style={{ margin: '0 0 20px', color: '#555', fontSize: 15.5 }}>
          {fetching ? 'Loading…' : `${filtered.length} of ${items.length} lineages`}
          {region && (
            <>
              {' '}in <strong>{region}</strong> ·{' '}
              <button type="button" onClick={clearRegion} className="kent-btn-quiet" style={clearBtn}>
                Show all regions
              </button>
            </>
          )}
        </p>

        {/* Filter bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            padding: 14,
            border: '1px solid #cccccc',
            background: '#fff',
            marginBottom: 22,
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lineage, brick wall, place…"
            style={{
              flex: '1 1 240px',
              minWidth: 200,
              padding: '10px 12px',
              border: '1px solid #cccccc',
              fontSize: 15,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map((l) => (
            <LineageCard key={l.id} l={l} />
          ))}
          {!fetching && filtered.length === 0 && (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#555',
                border: '1px dashed #cccccc',
                background: '#fff',
              }}
            >
              No lineages match these filters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LineageCard({ l }: { l: LineageItem }) {
  const border = l.hasYDnaParticipant ? TEAL : SALMON;
  const badges = badgesFor(l);
  const migration = migrationPath(l.migrationStops);
  const counties = countyList(l.migrationStops);
  const brick = l.brickWallAncestor as PersonLike | null | undefined;
  const haplo = l.haplogroups.map((h) => h.abbreviation ?? h.name).join(', ') || '—';

  return (
    <Link
      to={`/lineages/${l.id}`}
      className="kent-card-link"
      style={{
        background: '#fff',
        border: '1px solid #cccccc',
        borderLeft: `5px solid ${border}`,
        textDecoration: 'none',
        color: '#191919',
        display: 'block',
      }}
    >
      <div style={{ padding: '18px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: 21, margin: 0, flex: '1 1 auto' }}>
            {lineageTitle(l)}
          </h3>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {badges.map((b) => (
              <span key={b.label} style={badgeStyle(b)}>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {migration && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0 4px', fontSize: 14, color: '#333' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#2b6c6e' }}>
              Migration
            </span>
            <span style={{ fontFamily: mono, fontSize: 13.5 }}>{migration}</span>
          </div>
        )}
        {counties && <div style={{ fontSize: 13, color: '#555', marginBottom: 14 }}>{counties}</div>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, paddingTop: 12, borderTop: '1px solid #eee' }}>
          <div style={{ flex: '2 1 260px' }}>
            <div style={labelStyle('#a0605d')}>Brick wall ancestor</div>
            <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 16 }}>
              {brick ? personName(brick) : '—'}
            </div>
            {brick && <div style={{ fontSize: 13, color: '#555', fontFamily: mono }}>{lifeDates(brick)}</div>}
          </div>
          <div>
            <div style={labelStyle('#555')}>Participants</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600 }}>{l.participantCount}</div>
          </div>
          <div>
            <div style={labelStyle('#555')}>Haplogroup</div>
            <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600 }}>{haplo}</div>
          </div>
        </div>

        {!l.hasYDnaParticipant && (
          <div
            style={{
              marginTop: 14,
              padding: '8px 12px',
              background: '#faeceb',
              border: '1px solid #d5aba9',
              fontSize: 13.5,
              fontWeight: 600,
              color: '#8a4a47',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 800 }}>⚠</span> Needs a y-DNA participant to confirm this line
          </div>
        )}
      </div>
    </Link>
  );
}

const clearBtn: React.CSSProperties = {
  padding: '2px 8px',
  border: '1px solid #cccccc',
  background: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};

function badgeStyle(b: Badge): React.CSSProperties {
  return {
    padding: '3px 9px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
    background: b.bg,
    color: b.fg,
    border: `1px solid ${b.border}`,
  };
}
function labelStyle(color: string): React.CSSProperties {
  return {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
    color,
    marginBottom: 3,
  };
}
