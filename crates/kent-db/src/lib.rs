use std::fmt;

use neo4rs::{ConfigBuilder, Graph, Query};
use serde::Serialize;

// Re-export Graph so downstream crates don't need a direct neo4rs dependency.
pub use neo4rs::Graph as Neo4jGraph;

/// Row returned from Cypher queries for Lineage nodes.
#[derive(Debug, Clone, Serialize)]
pub struct LineageRow {
    pub id: String,
    pub origin_state: Option<String>,
    pub lineage_number: Option<i64>,
    pub display_name: String,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: bool,
    pub new_lineage_date: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

/// Unified error type for kent-db operations.
#[derive(Debug)]
pub enum Error {
    Neo4j(neo4rs::Error),
    Deserialization(String),
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Neo4j(e) => write!(f, "Neo4j error: {e}"),
            Error::Deserialization(e) => write!(f, "Deserialization error: {e}"),
        }
    }
}

impl std::error::Error for Error {}

impl From<neo4rs::Error> for Error {
    fn from(e: neo4rs::Error) -> Self {
        Error::Neo4j(e)
    }
}

impl From<neo4rs::DeError> for Error {
    fn from(e: neo4rs::DeError) -> Self {
        Error::Deserialization(e.to_string())
    }
}

/// Create a Neo4j connection pool.
pub async fn create_pool(uri: &str, user: &str, password: &str) -> Result<Graph, Error> {
    let config = ConfigBuilder::default()
        .uri(uri)
        .user(user)
        .password(password)
        .build()?;
    Ok(Graph::connect(config).await?)
}

/// Fetch all lineages, optionally filtered by region.
pub async fn find_all_lineages(
    graph: &Graph,
    region: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<LineageRow>, i64), Error> {
    let (query, count_query) = if let Some(region) = region {
        (
            Query::new(
                "MATCH (l:Lineage) WHERE l.region = $region \
                 RETURN l ORDER BY l.lineage_number \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("region", region)
            .param("offset", offset)
            .param("limit", limit),
            Query::new(
                "MATCH (l:Lineage) WHERE l.region = $region RETURN count(l) AS total".to_string(),
            )
            .param("region", region),
        )
    } else {
        (
            Query::new(
                "MATCH (l:Lineage) \
                 RETURN l ORDER BY l.region, l.lineage_number \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new("MATCH (l:Lineage) RETURN count(l) AS total".to_string()),
        )
    };

    let total = {
        let mut result = graph.execute(count_query).await?;
        if let Some(row) = result.next().await? {
            row.get::<i64>("total").unwrap_or(0)
        } else {
            0
        }
    };

    let mut result = graph.execute(query).await?;
    let mut lineages = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("l")?;
        lineages.push(node_to_lineage_row(&node));
    }

    Ok((lineages, total))
}

/// Fetch a single lineage by ID.
pub async fn find_lineage_by_id(graph: &Graph, id: &str) -> Result<Option<LineageRow>, Error> {
    let query =
        Query::new("MATCH (l:Lineage {id: $id}) RETURN l".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("l")?;
        Ok(Some(node_to_lineage_row(&node)))
    } else {
        Ok(None)
    }
}

fn node_to_lineage_row(node: &neo4rs::Node) -> LineageRow {
    LineageRow {
        id: node.get("id").unwrap_or_default(),
        origin_state: node.get("origin_state").ok(),
        lineage_number: node.get("lineage_number").ok(),
        display_name: node.get("display_name").unwrap_or_default(),
        region: node.get("region").ok(),
        status_note: node.get("status_note").ok(),
        is_new: node.get("is_new").unwrap_or(false),
        new_lineage_date: node.get("new_lineage_date").ok(),
        created_date: node.get("created_date").ok(),
        updated_date: node.get("updated_date").ok(),
    }
}
