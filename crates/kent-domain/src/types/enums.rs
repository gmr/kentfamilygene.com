use async_graphql::Enum;

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum MembershipType {
    ProjectMember,
    AssociateResearcher,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum DateModifier {
    Exact,
    About,
    Before,
    After,
    Calculated,
    Probably,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum PersonRole {
    PotentialAncestor,
    ConfirmedAncestor,
    BrickWall,
    ImmigrantAncestor,
    Descendant,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum ConfirmationStatus {
    Predicted,
    Confirmed,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum HaplogroupType {
    #[graphql(name = "Y_DNA")]
    YDna,
    #[graphql(name = "MT_DNA")]
    MtDna,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum NoteColor {
    Pink,
    Orange,
    Blue,
    Green,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum SearchType {
    Person,
    Participant,
    Lineage,
    Place,
    Haplogroup,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq, Debug)]
pub enum AnnotationTarget {
    Person,
    Participant,
    Lineage,
}

impl std::fmt::Display for AnnotationTarget {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AnnotationTarget::Person => write!(f, "Person"),
            AnnotationTarget::Participant => write!(f, "Participant"),
            AnnotationTarget::Lineage => write!(f, "Lineage"),
        }
    }
}

impl std::fmt::Display for SearchType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SearchType::Person => write!(f, "person"),
            SearchType::Participant => write!(f, "participant"),
            SearchType::Lineage => write!(f, "lineage"),
            SearchType::Place => write!(f, "place"),
            SearchType::Haplogroup => write!(f, "haplogroup"),
        }
    }
}
