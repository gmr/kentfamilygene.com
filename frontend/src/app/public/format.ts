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
  if (!surname && given) return given; // masked or single-token label
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

export function membershipLabel(m?: string | null): string {
  return (m ?? '').toUpperCase() === 'PROJECT_MEMBER' ? 'Project Member' : 'Associate Researcher';
}

export function membershipPill(m?: string | null): string {
  return (m ?? '').toUpperCase() === 'PROJECT_MEMBER' ? '#87c2c4' : '#f5deb3';
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

/** All 12 project regions, in the design's canonical order. */
export const ALL_REGIONS = [
  'England', 'Massachusetts', 'Maryland', 'New Jersey', 'New York', 'Pennsylvania',
  'North Carolina', 'Virginia', 'Georgia', 'Illinois', 'Missouri', 'Ohio',
];

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
