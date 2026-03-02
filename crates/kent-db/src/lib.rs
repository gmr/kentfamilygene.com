use std::fmt;

use neo4rs::{ConfigBuilder, Graph};
use serde::Serialize;

// Re-export Graph and Query so downstream crates don't need a direct neo4rs dependency.
pub use neo4rs::Graph as Neo4jGraph;
pub use neo4rs::Query as Neo4jQuery;

pub mod admin_note;
pub mod dna_test;
pub mod haplogroup;
pub mod lineage;
pub mod online_tree;
pub mod participant;
pub mod person;
pub mod place;
pub mod relationship;
pub mod search;

// Re-export entity functions at crate root for convenience.
pub use admin_note::*;
pub use dna_test::*;
pub use haplogroup::*;
pub use lineage::*;
pub use online_tree::*;
pub use participant::*;
pub use person::*;
pub use place::*;

/// Row returned from Cypher queries for Lineage nodes.
#[derive(Debug, Clone, Serialize)]
pub struct LineageRow {
    pub id: String,
    pub origin_state: Option<String>,
    pub lineage_number: Option<i64>,
    pub display_name: String,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: bool,
    pub new_lineage_date: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

/// Row returned from Cypher queries for Person nodes.
#[derive(Debug, Clone, Serialize)]
pub struct PersonRow {
    pub id: String,
    pub given_name: String,
    pub surname: String,
    pub name_suffix: Option<String>,
    pub name_prefix: Option<String>,
    pub name_qualifier: Option<String>,
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
    pub privacy_label: Option<String>,
    pub is_immigrant_ancestor: bool,
    pub notes: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

/// Row returned from Cypher queries for Participant nodes.
#[derive(Debug, Clone, Serialize)]
pub struct ParticipantRow {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub is_active: bool,
    pub ftdna_kit_number: Option<String>,
    pub join_date: Option<String>,
    pub contact_note: Option<String>,
    pub research_goal: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

/// Row returned from Cypher queries for Place nodes.
#[derive(Debug, Clone, Serialize)]
pub struct PlaceRow {
    pub id: String,
    pub name: String,
    pub county: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub familysearch_url: Option<String>,
}

/// Row returned from Cypher queries for Haplogroup nodes.
#[derive(Debug, Clone, Serialize)]
pub struct HaplogroupRow {
    pub id: String,
    pub name: String,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    pub haplogroup_type: Option<String>,
}

/// Row returned from Cypher queries for DNATest nodes.
#[derive(Debug, Clone, Serialize)]
pub struct DnaTestRow {
    pub id: String,
    pub test_type: Option<String>,
    pub test_name: Option<String>,
    pub provider: Option<String>,
    pub kit_number: Option<String>,
    pub marker_count: Option<i64>,
    pub registered_with_project: bool,
    pub gedmatch_kit: Option<String>,
}

/// Row returned from Cypher queries for OnlineTree nodes.
#[derive(Debug, Clone, Serialize)]
pub struct OnlineTreeRow {
    pub id: String,
    pub platform: Option<String>,
    pub username: Option<String>,
    pub tree_name: Option<String>,
    pub url: Option<String>,
}

/// Row returned from Cypher queries for AdminNote nodes.
#[derive(Debug, Clone, Serialize)]
pub struct AdminNoteRow {
    pub id: String,
    pub color: Option<String>,
    pub text: String,
    pub created_date: Option<String>,
    pub resolved: bool,
}

/// Unified error type for kent-db operations.
#[derive(Debug)]
pub enum Error {
    Neo4j(neo4rs::Error),
    Deserialization(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Neo4j(e) => write!(f, "Neo4j error: {e}"),
            Error::Deserialization(e) => write!(f, "Deserialization error: {e}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<neo4rs::Error> for Error {
    fn from(e: neo4rs::Error) -> Self {
        Error::Neo4j(e)
    }
}

impl From<neo4rs::DeError> for Error {
    fn from(e: neo4rs::DeError) -> Self {
        Error::Deserialization(e.to_string())
    }
}

/// Create a Neo4j connection pool.
pub async fn create_pool(uri: &str, user: &str, password: &str) -> Result<Graph, Error> {
    let config = ConfigBuilder::default()
        .uri(uri)
        .user(user)
        .password(password)
        .build()?;
    Ok(Graph::connect(config).await?)
}
