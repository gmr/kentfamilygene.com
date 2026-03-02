use neo4rs::{Graph, Query};

use crate::{AdminNoteRow, Error};

pub async fn find_all_admin_notes(
    graph: &Graph,
    color: Option<&str>,
    resolved: Option<bool>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<AdminNoteRow>, i64), Error> {
    let mut where_clauses = Vec::new();
    if color.is_some() {
        where_clauses.push("n.color = $color");
    }
    if let Some(r) = resolved {
        if r {
            where_clauses.push("n.resolved = true");
        } else {
            where_clauses.push("n.resolved = false");
        }
    }

    let where_str = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };

    let query_str = format!(
        "MATCH (n:AdminNote){where_str} \
         RETURN n ORDER BY n.created_date DESC \
         SKIP $offset LIMIT $limit"
    );
    let count_str = format!("MATCH (n:AdminNote){where_str} RETURN count(n) AS total");

    let mut query = Query::new(query_str)
        .param("offset", offset)
        .param("limit", limit);
    let mut count_query = Query::new(count_str);

    if let Some(c) = color {
        query = query.param("color", c.to_string());
        count_query = count_query.param("color", c.to_string());
    }

    let total = {
        let mut result = graph.execute(count_query).await?;
        if let Some(row) = result.next().await? {
            row.get::<i64>("total").unwrap_or(0)
        } else {
            0
        }
    };

    let mut result = graph.execute(query).await?;
    let mut notes = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("n")?;
        notes.push(node_to_admin_note_row(&node));
    }

    Ok((notes, total))
}

pub async fn find_admin_note_by_id(graph: &Graph, id: &str) -> Result<Option<AdminNoteRow>, Error> {
    let query = Query::new("MATCH (n:AdminNote {id: $id}) RETURN n".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("n")?;
        Ok(Some(node_to_admin_note_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_admin_note(graph: &Graph, row: &AdminNoteRow) -> Result<AdminNoteRow, Error> {
    let query = Query::new(
        "CREATE (n:AdminNote {
            id: $id, color: $color, text: $text,
            created_date: $created_date, resolved: $resolved
        }) RETURN n"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("color", row.color.clone().unwrap_or_default())
    .param("text", row.text.clone())
    .param("created_date", row.created_date.clone().unwrap_or_default())
    .param("resolved", row.resolved);

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("n")?;
    Ok(node_to_admin_note_row(&node))
}

pub async fn update_admin_note(
    graph: &Graph,
    id: &str,
    row: &AdminNoteRow,
) -> Result<Option<AdminNoteRow>, Error> {
    let query = Query::new(
        "MATCH (n:AdminNote {id: $id}) \
         SET n.color = $color, n.text = $text, n.resolved = $resolved \
         RETURN n"
            .to_string(),
    )
    .param("id", id)
    .param("color", row.color.clone().unwrap_or_default())
    .param("text", row.text.clone())
    .param("resolved", row.resolved);

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("n")?;
        Ok(Some(node_to_admin_note_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_admin_note(graph: &Graph, id: &str) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (n:AdminNote {id: $id}) WITH n, n IS NOT NULL AS existed DETACH DELETE n RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

/// Attach an admin note to a target node (Person, Participant, or Lineage).
pub async fn attach_admin_note(
    graph: &Graph,
    note_id: &str,
    target_id: &str,
    target_type: &str,
) -> Result<bool, Error> {
    let label = match target_type {
        "person" | "Person" => "Person",
        "participant" | "Participant" => "Participant",
        "lineage" | "Lineage" => "Lineage",
        _ => {
            return Err(Error::Deserialization(format!(
                "Invalid target type: {target_type}"
            )));
        }
    };

    let query_str = format!(
        "MATCH (n:AdminNote {{id: $note_id}}), (t:{label} {{id: $target_id}}) \
         MERGE (n)-[:ANNOTATES]->(t) \
         RETURN count(*) AS created"
    );
    let query = Query::new(query_str)
        .param("note_id", note_id)
        .param("target_id", target_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub(crate) fn node_to_admin_note_row(node: &neo4rs::Node) -> AdminNoteRow {
    AdminNoteRow {
        id: node.get("id").unwrap_or_default(),
        color: node.get("color").ok(),
        text: node.get("text").unwrap_or_default(),
        created_date: node.get("created_date").ok(),
        resolved: node.get("resolved").unwrap_or(false),
    }
}
