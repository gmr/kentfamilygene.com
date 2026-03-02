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

/// Deduplication context used during persistence.
pub struct DedupContext {
    pub persons: HashMap<PersonKey, String>,
    pub places: HashMap<PlaceKey, String>,
    pub haplogroups: HashMap<HaplogroupKey, String>,
    pub participants: HashMap<String, String>, // kit_number -> uuid
    pub lineages: HashMap<LineageKey, String>,
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

impl DedupContext {
    pub fn new() -> Self {
        let state_map: HashMap<String, String> = STATE_ABBREVS
            .iter()
            .map(|(abbr, full)| (abbr.to_string(), full.to_string()))
            .collect();

        Self {
            persons: HashMap::new(),
            places: HashMap::new(),
            haplogroups: HashMap::new(),
            participants: HashMap::new(),
            lineages: HashMap::new(),
            state_map,
        }
    }

    /// Get or create a person UUID, deduplicating by (given_name, surname, birth_year).
    pub fn get_or_create_person_id(&mut self, person: &ParsedPerson) -> String {
        let birth_year = person
            .birth_date_sort
            .as_ref()
            .and_then(|d| d.split('-').next().map(|y| y.to_string()));

        let key = PersonKey {
            given_name: person.given_name.to_lowercase(),
            surname: person.surname.to_lowercase(),
            birth_year,
        };

        // Don't dedup persons with empty names (privacy labels)
        if key.given_name.is_empty() && key.surname.is_empty() {
            return Uuid::now_v7().to_string();
        }

        self.persons
            .entry(key)
            .or_insert_with(|| Uuid::now_v7().to_string())
            .clone()
    }

    /// Get or create a haplogroup UUID.
    pub fn get_or_create_haplogroup_id(&mut self, name: &str, subclade: &str) -> String {
        let key = HaplogroupKey {
            name: name.to_string(),
            subclade: subclade.to_string(),
        };

        self.haplogroups
            .entry(key)
            .or_insert_with(|| Uuid::now_v7().to_string())
            .clone()
    }

    /// Get or create a place UUID, normalizing the place first.
    pub fn get_or_create_place_id(&mut self, raw_place: &str) -> (String, NormalizedPlace) {
        let normalized = self.normalize_place(raw_place);
        let key = PlaceKey {
            name: normalized.name.to_lowercase(),
            state: normalized.state.to_lowercase(),
            country: normalized.country.to_lowercase(),
        };

        let id = self
            .places
            .entry(key)
            .or_insert_with(|| Uuid::now_v7().to_string())
            .clone();

        (id, normalized)
    }

    /// Get or create a participant UUID, deduplicating by kit number.
    pub fn get_or_create_participant_id(&mut self, kit_number: Option<&str>, name: &str) -> String {
        if let Some(kit) = kit_number
            && !kit.is_empty()
        {
            return self
                .participants
                .entry(kit.to_string())
                .or_insert_with(|| Uuid::now_v7().to_string())
                .clone();
        }
        // No kit number — use name as fallback key (less reliable)
        self.participants
            .entry(format!("name:{}", name.to_lowercase()))
            .or_insert_with(|| Uuid::now_v7().to_string())
            .clone()
    }

    /// Get or create a lineage UUID.
    pub fn get_or_create_lineage_id(&mut self, lineage: &ParsedLineage) -> String {
        let key = LineageKey {
            origin_state: lineage
                .origin_state
                .clone()
                .unwrap_or_default()
                .to_lowercase(),
            lineage_number: lineage.lineage_number.unwrap_or(0),
            name: lineage.name.to_lowercase(),
        };

        self.lineages
            .entry(key)
            .or_insert_with(|| Uuid::now_v7().to_string())
            .clone()
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
