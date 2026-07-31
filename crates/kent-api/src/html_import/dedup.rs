use std::collections::HashMap;
use uuid::Uuid;

use super::types::*;

/// State abbreviation to full name mapping.
static STATE_ABBREVS: &[(&str, &str)] = &[
    ("AL", "Alabama"),
    ("AK", "Alaska"),
    ("AZ", "Arizona"),
    ("AR", "Arkansas"),
    ("CA", "California"),
    ("CO", "Colorado"),
    ("CT", "Connecticut"),
    ("DE", "Delaware"),
    ("FL", "Florida"),
    ("GA", "Georgia"),
    ("HI", "Hawaii"),
    ("ID", "Idaho"),
    ("IL", "Illinois"),
    ("IN", "Indiana"),
    ("IA", "Iowa"),
    ("KS", "Kansas"),
    ("KY", "Kentucky"),
    ("LA", "Louisiana"),
    ("ME", "Maine"),
    ("MD", "Maryland"),
    ("MA", "Massachusetts"),
    ("MI", "Michigan"),
    ("MN", "Minnesota"),
    ("MS", "Mississippi"),
    ("MO", "Missouri"),
    ("MT", "Montana"),
    ("NE", "Nebraska"),
    ("NV", "Nevada"),
    ("NH", "New Hampshire"),
    ("NJ", "New Jersey"),
    ("NM", "New Mexico"),
    ("NY", "New York"),
    ("NC", "North Carolina"),
    ("ND", "North Dakota"),
    ("OH", "Ohio"),
    ("OK", "Oklahoma"),
    ("OR", "Oregon"),
    ("PA", "Pennsylvania"),
    ("RI", "Rhode Island"),
    ("SC", "South Carolina"),
    ("SD", "South Dakota"),
    ("TN", "Tennessee"),
    ("TX", "Texas"),
    ("UT", "Utah"),
    ("VT", "Vermont"),
    ("VA", "Virginia"),
    ("WA", "Washington"),
    ("WV", "West Virginia"),
    ("WI", "Wisconsin"),
    ("WY", "Wyoming"),
];

/// Namespace UUID for deterministic ID generation (UUID v5).
pub const KENT_NAMESPACE: Uuid = Uuid::from_bytes([
    0x6b, 0x65, 0x6e, 0x74, 0x2d, 0x66, 0x61, 0x6d, 0x69, 0x6c, 0x79, 0x2d, 0x64, 0x6e, 0x61, 0x21,
]);

/// Generate a deterministic UUID from a namespace + key string. Every node the
/// importer creates derives its ID this way, so a re-run of the same source
/// `MERGE`s onto the existing graph instead of duplicating it.
pub fn deterministic_id(key: &str) -> String {
    Uuid::new_v5(&KENT_NAMESPACE, key.as_bytes()).to_string()
}

/// Canonical (given_name, surname).
type NameKey = (String, String);
/// A person node seen under a name: its birth year (if known) and its ID.
type NamedPerson = (Option<String>, String);

/// Deduplication context used during persistence.
pub struct DedupContext {
    persons: HashMap<PersonKey, String>,
    /// Every person seen per canonical name, in insertion order. Lets a record
    /// that omits the birth date merge with the dated record for the same
    /// person instead of forking a duplicate node.
    persons_by_name: HashMap<NameKey, Vec<NamedPerson>>,
    places: HashMap<PlaceKey, String>,
    haplogroups: HashMap<HaplogroupKey, String>,
    participants: HashMap<String, String>, // kit_number -> uuid
    lineages: HashMap<LineageKey, String>,
    state_map: HashMap<String, String>,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct PersonKey {
    pub given_name: String,
    pub surname: String,
    pub birth_year: Option<String>,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct PlaceKey {
    pub name: String,
    pub state: String,
    pub country: String,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct HaplogroupKey {
    pub name: String,
    pub subclade: String,
}

#[derive(Debug, Clone, Hash, Eq, PartialEq)]
pub struct LineageKey {
    pub origin_state: String,
    pub lineage_number: i64,
    pub name: String,
}

/// Canonicalize a value used in a dedup key: trim, collapse internal runs of
/// whitespace, and lowercase. Without this, "Ann  Smith" and "ann smith" hash
/// to different keys and produce duplicate nodes for the same person.
fn canonical(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

impl DedupContext {
    pub fn new() -> Self {
        let state_map: HashMap<String, String> = STATE_ABBREVS
            .iter()
            .map(|(abbr, full)| (abbr.to_string(), full.to_string()))
            .collect();

        Self {
            persons: HashMap::new(),
            persons_by_name: HashMap::new(),
            places: HashMap::new(),
            haplogroups: HashMap::new(),
            participants: HashMap::new(),
            lineages: HashMap::new(),
            state_map,
        }
    }

    /// Get or create a person UUID, deduplicating by (given_name, surname, birth_year).
    pub fn get_or_create_person_id(&mut self, person: &ParsedPerson) -> String {
        let given_name = canonical(&person.given_name);
        let surname = canonical(&person.surname);
        let birth_year = person
            .birth_date_sort
            .as_ref()
            .and_then(|d| d.split('-').next().map(|y| y.to_string()));

        // Nameless entries have no usable name key, so fall back to whatever
        // else distinguishes them. Still deterministic, unlike a random UUID.
        if given_name.is_empty() && surname.is_empty() {
            return deterministic_id(&format!(
                "person:anon:{}:{}:{}:{}",
                person.birth_date_sort.as_deref().unwrap_or(""),
                person.birth_place.as_deref().unwrap_or(""),
                person.death_date_sort.as_deref().unwrap_or(""),
                person.death_place.as_deref().unwrap_or(""),
            ));
        }

        let key = PersonKey {
            given_name: given_name.clone(),
            surname: surname.clone(),
            birth_year: birth_year.clone(),
        };
        if let Some(id) = self.persons.get(&key) {
            return id.clone();
        }

        // Same name, one record dated and one not: treat them as one person.
        // Only when the match is unambiguous — two dated records for the same
        // name are two different people and must stay apart.
        let seen = self
            .persons_by_name
            .entry((given_name.clone(), surname.clone()))
            .or_default();
        let merged = if birth_year.is_some() {
            // A dated record adopts the sole undated node for this name.
            let undated: Vec<usize> = seen
                .iter()
                .enumerate()
                .filter(|(_, (y, _))| y.is_none())
                .map(|(i, _)| i)
                .collect();
            (undated.len() == 1 && seen.len() == 1).then(|| {
                let i = undated[0];
                seen[i].0 = birth_year.clone();
                seen[i].1.clone()
            })
        } else {
            // An undated record adopts the sole existing node for this name.
            (seen.len() == 1).then(|| seen[0].1.clone())
        };

        let id = merged.unwrap_or_else(|| {
            let id = deterministic_id(&format!(
                "person:{given_name}|{surname}|{}",
                birth_year.as_deref().unwrap_or("")
            ));
            seen.push((birth_year.clone(), id.clone()));
            id
        });

        self.persons.insert(key, id.clone());
        id
    }

    /// Get or create a haplogroup UUID.
    pub fn get_or_create_haplogroup_id(&mut self, name: &str, subclade: &str) -> String {
        let key = HaplogroupKey {
            name: canonical(name),
            subclade: canonical(subclade),
        };
        let id = deterministic_id(&format!("haplogroup:{}|{}", key.name, key.subclade));

        self.haplogroups.entry(key).or_insert(id).clone()
    }

    /// Get or create a place UUID, normalizing the place first.
    pub fn get_or_create_place_id(&mut self, raw_place: &str) -> (String, NormalizedPlace) {
        let normalized = self.normalize_place(raw_place);
        let key = PlaceKey {
            name: canonical(&normalized.name),
            state: canonical(&normalized.state),
            country: canonical(&normalized.country),
        };

        let new_id = deterministic_id(&format!("place:{}|{}|{}", key.name, key.state, key.country));
        let id = self.places.entry(key).or_insert(new_id).clone();

        (id, normalized)
    }

    /// Get or create a participant UUID, deduplicating by kit number.
    pub fn get_or_create_participant_id(&mut self, kit_number: Option<&str>, name: &str) -> String {
        // Canonicalize *before* the emptiness check: a whitespace-only kit
        // number is non-empty but canonicalizes to "", so every such
        // participant would otherwise collide on a single key and merge.
        if let Some(kit) = kit_number.map(canonical).filter(|k| !k.is_empty()) {
            let id = deterministic_id(&format!("participant:kit:{kit}"));
            return self.participants.entry(kit).or_insert(id).clone();
        }
        // No kit number — use name as fallback key (less reliable)
        let key = format!("name:{}", canonical(name));
        let id = deterministic_id(&format!("participant:{key}"));
        self.participants.entry(key).or_insert(id).clone()
    }

    /// Get or create a lineage UUID.
    pub fn get_or_create_lineage_id(&mut self, lineage: &ParsedLineage) -> String {
        let key = LineageKey {
            origin_state: canonical(lineage.origin_state.as_deref().unwrap_or_default()),
            lineage_number: lineage.lineage_number.unwrap_or(0),
            name: canonical(&lineage.name),
        };

        let id = deterministic_id(&format!(
            "lineage:{}|{}|{}",
            key.origin_state, key.lineage_number, key.name
        ));
        self.lineages.entry(key).or_insert(id).clone()
    }

    /// Normalize a raw place string like "Sodus, Wayne, NY" into components.
    pub fn normalize_place(&self, raw: &str) -> NormalizedPlace {
        let raw = raw
            .trim()
            .trim_end_matches(',')
            .trim_start_matches(',')
            .trim();
        let parts: Vec<&str> = raw
            .split(',')
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        match parts.len() {
            0 => NormalizedPlace {
                name: raw.to_string(),
                county: None,
                state: String::new(),
                country: "United States".to_string(),
            },
            1 => {
                // Could be a state abbreviation, a country, or a city
                let part = parts[0];
                if let Some(full_state) = self.state_map.get(&part.to_uppercase()) {
                    NormalizedPlace {
                        name: full_state.clone(),
                        county: None,
                        state: full_state.clone(),
                        country: "United States".to_string(),
                    }
                } else if is_country(part) {
                    NormalizedPlace {
                        name: part.to_string(),
                        county: None,
                        state: String::new(),
                        country: part.to_string(),
                    }
                } else {
                    NormalizedPlace {
                        name: part.to_string(),
                        county: None,
                        state: String::new(),
                        country: "United States".to_string(),
                    }
                }
            }
            2 => {
                // "City, State" or "City, Country"
                let last = parts[1];
                if let Some(full_state) = self.state_map.get(&last.to_uppercase()) {
                    NormalizedPlace {
                        name: format!("{}, {}", parts[0], full_state),
                        county: None,
                        state: full_state.clone(),
                        country: "United States".to_string(),
                    }
                } else if is_country(last) || is_country_part(last) {
                    NormalizedPlace {
                        name: raw.to_string(),
                        county: None,
                        state: String::new(),
                        country: last.to_string(),
                    }
                } else {
                    // Might be "County, State" with full name
                    NormalizedPlace {
                        name: raw.to_string(),
                        county: None,
                        state: last.to_string(),
                        country: "United States".to_string(),
                    }
                }
            }
            3 => {
                // "City, County, State" (most common US format)
                let last = parts[2];
                if let Some(full_state) = self.state_map.get(&last.to_uppercase()) {
                    NormalizedPlace {
                        name: format!("{}, {}", parts[0], full_state),
                        county: Some(normalize_county(parts[1])),
                        state: full_state.clone(),
                        country: "United States".to_string(),
                    }
                } else if is_country(last) || is_country_part(last) {
                    NormalizedPlace {
                        name: raw.to_string(),
                        county: Some(parts[1].to_string()),
                        state: String::new(),
                        country: last.to_string(),
                    }
                } else {
                    NormalizedPlace {
                        name: raw.to_string(),
                        county: Some(parts[1].to_string()),
                        state: last.to_string(),
                        country: "United States".to_string(),
                    }
                }
            }
            _ => {
                // 4+ parts — last is likely state/country
                let last = parts[parts.len() - 1];
                if is_country(last) || is_country_part(last) {
                    // Non-US: last = country, second-to-last = state/region
                    let state = if parts.len() >= 3 {
                        parts[parts.len() - 2].to_string()
                    } else {
                        String::new()
                    };
                    let county = if parts.len() >= 4 {
                        Some(parts[parts.len() - 3].to_string())
                    } else {
                        None
                    };
                    NormalizedPlace {
                        name: raw.to_string(),
                        county,
                        state,
                        country: last.to_string(),
                    }
                } else {
                    // US: last = state abbreviation or full name
                    let state = if let Some(full) = self.state_map.get(&last.to_uppercase()) {
                        full.clone()
                    } else {
                        last.to_string()
                    };
                    NormalizedPlace {
                        name: raw.to_string(),
                        county: Some(parts[parts.len() - 2].to_string()),
                        state,
                        country: "United States".to_string(),
                    }
                }
            }
        }
    }
}

#[derive(Debug, Clone)]
pub struct NormalizedPlace {
    pub name: String,
    pub county: Option<String>,
    pub state: String,
    pub country: String,
}

fn normalize_county(county: &str) -> String {
    let county = county.trim();
    // Remove "Co." suffix if present
    county
        .trim_end_matches("Co.")
        .trim_end_matches("County")
        .trim()
        .to_string()
}

fn is_country(s: &str) -> bool {
    let countries = [
        "England",
        "Belgium",
        "Canada",
        "Germany",
        "France",
        "Ireland",
        "Scotland",
        "Wales",
        "New Zealand",
        "Australia",
    ];
    countries.iter().any(|c| s.eq_ignore_ascii_case(c))
}

fn is_country_part(s: &str) -> bool {
    // Parts of country names that appear in multi-part place strings
    s.contains("England")
        || s.contains("Belgium")
        || s.contains("Canada")
        || s.contains("New Zealand")
        || s.contains("Germany")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn person(given: &str, surname: &str, birth_sort: Option<&str>) -> ParsedPerson {
        ParsedPerson {
            given_name: given.to_string(),
            surname: surname.to_string(),
            name_suffix: None,
            name_prefix: None,
            sex: None,
            birth_date: None,
            birth_date_sort: birth_sort.map(String::from),
            birth_date_modifier: None,
            birth_place: None,
            death_date: None,
            death_date_sort: None,
            death_date_modifier: None,
            death_place: None,
            is_living: false,
            is_immigrant_ancestor: false,
            spouses: vec![],
            notes: None,
            common_ancestor_gen: None,
        }
    }

    /// The whole point of #5: a second import run must land on the same IDs.
    #[test]
    fn test_ids_are_stable_across_contexts() {
        let p = person("John", "Kent", Some("1762-01-01"));
        let mut a = DedupContext::new();
        let mut b = DedupContext::new();
        assert_eq!(a.get_or_create_person_id(&p), b.get_or_create_person_id(&p));

        let lineage = ParsedLineage {
            anchor: None,
            name: "MARYLAND".to_string(),
            lineage_number: Some(1),
            region: None,
            origin_state: Some("Maryland".to_string()),
            is_new: false,
            new_lineage_date: None,
            is_empty: false,
            migration_path: vec![],
            common_ancestors: vec![],
            participants: vec![],
        };
        let mut c = DedupContext::new();
        let mut d = DedupContext::new();
        assert_eq!(
            c.get_or_create_lineage_id(&lineage),
            d.get_or_create_lineage_id(&lineage)
        );
        assert_eq!(
            c.get_or_create_haplogroup_id("R-M269", "R-P25"),
            d.get_or_create_haplogroup_id("R-M269", "R-P25")
        );
        assert_eq!(
            c.get_or_create_place_id("Sodus, Wayne, NY").0,
            d.get_or_create_place_id("Sodus, Wayne, NY").0
        );
        assert_eq!(
            c.get_or_create_participant_id(Some("12345"), "A"),
            d.get_or_create_participant_id(Some("12345"), "A")
        );
    }

    #[test]
    fn test_undated_record_merges_into_dated_one() {
        // Order 1: dated first.
        let mut ctx = DedupContext::new();
        let dated = ctx.get_or_create_person_id(&person("John", "Kent", Some("1762-01-01")));
        let undated = ctx.get_or_create_person_id(&person("John", "Kent", None));
        assert_eq!(dated, undated);

        // Order 2: undated first — must merge the same way.
        let mut ctx = DedupContext::new();
        let undated = ctx.get_or_create_person_id(&person("John", "Kent", None));
        let dated = ctx.get_or_create_person_id(&person("John", "Kent", Some("1762-01-01")));
        assert_eq!(dated, undated);
    }

    #[test]
    fn test_two_dated_records_stay_distinct() {
        let mut ctx = DedupContext::new();
        let a = ctx.get_or_create_person_id(&person("John", "Kent", Some("1762-01-01")));
        let b = ctx.get_or_create_person_id(&person("John", "Kent", Some("1801-01-01")));
        assert_ne!(a, b);
        // With the name now ambiguous, an undated record must NOT merge.
        let c = ctx.get_or_create_person_id(&person("John", "Kent", None));
        assert_ne!(c, a);
        assert_ne!(c, b);
    }

    #[test]
    fn test_whitespace_only_kit_falls_back_to_name() {
        let mut ctx = DedupContext::new();
        let a = ctx.get_or_create_participant_id(Some("   "), "Alice");
        let b = ctx.get_or_create_participant_id(Some("   "), "Bob");
        assert_ne!(a, b, "whitespace kits must not collide");
    }
}
