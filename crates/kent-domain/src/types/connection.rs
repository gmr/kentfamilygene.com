use async_graphql::SimpleObject;

use super::{AdminNote, Haplogroup, Lineage, Participant, Person, Place};

/// Generic paginated connection.
#[derive(SimpleObject, Debug)]
pub struct LineageConnection {
    pub items: Vec<Lineage>,
    pub total: i32,
    pub has_more: bool,
}

#[derive(SimpleObject, Debug)]
pub struct PersonConnection {
    pub items: Vec<Person>,
    pub total: i32,
    pub has_more: bool,
}

#[derive(SimpleObject, Debug)]
pub struct ParticipantConnection {
    pub items: Vec<Participant>,
    pub total: i32,
    pub has_more: bool,
}

#[derive(SimpleObject, Debug)]
pub struct PlaceConnection {
    pub items: Vec<Place>,
    pub total: i32,
    pub has_more: bool,
}

#[derive(SimpleObject, Debug)]
pub struct HaplogroupConnection {
    pub items: Vec<Haplogroup>,
    pub total: i32,
    pub has_more: bool,
}

#[derive(SimpleObject, Debug)]
pub struct AdminNoteConnection {
    pub items: Vec<AdminNote>,
    pub total: i32,
    pub has_more: bool,
}
