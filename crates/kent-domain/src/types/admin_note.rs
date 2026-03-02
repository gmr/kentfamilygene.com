use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct AdminNote {
    pub id: String,
    pub color: Option<String>,
    pub text: String,
    pub created_date: Option<String>,
    pub resolved: bool,
}

impl From<kent_db::AdminNoteRow> for AdminNote {
    fn from(row: kent_db::AdminNoteRow) -> Self {
        Self {
            id: row.id,
            color: row.color,
            text: row.text,
            created_date: row.created_date,
            resolved: row.resolved,
        }
    }
}
