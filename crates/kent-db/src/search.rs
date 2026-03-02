use neo4rs::{Graph, Query};
use serde::Serialize;

use crate::Error;

/// A single search result from the full-text index.
#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub id: String,
    pub label: String,
    pub result_type: String,
    pub display: String,
    pub score: f64,
}

/// Ensure the full-text search indexes exist.
pub async fn ensure_search_indexes(graph: &Graph) -> Result<(), Error> {
    // Create indexes for each searchable node type.
    // Neo4j CREATE INDEX IF NOT EXISTS is idempotent.
    let indexes = [
        "CREATE FULLTEXT INDEX personSearch IF NOT EXISTS \
         FOR (n:Person) ON EACH [n.given_name, n.surname, n.notes]",
        "CREATE FULLTEXT INDEX participantSearch IF NOT EXISTS \
         FOR (n:Participant) ON EACH [n.display_name, n.research_goal]",
        "CREATE FULLTEXT INDEX lineageSearch IF NOT EXISTS \
         FOR (n:Lineage) ON EACH [n.display_name, n.origin_state, n.region, n.status_note]",
        "CREATE FULLTEXT INDEX placeSearch IF NOT EXISTS \
         FOR (n:Place) ON EACH [n.name, n.county, n.state, n.country]",
        "CREATE FULLTEXT INDEX haplogroupSearch IF NOT EXISTS \
         FOR (n:Haplogroup) ON EACH [n.name, n.subclade, n.abbreviation]",
    ];

    for idx_query in &indexes {
        let _ = graph.execute(Query::new(idx_query.to_string())).await?;
    }

    Ok(())
}

/// Search across multiple node types using full-text indexes.
pub async fn search_all(
    graph: &Graph,
    query_text: &str,
    types: Option<&[&str]>,
    limit: i64,
) -> Result<Vec<SearchResult>, Error> {
    let mut results = Vec::new();

    // Escape lucene special characters
    let safe_query = escape_lucene(query_text);
    if safe_query.is_empty() {
        return Ok(results);
    }

    let search_types: Vec<&str> = types
        .map(|t| t.to_vec())
        .unwrap_or_else(|| vec!["person", "participant", "lineage", "place", "haplogroup"]);

    for search_type in &search_types {
        let (index_name, display_expr, label) = match *search_type {
            "person" => (
                "personSearch",
                "node.given_name + ' ' + node.surname",
                "Person",
            ),
            "participant" => ("participantSearch", "node.display_name", "Participant"),
            "lineage" => ("lineageSearch", "node.display_name", "Lineage"),
            "place" => ("placeSearch", "node.name", "Place"),
            "haplogroup" => ("haplogroupSearch", "node.name", "Haplogroup"),
            _ => continue,
        };

        let query_str = format!(
            "CALL db.index.fulltext.queryNodes('{index_name}', $query) \
             YIELD node, score \
             RETURN node.id AS id, labels(node)[0] AS label, \
                    {display_expr} AS display, score \
             ORDER BY score DESC LIMIT $limit"
        );

        let query = Query::new(query_str)
            .param("query", safe_query.clone())
            .param("limit", limit);

        let mut result = graph.execute(query).await?;
        while let Some(row) = result.next().await? {
            let id: String = row.get("id").unwrap_or_default();
            let rl: String = row.get("label").unwrap_or_default();
            let display: String = row.get("display").unwrap_or_default();
            let score: f64 = row.get("score").unwrap_or(0.0);

            results.push(SearchResult {
                id,
                label: rl,
                result_type: label.to_string(),
                display,
                score,
            });
        }
    }

    // Sort all results by score descending, then truncate to limit
    results.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    results.truncate(limit as usize);

    Ok(results)
}

/// Fetch aggregate stats across all node types.
pub async fn get_stats(graph: &Graph) -> Result<Stats, Error> {
    let query = Query::new(
        "OPTIONAL MATCH (l:Lineage) WITH count(l) AS lineages \
         OPTIONAL MATCH (p:Person) WITH lineages, count(p) AS persons \
         OPTIONAL MATCH (part:Participant) WITH lineages, persons, count(part) AS participants \
         OPTIONAL MATCH (h:Haplogroup) WITH lineages, persons, participants, count(h) AS haplogroups \
         OPTIONAL MATCH (pl:Place) WITH lineages, persons, participants, haplogroups, count(pl) AS places \
         RETURN lineages, persons, participants, haplogroups, places"
            .to_string(),
    );

    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(Stats {
            lineage_count: row.get("lineages").unwrap_or(0),
            person_count: row.get("persons").unwrap_or(0),
            participant_count: row.get("participants").unwrap_or(0),
            haplogroup_count: row.get("haplogroups").unwrap_or(0),
            place_count: row.get("places").unwrap_or(0),
        })
    } else {
        Ok(Stats::default())
    }
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct Stats {
    pub lineage_count: i64,
    pub person_count: i64,
    pub participant_count: i64,
    pub haplogroup_count: i64,
    pub place_count: i64,
}

fn escape_lucene(input: &str) -> String {
    let specials = [
        '+', '-', '&', '|', '!', '(', ')', '{', '}', '[', ']', '^', '"', '~', '*', '?', ':', '\\',
        '/',
    ];
    let mut escaped = String::with_capacity(input.len() * 2);
    for ch in input.chars() {
        if specials.contains(&ch) {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}
