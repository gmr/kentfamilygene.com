//! CMS storage: editable Pages, reusable Snippets, and managed navigation.

use neo4rs::{Graph, Query};

use crate::{Error, NavItemRow, PageRow, SnippetRow};

/// Unique constraints so slugs and snippet keys stay addressable.
pub async fn ensure_content_constraints(graph: &Graph) -> Result<(), Error> {
    let constraints = [
        "CREATE CONSTRAINT pageSlugUnique IF NOT EXISTS \
         FOR (p:Page) REQUIRE p.slug IS UNIQUE",
        "CREATE CONSTRAINT snippetKeyUnique IF NOT EXISTS \
         FOR (s:Snippet) REQUIRE s.key IS UNIQUE",
    ];
    // `run`, not `execute` — see the note in search::ensure_search_indexes.
    for c in &constraints {
        graph.run(Query::new(c.to_string())).await?;
    }
    Ok(())
}

// ── Pages ──────────────────────────────────────────────────────────

pub async fn find_all_pages(graph: &Graph, published_only: bool) -> Result<Vec<PageRow>, Error> {
    let where_str = if published_only {
        " WHERE p.is_published = true"
    } else {
        ""
    };
    let query = Query::new(format!(
        "MATCH (p:Page){where_str} RETURN p ORDER BY p.title"
    ));
    let mut result = graph.execute(query).await?;
    let mut pages = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        pages.push(node_to_page_row(&node));
    }
    Ok(pages)
}

pub async fn find_page_by_slug(graph: &Graph, slug: &str) -> Result<Option<PageRow>, Error> {
    let query = Query::new("MATCH (p:Page {slug: $slug}) RETURN p".to_string()).param("slug", slug);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        Ok(Some(node_to_page_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn find_page_by_id(graph: &Graph, id: &str) -> Result<Option<PageRow>, Error> {
    let query = Query::new("MATCH (p:Page {id: $id}) RETURN p".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        Ok(Some(node_to_page_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_page(graph: &Graph, row: &PageRow) -> Result<PageRow, Error> {
    let query = Query::new(
        "CREATE (p:Page {
            id: $id, slug: $slug, title: $title, body: $body,
            summary: $summary, is_published: $is_published,
            created_date: $created_date, updated_date: $updated_date
        }) RETURN p"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("slug", row.slug.clone())
    .param("title", row.title.clone())
    .param("body", row.body.clone())
    .param("summary", row.summary.clone())
    .param("is_published", row.is_published)
    .param("created_date", row.created_date.clone())
    .param("updated_date", row.updated_date.clone());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("p")?;
    Ok(node_to_page_row(&node))
}

pub async fn update_page(graph: &Graph, id: &str, row: &PageRow) -> Result<Option<PageRow>, Error> {
    let query = Query::new(
        "MATCH (p:Page {id: $id}) \
         SET p.slug = $slug, p.title = $title, p.body = $body, \
             p.summary = $summary, p.is_published = $is_published, \
             p.updated_date = $updated_date \
         RETURN p"
            .to_string(),
    )
    .param("id", id)
    .param("slug", row.slug.clone())
    .param("title", row.title.clone())
    .param("body", row.body.clone())
    .param("summary", row.summary.clone())
    .param("is_published", row.is_published)
    .param("updated_date", row.updated_date.clone());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("p")?;
        Ok(Some(node_to_page_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_page(graph: &Graph, id: &str) -> Result<bool, Error> {
    delete_by_id(graph, "Page", id).await
}

// ── Snippets ───────────────────────────────────────────────────────

pub async fn find_all_snippets(graph: &Graph) -> Result<Vec<SnippetRow>, Error> {
    let query = Query::new("MATCH (s:Snippet) RETURN s ORDER BY s.key".to_string());
    let mut result = graph.execute(query).await?;
    let mut snippets = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("s")?;
        snippets.push(node_to_snippet_row(&node));
    }
    Ok(snippets)
}

pub async fn find_snippet_by_key(graph: &Graph, key: &str) -> Result<Option<SnippetRow>, Error> {
    let query = Query::new("MATCH (s:Snippet {key: $key}) RETURN s".to_string()).param("key", key);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("s")?;
        Ok(Some(node_to_snippet_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_snippet(graph: &Graph, row: &SnippetRow) -> Result<SnippetRow, Error> {
    let query = Query::new(
        "CREATE (s:Snippet {
            id: $id, key: $key, title: $title, body: $body,
            created_date: $created_date, updated_date: $updated_date
        }) RETURN s"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("key", row.key.clone())
    .param("title", row.title.clone())
    .param("body", row.body.clone())
    .param("created_date", row.created_date.clone())
    .param("updated_date", row.updated_date.clone());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("s")?;
    Ok(node_to_snippet_row(&node))
}

pub async fn update_snippet(
    graph: &Graph,
    id: &str,
    row: &SnippetRow,
) -> Result<Option<SnippetRow>, Error> {
    let query = Query::new(
        "MATCH (s:Snippet {id: $id}) \
         SET s.key = $key, s.title = $title, s.body = $body, \
             s.updated_date = $updated_date \
         RETURN s"
            .to_string(),
    )
    .param("id", id)
    .param("key", row.key.clone())
    .param("title", row.title.clone())
    .param("body", row.body.clone())
    .param("updated_date", row.updated_date.clone());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("s")?;
        Ok(Some(node_to_snippet_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_snippet(graph: &Graph, id: &str) -> Result<bool, Error> {
    delete_by_id(graph, "Snippet", id).await
}

// ── Navigation ─────────────────────────────────────────────────────

pub async fn find_nav_items(
    graph: &Graph,
    location: Option<&str>,
) -> Result<Vec<NavItemRow>, Error> {
    let where_str = if location.is_some() {
        " WHERE n.location = $location"
    } else {
        ""
    };
    let mut query = Query::new(format!(
        "MATCH (n:NavItem){where_str} RETURN n ORDER BY n.location, n.sort_order, n.label"
    ));
    if let Some(loc) = location {
        query = query.param("location", loc);
    }
    let mut result = graph.execute(query).await?;
    let mut items = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("n")?;
        items.push(node_to_nav_item_row(&node));
    }
    Ok(items)
}

pub async fn create_nav_item(graph: &Graph, row: &NavItemRow) -> Result<NavItemRow, Error> {
    let query = Query::new(
        "CREATE (n:NavItem {
            id: $id, location: $location, group_label: $group_label,
            label: $label, target: $target, sort_order: $sort_order
        }) RETURN n"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("location", row.location.clone())
    .param("group_label", row.group_label.clone())
    .param("label", row.label.clone())
    .param("target", row.target.clone())
    .param("sort_order", row.sort_order);

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("n")?;
    Ok(node_to_nav_item_row(&node))
}

pub async fn update_nav_item(
    graph: &Graph,
    id: &str,
    row: &NavItemRow,
) -> Result<Option<NavItemRow>, Error> {
    let query = Query::new(
        "MATCH (n:NavItem {id: $id}) \
         SET n.location = $location, n.group_label = $group_label, \
             n.label = $label, n.target = $target, n.sort_order = $sort_order \
         RETURN n"
            .to_string(),
    )
    .param("id", id)
    .param("location", row.location.clone())
    .param("group_label", row.group_label.clone())
    .param("label", row.label.clone())
    .param("target", row.target.clone())
    .param("sort_order", row.sort_order);

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("n")?;
        Ok(Some(node_to_nav_item_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_nav_item(graph: &Graph, id: &str) -> Result<bool, Error> {
    delete_by_id(graph, "NavItem", id).await
}

// ── Shared helpers ─────────────────────────────────────────────────

async fn delete_by_id(graph: &Graph, label: &str, id: &str) -> Result<bool, Error> {
    let query = Query::new(format!(
        "MATCH (n:{label} {{id: $id}}) WITH n, n IS NOT NULL AS existed \
         DETACH DELETE n RETURN existed AS deleted"
    ))
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

fn non_empty(node: &neo4rs::Node, key: &str) -> Option<String> {
    node.get::<String>(key).ok().filter(|s| !s.is_empty())
}

fn node_to_page_row(node: &neo4rs::Node) -> PageRow {
    PageRow {
        id: node.get::<String>("id").unwrap_or_default(),
        slug: node.get::<String>("slug").unwrap_or_default(),
        title: node.get::<String>("title").unwrap_or_default(),
        body: node.get::<String>("body").unwrap_or_default(),
        summary: non_empty(node, "summary"),
        is_published: node.get::<bool>("is_published").unwrap_or(false),
        created_date: non_empty(node, "created_date"),
        updated_date: non_empty(node, "updated_date"),
    }
}

fn node_to_snippet_row(node: &neo4rs::Node) -> SnippetRow {
    SnippetRow {
        id: node.get::<String>("id").unwrap_or_default(),
        key: node.get::<String>("key").unwrap_or_default(),
        title: non_empty(node, "title"),
        body: node.get::<String>("body").unwrap_or_default(),
        created_date: non_empty(node, "created_date"),
        updated_date: non_empty(node, "updated_date"),
    }
}

fn node_to_nav_item_row(node: &neo4rs::Node) -> NavItemRow {
    NavItemRow {
        id: node.get::<String>("id").unwrap_or_default(),
        location: node.get::<String>("location").unwrap_or_default(),
        group_label: non_empty(node, "group_label"),
        label: node.get::<String>("label").unwrap_or_default(),
        target: node.get::<String>("target").unwrap_or_default(),
        sort_order: node.get::<i64>("sort_order").unwrap_or(0),
    }
}
