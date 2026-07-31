import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gql, useClient } from 'urql';
import { SearchType, useSearchQuery } from '../../generated/graphql';

// Person/Participant have no standalone public page, so a search hit routes to
// the lineage they belong to.
const PERSON_LINEAGE = gql`
  query PersonLineage($id: String!) {
    person(id: $id) {
      lineageAssignments {
        lineage {
          id
        }
      }
    }
  }
`;
const PARTICIPANT_LINEAGE = gql`
  query ParticipantLineage($id: String!) {
    participant(id: $id) {
      lineageMemberships {
        lineage {
          id
        }
      }
    }
  }
`;

const serif = "'Source Serif 4', serif";

const CHIPS: { label: string; type: SearchType | 'ALL' }[] = [
  { label: 'All', type: 'ALL' },
  { label: 'People', type: SearchType.Person },
  { label: 'Participants', type: SearchType.Participant },
  { label: 'Lineages', type: SearchType.Lineage },
  { label: 'Places', type: SearchType.Place },
  { label: 'Haplogroups', type: SearchType.Haplogroup },
];

const TYPE_STYLE: Record<string, [string, string, string]> = {
  Lineage: ['#87c2c4', '#191919', '#191919'],
  Person: ['#f6f6f6', '#333', '#cccccc'],
  Participant: ['#87a4c4', '#191919', '#191919'],
  Place: ['#f5deb3', '#191919', '#191919'],
  Haplogroup: ['#d5aba9', '#191919', '#191919'],
};

export function Search() {
  const navigate = useNavigate();
  const client = useClient();
  const [q, setQ] = useState('');
  const [type, setType] = useState<SearchType | 'ALL'>('ALL');

  // Each query fans out across five fulltext indexes, so don't fire per keystroke.
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [{ data, fetching }] = useSearchQuery({
    variables: { query: debouncedQ, types: type === 'ALL' ? undefined : [type], limit: 40 },
    pause: debouncedQ.trim().length === 0,
  });

  const results = data?.search.items ?? [];

  const navFor = async (resultType: string, id: string) => {
    if (resultType === 'Lineage') {
      navigate(`/lineages/${id}`);
    } else if (resultType === 'Haplogroup') {
      navigate('/haplogroups');
    } else if (resultType === 'Person') {
      const res = await client.query(PERSON_LINEAGE, { id }).toPromise();
      const lid = res.data?.person?.lineageAssignments?.[0]?.lineage?.id;
      if (lid) navigate(`/lineages/${lid}`);
    } else if (resultType === 'Participant') {
      const res = await client.query(PARTICIPANT_LINEAGE, { id }).toPromise();
      const lid = res.data?.participant?.lineageMemberships?.[0]?.lineage?.id;
      if (lid) navigate(`/lineages/${lid}`);
    }
  };

  // Types that route somewhere. Places have no standalone page.
  const NAVIGABLE = new Set(['Lineage', 'Haplogroup', 'Person', 'Participant']);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 22px 72px' }}>
      <h1 style={{ fontFamily: serif, fontWeight: 700, fontSize: 36, margin: '0 0 6px' }}>
        Search the project
      </h1>
      <p style={{ margin: '0 0 22px', color: '#555', fontSize: 16 }}>
        Find people, participants, lineages, and places by name.
      </p>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. Kent, Warren County, R-M269…"
        autoFocus
        style={{
          width: '100%',
          padding: '16px 18px',
          border: '2px solid #191919',
          fontSize: 19,
          fontFamily: 'inherit',
          background: '#fff',
        }}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0 6px' }}>
        {CHIPS.map((c) => {
          const on = type === c.type;
          return (
            <button
              key={c.label}
              onClick={() => setType(c.type)}
              style={{
                cursor: 'pointer',
                padding: '7px 14px',
                fontSize: 13.5,
                fontWeight: 600,
                border: '1px solid #191919',
                background: on ? '#191919' : '#fff',
                color: on ? '#fff' : '#191919',
              }}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13.5, color: '#777', marginBottom: 18 }}>
        {q.trim().length === 0
          ? 'Type to search.'
          : fetching
            ? 'Searching…'
            : `${results.length} result${results.length === 1 ? '' : 's'}`}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {results.map((r) => {
          const [bg, fg, border] = TYPE_STYLE[r.resultType] ?? ['#f6f6f6', '#333', '#cccccc'];
          const clickable = NAVIGABLE.has(r.resultType);
          return (
            <div
              key={`${r.resultType}-${r.id}`}
              onClick={clickable ? () => navFor(r.resultType, r.id) : undefined}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navFor(r.resultType, r.id);
                      }
                    }
                  : undefined
              }
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              className={clickable ? 'kent-card-link' : undefined}
              style={{
                cursor: clickable ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                padding: '16px 18px',
                border: '1px solid #cccccc',
                background: '#fff',
                color: '#191919',
              }}
            >
              <span
                style={{
                  flex: '0 0 auto',
                  padding: '3px 9px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  background: bg,
                  color: fg,
                  border: `1px solid ${border}`,
                  marginTop: 2,
                }}
              >
                {r.resultType}
              </span>
              <div>
                <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 17 }}>{r.display}</div>
              </div>
            </div>
          );
        })}
        {q.trim().length > 0 && !fetching && results.length === 0 && (
          <div style={{ padding: 36, textAlign: 'center', color: '#555', border: '1px dashed #cccccc', background: '#fff' }}>
            No results. Try another name or place.
          </div>
        )}
      </div>
    </div>
  );
}
