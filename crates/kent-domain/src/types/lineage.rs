use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct Lineage {
    pub id: String,
    pub origin_state: Option<String>,
    pub lineage_number: Option<i32>,
    pub display_name: String,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: bool,
    pub new_lineage_date: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

impl From<kent_db::LineageRow> for Lineage {
    fn from(row: kent_db::LineageRow) -> Self {
        Self {
            id: row.id,
            origin_state: row.origin_state,
            lineage_number: row.lineage_number.and_then(|n| i32::try_from(n).ok()),
            display_name: row.display_name,
            region: row.region,
            status_note: row.status_note,
            is_new: row.is_new,
            new_lineage_date: row.new_lineage_date,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}
