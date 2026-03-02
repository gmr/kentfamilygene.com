use serde::Serialize;

/// The full result of parsing source.html.
#[derive(Debug, Serialize)]
pub struct ParsedDocument {
    pub newest_members: Vec<ParsedParticipantBlock>,
    pub lineages: Vec<ParsedLineage>,
    pub warnings: Vec<String>,
}

/// A parsed lineage section from the HTML.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedLineage {
    pub anchor: Option<String>,
    pub name: String,
    pub lineage_number: Option<i64>,
    pub region: Option<String>,
    pub origin_state: Option<String>,
    pub is_new: bool,
    pub new_lineage_date: Option<String>,
    pub is_empty: bool,
    pub migration_path: Vec<MigrationStop>,
    /// Common ancestors shared across branches (for nested lineages).
    pub common_ancestors: Vec<ParsedPerson>,
    pub participants: Vec<ParsedParticipantBlock>,
}

/// A single stop in a migration path, extracted from `<h4>`.
#[derive(Debug, Clone, Serialize)]
pub struct MigrationStop {
    pub place_text: String,
    pub stop_order: i64,
}

/// A participant block (name, email, tests, ancestor chain).
#[derive(Debug, Clone, Serialize)]
pub struct ParsedParticipantBlock {
    pub display_name: String,
    pub email: Option<String>,
    pub online_tree: Option<ParsedOnlineTree>,
    pub y_dna: Option<ParsedYDna>,
    pub at_dna: Option<ParsedAtDna>,
    pub kit_bracket: Option<ParsedKitBracket>,
    pub ancestors: Vec<ParsedAncestorEntry>,
    pub ancestor_note: Option<String>,
    pub research_goal: Option<String>,
    /// The "through..." back-reference text for nested lineages.
    pub through_ancestor: Option<String>,
}

/// Online tree info.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedOnlineTree {
    pub platform: Option<String>,
    pub username: Option<String>,
    pub tree_name: Option<String>,
    pub url: Option<String>,
}

/// Y-DNA test result.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedYDna {
    pub confirmation_status: String,
    pub haplogroup_name: String,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
}

/// Autosomal DNA test info.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedAtDna {
    pub has_family_finder: bool,
    pub registered_with_project: bool,
    pub provider: Option<String>,
    pub gedmatch_kit: Option<String>,
}

/// Kit bracket info from `[Project Member, FTDNA Kit No. ...]`.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedKitBracket {
    pub membership_type: String,
    pub ftdna_kit_number: Option<String>,
    pub initials: Option<String>,
    pub marker_count: Option<i64>,
    pub join_year: Option<String>,
    pub raw_text: String,
}

/// A single ancestor entry from `<li value="N">`.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedAncestorEntry {
    pub generation_number: i64,
    pub person: ParsedPerson,
    pub is_participant_self: bool,
    pub privacy_label: Option<String>,
}

/// A parsed person from an ancestor chain or common ancestor list.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedPerson {
    pub given_name: String,
    pub surname: String,
    pub name_suffix: Option<String>,
    pub name_prefix: Option<String>,
    pub sex: Option<String>,
    pub birth_date: Option<String>,
    pub birth_date_sort: Option<String>,
    pub birth_date_modifier: Option<String>,
    pub birth_place: Option<String>,
    pub death_date: Option<String>,
    pub death_date_sort: Option<String>,
    pub death_date_modifier: Option<String>,
    pub death_place: Option<String>,
    pub is_living: bool,
    pub is_immigrant_ancestor: bool,
    pub spouses: Vec<ParsedSpouse>,
    pub notes: Option<String>,
    /// Generation number in the common-ancestor tree (for nested lineages).
    pub common_ancestor_gen: Option<i64>,
}

/// A spouse reference parsed from marriage text.
#[derive(Debug, Clone, Serialize)]
pub struct ParsedSpouse {
    pub given_name: Option<String>,
    pub surname: String,
    pub marriage_order: i64,
}

/// Result of parsing a genealogical date.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ParsedDate {
    pub display: String,
    pub sort_key: String,
    pub modifier: Option<String>,
}
