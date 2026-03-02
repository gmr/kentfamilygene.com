use neo4rs::{Graph, Query};

use crate::{Error, PlaceRow};

pub async fn find_all_places(
    graph: &Graph,
    country: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<PlaceRow>, i64), Error> {
    let (query, count_query) = if let Some(country) = country {
        (
            Query::new(
                "MATCH (p:Place) WHERE p.country = $country \
                 RETURN p ORDER BY p.state, p.county, p.name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("country", country)
            .param("offset", offset)
            .param("limit", limit),
            Query::new(
                "MATCH (p:Place) WHERE p.country = $country RETURN count(p) AS total".to_string(),
            )
            .param("country", country),
        )
    } else {
        (
            Query::new(
                "MATCH (p:Place) \
                 RETURN p ORDER BY p.country, p.state, p.name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new("MATCH (p:Place) RETURN count(p) AS total".to_string()),
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
    let mut places = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        places.push(node_to_place_row(&node));
    }

    Ok((places, total))
}

pub async fn find_place_by_id(graph: &Graph, id: &str) -> Result<Option<PlaceRow>, Error> {
    let query = Query::new("MATCH (p:Place {id: $id}) RETURN p".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        Ok(Some(node_to_place_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_place(graph: &Graph, row: &PlaceRow) -> Result<PlaceRow, Error> {
    let query = Query::new(
        "CREATE (p:Place {
            id: $id, name: $name, county: $county, state: $state,
            country: $country, lat: $lat, lon: $lon,
            familysearch_url: $familysearch_url
        }) RETURN p"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("name", row.name.clone())
    .param("county", row.county.clone())
    .param("state", row.state.clone())
    .param("country", row.country.clone())
    .param("lat", row.lat)
    .param("lon", row.lon)
    .param("familysearch_url", row.familysearch_url.clone());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("p")?;
    Ok(node_to_place_row(&node))
}

pub async fn update_place(
    graph: &Graph,
    id: &str,
    row: &PlaceRow,
) -> Result<Option<PlaceRow>, Error> {
    let query = Query::new(
        "MATCH (p:Place {id: $id}) \
         SET p.name = $name, p.county = $county, p.state = $state, \
             p.country = $country, p.lat = $lat, p.lon = $lon, \
             p.familysearch_url = $familysearch_url \
         RETURN p"
            .to_string(),
    )
    .param("id", id)
    .param("name", row.name.clone())
    .param("county", row.county.clone())
    .param("state", row.state.clone())
    .param("country", row.country.clone())
    .param("lat", row.lat)
    .param("lon", row.lon)
    .param("familysearch_url", row.familysearch_url.clone());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("p")?;
        Ok(Some(node_to_place_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_place(graph: &Graph, id: &str) -> Result<bool, Error> {
    let check = Query::new(
        "MATCH (p:Place {id: $id}) \
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
                "Cannot delete place {id}: has {rel_count} relationships"
            )));
        }
    }

    let query = Query::new(
        "MATCH (p:Place {id: $id}) WITH p, p IS NOT NULL AS existed DELETE p RETURN existed AS deleted".to_string(),
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

pub(crate) fn node_to_place_row(node: &neo4rs::Node) -> PlaceRow {
    PlaceRow {
        id: node.get("id").unwrap_or_default(),
        name: node.get("name").unwrap_or_default(),
        county: non_empty(node, "county"),
        state: non_empty(node, "state"),
        country: non_empty(node, "country"),
        lat: node.get("lat").ok(),
        lon: node.get("lon").ok(),
        familysearch_url: non_empty(node, "familysearch_url"),
    }
}
