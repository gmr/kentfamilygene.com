use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct Participant {
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

impl From<kent_db::ParticipantRow> for Participant {
    fn from(row: kent_db::ParticipantRow) -> Self {
        Self {
            id: row.id,
            display_name: row.display_name,
            email: row.email,
            membership_type: row.membership_type,
            is_active: row.is_active,
            ftdna_kit_number: row.ftdna_kit_number,
            join_date: row.join_date,
            contact_note: row.contact_note,
            research_goal: row.research_goal,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}
