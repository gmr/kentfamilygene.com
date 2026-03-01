use async_graphql::{Context, EmptyMutation, EmptySubscription, Object, Schema, SimpleObject};
use kent_db::Neo4jGraph as Graph;

/// GraphQL representation of a Lineage.
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

/// Paginated list of lineages.
#[derive(SimpleObject, Debug)]
pub struct LineageConnection {
    pub items: Vec<Lineage>,
    pub total: i32,
    pub has_more: bool,
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

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// List lineages with optional region filter and pagination.
    async fn lineages(
        &self,
        ctx: &Context<'_>,
        region: Option<String>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<LineageConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_lineages(graph, region.as_deref(), offset, limit).await?;

        let items: Vec<Lineage> = rows.into_iter().map(Lineage::from).collect();
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(LineageConnection {
            items,
            total,
            has_more,
        })
    }

    /// Fetch a single lineage by ID.
    async fn lineage(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<Lineage>> {
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_lineage_by_id(graph, &id).await?;
        Ok(row.map(Lineage::from))
    }
}

pub type KentSchema = Schema<QueryRoot, EmptyMutation, EmptySubscription>;

/// Build the GraphQL schema with Neo4j pool in context.
pub fn build_schema(graph: Graph) -> KentSchema {
    Schema::build(QueryRoot, EmptyMutation, EmptySubscription)
        .data(graph)
        .finish()
}
