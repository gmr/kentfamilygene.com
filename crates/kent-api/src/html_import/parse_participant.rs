use regex::Regex;
use scraper::{Html, Selector};
use std::sync::LazyLock;

use super::parse_ancestor;
use super::types::*;

// Pattern to match participant name/email: <strong>Name</strong>, &lt;email&gt;
// or sometimes just <strong>Name</strong>, <email>
static NAME_EMAIL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"<strong>([^<]+)</strong>,?\s*(?:&lt;|<)([^>&]+@[^>&]+)(?:&gt;|>)").unwrap()
});

// y-DNA haplogroup pattern
static YDNA_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)\((\w+)\)\s*Haplogroup\s+is\s+<strong>([^<]+)</strong>(?:,\s*Subclade\s+<strong>([^<]+)</strong>)?")
        .unwrap()
});

// Abbreviation pattern — handles both encoded (&quot;) and decoded (") quote forms
static ABBREV_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"abbreviation[^"]*?(?:&quot;|")<strong>([^<]+)</strong>(?:&quot;|")"#).unwrap()
});

// Kit bracket pattern — tolerant of many variants
static KIT_BRACKET_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[([^\]]+)\]").unwrap());

// FTDNA Kit No. inside bracket
static KIT_NUMBER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:FTDNA\s+)?Kit\s+No\.?\*?\s*([A-Z]{0,2}\d+)").unwrap());

// Marker count
static MARKER_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\d+)\s+Markers?").unwrap());

// Join year
static JOIN_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"Joined\s+(\d{4})").unwrap());

// Initials in kit bracket (e.g., "R. A. Kent", "C. W. Kent", "M. Kindt")
static INITIALS_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:,\s*)([A-Z]\.\s*(?:[A-Z]\.\s*)?[A-Za-z]+)(?:,|\s*\d|\s*Joined)").unwrap()
});

// Online tree pattern
static ONLINE_TREE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)<strong>Online\s+(?:Family\s+)?Tree</strong>\s*:?").unwrap());

// Family Finder test
static FAMILY_FINDER_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"(?i)(?:Family\s+Finder|"Family Finder")"#).unwrap());

// GEDmatch kit
static GEDMATCH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)Kit\s+No\.\s*([A-Z]\d+)").unwrap());

// Research goal
static RESEARCH_GOAL_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)RESEARCH\s+GOAL</span>\s*:\s*(.+?)(?:</div>|<br)").unwrap());

// "through" back-reference in nested lineages
static THROUGH_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\(through\s+<strong>([^<]+)</strong>[^)]*\)").unwrap());

/// Parse participant blocks from a chunk of HTML.
pub fn parse_participant_blocks_from_html(
    html: &str,
    warnings: &mut Vec<String>,
) -> Vec<ParsedParticipantBlock> {
    let mut participants = Vec::new();

    // Find all name/email matches to identify participant block boundaries
    let matches: Vec<_> = NAME_EMAIL_RE.captures_iter(html).collect();
    if matches.is_empty() {
        return participants;
    }

    for (i, caps) in matches.iter().enumerate() {
        let match_start = caps.get(0).unwrap().start();
        let block_end = if i + 1 < matches.len() {
            matches[i + 1].get(0).unwrap().start()
        } else {
            html.len()
        };

        let block_html = &html[match_start..block_end];
        let display_name = html_escape::decode_html_entities(caps.get(1).unwrap().as_str())
            .trim()
            .to_string();
        let email = Some(
            html_escape::decode_html_entities(caps.get(2).unwrap().as_str())
                .trim()
                .to_string(),
        );

        let online_tree = parse_online_tree(block_html);
        let y_dna = parse_ydna(block_html);
        let at_dna = parse_atdna(block_html);
        let kit_bracket = parse_kit_bracket(block_html, warnings);
        let ancestors = parse_ancestor_chain(block_html, warnings);
        let ancestor_note = parse_ancestor_note(block_html);
        let research_goal = parse_research_goal(block_html);
        let through_ancestor = parse_through_reference(block_html);

        participants.push(ParsedParticipantBlock {
            display_name,
            email,
            online_tree,
            y_dna,
            at_dna,
            kit_bracket,
            ancestors,
            ancestor_note,
            research_goal,
            through_ancestor,
        });
    }

    participants
}

fn parse_online_tree(html: &str) -> Option<ParsedOnlineTree> {
    // Check if online tree is present and not N/A
    if !ONLINE_TREE_RE.is_match(html) {
        return None;
    }

    // Find the line(s) containing the Online Tree info
    let tree_start = ONLINE_TREE_RE.find(html)?.end();
    let tree_section = &html[tree_start..];

    // Check for N/A
    let first_line_end = tree_section.find("<br").unwrap_or(200).min(200);
    let first_line = &tree_section[..first_line_end];
    if first_line.trim_start().starts_with("N/A") || first_line.contains(">N/A<") {
        return None;
    }

    // Parse platform from <em>
    let platform_re = Regex::new(r"<em>([^<]+)</em>").unwrap();
    let platform = platform_re
        .captures(tree_section)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    // Parse username from <strong>
    let username_re = Regex::new(r"Username:\s*<strong>([^<]+)</strong>").unwrap();
    let username = username_re
        .captures(tree_section)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    // Parse tree name from <a> with <strong> inside
    let tree_name_re =
        Regex::new(r#"<a[^>]*>\s*(?:&quot;|")\s*<strong>([^<]+)</strong>\s*(?:&quot;|")\s*</a>"#)
            .unwrap();
    let tree_name = tree_name_re.captures(tree_section).map(|c| {
        html_escape::decode_html_entities(c.get(1).unwrap().as_str())
            .trim()
            .to_string()
    });

    // Parse URL from <a href="...">
    let url_re = Regex::new(r#"<a\s+href="([^"]+)"[^>]*>(?:&quot;|")\s*<strong>"#).unwrap();
    let url = url_re
        .captures(tree_section)
        .map(|c| strip_wayback_prefix(c.get(1).unwrap().as_str()));

    if platform.is_none() && username.is_none() && tree_name.is_none() {
        return None;
    }

    Some(ParsedOnlineTree {
        platform,
        username,
        tree_name,
        url,
    })
}

fn parse_ydna(html: &str) -> Option<ParsedYDna> {
    // Check for N/A
    let ydna_line_re =
        Regex::new(r"(?i)<strong>y-DNA\s+Test</strong>\s*:\s*(.+?)(?:<br|$)").unwrap();
    let line_match = ydna_line_re.captures(html)?;
    let line = line_match.get(1).unwrap().as_str();

    if line.trim_start().starts_with("N/A") || line.contains(">N/A<") {
        return None;
    }

    let caps = YDNA_RE.captures(html)?;
    let confirmation_status = caps.get(1).unwrap().as_str().to_string();
    let haplogroup_name = caps.get(2).unwrap().as_str().trim().to_string();
    let subclade = caps.get(3).map(|m| m.as_str().trim().to_string());

    // Look for abbreviation
    let abbreviation = ABBREV_RE
        .captures(html)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    Some(ParsedYDna {
        confirmation_status,
        haplogroup_name,
        subclade,
        abbreviation,
    })
}

fn parse_atdna(html: &str) -> Option<ParsedAtDna> {
    // Check for at-DNA or atDNA line
    let atdna_line_re =
        Regex::new(r"(?i)<strong>at-?DNA\s+Test</strong>\s*:\s*(.+?)(?:<br|$)").unwrap();
    let line_match = atdna_line_re.captures(html)?;
    let line = line_match.get(1).unwrap().as_str();

    if line.trim_start().starts_with("N/A") || line.contains(">N/A<") {
        return None;
    }

    let has_family_finder = FAMILY_FINDER_RE.is_match(line);
    let registered_with_project =
        line.contains("registered with this project") || line.contains("registered with the");

    // Check for GEDmatch kit
    let gedmatch_kit = GEDMATCH_RE.captures(html).and_then(|c| {
        let kit = c.get(1).unwrap().as_str();
        // Only capture if it's in the at-DNA context (not the FTDNA kit bracket)
        if html.contains("GEDmatch") || html.contains("gedmatch") {
            Some(kit.to_string())
        } else {
            None
        }
    });

    // Detect provider
    let provider = if line.contains("FTDNA") || line.contains("Family Tree DNA") {
        Some("FTDNA".to_string())
    } else if line.contains("AncestryDNA") || line.contains("Ancestry") {
        Some("AncestryDNA".to_string())
    } else if line.contains("23andMe") {
        Some("23andMe".to_string())
    } else {
        None
    };

    Some(ParsedAtDna {
        has_family_finder,
        registered_with_project,
        provider,
        gedmatch_kit,
    })
}

fn parse_kit_bracket(html: &str, warnings: &mut Vec<String>) -> Option<ParsedKitBracket> {
    // Find the kit bracket — it's typically the last [...] in the block
    // and contains "Project Member" or "Associate Researcher" or "Kit No."
    let mut best_bracket: Option<regex::Captures> = None;

    for caps in KIT_BRACKET_RE.captures_iter(html) {
        let text = caps.get(1).unwrap().as_str();
        if text.contains("Project Member")
            || text.contains("Associate Researcher")
            || text.contains("Kit No")
            || text.contains("Joined")
        {
            best_bracket = Some(caps);
        }
    }

    let caps = best_bracket?;
    let raw = caps.get(1).unwrap().as_str();
    let raw_decoded = html_escape::decode_html_entities(raw).to_string();

    let membership_type = if raw_decoded.contains("Associate Researcher") {
        "Associate Researcher".to_string()
    } else {
        "Project Member".to_string()
    };

    let ftdna_kit_number = KIT_NUMBER_RE
        .captures(&raw_decoded)
        .map(|c| c.get(1).unwrap().as_str().to_string());

    let marker_count = MARKER_RE
        .captures(&raw_decoded)
        .and_then(|c| c.get(1).unwrap().as_str().parse::<i64>().ok());

    let join_year = JOIN_RE
        .captures(&raw_decoded)
        .map(|c| c.get(1).unwrap().as_str().to_string());

    let initials = INITIALS_RE
        .captures(&raw_decoded)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string());

    if ftdna_kit_number.is_none() && !raw_decoded.contains("Associate Researcher") {
        warnings.push(format!(
            "Kit bracket without FTDNA kit number: [{raw_decoded}]"
        ));
    }

    Some(ParsedKitBracket {
        membership_type,
        ftdna_kit_number,
        initials,
        marker_count,
        join_year,
        raw_text: format!("[{raw_decoded}]"),
    })
}

fn parse_ancestor_chain(html: &str, warnings: &mut Vec<String>) -> Vec<ParsedAncestorEntry> {
    // Find <ol>...</ol> blocks and parse <li> entries
    let fragment = Html::parse_fragment(html);
    let ol_sel = Selector::parse("ol").unwrap();
    let li_sel = Selector::parse("li").unwrap();

    let mut entries = Vec::new();

    for ol in fragment.select(&ol_sel) {
        for li in ol.select(&li_sel) {
            if let Some(entry) = parse_ancestor::parse_li_entry(&li, warnings) {
                entries.push(entry);
            }
        }
    }

    entries
}

fn parse_ancestor_note(html: &str) -> Option<String> {
    // Notes that appear after the <ol> but within the participant block
    // Often start with "This project member..." or contain match info
    let note_re = Regex::new(
        r"(?s)</ol>\s*((?:This project member|This associate|A qualifying|SUSPECTED)[^<]*)",
    )
    .unwrap();

    // Also check for notes inside <ol> but outside <li> (e.g., "[SUSPECTED patrilineal...]")
    let bracket_note_re = Regex::new(r"<ol>\s*\[([^\]]+)\]").unwrap();

    let mut notes = Vec::new();

    if let Some(caps) = note_re.captures(html) {
        let text = caps.get(1).unwrap().as_str().trim();
        let text = html_escape::decode_html_entities(text);
        if !text.is_empty() {
            notes.push(text.to_string());
        }
    }

    if let Some(caps) = bracket_note_re.captures(html) {
        let text = caps.get(1).unwrap().as_str().trim();
        let text = html_escape::decode_html_entities(text);
        notes.push(text.to_string());
    }

    if notes.is_empty() {
        None
    } else {
        Some(notes.join("; "))
    }
}

fn parse_research_goal(html: &str) -> Option<String> {
    RESEARCH_GOAL_RE.captures(html).map(|c| {
        let text = c.get(1).unwrap().as_str().trim();
        html_escape::decode_html_entities(text).to_string()
    })
}

fn parse_through_reference(html: &str) -> Option<String> {
    THROUGH_RE
        .captures(html)
        .map(|c| c.get(1).unwrap().as_str().trim().to_string())
}

/// Strip Wayback Machine URL prefix.
pub fn strip_wayback_prefix(url: &str) -> String {
    let re = Regex::new(r"https?://web\.archive\.org/web/\d+/").unwrap();
    re.replace(url, "").to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_wayback_prefix() {
        let url = "https://web.archive.org/web/20230126221128/https://www.ancestry.com/family-tree/person/tree/16845807/person/412282194116/facts";
        assert_eq!(
            strip_wayback_prefix(url),
            "https://www.ancestry.com/family-tree/person/tree/16845807/person/412282194116/facts"
        );
    }

    #[test]
    fn test_parse_kit_bracket_standard() {
        let html =
            r#"[Project Member, FTDNA Kit No. 967523, R. A. Kent, 111 Markers, Joined 2021]"#;
        let mut warnings = Vec::new();
        let bracket = parse_kit_bracket(html, &mut warnings).unwrap();
        assert_eq!(bracket.membership_type, "Project Member");
        assert_eq!(bracket.ftdna_kit_number.as_deref(), Some("967523"));
        assert_eq!(bracket.marker_count, Some(111));
        assert_eq!(bracket.join_year.as_deref(), Some("2021"));
    }

    #[test]
    fn test_parse_kit_bracket_asterisk() {
        let html = r#"[Project Member, FTDNA Kit No.* 932607, R. Kent, 37 Markers, Joined 2021]"#;
        let mut warnings = Vec::new();
        let bracket = parse_kit_bracket(html, &mut warnings).unwrap();
        assert_eq!(bracket.ftdna_kit_number.as_deref(), Some("932607"));
    }

    #[test]
    fn test_parse_kit_bracket_associate() {
        let html = r#"[Associate Researcher, Joined 2020]"#;
        let mut warnings = Vec::new();
        let bracket = parse_kit_bracket(html, &mut warnings).unwrap();
        assert_eq!(bracket.membership_type, "Associate Researcher");
        assert_eq!(bracket.ftdna_kit_number, None);
    }

    #[test]
    fn test_parse_kit_bracket_b_prefix() {
        let html = r#"[Project Member, FTDNA Kit No. B130208, Joined 2019]"#;
        let mut warnings = Vec::new();
        let bracket = parse_kit_bracket(html, &mut warnings).unwrap();
        assert_eq!(bracket.ftdna_kit_number.as_deref(), Some("B130208"));
    }

    #[test]
    fn test_parse_ydna() {
        let html = r#"<strong>y-DNA Test</strong>: (Predicted) Haplogroup is <strong>R1b1a2</strong>, Subclade <strong>M269</strong> (abbreviation for this haplogroup/subclade is &quot;<strong>R-M269</strong>&quot;)"#;
        let result = parse_ydna(html).unwrap();
        assert_eq!(result.confirmation_status, "Predicted");
        assert_eq!(result.haplogroup_name, "R1b1a2");
        assert_eq!(result.subclade.as_deref(), Some("M269"));
        assert_eq!(result.abbreviation.as_deref(), Some("R-M269"));
    }

    #[test]
    fn test_parse_ydna_confirmed() {
        let html = r#"<strong>y-DNA Test</strong>: (Confirmed) Haplogroup is <strong>I1a1</strong>, Subclade <strong>DF29</strong> (abbreviation for this haplogroup/subclade is &quot;<strong>I-DF29</strong>&quot;)"#;
        let result = parse_ydna(html).unwrap();
        assert_eq!(result.confirmation_status, "Confirmed");
        assert_eq!(result.haplogroup_name, "I1a1");
        assert_eq!(result.subclade.as_deref(), Some("DF29"));
    }

    #[test]
    fn test_parse_ydna_na() {
        let html = r#"<strong>y-DNA Test</strong>: N/A<br>"#;
        assert!(parse_ydna(html).is_none());
    }
}
