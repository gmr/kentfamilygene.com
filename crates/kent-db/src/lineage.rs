use neo4rs::{Graph, Query};

use crate::{Error, LineageRow};

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
    let query = Query::new("MATCH (l:Lineage {id: $id}) RETURN l".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("l")?;
        Ok(Some(node_to_lineage_row(&node)))
    } else {
        Ok(None)
    }
}

/// Create a new lineage.
pub async fn create_lineage(graph: &Graph, row: &LineageRow) -> Result<LineageRow, Error> {
    let query = Query::new(
        "CREATE (l:Lineage {
            id: $id, origin_state: $origin_state, lineage_number: $lineage_number,
            display_name: $display_name, region: $region, status_note: $status_note,
            is_new: $is_new, new_lineage_date: $new_lineage_date,
            created_date: $created_date, updated_date: $updated_date
        }) RETURN l"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("origin_state", row.origin_state.clone().unwrap_or_default())
    .param("lineage_number", row.lineage_number.unwrap_or(0))
    .param("display_name", row.display_name.clone())
    .param("region", row.region.clone().unwrap_or_default())
    .param("status_note", row.status_note.clone().unwrap_or_default())
    .param("is_new", row.is_new)
    .param(
        "new_lineage_date",
        row.new_lineage_date.clone().unwrap_or_default(),
    )
    .param("created_date", row.created_date.clone().unwrap_or_default())
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    let row = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = row.get("l")?;
    Ok(node_to_lineage_row(&node))
}

/// Update an existing lineage.
pub async fn update_lineage(
    graph: &Graph,
    id: &str,
    row: &LineageRow,
) -> Result<Option<LineageRow>, Error> {
    let query = Query::new(
        "MATCH (l:Lineage {id: $id}) \
         SET l.origin_state = $origin_state, l.lineage_number = $lineage_number, \
             l.display_name = $display_name, l.region = $region, \
             l.status_note = $status_note, l.is_new = $is_new, \
             l.new_lineage_date = $new_lineage_date, l.updated_date = $updated_date \
         RETURN l"
            .to_string(),
    )
    .param("id", id)
    .param("origin_state", row.origin_state.clone().unwrap_or_default())
    .param("lineage_number", row.lineage_number.unwrap_or(0))
    .param("display_name", row.display_name.clone())
    .param("region", row.region.clone().unwrap_or_default())
    .param("status_note", row.status_note.clone().unwrap_or_default())
    .param("is_new", row.is_new)
    .param(
        "new_lineage_date",
        row.new_lineage_date.clone().unwrap_or_default(),
    )
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("l")?;
        Ok(Some(node_to_lineage_row(&node)))
    } else {
        Ok(None)
    }
}

/// Delete a lineage by ID. Returns true if deleted.
pub async fn delete_lineage(graph: &Graph, id: &str) -> Result<bool, Error> {
    // Check for relationships first
    let check = Query::new(
        "MATCH (l:Lineage {id: $id}) \
         OPTIONAL MATCH (l)-[r]-() \
         RETURN l IS NOT NULL AS exists, count(r) AS rel_count"
            .to_string(),
    )
    .param("id", id);

    let mut result = graph.execute(check).await?;
    if let Some(row) = result.next().await? {
        let exists: bool = row.get("exists").unwrap_or(false);
        if !exists {
            return Ok(false);
        }
        let rel_count: i64 = row.get("rel_count").unwrap_or(0);
        if rel_count > 0 {
            return Err(Error::Deserialization(format!(
                "Cannot delete lineage {id}: has {rel_count} relationships"
            )));
        }
    }

    let query = Query::new(
        "MATCH (l:Lineage {id: $id}) WITH l, l IS NOT NULL AS existed DELETE l RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

pub(crate) fn node_to_lineage_row(node: &neo4rs::Node) -> LineageRow {
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
