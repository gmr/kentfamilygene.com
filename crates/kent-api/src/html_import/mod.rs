pub mod dedup;
pub mod parse_ancestor;
pub mod parse_date;
pub mod parse_document;
pub mod parse_lineage;
pub mod parse_participant;
pub mod persist;
pub mod types;

use kent_db::Neo4jGraph as Graph;
use types::ParsedDocument;

/// Main entry point: parse source.html and either dry-run (JSON) or persist to Neo4j.
pub async fn run_html_import(graph: &Graph, file_path: &str, dry_run: bool) {
    tracing::info!("Reading HTML file: {file_path}");

    let html = match std::fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to read file: {e}");
            return;
        }
    };

    tracing::info!("Parsing HTML ({} bytes)...", html.len());
    let doc = parse_document::parse_html(&html);

    let participant_count: usize = doc
        .lineages
        .iter()
        .map(|l| l.participants.len())
        .sum::<usize>()
        + doc.newest_members.len();
    let person_count: usize = doc
        .lineages
        .iter()
        .flat_map(|l| l.participants.iter())
        .chain(doc.newest_members.iter())
        .map(|p| p.ancestors.len())
        .sum::<usize>()
        + doc
            .lineages
            .iter()
            .map(|l| l.common_ancestors.len())
            .sum::<usize>();

    tracing::info!("Parse complete:");
    tracing::info!("  Lineages:           {}", doc.lineages.len());
    tracing::info!("  Newest members:     {}", doc.newest_members.len());
    tracing::info!("  Total participants: {participant_count}");
    tracing::info!("  Ancestor entries:   {person_count}");
    tracing::info!("  Warnings:           {}", doc.warnings.len());

    for w in &doc.warnings {
        tracing::warn!("  {w}");
    }

    if dry_run {
        print_dry_run(&doc);
    } else {
        persist::persist_to_neo4j(graph, &doc).await;
    }
}

fn print_dry_run(doc: &ParsedDocument) {
    match serde_json::to_string_pretty(doc) {
        Ok(json) => println!("{json}"),
        Err(e) => tracing::error!("Failed to serialize to JSON: {e}"),
    }
}
