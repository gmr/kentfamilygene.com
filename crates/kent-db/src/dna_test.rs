use neo4rs::{Graph, Query};

use crate::{DnaTestRow, Error};

pub async fn find_dna_tests_by_participant(
    graph: &Graph,
    participant_id: &str,
) -> Result<Vec<DnaTestRow>, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id})-[:TOOK_TEST]->(t:DNATest) \
         RETURN t ORDER BY t.test_type, t.test_name"
            .to_string(),
    )
    .param("participant_id", participant_id);

    let mut result = graph.execute(query).await?;
    let mut tests = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("t")?;
        tests.push(node_to_dna_test_row(&node));
    }
    Ok(tests)
}

pub async fn find_dna_test_by_id(graph: &Graph, id: &str) -> Result<Option<DnaTestRow>, Error> {
    let query = Query::new("MATCH (t:DNATest {id: $id}) RETURN t".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("t")?;
        Ok(Some(node_to_dna_test_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_dna_test(
    graph: &Graph,
    participant_id: &str,
    row: &DnaTestRow,
) -> Result<DnaTestRow, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id}) \
         CREATE (t:DNATest {
            id: $id, test_type: $test_type, test_name: $test_name,
            provider: $provider, kit_number: $kit_number,
            marker_count: $marker_count,
            registered_with_project: $registered_with_project,
            gedmatch_kit: $gedmatch_kit
         }) \
         CREATE (p)-[:TOOK_TEST]->(t) \
         RETURN t"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("id", row.id.clone())
    .param("test_type", row.test_type.clone())
    .param("test_name", row.test_name.clone())
    .param("provider", row.provider.clone())
    .param("kit_number", row.kit_number.clone())
    .param("marker_count", row.marker_count)
    .param("registered_with_project", row.registered_with_project)
    .param("gedmatch_kit", row.gedmatch_kit.clone());

    let mut result = graph.execute(query).await?;
    let r = result.next().await?.ok_or(Error::Deserialization(
        "No row returned from CREATE (participant not found?)".into(),
    ))?;
    let node: neo4rs::Node = r.get("t")?;
    Ok(node_to_dna_test_row(&node))
}

pub async fn delete_dna_test(graph: &Graph, id: &str) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (t:DNATest {id: $id}) WITH t, t IS NOT NULL AS existed DETACH DELETE t RETURN existed AS deleted".to_string(),
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

pub(crate) fn node_to_dna_test_row(node: &neo4rs::Node) -> DnaTestRow {
    DnaTestRow {
        id: node.get("id").unwrap_or_default(),
        test_type: non_empty(node, "test_type"),
        test_name: non_empty(node, "test_name"),
        provider: non_empty(node, "provider"),
        kit_number: non_empty(node, "kit_number"),
        marker_count: node.get("marker_count").ok(),
        registered_with_project: node.get("registered_with_project").unwrap_or(false),
        gedmatch_kit: non_empty(node, "gedmatch_kit"),
    }
}
