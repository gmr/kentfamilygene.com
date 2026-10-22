/** Shown only if the graph has no timestamps at all (empty database). */
export const LAST_UPDATED_FALLBACK = 'recently';

/** The project's home timezone. Pinned so a timestamp near a month boundary
 * renders as the same month for every visitor, not the viewer's local one. */
export const SITE_TIME_ZONE = 'America/New_York';

/**
 * Render `Stats.lastUpdated` (ISO-8601) as "Jul 2026". The value is the newest
 * data change or published CMS edit, so the footer tracks reality instead of a
 * hand-edited constant.
 */
export function formatLastUpdated(iso?: string | null): string {
  if (!iso) return LAST_UPDATED_FALLBACK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return LAST_UPDATED_FALLBACK;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: SITE_TIME_ZONE,
  });
}

// Formatting helpers shared across the public site. Genealogy dates are fuzzy
// strings with a separate modifier enum; names carry prefixes/suffixes and
// privacy labels. These helpers turn the GraphQL shapes into the display
// strings the design calls for.

/** Prefix for a genealogy date modifier, e.g. ABOUT -> "abt ". */
export function datePrefix(modifier?: string | null): string {
  switch ((modifier ?? '').toUpperCase()) {
    case 'ABOUT':
      return 'abt ';
    case 'BEFORE':
      return 'bef. ';
    case 'AFTER':
      return 'aft. ';
    case 'CALCULATED':
      return 'ca ';
    case 'PROBABLY':
      return 'prob. ';
    default:
      return '';
  }
}

export interface PersonLike {
  givenName?: string | null;
  surname?: string | null;
  nameSuffix?: string | null;
  privacyLabel?: string | null;
  isLiving?: boolean | null;
  birthDate?: string | null;
  birthDateModifier?: string | null;
  birthPlace?: string | null;
  deathDate?: string | null;
  deathDateModifier?: string | null;
  deathPlace?: string | null;
}

/** True when the backend has privacy-masked this person (living leaf node).
 * Masking strips the surname and all dates, leaving only a privacy label in
 * givenName (e.g. "Father", "[Living]", "y-DNA Participant"). The reliable
 * signal is an empty surname combined with a living flag / privacy label. */
export function isMasked(p: PersonLike): boolean {
  const surname = (p.surname ?? '').trim();
  if (surname) return false;
  const given = (p.givenName ?? '').trim();
  return !!p.isLiving || !!p.privacyLabel || given.startsWith('[');
}

/** Full display name; falls back to the privacy label for masked persons. */
export function personName(p: PersonLike): string {
  const given = (p.givenName ?? '').trim();
  const surname = (p.surname ?? '').trim();
  // Importer placeholders store the role in privacyLabel and leave the names
  // empty. Masking copies the label into givenName for anonymous callers, so
  // without this fallback the node renders blank to a signed-in admin.
  if (!given && !surname) return (p.privacyLabel ?? '').trim();
  if (!surname) return given; // masked or single-token label
  return [given, surname, (p.nameSuffix ?? '').trim()].filter(Boolean).join(' ');
}

// Modifier tokens that may already be baked into the imported date string.
const EXISTING_PREFIX = /^\s*(abt\.?|bef\.?|aft\.?|ca\.?|c\.?|prob\.?|about|before|after)\s/i;

function oneDate(date?: string | null, modifier?: string | null, place?: string | null): string {
  if (!date && !place) return '';
  // Don't double up the prefix when the date string already carries a modifier.
  const prefix = EXISTING_PREFIX.test(date ?? '') ? '' : datePrefix(modifier);
  const d = date ? `${prefix}${date}` : '';
  return [d, place].filter(Boolean).join(' ');
}

/** "b abt 1792 NC · d Apr 1856 Warren Co., GA" (empty parts dropped). */
export function lifeDates(p: PersonLike): string {
  const parts: string[] = [];
  const b = oneDate(p.birthDate, p.birthDateModifier, p.birthPlace);
  const d = oneDate(p.deathDate, p.deathDateModifier, p.deathPlace);
  if (b) parts.push(`b ${b}`);
  if (d) parts.push(`d ${d}`);
  return parts.join(' · ');
}

/** Disambiguated lineage heading, e.g. "Maryland, Lineage No. 1".
 * A region can hold many same-numbered lineages across states, so the bare
 * displayName ("MARYLAND") isn't unique — compose state + number. */
export function lineageTitle(l: {
  displayName: string;
  originState?: string | null;
  lineageNumber?: number | null;
}): string {
  const base = l.originState || l.displayName;
  return l.lineageNumber != null ? `${base}, Lineage No. ${l.lineageNumber}` : base;
}

// Older imports stored the label ("Project Member") instead of the enum value.
function isProjectMember(m?: string | null): boolean {
  return (m ?? '').toUpperCase().replace(/ /g, '_') === 'PROJECT_MEMBER';
}

export function membershipLabel(m?: string | null): string {
  return isProjectMember(m) ? 'Project Member' : 'Associate Researcher';
}

export function membershipPill(m?: string | null): string {
  return isProjectMember(m) ? '#87c2c4' : '#f5deb3';
}

export interface PlaceLike {
  name?: string | null;
  county?: string | null;
  state?: string | null;
  country?: string | null;
}

/** Short place label, e.g. "Warren Co., GA" or "England". */
export function placeShort(place: PlaceLike): string {
  if (place.county && place.state) {
    return `${place.county.replace(/ County$/i, '')} Co., ${stateAbbr(place.state)}`;
  }
  return place.name ?? place.state ?? place.country ?? '';
}

const STATE_ABBR: Record<string, string> = {
  Alabama: 'AL', Georgia: 'GA', Illinois: 'IL', Maryland: 'MD', Massachusetts: 'MA',
  Missouri: 'MO', 'New Jersey': 'NJ', 'New York': 'NY', 'North Carolina': 'NC', Ohio: 'OH',
  Pennsylvania: 'PA', Virginia: 'VA', 'South Carolina': 'SC', Tennessee: 'TN',
};
export function stateAbbr(state?: string | null): string {
  if (!state) return '';
  return STATE_ABBR[state] ?? state;
}

/** Project regions in display order, each with its states/countries in
 * display order. The site groups lineages by this table, not by the imported
 * `region` value, so the grouping follows the project's own region scheme. */
export const REGIONS: { name: string; states: string[] }[] = [
  { name: 'International', states: ['Belgium', 'Canada', 'England', 'Germany'] },
  { name: 'New England', states: ['Connecticut', 'Maine', 'Massachusetts', 'New Hampshire', 'Rhode Island', 'Vermont'] },
  { name: 'Mid Atlantic', states: ['Delaware', 'Maryland', 'New Jersey', 'New York', 'Pennsylvania'] },
  { name: 'Upper South', states: ['Kentucky', 'North Carolina', 'Tennessee', 'Virginia', 'West Virginia'] },
  {
    name: 'South & Gulf States',
    states: ['Alabama', 'Arkansas', 'Florida', 'Georgia', 'Louisiana', 'Mississippi', 'South Carolina', 'Texas'],
  },
  {
    name: 'Midwest & Great Plains',
    states: [
      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Michigan', 'Minnesota', 'Missouri', 'Nebraska',
      'North Dakota', 'Ohio', 'Oklahoma', 'South Dakota', 'Wisconsin',
    ],
  },
  {
    name: 'Western States',
    states: [
      'Alaska', 'Arizona', 'California', 'Colorado', 'Hawaii', 'Idaho', 'Montana', 'Nevada',
      'New Mexico', 'Oregon', 'Utah', 'Washington', 'Wyoming',
    ],
  },
];

interface LineageSortable {
  displayName: string;
  originState?: string | null;
  lineageNumber?: number | null;
  region?: string | null;
}

/** Region name for a lineage; an unlisted state keeps its imported region. */
export function regionOf(l: LineageSortable): string {
  const state = l.originState ?? '';
  return REGIONS.find((r) => r.states.includes(state))?.name ?? l.region ?? 'Other';
}

// Position of the lineage's state in REGIONS; unlisted states sort last.
function stateRank(l: LineageSortable): number {
  let i = 0;
  for (const r of REGIONS) {
    for (const s of r.states) {
      if (s === l.originState) return i;
      i++;
    }
  }
  return i;
}

/** Order by region, then state, then lineage number. */
export function compareLineages(a: LineageSortable, b: LineageSortable): number {
  return (
    stateRank(a) - stateRank(b) ||
    (a.originState ?? a.displayName).localeCompare(b.originState ?? b.displayName) ||
    (a.lineageNumber ?? 0) - (b.lineageNumber ?? 0)
  );
}

interface MigrationStopLike {
  stopOrder?: number | null;
  place: PlaceLike;
}

/** "North Carolina → Georgia" from the ordered migration stops (distinct regions). */
export function migrationPath(stops: MigrationStopLike[]): string {
  const labels: string[] = [];
  for (const s of stops) {
    const label = s.place.country && s.place.country !== 'USA' && s.place.country !== 'United States'
      ? s.place.country
      : s.place.state ?? s.place.name ?? '';
    if (label && labels[labels.length - 1] !== label) labels.push(label);
  }
  return labels.join(' → ');
}

/** "Montgomery, Toombs, Warren & Wheeler Co., GA" — counties grouped by state. */
export function countyList(stops: MigrationStopLike[]): string {
  const byState = new Map<string, string[]>();
  for (const s of stops) {
    const county = s.place.county?.replace(/ County$/i, '');
    const state = stateAbbr(s.place.state);
    if (county && state) {
      const list = byState.get(state) ?? [];
      if (!list.includes(county)) list.push(county);
      byState.set(state, list);
    }
  }
  const chunks: string[] = [];
  for (const [state, counties] of byState) {
    const joined =
      counties.length > 1
        ? `${counties.slice(0, -1).join(', ')} & ${counties[counties.length - 1]}`
        : counties[0];
    chunks.push(`${joined} Co., ${state}`);
  }
  return chunks.join(' · ');
}
