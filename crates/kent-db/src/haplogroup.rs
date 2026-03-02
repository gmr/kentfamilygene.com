use neo4rs::{Graph, Query};

use crate::{Error, HaplogroupRow};

pub async fn find_all_haplogroups(
    graph: &Graph,
    haplogroup_type: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<HaplogroupRow>, i64), Error> {
    let (query, count_query) = if let Some(ht) = haplogroup_type {
        (
            Query::new(
                "MATCH (h:Haplogroup) WHERE h.type = $type \
                 RETURN h ORDER BY h.name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("type", ht)
            .param("offset", offset)
            .param("limit", limit),
            Query::new(
                "MATCH (h:Haplogroup) WHERE h.type = $type RETURN count(h) AS total".to_string(),
            )
            .param("type", ht),
        )
    } else {
        (
            Query::new(
                "MATCH (h:Haplogroup) \
                 RETURN h ORDER BY h.name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new("MATCH (h:Haplogroup) RETURN count(h) AS total".to_string()),
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
    let mut haplogroups = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("h")?;
        haplogroups.push(node_to_haplogroup_row(&node));
    }

    Ok((haplogroups, total))
}

pub async fn find_haplogroup_by_id(
    graph: &Graph,
    id: &str,
) -> Result<Option<HaplogroupRow>, Error> {
    let query = Query::new("MATCH (h:Haplogroup {id: $id}) RETURN h".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("h")?;
        Ok(Some(node_to_haplogroup_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_haplogroup(graph: &Graph, row: &HaplogroupRow) -> Result<HaplogroupRow, Error> {
    let query = Query::new(
        "CREATE (h:Haplogroup {
            id: $id, name: $name, subclade: $subclade,
            abbreviation: $abbreviation, confirmation_status: $confirmation_status,
            type: $type
        }) RETURN h"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("name", row.name.clone())
    .param("subclade", row.subclade.clone())
    .param("abbreviation", row.abbreviation.clone())
    .param("confirmation_status", row.confirmation_status.clone())
    .param("type", row.haplogroup_type.clone());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("h")?;
    Ok(node_to_haplogroup_row(&node))
}

pub async fn update_haplogroup(
    graph: &Graph,
    id: &str,
    row: &HaplogroupRow,
) -> Result<Option<HaplogroupRow>, Error> {
    let query = Query::new(
        "MATCH (h:Haplogroup {id: $id}) \
         SET h.name = $name, h.subclade = $subclade, \
             h.abbreviation = $abbreviation, \
             h.confirmation_status = $confirmation_status, h.type = $type \
         RETURN h"
            .to_string(),
    )
    .param("id", id)
    .param("name", row.name.clone())
    .param("subclade", row.subclade.clone())
    .param("abbreviation", row.abbreviation.clone())
    .param("confirmation_status", row.confirmation_status.clone())
    .param("type", row.haplogroup_type.clone());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("h")?;
        Ok(Some(node_to_haplogroup_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_haplogroup(graph: &Graph, id: &str) -> Result<bool, Error> {
    let check = Query::new(
        "MATCH (h:Haplogroup {id: $id}) \
         OPTIONAL MATCH (h)-[r]-() \
         RETURN h IS NOT NULL AS exists, count(r) AS rel_count"
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
                "Cannot delete haplogroup {id}: has {rel_count} relationships"
            )));
        }
    }

    let query = Query::new(
        "MATCH (h:Haplogroup {id: $id}) WITH h, h IS NOT NULL AS existed DELETE h RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

/// Convert empty strings to None for optional fields.
fn non_empty(node: &neo4rs::Node, key: &str) -> Option<String> {
    node.get::<String>(key).ok().filter(|s| !s.is_empty())
}

pub(crate) fn node_to_haplogroup_row(node: &neo4rs::Node) -> HaplogroupRow {
    HaplogroupRow {
        id: node.get("id").unwrap_or_default(),
        name: node.get("name").unwrap_or_default(),
        subclade: non_empty(node, "subclade"),
        abbreviation: non_empty(node, "abbreviation"),
        confirmation_status: non_empty(node, "confirmation_status"),
        haplogroup_type: non_empty(node, "type"),
    }
}
