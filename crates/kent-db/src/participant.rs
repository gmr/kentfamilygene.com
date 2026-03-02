use neo4rs::{Graph, Query};

use crate::{Error, ParticipantRow};

pub async fn find_all_participants(
    graph: &Graph,
    active_only: Option<bool>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<ParticipantRow>, i64), Error> {
    let (query, count_query) = if let Some(true) = active_only {
        (
            Query::new(
                "MATCH (p:Participant) WHERE p.is_active = true \
                 RETURN p ORDER BY p.display_name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new(
                "MATCH (p:Participant) WHERE p.is_active = true RETURN count(p) AS total"
                    .to_string(),
            ),
        )
    } else {
        (
            Query::new(
                "MATCH (p:Participant) \
                 RETURN p ORDER BY p.display_name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new("MATCH (p:Participant) RETURN count(p) AS total".to_string()),
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
    let mut participants = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        participants.push(node_to_participant_row(&node));
    }

    Ok((participants, total))
}

pub async fn find_participant_by_id(
    graph: &Graph,
    id: &str,
) -> Result<Option<ParticipantRow>, Error> {
    let query = Query::new("MATCH (p:Participant {id: $id}) RETURN p".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        Ok(Some(node_to_participant_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn find_participants_by_lineage(
    graph: &Graph,
    lineage_id: &str,
) -> Result<Vec<(ParticipantRow, Option<String>)>, Error> {
    let query = Query::new(
        "MATCH (p:Participant)-[r:RESEARCHES]->(l:Lineage {id: $lineage_id}) \
         RETURN p, r.branch_label AS branch_label \
         ORDER BY p.display_name"
            .to_string(),
    )
    .param("lineage_id", lineage_id);

    let mut result = graph.execute(query).await?;
    let mut participants = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        let branch: Option<String> = row.get("branch_label").ok();
        participants.push((node_to_participant_row(&node), branch));
    }
    Ok(participants)
}

pub async fn create_participant(
    graph: &Graph,
    row: &ParticipantRow,
) -> Result<ParticipantRow, Error> {
    let query = Query::new(
        "CREATE (p:Participant {
            id: $id, display_name: $display_name, email: $email,
            membership_type: $membership_type, is_active: $is_active,
            ftdna_kit_number: $ftdna_kit_number, join_date: $join_date,
            contact_note: $contact_note, research_goal: $research_goal,
            created_date: $created_date, updated_date: $updated_date
        }) RETURN p"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("display_name", row.display_name.clone())
    .param("email", row.email.clone().unwrap_or_default())
    .param(
        "membership_type",
        row.membership_type.clone().unwrap_or_default(),
    )
    .param("is_active", row.is_active)
    .param(
        "ftdna_kit_number",
        row.ftdna_kit_number.clone().unwrap_or_default(),
    )
    .param("join_date", row.join_date.clone().unwrap_or_default())
    .param("contact_note", row.contact_note.clone().unwrap_or_default())
    .param(
        "research_goal",
        row.research_goal.clone().unwrap_or_default(),
    )
    .param("created_date", row.created_date.clone().unwrap_or_default())
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("p")?;
    Ok(node_to_participant_row(&node))
}

pub async fn update_participant(
    graph: &Graph,
    id: &str,
    row: &ParticipantRow,
) -> Result<Option<ParticipantRow>, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $id}) \
         SET p.display_name = $display_name, p.email = $email, \
             p.membership_type = $membership_type, p.is_active = $is_active, \
             p.ftdna_kit_number = $ftdna_kit_number, p.join_date = $join_date, \
             p.contact_note = $contact_note, p.research_goal = $research_goal, \
             p.updated_date = $updated_date \
         RETURN p"
            .to_string(),
    )
    .param("id", id)
    .param("display_name", row.display_name.clone())
    .param("email", row.email.clone().unwrap_or_default())
    .param(
        "membership_type",
        row.membership_type.clone().unwrap_or_default(),
    )
    .param("is_active", row.is_active)
    .param(
        "ftdna_kit_number",
        row.ftdna_kit_number.clone().unwrap_or_default(),
    )
    .param("join_date", row.join_date.clone().unwrap_or_default())
    .param("contact_note", row.contact_note.clone().unwrap_or_default())
    .param(
        "research_goal",
        row.research_goal.clone().unwrap_or_default(),
    )
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("p")?;
        Ok(Some(node_to_participant_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_participant(graph: &Graph, id: &str) -> Result<bool, Error> {
    let check = Query::new(
        "MATCH (p:Participant {id: $id}) \
         OPTIONAL MATCH (p)-[r]-() \
         RETURN p IS NOT NULL AS exists, count(r) AS rel_count"
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
                "Cannot delete participant {id}: has {rel_count} relationships"
            )));
        }
    }

    let query = Query::new(
        "MATCH (p:Participant {id: $id}) WITH p, p IS NOT NULL AS existed DELETE p RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

pub(crate) fn node_to_participant_row(node: &neo4rs::Node) -> ParticipantRow {
    ParticipantRow {
        id: node.get("id").unwrap_or_default(),
        display_name: node.get("display_name").unwrap_or_default(),
        email: node.get("email").ok(),
        membership_type: node.get("membership_type").ok(),
        is_active: node.get("is_active").unwrap_or(true),
        ftdna_kit_number: node.get("ftdna_kit_number").ok(),
        join_date: node.get("join_date").ok(),
        contact_note: node.get("contact_note").ok(),
        research_goal: node.get("research_goal").ok(),
        created_date: node.get("created_date").ok(),
        updated_date: node.get("updated_date").ok(),
    }
}
