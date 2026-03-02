use regex::Regex;
use scraper::{ElementRef, Html, Selector};
use std::sync::LazyLock;

use super::parse_ancestor;
use super::parse_participant;
use super::types::*;

// Regex to extract lineage name and optional number from <h3> text
static LINEAGE_NAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^([\w\s.''&/,-]+?)(?:,\s*Lineage No\.\s*(\d+))?\s*$").unwrap());

// Regex to detect "New Lineage (Month YYYY)"
static NEW_LINEAGE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"New Lineage\s*\(([^)]+)\)").unwrap());

// Region names from the <h2> in region header divs
static REGION_NAMES: &[(&str, &str)] = &[
    ("International Kent Families", "International"),
    ("New England", "New England"),
    ("Mid-Atlantic", "Mid-Atlantic"),
    ("Southern-Gulf", "Southern-Gulf"),
    ("Midwest", "Midwest & Great Plains"),
    ("Pacific", "Pacific & Mountain"),
];

/// Parse all lineages from the lineage zone HTML.
pub fn parse_all_lineages(html: &str, warnings: &mut Vec<String>) -> Vec<ParsedLineage> {
    let fragment = Html::parse_fragment(html);
    let mut lineages = Vec::new();

    // Build region map by scanning the raw HTML for region header patterns.
    // Each entry is (byte_offset, region_name).
    let region_header_re = Regex::new(r#"<h2><strong>([^<]+)</strong></h2>"#).unwrap();
    let mut region_map: Vec<(usize, String)> = Vec::new();
    for caps in region_header_re.captures_iter(html) {
        let text = html_escape::decode_html_entities(caps.get(1).unwrap().as_str()).to_string();
        let offset = caps.get(0).unwrap().start();
        for &(pattern, region) in REGION_NAMES {
            if text.contains(pattern) {
                region_map.push((offset, region.to_string()));
                break;
            }
        }
    }
    region_map.sort_by_key(|(off, _)| *off);

    // Now find all lineage blocks marked by <h3>
    let h3_sel = Selector::parse("h3").unwrap();

    for h3 in fragment.select(&h3_sel) {
        let h3_text = element_full_text(&h3);
        let h3_text = h3_text.trim();

        // Skip empty h3 or navigation h3
        if h3_text.is_empty() {
            continue;
        }

        // Check if this is a "New Lineage" marker inside a nested structure
        if NEW_LINEAGE_RE.is_match(h3_text) {
            continue;
        }

        // Determine current region from offset
        // Use the h3 text to find its position in the raw HTML
        let h3_offset = find_h3_offset(html, h3_text);
        let mut current_region = String::new();
        for (off, region) in &region_map {
            if h3_offset >= *off {
                current_region = region.clone();
            }
        }

        // Parse lineage name
        let (name, lineage_number) = parse_lineage_name(h3_text);

        // Check if this is an empty lineage (the containing div will have the "no lineages" text)
        let parent_html = get_lineage_block_html(html, h3_text);
        let is_empty = parent_html
            .is_some_and(|h| h.contains("currently aren") || h.contains("There currently aren"));

        if is_empty {
            continue; // Skip empty state lineages
        }

        // Extract anchor name
        let anchor = find_anchor_before_h3(html, h3_text);

        // Determine origin_state from the lineage name
        let origin_state = extract_origin_state(&name);

        // Parse migration path from <h4>
        let migration_path = parent_html.map(parse_migration_path).unwrap_or_default();

        // Parse participants from the lineage block
        let block_html = parent_html.unwrap_or("");

        // Check for nested lineage (GENERATION blocks)
        let is_nested = block_html.contains("GENERATION");

        let (common_ancestors, participants) = if is_nested {
            parse_nested_lineage(block_html, warnings)
        } else {
            let participants =
                parse_participant::parse_participant_blocks_from_html(block_html, warnings);
            (vec![], participants)
        };

        lineages.push(ParsedLineage {
            anchor,
            name: name.clone(),
            lineage_number,
            region: Some(current_region.clone()),
            origin_state,
            is_new: false,
            new_lineage_date: None,
            is_empty,
            migration_path,
            common_ancestors,
            participants,
        });
    }

    lineages
}

/// Find the byte offset of an h3 element's text in the raw HTML.
/// Searches for `<h3>TEXT</h3>` patterns to get an accurate position.
fn find_h3_offset(html: &str, h3_text: &str) -> usize {
    // Try to find the exact <h3> tag containing this text
    let search = format!("<h3>{}", h3_text);
    if let Some(pos) = html.find(&search) {
        return pos;
    }
    // Fallback: search for the h3 text near an <h3> tag
    if let Some(pos) = html.find(h3_text) {
        return pos;
    }
    0
}

/// Parse a lineage name from h3 text.
fn parse_lineage_name(text: &str) -> (String, Option<i64>) {
    let text = text.trim();
    if let Some(caps) = LINEAGE_NAME_RE.captures(text) {
        let name = caps.get(1).unwrap().as_str().trim().to_string();
        let number = caps.get(2).and_then(|m| m.as_str().parse::<i64>().ok());
        (name, number)
    } else {
        (text.to_string(), None)
    }
}

/// Extract the origin state from a lineage name like "MARYLAND" or "NEW YORK".
fn extract_origin_state(name: &str) -> Option<String> {
    Some(title_case(name.trim()))
}

fn title_case(s: &str) -> String {
    s.split_whitespace()
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => {
                    let upper: String = c.to_uppercase().collect();
                    format!("{upper}{}", chars.as_str().to_lowercase())
                }
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Get the HTML of the lineage block containing a given h3 text.
fn get_lineage_block_html<'a>(html: &'a str, h3_text: &str) -> Option<&'a str> {
    // Find the h3 text in the HTML, then extract the containing block
    let pos = html.find(h3_text)?;

    // Look backwards for the containing div with border-left
    let before = &html[..pos];
    let block_start = before
        .rfind("border-left:")
        .and_then(|p| {
            // Go back to find the <div that contains this style
            before[..p].rfind("<div")
        })
        .unwrap_or(
            // Fallback: find the nearest <div style="margin-left: 2em">
            before.rfind("<div style=\"margin-left: 2em\"").unwrap_or(0),
        );

    // Find the end of this lineage block
    // Look for the next lineage anchor or region header
    let after_h3 = &html[pos..];

    // Find the next <h3> or region header that's not inside a nested structure
    let next_boundary = find_next_lineage_boundary(after_h3, h3_text.len());
    let block_end = pos + next_boundary;

    Some(&html[block_start..block_end])
}

/// Find the next lineage boundary after the current h3.
fn find_next_lineage_boundary(html: &str, skip_initial: usize) -> usize {
    let search_from = skip_initial;
    let remainder = &html[search_from..];

    // Look for patterns that indicate a new lineage block:
    // - <a name="..."> followed by a lineage block
    // - <div style="background-color: #87c2c4"> (region header)
    // - another <h3> at the same nesting level

    // Simple heuristic: find the next <hr or <a name= or region div
    let boundaries = [
        remainder.find("<a name="),
        remainder.find("background-color: #87c2c4"),
    ];

    boundaries
        .iter()
        .filter_map(|&b| b)
        .min()
        .map(|b| search_from + b)
        .unwrap_or(html.len())
}

/// Find the anchor name (<a name="...">) preceding an h3.
fn find_anchor_before_h3(html: &str, h3_text: &str) -> Option<String> {
    let pos = html.find(h3_text)?;
    let before = &html[..pos];

    // Find the last <a name="..."> before this h3
    let re = Regex::new(r#"<a\s+name="([^"]+)""#).unwrap();
    let mut last_anchor = None;
    for caps in re.captures_iter(before) {
        last_anchor = Some(caps.get(1).unwrap().as_str().to_string());
    }
    last_anchor
}

/// Parse migration path from the <h4> inside a lineage block.
pub fn parse_migration_path(block_html: &str) -> Vec<MigrationStop> {
    let fragment = Html::parse_fragment(block_html);
    let h4_sel = Selector::parse("h4").unwrap();

    let Some(h4) = fragment.select(&h4_sel).next() else {
        return vec![];
    };

    let a_sel = Selector::parse("a").unwrap();
    let mut stops = Vec::new();
    let mut order = 0i64;

    // Each <a> in the h4 is a place in the migration path
    // The text between "From" and "to" markers separates origin from destination
    // Extract place names from the links and surrounding text
    // The pattern is: From PLACE to PLACE to PLACE
    for a in h4.select(&a_sel) {
        let text = a.text().collect::<String>();
        let text = text.trim();
        if text.is_empty()
            || text.starts_with("Next")
            || text.starts_with("Previous")
            || text.starts_with("Top")
            || text.starts_with("Click")
            || text.starts_with("*USE")
        {
            continue;
        }

        // Clean up wayback machine URLs
        let href = a.value().attr("href").unwrap_or("");
        if href.contains("familysearch.org") || !href.contains("archive.org") || text.len() > 2 {
            order += 1;
            stops.push(MigrationStop {
                place_text: clean_place_text(text),
                stop_order: order,
            });
        }
    }

    // If no links found, try to parse from raw text
    if stops.is_empty() {
        let text = h4.text().collect::<String>();
        let parts: Vec<&str> = text.split(" to ").collect();
        for (i, part) in parts.iter().enumerate() {
            let place = part
                .trim()
                .trim_start_matches("From ")
                .trim_start_matches("from ")
                .trim();
            if !place.is_empty() {
                stops.push(MigrationStop {
                    place_text: clean_place_text(place),
                    stop_order: (i + 1) as i64,
                });
            }
        }
    }

    stops
}

fn clean_place_text(text: &str) -> String {
    text.trim()
        .trim_start_matches("From ")
        .trim_start_matches("from ")
        .trim_start_matches("in ")
        .trim_end_matches(" to")
        .trim()
        .to_string()
}

/// Get the full text content of an element (including nested elements).
fn element_full_text(el: &ElementRef) -> String {
    el.text().collect::<String>()
}

/// Parse a nested lineage (with GENERATION blocks and common ancestors).
fn parse_nested_lineage(
    block_html: &str,
    warnings: &mut Vec<String>,
) -> (Vec<ParsedPerson>, Vec<ParsedParticipantBlock>) {
    let mut common_ancestors = Vec::new();
    // Parse common ancestors: numbered entries outside <ol> tags
    // Format: "18. <strong>John Kent</strong>, b ca 1480 ..."
    let common_re = Regex::new(
        r"(?s)(\d+)\.\s*(?:/\s*\d+\.\s*)*<strong>([^<]+)</strong>,?\s*([^<]*?)(?:<br|<div|$)",
    )
    .unwrap();

    // Find the section before the first GENERATION marker
    let gen_start = block_html.find("GENERATION").unwrap_or(block_html.len());
    let preamble = &block_html[..gen_start];

    // Also find the "FURTHEST KNOWN" ancestor section
    let ancestor_section_start = preamble
        .find("FURTHEST KNOWN")
        .or_else(|| preamble.find("BRICK WALL FOR FOLLOWING"))
        .unwrap_or(0);

    let ancestor_section = &preamble[ancestor_section_start..];

    for caps in common_re.captures_iter(ancestor_section) {
        let gen_num: i64 = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
        let name = caps.get(2).unwrap().as_str().trim();
        let bio_text = caps.get(3).unwrap().as_str().trim();
        let bio_text = html_escape::decode_html_entities(bio_text).to_string();

        let person = parse_ancestor::parse_person_from_text(name, &bio_text);
        let mut person = person;
        person.common_ancestor_gen = Some(gen_num);
        common_ancestors.push(person);
    }

    // Also find common ancestors in GENERATION blocks (numbered entries before participant blocks)
    // Format: "9. / 11. / 12. <strong>Name</strong>, bio..."
    let gen_numbered_re = Regex::new(
        r"(?s)(?:(?:\d+\.\s*/\s*)*(\d+)\.?\s*)<strong>([^<]+)</strong>,?\s*([^<]*?)(?:<br|<div|<ol|$)"
    ).unwrap();

    // Find generation blocks and extract their common ancestors and participant blocks
    let gen_block_re = Regex::new(
        r"(?i)(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+GENERATION",
    )
    .unwrap();

    // Parse all participant blocks from the full nested structure
    let participants = parse_participant::parse_participant_blocks_from_html(block_html, warnings);

    // For the generation blocks, extract numbered persons that aren't in <ol> tags
    let generation_sections: Vec<&str> = gen_block_re.split(block_html).collect();
    for section in &generation_sections[1..] {
        // Look for numbered person entries (not inside <ol>)
        // These are the branching ancestors in the generation tree
        for caps in gen_numbered_re.captures_iter(section) {
            let gen_num: i64 = caps.get(1).unwrap().as_str().parse().unwrap_or(0);
            let name = caps.get(2).unwrap().as_str().trim();
            let bio_text = caps.get(3).unwrap().as_str().trim();
            let bio_text = html_escape::decode_html_entities(bio_text).to_string();

            // Skip if this looks like a participant name (followed by email)
            if bio_text.contains("&lt;") || bio_text.contains("@") {
                continue;
            }

            // Skip if the name is a privacy label
            if name.starts_with('[') {
                continue;
            }

            let mut person = parse_ancestor::parse_person_from_text(name, &bio_text);
            person.common_ancestor_gen = Some(gen_num);

            // Avoid duplicates
            if !common_ancestors.iter().any(|p| {
                p.given_name == person.given_name
                    && p.surname == person.surname
                    && p.birth_date_sort == person.birth_date_sort
            }) {
                common_ancestors.push(person);
            }
        }
    }

    (common_ancestors, participants)
}
