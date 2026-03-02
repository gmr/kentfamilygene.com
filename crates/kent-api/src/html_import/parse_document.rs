use scraper::{ElementRef, Html, Selector};

use super::parse_lineage;
use super::types::*;

/// Parse the full HTML document into a ParsedDocument.
pub fn parse_html(html: &str) -> ParsedDocument {
    let document = Html::parse_document(html);
    let mut warnings = Vec::new();

    // Find the about-content div
    let content_sel = Selector::parse("div.about-content").unwrap();
    let content = match document.select(&content_sel).next() {
        Some(el) => el,
        None => {
            warnings.push("Could not find div.about-content".to_string());
            return ParsedDocument {
                newest_members: vec![],
                lineages: vec![],
                warnings,
            };
        }
    };

    // Get the inner HTML of the content div and work with it
    let inner_html = content.inner_html();

    // Split at [END] to exclude admin scratch
    let content_html = if let Some(pos) = inner_html.find("[END]") {
        // Find the start of the <h2> containing [END]
        let search_area = &inner_html[..pos];
        if let Some(h2_start) = search_area.rfind("<h2") {
            &inner_html[..h2_start]
        } else {
            search_area
        }
    } else {
        &inner_html
    };

    // Re-parse the trimmed content
    let fragment = Html::parse_fragment(content_html);

    // Split into zones:
    // 1. Newest Members: from <h2>Our Newest Members</h2> to <h2>Navigate/Search
    // 2. Lineage sections: from "Search for Lineages by Region" onwards
    let newest_members = parse_newest_members_zone(&fragment, &mut warnings);
    let lineages = parse_lineage_zones(&fragment, &mut warnings);

    ParsedDocument {
        newest_members,
        lineages,
        warnings,
    }
}

/// Parse the "Newest Members" zone.
fn parse_newest_members_zone(
    fragment: &Html,
    warnings: &mut Vec<String>,
) -> Vec<ParsedParticipantBlock> {
    let h2_sel = Selector::parse("h2").unwrap();
    let h2s: Vec<ElementRef> = fragment.select(&h2_sel).collect();

    // Find the "Our Newest Members" h2 and the next h2 after it
    let mut newest_start = None;

    for h2 in &h2s {
        let text = h2.text().collect::<String>();
        if text.contains("Newest Members") {
            newest_start = Some(h2);
            break;
        }
    }

    let Some(_start) = newest_start else {
        warnings.push("Could not find 'Newest Members' section".to_string());
        return vec![];
    };

    // Extract participant blocks from the newest members zone using the fragment HTML
    let html_str = fragment.html();

    // Find the boundaries in the raw HTML string
    let start_marker = "Newest Members";
    let start_pos = match html_str.find(start_marker) {
        Some(p) => p,
        None => return vec![],
    };

    // The zone ends at the next major section
    let end_markers = ["Navigate Your Search", "Search for Lineages by Region"];
    let end_pos = end_markers
        .iter()
        .filter_map(|m| html_str[start_pos..].find(m).map(|p| start_pos + p))
        .min()
        .unwrap_or(html_str.len());

    let zone_html = &html_str[start_pos..end_pos];

    super::parse_participant::parse_participant_blocks_from_html(zone_html, warnings)
}

/// Parse the lineage zones (regions and individual lineages).
fn parse_lineage_zones(fragment: &Html, warnings: &mut Vec<String>) -> Vec<ParsedLineage> {
    let html_str = fragment.html();

    // Find where lineage content starts (after "Search for Lineages by Region")
    let lineage_start_marker = "Search for Lineages by Region";
    let start_pos = match html_str.find(lineage_start_marker) {
        Some(p) => p,
        None => {
            warnings.push("Could not find 'Search for Lineages by Region' section".to_string());
            return vec![];
        }
    };

    let lineage_html = &html_str[start_pos..];

    // Find all <a name="..."> anchors that mark lineage boundaries
    // and the region headers with background-color: #87c2c4
    parse_lineage::parse_all_lineages(lineage_html, warnings)
}
