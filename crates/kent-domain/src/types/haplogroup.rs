use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct Haplogroup {
    pub id: String,
    pub name: String,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    pub haplogroup_type: Option<String>,
}

impl From<kent_db::HaplogroupRow> for Haplogroup {
    fn from(row: kent_db::HaplogroupRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            subclade: row.subclade,
            abbreviation: row.abbreviation,
            confirmation_status: row.confirmation_status,
            haplogroup_type: row.haplogroup_type,
        }
    }
}
