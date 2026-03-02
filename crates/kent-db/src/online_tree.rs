use neo4rs::{Graph, Query};

use crate::{Error, OnlineTreeRow};

pub async fn find_online_trees_by_participant(
    graph: &Graph,
    participant_id: &str,
) -> Result<Vec<OnlineTreeRow>, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id})-[:HAS_TREE]->(t:OnlineTree) \
         RETURN t ORDER BY t.platform"
            .to_string(),
    )
    .param("participant_id", participant_id);

    let mut result = graph.execute(query).await?;
    let mut trees = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("t")?;
        trees.push(node_to_online_tree_row(&node));
    }
    Ok(trees)
}

pub async fn find_online_tree_by_id(
    graph: &Graph,
    id: &str,
) -> Result<Option<OnlineTreeRow>, Error> {
    let query = Query::new("MATCH (t:OnlineTree {id: $id}) RETURN t".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("t")?;
        Ok(Some(node_to_online_tree_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_online_tree(
    graph: &Graph,
    participant_id: &str,
    row: &OnlineTreeRow,
) -> Result<OnlineTreeRow, Error> {
    let query = Query::new(
        "MATCH (p:Participant {id: $participant_id}) \
         CREATE (t:OnlineTree {
            id: $id, platform: $platform, username: $username,
            tree_name: $tree_name, url: $url
         }) \
         CREATE (p)-[:HAS_TREE]->(t) \
         RETURN t"
            .to_string(),
    )
    .param("participant_id", participant_id)
    .param("id", row.id.clone())
    .param("platform", row.platform.clone().unwrap_or_default())
    .param("username", row.username.clone().unwrap_or_default())
    .param("tree_name", row.tree_name.clone().unwrap_or_default())
    .param("url", row.url.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    let r = result.next().await?.ok_or(Error::Deserialization(
        "No row returned from CREATE (participant not found?)".into(),
    ))?;
    let node: neo4rs::Node = r.get("t")?;
    Ok(node_to_online_tree_row(&node))
}

pub async fn delete_online_tree(graph: &Graph, id: &str) -> Result<bool, Error> {
    let query = Query::new(
        "MATCH (t:OnlineTree {id: $id}) WITH t, t IS NOT NULL AS existed DETACH DELETE t RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

pub(crate) fn node_to_online_tree_row(node: &neo4rs::Node) -> OnlineTreeRow {
    OnlineTreeRow {
        id: node.get("id").unwrap_or_default(),
        platform: node.get("platform").ok(),
        username: node.get("username").ok(),
        tree_name: node.get("tree_name").ok(),
        url: node.get("url").ok(),
    }
}
