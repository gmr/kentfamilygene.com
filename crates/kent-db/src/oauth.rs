//! Storage for sign-in state: OAuth clients, pending requests, codes, tokens and
//! admin sessions. Each one is an `OAuthGrant` node keyed by `hash` (a SHA-256 of
//! the secret, or the client id) and `kind`, with an opaque JSON `data` string and
//! an `expiresAt` in Unix seconds.

use neo4rs::{Graph, Query};

use crate::Error;

fn now() -> i64 {
    chrono::Utc::now().timestamp()
}

pub async fn ensure_oauth_constraints(graph: &Graph) -> Result<(), Error> {
    graph
        .run(Query::new(
            "CREATE CONSTRAINT oauthGrantHashUnique IF NOT EXISTS \
             FOR (g:OAuthGrant) REQUIRE g.hash IS UNIQUE"
                .to_string(),
        ))
        .await?;
    Ok(())
}

/// Stores a grant and removes expired ones.
pub async fn save_grant(
    graph: &Graph,
    hash: &str,
    kind: &str,
    data: &str,
    ttl_secs: i64,
) -> Result<(), Error> {
    let t = now();
    graph
        .run(
            Query::new("MATCH (g:OAuthGrant) WHERE g.expiresAt < $now DELETE g".to_string())
                .param("now", t),
        )
        .await?;
    graph
        .run(
            Query::new(
                "CREATE (:OAuthGrant {hash: $hash, kind: $kind, data: $data, expiresAt: $exp})"
                    .to_string(),
            )
            .param("hash", hash)
            .param("kind", kind)
            .param("data", data)
            .param("exp", t + ttl_secs),
        )
        .await?;
    Ok(())
}

/// Returns the data of a live grant.
pub async fn get_grant(graph: &Graph, hash: &str, kind: &str) -> Result<Option<String>, Error> {
    one(
        graph,
        "MATCH (g:OAuthGrant {hash: $hash, kind: $kind}) WHERE g.expiresAt > $now RETURN g.data AS data",
        hash,
        kind,
    )
    .await
}

/// Deletes a grant and returns its data if it was live (single use).
/// ponytail: two concurrent takes of one code can both read it before the delete; at
/// this scale the window is tiny. Lock the node first (SET) if that ever matters.
pub async fn take_grant(graph: &Graph, hash: &str, kind: &str) -> Result<Option<String>, Error> {
    one(
        graph,
        "MATCH (g:OAuthGrant {hash: $hash, kind: $kind}) \
         WITH g, g.data AS data, g.expiresAt > $now AS live DELETE g \
         RETURN CASE WHEN live THEN data END AS data",
        hash,
        kind,
    )
    .await
}

async fn one(graph: &Graph, cypher: &str, hash: &str, kind: &str) -> Result<Option<String>, Error> {
    let q = Query::new(cypher.to_string())
        .param("hash", hash)
        .param("kind", kind)
        .param("now", now());
    let mut rows = graph.execute(q).await?;
    let mut out = None;
    while let Some(row) = rows.next().await? {
        out = row.get::<Option<String>>("data")?;
    }
    Ok(out)
}
