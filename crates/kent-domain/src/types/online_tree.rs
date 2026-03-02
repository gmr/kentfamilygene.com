use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct OnlineTree {
    pub id: String,
    pub platform: Option<String>,
    pub username: Option<String>,
    pub tree_name: Option<String>,
    pub url: Option<String>,
}

impl From<kent_db::OnlineTreeRow> for OnlineTree {
    fn from(row: kent_db::OnlineTreeRow) -> Self {
        Self {
            id: row.id,
            platform: row.platform,
            username: row.username,
            tree_name: row.tree_name,
            url: row.url,
        }
    }
}
