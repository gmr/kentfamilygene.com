use async_graphql::SimpleObject;

use super::{Lineage, Participant, Person};

/// Wraps a parent Person with the PARENT_OF edge's relationship_type.
#[derive(SimpleObject, Debug, Clone)]
pub struct PersonRelationship {
    pub person: Person,
    pub relationship_type: Option<String>,
}

/// Wraps a spouse Person with SPOUSE_OF edge properties.
#[derive(SimpleObject, Debug, Clone)]
pub struct SpouseRelationship {
    pub spouse: Person,
    pub marriage_date: Option<String>,
    pub marriage_place: Option<String>,
    pub marriage_order: Option<i32>,
    pub spouse_surname: Option<String>,
}

/// Person → Lineage via BELONGS_TO edge with role/generation/certainty.
#[derive(SimpleObject, Debug, Clone)]
pub struct LineageAssignment {
    pub lineage: Lineage,
    pub role: Option<String>,
    pub generation_number: Option<i32>,
    pub certainty: Option<String>,
}

/// Participant → Lineage via RESEARCHES edge with branch_label.
#[derive(SimpleObject, Debug, Clone)]
pub struct LineageMembership {
    pub lineage: Lineage,
    pub branch_label: Option<String>,
}

/// Wraps a genetic match between two participants with match metadata.
#[derive(SimpleObject, Debug, Clone)]
pub struct GeneticMatchEntry {
    pub participant: Participant,
    pub marker_level: Option<i32>,
    pub match_type: Option<String>,
    pub notes: Option<String>,
}
