import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  usePublicLineageQuery,
  usePublicRegionOverviewQuery,
} from '../../generated/graphql';
import {
  isMasked,
  lifeDates,
  lineageTitle,
  membershipLabel,
  membershipPill,
  migrationPath,
  personName,
} from './format';

const serif = "'Source Serif 4', serif";
const mono = "'Spline Sans Mono', monospace";
const TEAL = '#87c2c4';

type LineageData = NonNullable<
  ReturnType<typeof usePublicLineageQuery>[0]['data']
>['lineage'];
type AssignedPerson = NonNullable<LineageData>['assignedPersons'][number];
type ParticipantData = NonNullable<LineageData>['participants'][number];

export function LineageDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [{ data, fetching, error }] = usePublicLineageQuery({ variables: { id } });
  const [{ data: overview }] = usePublicRegionOverviewQuery();

  const lineage = data?.lineage;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const order = overview?.lineages.items ?? [];
  const idx = order.findIndex((l) => l.id === id);
  const prev = idx > 0 ? order[idx - 1] : order[order.length - 1];
  const next = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : order[0];

  if (fetching) {
    return <div style={{ maxWidth: 1080, margin: '0 auto', padding: 40, color: '#555' }}>Loading…</div>;
  }
  if (error || !lineage) {
    return (
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: 40 }}>
        <p style={{ color: '#555' }}>Lineage not found.</p>
        <Link to="/lineages">← Back to lineages</Link>
      </div>
    );
  }

  const badges: string[] = [];
  badges.push(lineage.hasYDnaParticipant ? 'Confirmed' : 'Unconfirmed');
  if (lineage.isNew) badges.push('NEW');

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '22px 22px 72px' }}>
      {/* Breadcrumb + prev/next */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 14, color: '#555' }}>
          <Link to="/lineages">Lineages</Link> <span style={{ color: '#bbb' }}>/</span>{' '}
          <span style={{ color: '#333' }}>{lineage.region}</span>
        </div>
        {order.length > 1 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => navigate(`/lineages/${prev.id}`)} className="kent-btn-quiet" style={navBtn}>
              ← Prev
            </button>
            <button onClick={() => navigate(`/lineages/${next.id}`)} className="kent-btn-quiet" style={navBtn}>
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Header */}
      <div style={{ border: '1px solid #cccccc', borderTop: `5px solid ${TEAL}`, background: '#fff', padding: '26px 28px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 34, margin: 0, flex: '1 1 auto', lineHeight: 1.1 }}>
            {lineageTitle(lineage)}
          </h1>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {badges.map((b) => (
              <span
                key={b}
                style={{
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.4px',
                  textTransform: 'uppercase',
                  background: b === 'Confirmed' ? TEAL : b === 'NEW' ? '#ffdead' : '#d5aba9',
                  border: '1px solid #191919',
                }}
              >
                {b}
              </span>
            ))}
          </div>
        </div>

        {lineage.migrationStops.length > 0 && (
          <div style={{ margin: '18px 0 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#2b6c6e' }}>
              Migration path
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {lineage.migrationStops.map((stop, i) => (
                <span key={stop.place.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {stop.place.familysearchUrl ? (
                    <a
                      href={stop.place.familysearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="kent-place-chip"
                      style={placeChip}
                    >
                      {stop.place.name}
                    </a>
                  ) : (
                    <span style={placeChip}>{stop.place.name}</span>
                  )}
                  {i < lineage.migrationStops.length - 1 && (
                    <span style={{ color: TEAL, fontWeight: 700 }}>→</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {lineage.statusNote && (
          <div
            style={{
              marginTop: 18,
              padding: '12px 14px',
              background: '#faeceb',
              borderLeft: '4px solid #d5aba9',
              fontSize: 14.5,
              color: '#7d4340',
            }}
          >
            <strong>Status note.</strong> {lineage.statusNote}
          </div>
        )}
      </div>

      <AncestorTree
        assigned={lineage.assignedPersons}
        brickWallId={lineage.brickWallAncestor?.id ?? undefined}
      />

      {/* Participants */}
      <section>
        <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: 24, margin: '0 0 16px' }}>
          Participants{' '}
          <span style={{ fontFamily: mono, fontSize: 17, color: '#777' }}>
            ({lineage.participants.length})
          </span>
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {lineage.participants.map((p) => (
            <ParticipantCard key={p.id} p={p} assigned={lineage.assignedPersons} />
          ))}
          {lineage.participants.length === 0 && (
            <div style={{ padding: 24, border: '1px dashed #cccccc', background: '#fff', color: '#555' }}>
              No participants have joined this lineage yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─── Ancestor tree ─────────────────────────────────────────────── */

// Generations expanded on first render (PRD: brick wall + one below).
const DEFAULT_EXPAND_DEPTH = 3;

interface TreeNode {
  ap: AssignedPerson;
  childIds: string[];
}

function buildTree(assigned: AssignedPerson[]) {
  const byId = new Map<string, TreeNode>();
  assigned.forEach((ap) => byId.set(ap.person.id, { ap, childIds: [] }));
  const hasParent = new Set<string>();
  for (const ap of assigned) {
    for (const c of ap.person.children) {
      if (byId.has(c.id)) {
        byId.get(ap.person.id)!.childIds.push(c.id);
        hasParent.add(c.id);
      }
    }
  }
  const roots = assigned
    .filter((ap) => !hasParent.has(ap.person.id))
    .map((ap) => ap.person.id);
  // Everything the roots can reach, ignoring expansion state — nodes outside
  // this set are orphans and get rendered as extra roots.
  const reachable = new Set<string>();
  const mark = (id: string) => {
    if (reachable.has(id)) return;
    reachable.add(id);
    byId.get(id)?.childIds.forEach(mark);
  };
  roots.forEach(mark);
  return { byId, roots, reachable };
}

function marriageLine(ap: AssignedPerson): string {
  const sp = ap.person.spouses?.[0];
  if (!sp) return '';
  const surname = (sp.spouseSurname ?? sp.spouse.surname ?? '').toUpperCase();
  const name = [sp.spouse.givenName, surname].filter(Boolean).join(' ').trim();
  if (!name) return '';
  return `m ${name}${sp.marriagePlace ? `, ${sp.marriagePlace}` : ''}`;
}

function AncestorTree({ assigned, brickWallId }: { assigned: AssignedPerson[]; brickWallId?: string }) {
  const { byId, roots, reachable } = useMemo(() => buildTree(assigned), [assigned]);

  // Default expand: the top DEFAULT_EXPAND_DEPTH generations.
  const defaultExpanded = useMemo(() => {
    const exp: Record<string, boolean> = {};
    const open = (id: string, depth: number) => {
      if (depth >= DEFAULT_EXPAND_DEPTH || exp[id]) return;
      exp[id] = true;
      byId.get(id)?.childIds.forEach((c) => open(c, depth + 1));
    };
    roots.forEach((r) => open(r, 0));
    return exp;
  }, [byId, roots]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>(defaultExpanded);
  useEffect(() => setExpanded(defaultExpanded), [defaultExpanded]);

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    byId.forEach((_, k) => {
      all[k] = true;
    });
    setExpanded(all);
  };
  const collapseAll = () => setExpanded({});

  const rows: React.ReactNode[] = [];
  const visited = new Set<string>();
  const walk = (nodeId: string, depth: number) => {
    const node = byId.get(nodeId);
    if (!node || visited.has(nodeId)) return;
    visited.add(nodeId);
    const { ap } = node;
    const masked = isMasked(ap.person);
    // Masking hides a person's details, not their descendants — every lineage
    // roots at a masked [Living] node, so gating expansion on it flattens the tree.
    const hasChildren = node.childIds.length > 0;
    const isOpen = !!expanded[nodeId];
    const isBrick = brickWallId ? ap.person.id === brickWallId : false;
    const immigrant = ap.person.isImmigrantAncestor;
    const potential = (ap.certainty ?? '').toLowerCase() === 'potential';

    let badge: { label: string; bg: string; fg: string; border: string } | null = null;
    if (!masked) {
      if (isBrick) badge = { label: 'Brick Wall', bg: '#d5aba9', fg: '#191919', border: '#191919' };
      else if (immigrant) badge = { label: 'Immigrant', bg: '#f5deb3', fg: '#191919', border: '#191919' };
      else if (potential) badge = { label: 'Potential', bg: '#f6f6f6', fg: '#555', border: '#cccccc' };
    }
    const marriage = masked ? '' : marriageLine(ap);
    const dates = masked ? '' : lifeDates(ap.person);

    rows.push(
      <div role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} key={nodeId} style={{ paddingLeft: depth * 26 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '5px 0',
            borderBottom: isBrick ? '2px solid #d5aba9' : '1px solid #f2f2f2',
          }}
        >
          <span
            onClick={hasChildren ? () => setExpanded((e) => ({ ...e, [nodeId]: !e[nodeId] })) : undefined}
            style={{
              cursor: hasChildren ? 'pointer' : 'default',
              width: 20,
              flex: '0 0 20px',
              textAlign: 'center',
              color: '#2b6c6e',
              fontSize: 13,
              userSelect: 'none',
            }}
          >
            {hasChildren ? (isOpen ? '▾' : '▸') : '·'}
          </span>
          <span style={{ width: 12, flex: '0 0 12px', borderTop: `1px solid ${TEAL}`, marginTop: 9 }} />
          <div style={{ flex: '1 1 auto' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontFamily: serif,
                  fontWeight: isBrick ? 700 : masked ? 400 : 600,
                  fontSize: isBrick ? 17 : 15.5,
                  fontStyle: masked ? 'italic' : 'normal',
                  color: masked ? '#888' : '#191919',
                }}
              >
                {masked ? ap.person.privacyLabel ?? personName(ap.person) : personName(ap.person)}
              </span>
              {badge && (
                <span
                  style={{
                    padding: '1px 7px',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    background: badge.bg,
                    color: badge.fg,
                    border: `1px solid ${badge.border}`,
                  }}
                >
                  {badge.label}
                </span>
              )}
              {dates && <span style={{ fontFamily: mono, fontSize: 12.5, color: '#555' }}>{dates}</span>}
            </div>
            {marriage && (
              <div style={{ fontSize: 13, color: '#555', marginTop: 1, fontStyle: 'italic' }}>{marriage}</div>
            )}
          </div>
        </div>
      </div>,
    );

    if (hasChildren && isOpen) node.childIds.forEach((c) => walk(c, depth + 1));
  };
  roots.forEach((r) => walk(r, 0));
  // Defensive: never silently drop assigned ancestors that weren't reached via
  // the parent/child edges (e.g. cyclic or asymmetric import data) — show them
  // as additional roots rather than hiding documented people.
  assigned.forEach((ap) => {
    if (!reachable.has(ap.person.id)) walk(ap.person.id, 0);
  });

  return (
    <section style={{ border: '1px solid #cccccc', background: '#fff', marginBottom: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '16px 20px',
          borderBottom: '1px solid #cccccc',
          background: '#f6f6f6',
          flexWrap: 'wrap',
        }}
      >
        <h2 style={{ fontFamily: serif, fontWeight: 700, fontSize: 22, margin: 0 }}>Ancestor tree</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={expandAll} className="kent-btn-quiet" style={smallBtn}>
            Expand all
          </button>
          <button onClick={collapseAll} className="kent-btn-quiet" style={smallBtn}>
            Collapse all
          </button>
        </div>
      </div>
      <div role="tree" aria-label="Ancestor tree" className="kent-scroll" style={{ padding: '12px 14px 20px', overflowX: 'auto' }}>
        {rows.length > 0 ? (
          <div style={{ minWidth: 480 }}>{rows}</div>
        ) : (
          <div style={{ color: '#777', fontStyle: 'italic', padding: '8px 6px' }}>
            No documented ancestors recorded for this lineage yet.
          </div>
        )}
      </div>
      <div
        style={{
          padding: '10px 20px',
          borderTop: '1px solid #eee',
          fontSize: 12.5,
          color: '#777',
          display: 'flex',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#d5aba9', verticalAlign: 'middle', marginRight: 5 }} />
          Brick wall
        </span>
        <span>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: '#f5deb3', verticalAlign: 'middle', marginRight: 5 }} />
          Immigrant
        </span>
        <span style={{ fontStyle: 'italic' }}>[Living] nodes are privacy-masked leaves</span>
      </div>
    </section>
  );
}

/* ─── Participant card ──────────────────────────────────────────── */

interface Pill {
  label: string;
  value: string;
  detail: string;
  bg: string;
  valueColor: string;
}

function buildChain(participant: ParticipantData, assigned: AssignedPerson[]) {
  const linkedId = participant.linkedPerson?.id;
  if (!linkedId) return [];
  const byId = new Map(assigned.map((ap) => [ap.person.id, ap]));
  if (!byId.has(linkedId)) return [];
  // child -> parent adjacency (inverse of children edges within the set)
  const parentOf = new Map<string, string>();
  for (const ap of assigned) {
    for (const c of ap.person.children) {
      if (byId.has(c.id)) parentOf.set(c.id, ap.person.id);
    }
  }
  const path: AssignedPerson[] = [];
  let cur: string | undefined = linkedId;
  const seen = new Set<string>();
  while (cur && byId.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    path.push(byId.get(cur)!);
    cur = parentOf.get(cur);
  }
  return path.reverse(); // brick wall (G1) first
}

function ParticipantCard({ p, assigned }: { p: ParticipantData; assigned: AssignedPerson[] }) {
  const [chainOpen, setChainOpen] = useState(false);

  const yTest = p.dnaTests.find((t) => (t.testType ?? '').toLowerCase().startsWith('y'));
  const atTest = p.dnaTests.find((t) => (t.testType ?? '').toLowerCase().includes('at'));
  const yHaplo = p.haplogroups.find((h) => (h.haplogroupType ?? '').toUpperCase().includes('Y'));

  const pill = (
    label: string,
    present: boolean,
    value: string,
    detail: string,
    accent: string,
  ): Pill => ({
    label,
    value: present ? value : 'N/A',
    detail: present ? detail : '',
    bg: present ? accent : '#fafafa',
    valueColor: present ? '#191919' : '#999',
  });

  const yStatus = yHaplo?.confirmationStatus
    ? yHaplo.confirmationStatus.toUpperCase() === 'CONFIRMED'
      ? 'Confirmed'
      : 'Predicted'
    : '';

  const pills: Pill[] = [
    pill(
      'Online Tree',
      p.onlineTrees.length > 0,
      p.onlineTrees[0]?.platform ?? '',
      p.onlineTrees[0]?.treeName ?? '',
      '#f7fbfb',
    ),
    pill(
      'y-DNA Test',
      !!yTest,
      `${yTest?.markerCount ?? '?'} markers${yHaplo ? ` · ${yHaplo.abbreviation ?? yHaplo.name}` : ''}`,
      [yStatus, yTest?.registeredWithProject ? 'Registered ✓' : '', yTest?.kitNumber ? `Kit ${yTest.kitNumber}` : '']
        .filter(Boolean)
        .join(' · '),
      '#f7fbfb',
    ),
    pill(
      'atDNA Test',
      !!atTest,
      atTest?.provider ?? atTest?.testName ?? '',
      atTest?.registeredWithProject ? 'Registered ✓' : 'Not registered',
      '#fdf8ef',
    ),
  ];

  const chain = useMemo(() => buildChain(p, assigned), [p, assigned]);

  const matches = p.geneticMatches.map((m) => {
    const who = m.participant.ftdnaKitNumber
      ? `Kit No. ${m.participant.ftdnaKitNumber}`
      : m.participant.displayName;
    const level = m.markerLevel ? ` at ${m.markerLevel}/${m.markerLevel} markers` : '';
    const note = m.notes ? ` (${m.notes})` : '';
    return `Matches ${who}${level}${note}`;
  });

  return (
    <article style={{ border: '1px solid #cccccc', borderLeft: '5px solid #87a4c4', background: '#fff' }}>
      <div style={{ padding: '20px 22px', borderBottom: '1px solid #eee', display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <h3 style={{ fontFamily: serif, fontWeight: 700, fontSize: 20, margin: 0 }}>{p.displayName}</h3>
            <span
              style={{
                padding: '3px 9px',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                background: membershipPill(p.membershipType),
                border: '1px solid #191919',
              }}
            >
              {membershipLabel(p.membershipType)}
            </span>
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 5, fontFamily: mono }}>
            {[p.joinDate ? `Joined ${p.joinDate}` : '', p.ftdnaKitNumber ? `Kit No. ${p.ftdnaKitNumber}` : 'Researcher']
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
      </div>

      <div className="kent-pill-grid" style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {pills.map((pl) => (
          <div key={pl.label} style={{ border: '1px solid #e2e2e2', background: pl.bg, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#555', marginBottom: 6 }}>
              {pl.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: pl.valueColor }}>{pl.value}</div>
            {pl.detail && (
              <div style={{ fontSize: 12.5, color: '#555', marginTop: 3, fontFamily: mono }}>{pl.detail}</div>
            )}
          </div>
        ))}
      </div>

      {chain.length > 0 && (
        <div style={{ padding: '0 22px 6px' }}>
          <button
            onClick={() => setChainOpen((o) => !o)}
            style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#2b6c6e', background: 'none', border: 'none', padding: '6px 0' }}
          >
            {chainOpen ? '▾' : '▸'} Kent ancestry &amp; brick wall ({chain.length})
          </button>
          {chainOpen && (
            <ol style={{ margin: '12px 0 6px', padding: 0, listStyle: 'none' }}>
              {chain.map((ap, i) => {
                const masked = isMasked(ap.person);
                return (
                  <li key={ap.person.id} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <span style={{ flex: '0 0 34px', fontFamily: mono, fontSize: 13, color: '#87a4c4', fontWeight: 600 }}>
                      G{i + 1}
                    </span>
                    <div>
                      <span style={{ fontFamily: serif, fontWeight: masked ? 400 : i === 0 ? 700 : 600, fontSize: 15.5, fontStyle: masked ? 'italic' : 'normal' }}>
                        {masked ? ap.person.privacyLabel ?? personName(ap.person) : personName(ap.person)}
                      </span>
                      {!masked && <span style={{ fontFamily: mono, fontSize: 12.5, color: '#555', marginLeft: 8 }}>{lifeDates(ap.person)}</span>}
                      {!masked && marriageLine(ap) && (
                        <div style={{ fontSize: 13, color: '#555', fontStyle: 'italic' }}>{marriageLine(ap)}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      {p.researchGoal && (
        <div style={{ padding: '4px 22px 16px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#555' }}>
            Research goal
          </span>
          <p style={{ margin: '4px 0 0', fontStyle: 'italic', color: '#333', fontSize: 15 }}>{p.researchGoal}</p>
        </div>
      )}

      {matches.length > 0 && (
        <div style={{ padding: '12px 22px 18px', borderTop: '1px solid #eee' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#555', marginBottom: 8 }}>
            Genetic matches
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matches.map((m, i) => (
              <div key={i} style={{ fontSize: 14, color: '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#87a4c4' }} />
                {m}
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

const navBtn: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #cccccc',
  background: '#fff',
  fontSize: 13.5,
  fontWeight: 600,
  cursor: 'pointer',
};
const smallBtn: React.CSSProperties = {
  padding: '6px 12px',
  border: '1px solid #cccccc',
  background: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
};
const placeChip: React.CSSProperties = {
  fontFamily: mono,
  fontSize: 14,
  padding: '3px 8px',
  border: `1px solid ${TEAL}`,
  background: '#f0f8f8',
  color: '#1f5658',
  textDecoration: 'none',
};
