use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct DnaTest {
    pub id: String,
    pub test_type: Option<String>,
    pub test_name: Option<String>,
    pub provider: Option<String>,
    pub kit_number: Option<String>,
    pub marker_count: Option<i32>,
    pub registered_with_project: bool,
    pub gedmatch_kit: Option<String>,
}

impl From<kent_db::DnaTestRow> for DnaTest {
    fn from(row: kent_db::DnaTestRow) -> Self {
        Self {
            id: row.id,
            test_type: row.test_type,
            test_name: row.test_name,
            provider: row.provider,
            kit_number: row.kit_number,
            marker_count: row.marker_count.and_then(|n| i32::try_from(n).ok()),
            registered_with_project: row.registered_with_project,
            gedmatch_kit: row.gedmatch_kit,
        }
    }
}
