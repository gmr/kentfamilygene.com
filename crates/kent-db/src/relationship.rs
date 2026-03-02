use neo4rs::{Graph, Query};

use crate::Error;

// ── Person ↔ Lineage (BELONGS_TO) ──────────────────────────────────

pub async fn add_person_to_lineage(
    graph: &Graph,
    person_id: &str,
    lineage_id: &str,
    role: Option<&str>,
    generation_number: Option<i64>,
    certainty: Option<&str>,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Person {id: $person_id}), (l:Lineage {id: $lineage_id}) \
         MERGE (p)-[b:BELONGS_TO]->(l) \
         SET b.role = $role, b.generation_number = $gen, b.certainty = $certainty \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("person_id", person_id)
    .param("lineage_id", lineage_id)
    .param("role", role.unwrap_or("descendant"))
    .param("gen", generation_number.unwrap_or(0))
    .param("certainty", certainty.unwrap_or("unknown"));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_person_from_lineage(
    graph: &Graph,
    person_id: &str,
    lineage_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Person {id: $person_id})-[b:BELONGS_TO]->(l:Lineage {id: $lineage_id}) \
         DELETE b RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("person_id", person_id)
    .param("lineage_id", lineage_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Person ↔ Person (PARENT_OF) ────────────────────────────────────

pub async fn set_parent_of(
    graph: &Graph,
    parent_id: &str,
    child_id: &str,
    relationship_type: Option<&str>,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (parent:Person {id: $parent_id}), (child:Person {id: $child_id}) \
         MERGE (parent)-[r:PARENT_OF]->(child) \
         SET r.relationship_type = $rel_type \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("parent_id", parent_id)
    .param("child_id", child_id)
    .param("rel_type", relationship_type.unwrap_or("natural"));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_parent_of(
    graph: &Graph,
    parent_id: &str,
    child_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (parent:Person {id: $parent_id})-[r:PARENT_OF]->(child:Person {id: $child_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("parent_id", parent_id)
    .param("child_id", child_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Person ↔ Person (SPOUSE_OF) ────────────────────────────────────

pub async fn set_spouse_of(
    graph: &Graph,
    person1_id: &str,
    person2_id: &str,
    marriage_date: Option<&str>,
    marriage_place: Option<&str>,
    marriage_order: Option<i64>,
    spouse_surname: Option<&str>,
) -> Result<bool, Error> {
    // Canonical ordering prevents duplicate edges when called with swapped IDs
    let (p1, p2) = if person1_id <= person2_id {
        (person1_id, person2_id)
    } else {
        (person2_id, person1_id)
    };
    let query = Query::new(
        "MATCH (p1:Person {id: $p1_id}), (p2:Person {id: $p2_id}) \
         MERGE (p1)-[r:SPOUSE_OF]->(p2) \
         SET r.marriage_date = $marriage_date, r.marriage_place = $marriage_place, \
             r.marriage_order = $marriage_order, r.spouse_surname = $spouse_surname \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("p1_id", p1)
    .param("p2_id", p2)
    .param("marriage_date", marriage_date.unwrap_or(""))
    .param("marriage_place", marriage_place.unwrap_or(""))
    .param("marriage_order", marriage_order.unwrap_or(1))
    .param("spouse_surname", spouse_surname.unwrap_or(""));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_spouse_of(
    graph: &Graph,
    person1_id: &str,
    person2_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p1:Person {id: $p1_id})-[r:SPOUSE_OF]-(p2:Person {id: $p2_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("p1_id", person1_id)
    .param("p2_id", person2_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Participant ↔ Person (IDENTITY_OF) ─────────────────────────────

pub async fn link_participant_to_person(
    graph: &Graph,
    participant_id: &str,
    person_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (part:Participant {id: $participant_id}), (pers:Person {id: $person_id}) \
         MERGE (part)-[:IDENTITY_OF]->(pers) \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("person_id", person_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn unlink_participant_from_person(
    graph: &Graph,
    participant_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (part:Participant {id: $participant_id})-[r:IDENTITY_OF]->(:Person) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("participant_id", participant_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Participant ↔ Lineage (RESEARCHES) ─────────────────────────────

pub async fn add_participant_to_lineage(
    graph: &Graph,
    participant_id: &str,
    lineage_id: &str,
    branch_label: Option<&str>,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id}), (l:Lineage {id: $lineage_id}) \
         MERGE (p)-[r:RESEARCHES]->(l) \
         SET r.branch_label = $branch_label \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("lineage_id", lineage_id)
    .param("branch_label", branch_label.unwrap_or(""));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_participant_from_lineage(
    graph: &Graph,
    participant_id: &str,
    lineage_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id})-[r:RESEARCHES]->(l:Lineage {id: $lineage_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("lineage_id", lineage_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Participant ↔ Haplogroup (HAS_HAPLOGROUP) ──────────────────────

pub async fn assign_haplogroup(
    graph: &Graph,
    participant_id: &str,
    haplogroup_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id}), (h:Haplogroup {id: $haplogroup_id}) \
         MERGE (p)-[:HAS_HAPLOGROUP]->(h) \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("haplogroup_id", haplogroup_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn unassign_haplogroup(
    graph: &Graph,
    participant_id: &str,
    haplogroup_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id})-[r:HAS_HAPLOGROUP]->(h:Haplogroup {id: $haplogroup_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("haplogroup_id", haplogroup_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Participant ↔ Participant (GENETIC_MATCH) ──────────────────────

pub async fn record_genetic_match(
    graph: &Graph,
    participant1_id: &str,
    participant2_id: &str,
    marker_level: Option<i64>,
    match_type: Option<&str>,
    notes: Option<&str>,
) -> Result<bool, Error> {
    // Canonical ordering prevents duplicate edges when called with swapped IDs
    let (p1, p2) = if participant1_id <= participant2_id {
        (participant1_id, participant2_id)
    } else {
        (participant2_id, participant1_id)
    };
    let query = Query::new(
        "MATCH (p1:Participant {id: $p1_id}), (p2:Participant {id: $p2_id}) \
         MERGE (p1)-[r:GENETIC_MATCH]->(p2) \
         SET r.marker_level = $marker_level, r.match_type = $match_type, r.notes = $notes \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("p1_id", p1)
    .param("p2_id", p2)
    .param("marker_level", marker_level.unwrap_or(0))
    .param("match_type", match_type.unwrap_or(""))
    .param("notes", notes.unwrap_or(""));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_genetic_match(
    graph: &Graph,
    participant1_id: &str,
    participant2_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (p1:Participant {id: $p1_id})-[r:GENETIC_MATCH]-(p2:Participant {id: $p2_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("p1_id", participant1_id)
    .param("p2_id", participant2_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

// ── Lineage ↔ Place (MIGRATION_STOP) ──────────────────────────────

pub async fn add_migration_stop(
    graph: &Graph,
    lineage_id: &str,
    place_id: &str,
    stop_order: i64,
    role: Option<&str>,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (l:Lineage {id: $lineage_id}), (p:Place {id: $place_id}) \
         MERGE (l)-[r:MIGRATION_STOP]->(p) \
         SET r.stop_order = $stop_order, r.role = $role \
         RETURN count(*) AS created"
            .to_string(),
    )
    .param("lineage_id", lineage_id)
    .param("place_id", place_id)
    .param("stop_order", stop_order)
    .param("role", role.unwrap_or(""));

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("created").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}

pub async fn remove_migration_stop(
    graph: &Graph,
    lineage_id: &str,
    place_id: &str,
) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (l:Lineage {id: $lineage_id})-[r:MIGRATION_STOP]->(p:Place {id: $place_id}) \
         DELETE r RETURN count(*) AS deleted"
            .to_string(),
    )
    .param("lineage_id", lineage_id)
    .param("place_id", place_id);

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<i64>("deleted").unwrap_or(0) > 0)
    } else {
        Ok(false)
    }
}
