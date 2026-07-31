use regex::Regex;
use scraper::{ElementRef, Selector};
use std::sync::LazyLock;

use super::parse_date;
use super::types::*;

/// Known role prefixes that indicate a privacy label when inside brackets.
/// Ordered longest-first so "Great-Grandfather" matches before "Father".
static PRIVACY_ROLE_PREFIXES: &[&str] = &[
    "2nd Great-Grandmother",
    "2nd Great-Grandfather",
    "2nd Great-Grandparent",
    "Great-Grandmother",
    "Great-Grandfather",
    "Great-Grandparent",
    "Grandmother",
    "Grandfather",
    "Grandparent",
    "Associate Researcher",
    "y-DNA Participant",
    "y-DNAParticipant",
    "yDNA Participant",
    "Participant/Researcher",
    "Researcher & Participant",
    "Participant & Researcher",
    "Participant",
    "Researcher",
    "Father",
    "Mother",
    "Parent",
    "Nephew",
    "Unknown",
    "-Unknown-",
    "-?-",
    "Project Member",
];

/// Collapse the source's spelling variants onto one label per role. The source
/// uses "y-DNA Participant", "yDNA Participant" and "y-DNAParticipant" for the
/// same thing, which otherwise become three distinct labels in the graph.
fn canonical_privacy_label(prefix: &str) -> &str {
    match prefix {
        "y-DNAParticipant" | "yDNA Participant" => "y-DNA Participant",
        "Participant/Researcher" | "Researcher & Participant" => "Participant & Researcher",
        "-Unknown-" | "-?-" => "Unknown",
        other => other,
    }
}

/// Detect if a `<strong>` name text is a privacy label (role placeholder).
/// Returns `Some(label)` if it is, `None` if it's a real name.
fn detect_privacy_label(raw_name: &str) -> Option<String> {
    let trimmed = raw_name.trim();
    if !trimmed.starts_with('[') {
        return None;
    }

    // Qualifier prefixes that appear before a real name: [prob.] Joan, [Honorable] John, [Alex?] Kent
    // These have a closing ']' followed by more alphabetic text (the real person name).
    if let Some(close_pos) = trimmed.find(']') {
        let after_close = trimmed[close_pos + 1..].trim();
        if !after_close.is_empty() && after_close.chars().next().unwrap().is_alphabetic() {
            return None;
        }
    }

    // Strip leading '[', then an optional project-name qualifier: the source
    // writes both "[Grandfather]" and "[Kent Grandfather]" for the same role.
    let inner = trimmed.trim_start_matches('[');
    let inner = inner.strip_prefix("Kent ").unwrap_or(inner);

    for prefix in PRIVACY_ROLE_PREFIXES {
        if inner.starts_with(prefix) {
            return Some(canonical_privacy_label(prefix).to_string());
        }
    }

    None
}

// Name prefix pattern (titles)
static NAME_PREFIX_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^\(((?:Sergeant|Captain|Colonel|Rev\.|Dr\.|Sir|Sieur|Deacon|Elder|Major|Corporal|Lieutenant|Pvt\.|Sgt\.))\)\s*").unwrap()
});

// Name suffix pattern
static NAME_SUFFIX_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r",?\s+(Sr\.|Jr\.|I{1,3}|IV|V|Esq\.)$").unwrap());

// Numbered spouse pattern: "1) Name; 2) Name"
static NUMBERED_SPOUSE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d+)\)\s*([^;]+)").unwrap());

/// Parse a single `<li>` element into a ParsedAncestorEntry.
pub fn parse_li_entry(li: &ElementRef, _warnings: &mut Vec<String>) -> Option<ParsedAncestorEntry> {
    let generation_number = li
        .value()
        .attr("value")
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0);

    // Get the person name from <strong>
    let strong_sel = Selector::parse("strong").unwrap();
    let name_strong = li.select(&strong_sel).next()?;
    let raw_name = name_strong.text().collect::<String>();
    let raw_name = raw_name.trim();

    // Check for privacy labels (bracket-enclosed role placeholders)
    if let Some(privacy_label) = detect_privacy_label(raw_name) {
        // Labels are already canonicalized, so the variant spellings are gone.
        let is_participant_self = matches!(
            privacy_label.as_str(),
            "y-DNA Participant"
                | "Participant"
                | "Participant & Researcher"
                | "Associate Researcher"
                | "Researcher"
                | "Nephew"
                | "Project Member"
        );
        return Some(ParsedAncestorEntry {
            generation_number,
            person: ParsedPerson {
                given_name: String::new(),
                surname: String::new(),
                name_suffix: None,
                name_prefix: None,
                sex: infer_sex_from_label(&privacy_label),
                birth_date: None,
                birth_date_sort: None,
                birth_date_modifier: None,
                birth_place: None,
                death_date: None,
                death_date_sort: None,
                death_date_modifier: None,
                death_place: None,
                is_living: is_participant_self
                    || privacy_label == "Father"
                    || privacy_label == "Mother"
                    || privacy_label == "Parent",
                is_immigrant_ancestor: false,
                spouses: vec![],
                notes: None,
                common_ancestor_gen: None,
            },
            is_participant_self,
            privacy_label: Some(privacy_label),
        });
    }

    // Get the full text of the li for bio parsing
    let full_text = li.text().collect::<String>();
    let full_text = html_escape::decode_html_entities(&full_text).to_string();

    // Also check for underlined spouse names
    let spouse_names_from_html = extract_underlined_spouse_names(li);

    // Remove the name portion and parse the bio text
    let bio_start = full_text
        .find(raw_name)
        .map(|p| p + raw_name.len())
        .unwrap_or(0);
    let bio_text = full_text[bio_start..].trim_start_matches(',').trim();

    let mut person = parse_person_from_text(raw_name, bio_text);

    // Merge underlined spouse names if we found them and they're in ALL CAPS
    for (i, spouse) in person.spouses.iter_mut().enumerate() {
        if let Some(underlined) = spouse_names_from_html.get(i) {
            // If the current surname is ALL CAPS, keep it. Otherwise use underlined name.
            if spouse.given_name.is_none() && !underlined.is_empty() {
                let parts: Vec<&str> = underlined.rsplitn(2, ' ').collect();
                if parts.len() == 2 {
                    spouse.given_name = Some(parts[1].to_string());
                    spouse.surname = parts[0].to_string();
                } else {
                    spouse.surname = underlined.clone();
                }
            }
        }
    }

    Some(ParsedAncestorEntry {
        generation_number,
        person,
        is_participant_self: false,
        privacy_label: None,
    })
}

/// Extract spouse names from <span style="text-decoration: underline"> elements.
fn extract_underlined_spouse_names(li: &ElementRef) -> Vec<String> {
    let span_sel = Selector::parse("span").unwrap();
    let mut names = Vec::new();

    for span in li.select(&span_sel) {
        let style = span.value().attr("style").unwrap_or("");
        if style.contains("underline") {
            let text = span.text().collect::<String>();
            let text = text.trim();
            if !text.is_empty()
                && !text.contains("KENT ANCESTRY")
                && !text.contains("BRICK WALL")
                && !text.contains("RESEARCH GOAL")
            {
                names.push(text.to_string());
            }
        }
    }

    names
}

/// Parse a person from their name and bio text.
/// This is used both for <li> entries and for common ancestor lines.
pub fn parse_person_from_text(raw_name: &str, bio_text: &str) -> ParsedPerson {
    let raw_name = raw_name.trim();

    // Handle "[-?-] Kent" pattern
    if raw_name.contains("[-?-]") {
        let surname = raw_name.replace("[-?-]", "").trim().to_string();
        let mut person = parse_bio_text(bio_text);
        person.surname = surname;
        person.given_name = String::new();
        person.notes = Some(match person.notes {
            Some(existing) => format!("Unknown given name\n\n{existing}"),
            None => "Unknown given name".to_string(),
        });
        return person;
    }

    // Extract name prefix (title in parens)
    let mut name = raw_name.to_string();
    let mut name_prefix = None;
    if let Some(caps) = NAME_PREFIX_RE.captures(&name) {
        name_prefix = Some(caps.get(1).unwrap().as_str().to_string());
        name = name[caps.get(0).unwrap().end()..].to_string();
    }

    // Also handle prefix without parens: "Sergeant Samuel Kent"
    let title_prefixes = [
        "Sergeant ",
        "Captain ",
        "Colonel ",
        "Rev. ",
        "Dr. ",
        "Sir ",
        "Sieur ",
        "Deacon ",
        "Elder ",
        "Major ",
        "Corporal ",
        "Lieutenant ",
        "Pvt. ",
        "Sgt. ",
    ];
    for prefix in &title_prefixes {
        if name.starts_with(prefix) {
            name_prefix = Some(prefix.trim().to_string());
            name = name[prefix.len()..].to_string();
            break;
        }
    }

    // Extract name suffix
    let mut name_suffix = None;
    if let Some(caps) = NAME_SUFFIX_RE.captures(&name) {
        name_suffix = Some(caps.get(1).unwrap().as_str().to_string());
        name = name[..caps.get(0).unwrap().start()].to_string();
    }

    // Split name into given name and surname
    // Handle "Kind/Kint" variant surnames
    let name = name.trim();
    let (given_name, surname) = split_name(name);

    let mut person = parse_bio_text(bio_text);
    person.given_name = given_name;
    person.surname = surname;
    person.name_prefix = name_prefix;
    person.name_suffix = name_suffix;
    person
}

/// Split a full name into given name and surname.
/// Convention: surname is the LAST word (or last ALL-CAPS word group).
fn split_name(name: &str) -> (String, String) {
    let parts: Vec<&str> = name.split_whitespace().collect();
    if parts.is_empty() {
        return (String::new(), String::new());
    }
    if parts.len() == 1 {
        return (parts[0].to_string(), String::new());
    }

    // The surname is the last part
    let surname = parts.last().unwrap().to_string();
    let given = parts[..parts.len() - 1].join(" ");
    (given, surname)
}

/// Markers where a bio stops describing dates/names and turns into free prose.
/// Everything from here on belongs in `person.notes`, not in a name field.
static NOTE_MARKER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(?:^|[\s(\[])\(?\s*(?:note\s*:|family group sheet)").unwrap()
});

/// Split a bio at the first research-note marker. Returns the parseable head
/// and the note tail. Without this the whole paragraph ends up as a name — one
/// imported person carried a 300-character note as their given name.
fn split_trailing_note(text: &str) -> (&str, Option<String>) {
    let Some(mat) = NOTE_MARKER_RE.find(text) else {
        return (text, None);
    };
    let note = text[mat.start()..]
        .trim()
        .trim_start_matches(['(', '['])
        .trim();
    let head = text[..mat.start()].trim();
    if note.is_empty() {
        (head, None)
    } else {
        (head, Some(note.to_string()))
    }
}

/// Parse bio text (the part after the name) into person fields.
fn parse_bio_text(text: &str) -> ParsedPerson {
    let text = text.trim().trim_start_matches(',').trim();
    let (text, trailing_note) = split_trailing_note(text);

    let mut person = ParsedPerson {
        given_name: String::new(),
        surname: String::new(),
        name_suffix: None,
        name_prefix: None,
        sex: None,
        birth_date: None,
        birth_date_sort: None,
        birth_date_modifier: None,
        birth_place: None,
        death_date: None,
        death_date_sort: None,
        death_date_modifier: None,
        death_place: None,
        is_living: false,
        is_immigrant_ancestor: false,
        spouses: vec![],
        notes: None,
        common_ancestor_gen: None,
    };

    if text.is_empty() {
        person.notes = trailing_note;
        return person;
    }

    let mut notes: Vec<String> = Vec::new();

    // Use a state machine to parse: b DATE PLACE d DATE PLACE m SPOUSE
    // Find the positions of b, d, m tokens
    let tokens = find_bio_tokens(text);

    for (i, token) in tokens.iter().enumerate() {
        let end = if i + 1 < tokens.len() {
            tokens[i + 1].match_start
        } else {
            text.len()
        };

        let content = text[token.content_start..end].trim();

        match token.token_type.as_str() {
            "b" => {
                let (date_str, place_str) = split_date_and_place(content);
                if let Some(date_str) = date_str
                    && let Some(parsed) = parse_date::parse_date(&date_str)
                {
                    person.birth_date = Some(parsed.display);
                    person.birth_date_sort = Some(parsed.sort_key);
                    person.birth_date_modifier = parsed.modifier;
                }
                if let Some(place) = place_str {
                    person.birth_place = Some(place);
                }
            }
            "d" => {
                let (date_str, place_str) = split_date_and_place(content);
                if let Some(date_str) = date_str
                    && let Some(parsed) = parse_date::parse_date(&date_str)
                {
                    person.death_date = Some(parsed.display);
                    person.death_date_sort = Some(parsed.sort_key);
                    person.death_date_modifier = parsed.modifier;
                }
                if let Some(place) = place_str {
                    person.death_place = Some(place);
                }
            }
            "m" => {
                person.spouses = parse_spouse_text(content);
            }
            "res" if notes.is_empty() => {
                // Residence — store as note
                notes.push(format!("res. {content}"));
            }
            _ => {}
        }
    }

    // If no tokens found, try to extract just a place after "b" or "in"
    if tokens.is_empty() && !text.is_empty() {
        // Might be just "b New York" or similar without proper tokenization
        if text.starts_with("b ") || text.starts_with("in ") {
            let place = text
                .trim_start_matches("b ")
                .trim_start_matches("in ")
                .trim();
            // Check if it contains a comma and a marriage marker
            if let Some(m_pos) = find_marriage_boundary(place) {
                person.birth_place = Some(place[..m_pos].trim().trim_end_matches(',').to_string());
                let spouse_text = place[m_pos..].trim_start_matches("m ").trim();
                person.spouses = parse_spouse_text(spouse_text);
            } else {
                person.birth_place = Some(place.to_string());
            }
        }
    }

    notes.extend(trailing_note);
    if !notes.is_empty() {
        person.notes = Some(notes.join("\n\n"));
    }

    person
}

/// A bio token with its type, content start, and match start positions.
struct BioToken {
    token_type: String,
    content_start: usize,
    match_start: usize,
}

/// Find bio tokens (b, d, m, res.) and their positions.
fn find_bio_tokens(text: &str) -> Vec<BioToken> {
    let mut tokens = Vec::new();

    // We need to carefully identify standalone 'b', 'd', 'm' tokens
    // that appear as the first thing or after a space
    let re = Regex::new(r"(?:^|\s)(b|d|m|res\.?)\s+").unwrap();

    for mat in re.find_iter(text) {
        let matched = mat.as_str().trim();
        let token = if matched.starts_with("res") {
            "res".to_string()
        } else {
            matched.chars().next().unwrap().to_string()
        };

        tokens.push(BioToken {
            token_type: token,
            content_start: mat.end(),
            match_start: mat.start(),
        });
    }

    tokens
}

/// Regex to detect an ALL-CAPS surname at the end of a place string (e.g., "England Elizabeth HOLLINGDALE")
static TRAILING_SURNAME_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\s[A-Z][a-z]+\s+[A-Z]{3,}$").unwrap());

/// Regex to detect a date embedded in a place (e.g., "England Dec 1797 Kingston")
static EMBEDDED_DATE_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}\s").unwrap()
});

/// Clean a place string by removing common junk patterns.
fn clean_place_string(place: &str) -> Option<String> {
    let cleaned = place
        .trim()
        .trim_matches(',')
        .trim_matches(';')
        .trim_start_matches("at ")
        .trim_start_matches("in ")
        .trim_start_matches("- ")
        .trim_start_matches("(-?-) ")
        .trim_start_matches("(-?-)")
        .trim_end_matches(',')
        .trim_end_matches(';')
        .trim();

    // Reject obvious non-places
    if cleaned.is_empty()
        || cleaned == "(-?-)"
        || cleaned == "-?-"
        || cleaned.starts_with("-?-]")
        || cleaned.starts_with("-Unknown-]")
        || cleaned == "[Unknown]"
        || cleaned == "poss."
        || cleaned == "(-?-) poss."
        || cleaned.starts_with("to ")
        || cleaned.starts_with("m.")
        || cleaned.starts_with("m ")
    {
        return None;
    }

    let mut result = cleaned.to_string();

    // Strip bracketed notes: "Nashville, TN [during Civil War...]" -> "Nashville, TN"
    if let Some(bracket_start) = result.find(" [") {
        let before = result[..bracket_start].trim();
        if !before.is_empty() {
            result = before.to_string();
        }
    }

    // Strip trailing parenthetical notes: "Place (he was drafted...)"
    if let Some(paren_start) = result.find(" (") {
        let after = &result[paren_start + 2..];
        if after.starts_with("he ")
            || after.starts_with("she ")
            || after.starts_with("prob")
            || after.starts_with("possibly")
            || after.starts_with("pursuant")
            || after.starts_with("settled")
            || after.starts_with("through")
            || after.starts_with("during")
        {
            result = result[..paren_start]
                .trim_end_matches(',')
                .trim()
                .to_string();
        }
    }

    // Strip trailing notes: "migrated to...", "settled in..."
    for prefix in &[" migrated ", " settled "] {
        if let Some(pos) = result.find(prefix) {
            result = result[..pos].trim().to_string();
        }
    }

    // Strip leading narrative phrases or junk fragments
    if result.starts_with("as a ")
        || result.starts_with("or ")
        || result.starts_with('-') && result.chars().nth(1).is_some_and(|c| c.is_ascii_digit())
    {
        return None;
    }

    // If an embedded date is found (e.g., "England Dec 1797 Kingston..."),
    // take only the part before the date — the text after is death/marriage info
    if let Some(mat) = EMBEDDED_DATE_RE.find(&result) {
        result = result[..mat.start()].trim().to_string();
    }

    // Strip trailing surname pattern: "England Elizabeth HOLLINGDALE"
    if let Some(mat) = TRAILING_SURNAME_RE.find(&result) {
        result = result[..mat.start()].trim().to_string();
    }

    // Reject strings that start with a state abbreviation jammed against a token
    // e.g., "ILm 1) Phebe..." from malformed source
    let first_chars: String = result.chars().take(3).collect();
    if first_chars.len() == 3
        && first_chars[..2].chars().all(|c| c.is_ascii_uppercase())
        && first_chars
            .chars()
            .nth(2)
            .is_some_and(|c| c == 'm' || c == 'd' || c == 'b')
    {
        return None;
    }

    // Reject if still looks like junk
    result = result.trim_end_matches(',').trim().to_string();
    if result.is_empty() || result.len() > 120 {
        return None;
    }

    Some(result)
}

/// Split a date+place string. Date comes first, place follows.
fn split_date_and_place(text: &str) -> (Option<String>, Option<String>) {
    let text = text
        .trim()
        .trim_start_matches('[')
        .trim_start_matches("prob.")
        .trim_start_matches("(prob.)")
        .trim();

    if text.is_empty()
        || text == "(-?-)"
        || text == "[Unknown]"
        || text == "-?-]"
        || text == "-Unknown-]"
        || text == "(-?-) poss."
    {
        return (None, None);
    }

    // Handle "[When?] Place" or "When?] Place" pattern — unknown date with a place
    let after_when = text
        .strip_prefix("[When?]")
        .or_else(|| text.strip_prefix("When?]"));
    if let Some(rest) = after_when {
        let place = rest.trim().trim_start_matches("in ").trim();
        return (None, clean_place_string(place));
    }

    // Handle "(-?-) at Place" pattern — unknown date with a place
    if let Some(rest) = text.strip_prefix("(-?-)") {
        let place = rest
            .trim()
            .trim_start_matches("at ")
            .trim_start_matches("in ")
            .trim();
        return (None, clean_place_string(place));
    }

    // Try to find where the date ends and the place begins
    // Date patterns end with a year (4 digits, possibly /2 digits)
    let year_re = Regex::new(r"\d{4}(?:/\d{1,2})?").unwrap();

    if let Some(mat) = year_re.find(text) {
        // If what follows starts with a place-like pattern, split here
        let after_year = &text[mat.end()..].trim_start();
        if after_year.is_empty() {
            return (Some(text.to_string()), None);
        }

        // Check if there's a parenthetical after the year (like "(probate)")
        let mut date_end = mat.end();
        let remainder = &text[date_end..];
        if remainder.trim_start().starts_with('(')
            && let Some(close) = remainder.find(')')
        {
            date_end += close + 1;
        }

        let date_str = text[..date_end].trim().to_string();
        let place_str = text[date_end..]
            .trim()
            .trim_start_matches("in ")
            .trim()
            .to_string();

        if place_str.is_empty() {
            (Some(date_str), None)
        } else {
            (Some(date_str), clean_place_string(&place_str))
        }
    } else {
        // No year found — might be just a place
        // Check if it starts with a date modifier
        let date_mods = ["ca", "c", "abt", "bef", "aft", "prob"];
        let first_word = text.split_whitespace().next().unwrap_or("").to_lowercase();
        let first_word_trimmed = first_word.trim_end_matches('.');
        if date_mods.contains(&first_word_trimmed) {
            // Probably a date without a proper year — treat as date
            (Some(text.to_string()), None)
        } else {
            // Just a place — strip "in " prefix and clean
            let place = text.trim_start_matches("in ").trim();
            (None, clean_place_string(place))
        }
    }
}

/// Parse spouse text, handling numbered spouses.
fn parse_spouse_text(text: &str) -> Vec<ParsedSpouse> {
    let text = text.trim();
    if text.is_empty() || text == "(-?-)" {
        return vec![];
    }

    // Check for numbered spouses: "1) Name; 2) Name"
    if text.contains("1)") || text.contains("2)") {
        let mut spouses = Vec::new();
        for caps in NUMBERED_SPOUSE_RE.captures_iter(text) {
            let order: i64 = caps.get(1).unwrap().as_str().parse().unwrap_or(1);
            let name = caps
                .get(2)
                .unwrap()
                .as_str()
                .trim()
                .trim_end_matches(';')
                .trim();
            if let Some(spouse) = parse_single_spouse(name, order) {
                spouses.push(spouse);
            }
        }
        if !spouses.is_empty() {
            return spouses;
        }
    }

    // Single spouse
    if let Some(spouse) = parse_single_spouse(text, 1) {
        vec![spouse]
    } else {
        vec![]
    }
}

fn is_month_token(token: &str) -> bool {
    let t = token
        .trim_matches(|c: char| !c.is_alphabetic())
        .to_lowercase();
    matches!(
        t.as_str(),
        "jan"
            | "january"
            | "feb"
            | "february"
            | "mar"
            | "march"
            | "apr"
            | "april"
            | "may"
            | "jun"
            | "june"
            | "jul"
            | "july"
            | "aug"
            | "august"
            | "sep"
            | "sept"
            | "september"
            | "oct"
            | "october"
            | "nov"
            | "november"
            | "dec"
            | "december"
    )
}

fn is_year_token(token: &str) -> bool {
    let t = token.trim_matches(|c: char| !c.is_ascii_digit() && c != '/');
    let head = t.split('/').next().unwrap_or("");
    head.len() == 4 && head.chars().all(|c| c.is_ascii_digit())
}

fn is_date_modifier_token(token: &str) -> bool {
    let t = token
        .trim_matches(|c: char| !c.is_alphabetic())
        .to_lowercase();
    matches!(
        t.as_str(),
        "abt" | "about" | "ca" | "c" | "bef" | "before" | "aft" | "after" | "prob"
    )
}

fn is_day_token(token: &str) -> bool {
    let t = token.trim_matches(|c: char| !c.is_ascii_digit());
    !t.is_empty() && t.len() <= 2 && t.chars().all(|c| c.is_ascii_digit())
}

/// Split spouse text into the name and the trailing marriage date/place.
///
/// The source writes marriage info inline — "Sarah Plummer, 23 May 1796
/// Thorndon, Suffolk, England" — and nothing used to terminate the name, so
/// the date and place were absorbed into it. Cuts at the first date-like
/// token, backing up over a leading day number or modifier.
fn split_spouse_and_marriage(text: &str) -> (&str, Option<&str>) {
    let tokens: Vec<(usize, &str)> = text
        .split_whitespace()
        .map(|t| (t.as_ptr() as usize - text.as_ptr() as usize, t))
        .collect();

    let Some(first) = tokens
        .iter()
        .position(|(_, t)| is_month_token(t) || is_year_token(t))
    else {
        return (text, None);
    };

    // Walk back over "23" / "abt" so the date starts at its true beginning.
    let mut start = first;
    while start > 0 {
        let prev = tokens[start - 1].1;
        if is_day_token(prev) || is_date_modifier_token(prev) {
            start -= 1;
        } else {
            break;
        }
    }

    let offset = tokens[start].0;
    let name = text[..offset].trim().trim_end_matches(',').trim();
    let marriage = text[offset..].trim();
    (name, Some(marriage))
}

/// Parse a single spouse name.
fn parse_single_spouse(text: &str, order: i64) -> Option<ParsedSpouse> {
    let text = text.trim();
    if text.is_empty() || text == "(-?-)" || text == "Unknown" || text.starts_with("[-?-]") {
        return None;
    }

    // Handle patterns like "Elizabeth (-?-)" (unknown surname)
    if text.ends_with("(-?-)") {
        let given = text.trim_end_matches("(-?-)").trim();
        return Some(ParsedSpouse {
            given_name: if given.is_empty() {
                None
            } else {
                Some(given.to_string())
            },
            surname: "Unknown".to_string(),
            marriage_order: order,
            marriage_date: None,
            marriage_place: None,
        });
    }

    let (text, marriage_text) = split_spouse_and_marriage(text);
    let (marriage_date, marriage_place) = match marriage_text {
        Some(m) => split_date_and_place(m),
        None => (None, None),
    };

    // A separator left behind by a stripped note would become part of the
    // surname ("Epperson;"). Not '.', which is part of "Jr."/"Sr.".
    let text = text.trim_end_matches([';', ',']).trim();

    // Drop a trailing multi-word parenthetical ("Summa (A Widow)") — a
    // one-word one is a maiden name we want to keep ("Margaret (Hill)").
    let text = match text.rfind(" (") {
        Some(pos)
            if text.ends_with(')') && text[pos..].contains(' ') && {
                let inner = &text[pos + 2..text.len() - 1];
                inner.contains(' ')
            } =>
        {
            text[..pos].trim()
        }
        _ => text,
    };

    // Handle "FirstName SURNAME" where surname is ALL CAPS
    // or "FirstName Surname" where surname is the last word
    let parts: Vec<&str> = text.split_whitespace().collect();
    if parts.is_empty() {
        // The text was entirely marriage info. Keep the marriage facts on an
        // anonymous spouse rather than dropping them.
        if marriage_date.is_none() && marriage_place.is_none() {
            return None;
        }
        return Some(ParsedSpouse {
            given_name: None,
            surname: "Unknown".to_string(),
            marriage_order: order,
            marriage_date,
            marriage_place,
        });
    }

    // Find the surname — typically the last ALL CAPS word, or just the last word
    let mut surname_start = parts.len() - 1;
    for (i, part) in parts.iter().enumerate().rev() {
        if is_all_caps(part) && i > 0 {
            surname_start = i;
            break;
        }
    }

    let given_parts = &parts[..surname_start];
    let surname_parts = &parts[surname_start..];

    let given_name = if given_parts.is_empty() {
        None
    } else {
        Some(given_parts.join(" "))
    };

    let surname = surname_parts.join(" ");

    Some(ParsedSpouse {
        given_name,
        surname,
        marriage_order: order,
        marriage_date,
        marriage_place,
    })
}

/// True for an ALL-CAPS *word*. The alphabetic requirement matters: without it
/// a bare year like "1796" has no lowercase letters and passes, so the surname
/// scan in `parse_single_spouse` splits the name at the marriage date.
fn is_all_caps(s: &str) -> bool {
    s.len() > 1
        && s.chars().any(|c| c.is_alphabetic())
        && s.chars().all(|c| c.is_uppercase() || !c.is_alphabetic())
}

/// Find the marriage boundary ("m " that starts marriage info).
fn find_marriage_boundary(text: &str) -> Option<usize> {
    // Find standalone "m " that's preceded by a comma or space
    let re = Regex::new(r"(?:,\s*|\s+)(m\s+)").unwrap();
    re.find(text).map(|m| m.start())
}

fn infer_sex_from_label(label: &str) -> Option<String> {
    // Check for male-gendered role words
    if label.contains("Father") || label.contains("Grandfather") || label == "Nephew" {
        return Some("Male".to_string());
    }
    // Check for female-gendered role words
    if label.contains("Mother") || label.contains("Grandmother") {
        return Some("Female".to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_person_simple() {
        let person = parse_person_from_text(
            "Simeon Kent",
            "b 1762 New Jersey d 21 Jan 1851 Sodus, Wayne, NY m Helen Rebecca ANDERSON",
        );
        assert_eq!(person.given_name, "Simeon");
        assert_eq!(person.surname, "Kent");
        assert_eq!(person.birth_date_sort.as_deref(), Some("1762-01-01"));
        assert_eq!(person.birth_place.as_deref(), Some("New Jersey"));
        assert_eq!(person.death_date_sort.as_deref(), Some("1851-01-21"));
        assert!(person.death_place.as_deref().unwrap().contains("Sodus"));
        assert_eq!(person.spouses.len(), 1);
        assert_eq!(person.spouses[0].surname, "ANDERSON");
    }

    #[test]
    fn test_parse_person_multiple_spouses() {
        let person = parse_person_from_text(
            "Peter Secord Kent",
            "b 18 Mar 1776 Putnam Co., NY d 24 May 1867 Putnam Co., NY m 1) Sarah CROSBY; 2) Experience STEPHENS",
        );
        assert_eq!(person.spouses.len(), 2);
        assert_eq!(person.spouses[0].surname, "CROSBY");
        assert_eq!(person.spouses[0].marriage_order, 1);
        assert_eq!(person.spouses[1].surname, "STEPHENS");
        assert_eq!(person.spouses[1].marriage_order, 2);
    }

    #[test]
    fn test_parse_person_with_prefix() {
        let person = parse_person_from_text(
            "Sieur Ferdinand Josephus Kindt",
            "b 11 Nov 1746 Tielt, Belgium d 29 May 1808 Tielt, Belgium m Regina Barbara DEPLA",
        );
        assert_eq!(person.name_prefix.as_deref(), Some("Sieur"));
        assert_eq!(person.given_name, "Ferdinand Josephus");
        assert_eq!(person.surname, "Kindt");
    }

    #[test]
    fn test_parse_person_with_suffix() {
        let person = parse_person_from_text(
            "Ezra Kent, Jr.",
            "b 26 Sep 1767 Rehoboth, Bristol, MA d 23 Nov 1833 Southwick, Hampden, MA m Mary TRUMBALL",
        );
        assert_eq!(person.name_suffix.as_deref(), Some("Jr."));
        assert_eq!(person.given_name, "Ezra");
        assert_eq!(person.surname, "Kent");
    }

    #[test]
    fn test_parse_person_circa_date() {
        let person = parse_person_from_text(
            "John Kent",
            "b ca 1480 d aft. 25 Mar 1527/28 Nether Wallop, Hampshire, England",
        );
        assert_eq!(person.birth_date_sort.as_deref(), Some("1480-01-01"));
        assert_eq!(person.birth_date_modifier.as_deref(), Some("circa"));
        assert_eq!(person.death_date_sort.as_deref(), Some("1528-03-25"));
        assert_eq!(person.death_date_modifier.as_deref(), Some("after"));
    }

    #[test]
    fn test_parse_person_unknown_given() {
        let person = parse_person_from_text("[-?-] Kent", "b New York, m [-?-] b in New York");
        assert_eq!(person.given_name, "");
        assert_eq!(person.surname, "Kent");
    }

    #[test]
    fn test_parse_person_three_spouses() {
        let person = parse_person_from_text(
            "Frederick Kent",
            "b 10 Jan 1799 Essex Co., NJ d 05 Nov 1886 Whitehouse, Lucas, OH m 1) Unknown; 2) Stella BURK; 3) Angeline ADAMS Bisher",
        );
        // Unknown is filtered out, so we should get 2 or 3 spouses
        assert!(person.spouses.len() >= 2);
    }

    #[test]
    fn test_split_date_and_place() {
        let (date, place) = split_date_and_place("1762 New Jersey");
        assert_eq!(date.as_deref(), Some("1762"));
        assert_eq!(place.as_deref(), Some("New Jersey"));
    }

    #[test]
    fn test_split_date_and_place_full() {
        let (date, place) = split_date_and_place("21 Jan 1851 Sodus, Wayne, NY");
        assert_eq!(date.as_deref(), Some("21 Jan 1851"));
        assert_eq!(place.as_deref(), Some("Sodus, Wayne, NY"));
    }

    // The four rows below are the corrupted records this parser actually
    // produced; each asserts the specific corruption is gone.

    #[test]
    fn test_spouse_marriage_date_and_place_split_off_name() {
        // Was: given_name "Sarah Plummer, 23 May", surname "1796 Thorndon, ..."
        let person = parse_person_from_text(
            "John Kent",
            "b 1770 m Sarah Plummer, 23 May 1796 Thorndon, Mid-Suffolk, Suffolk, England",
        );
        let spouse = &person.spouses[0];
        assert_eq!(spouse.given_name.as_deref(), Some("Sarah"));
        assert_eq!(spouse.surname, "Plummer");
        assert_eq!(spouse.marriage_date.as_deref(), Some("23 May 1796"));
        assert_eq!(
            spouse.marriage_place.as_deref(),
            Some("Thorndon, Mid-Suffolk, Suffolk, England")
        );
    }

    #[test]
    fn test_year_is_not_a_surname() {
        // is_all_caps() used to accept "1796" because it has no lowercase.
        assert!(!is_all_caps("1796"));
        assert!(is_all_caps("ANDERSON"));
        assert!(is_all_caps("O'BRIEN"));
    }

    #[test]
    fn test_research_note_does_not_become_a_name() {
        // Was: a 300-character paragraph stored as given_name.
        let person = parse_person_from_text(
            "Walton Kent",
            "b 1850 m Martha Ann Mattie Irvin Note: Walton Peterson Kent had retained \
             his mother's maiden name of Kent, with a y-DNA subclade of R-P25.",
        );
        let spouse = &person.spouses[0];
        assert_eq!(spouse.given_name.as_deref(), Some("Martha Ann Mattie"));
        assert_eq!(spouse.surname, "Irvin");
        let notes = person.notes.expect("note captured");
        assert!(notes.starts_with("Note:"), "got {notes:?}");
        assert!(notes.contains("R-P25"));
    }

    #[test]
    fn test_family_group_sheet_marker_splits_note() {
        let person = parse_person_from_text(
            "Elijah Boyd",
            "b 1880 m Edith Pearl Epperson; (Family Group Sheet for Elijah Boyd)",
        );
        assert_eq!(person.spouses[0].surname, "Epperson");
        assert!(person.notes.unwrap().contains("Family Group Sheet"));
    }

    #[test]
    fn test_trailing_multiword_parenthetical_dropped() {
        // Was: surname "Summa (A Widow)".
        let person = parse_person_from_text(
            "Samuel Kent",
            "b 1800 m Mrs. Margaret Angeline (Hill) Summa (A Widow)",
        );
        assert_eq!(person.spouses[0].surname, "Summa");
        // A single-word parenthetical is a maiden name and must survive.
        let keeps = parse_person_from_text("Samuel Kent", "b 1800 m Margaret (Hill)");
        assert!(keeps.spouses[0].surname.contains("(Hill)"));
    }

    #[test]
    fn test_privacy_labels_are_canonicalized() {
        for raw in [
            "[yDNA Participant]",
            "[y-DNAParticipant]",
            "[Kent y-DNA Participant]",
        ] {
            assert_eq!(
                detect_privacy_label(raw).as_deref(),
                Some("y-DNA Participant"),
                "{raw}"
            );
        }
        assert_eq!(
            detect_privacy_label("[Kent Great-Grandfather]").as_deref(),
            Some("Great-Grandfather")
        );
        assert_eq!(
            detect_privacy_label("[Kent Parent]").as_deref(),
            Some("Parent")
        );
        // A real name must still not be mistaken for a label.
        assert_eq!(detect_privacy_label("[prob.] Joan Kent"), None);
    }

    #[test]
    fn test_split_date_only() {
        let (date, place) = split_date_and_place("1762");
        assert_eq!(date.as_deref(), Some("1762"));
        assert!(place.is_none());
    }
}
