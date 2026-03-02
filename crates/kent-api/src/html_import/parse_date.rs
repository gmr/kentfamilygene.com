use regex::Regex;
use std::sync::LazyLock;

use super::types::ParsedDate;

static MONTH_MAP: LazyLock<std::collections::HashMap<&'static str, &'static str>> =
    LazyLock::new(|| {
        let mut m = std::collections::HashMap::new();
        m.insert("jan", "01");
        m.insert("feb", "02");
        m.insert("mar", "03");
        m.insert("apr", "04");
        m.insert("may", "05");
        m.insert("jun", "06");
        m.insert("jul", "07");
        m.insert("aug", "08");
        m.insert("sep", "09");
        m.insert("oct", "10");
        m.insert("nov", "11");
        m.insert("dec", "12");
        // Long month names
        m.insert("january", "01");
        m.insert("february", "02");
        m.insert("march", "03");
        m.insert("april", "04");
        m.insert("june", "06");
        m.insert("july", "07");
        m.insert("august", "08");
        m.insert("september", "09");
        m.insert("october", "10");
        m.insert("november", "11");
        m.insert("december", "12");
        m
    });

// Modifier prefix regex
static MODIFIER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(ca\.?|abt\.?|about|bef\.?|before|aft\.?|after|prob\.?\s*bet\.?|probably\s*between)\s+")
        .unwrap()
});

// "c" prefix directly before digits: "c1750", "c 1750"
static C_PREFIX_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(?i)^c\.?\s*(\d)").unwrap());

// Dual-year: e.g. 1527/28 or 1737/8
static DUAL_YEAR_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(\d{4})/(\d{1,2})$").unwrap());

// Full date: DD Mon YYYY or DD Month YYYY
static FULL_DATE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)(\d{1,2})\s+([A-Za-z]+)\s+(\d{4}(?:/\d{1,2})?)").unwrap());

// Month-year: Mon YYYY or Month YYYY
static MONTH_YEAR_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)^([A-Za-z]+)\s+(\d{4}(?:/\d{1,2})?)$").unwrap());

// Year only: YYYY or YYYY/YY
static YEAR_ONLY_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^(\d{4}(?:/\d{1,2})?)$").unwrap());

// Range date: prob. bet. YYYY - YYYY
static RANGE_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(\d{4})\s*[-–]\s*(\d{4})").unwrap());

/// Parse a genealogical date string into a structured form.
/// Returns None if the input is empty or unparseable.
pub fn parse_date(input: &str) -> Option<ParsedDate> {
    let input = input.trim();
    if input.is_empty() || input == "(-?-)" || input == "[Unknown]" {
        return None;
    }

    let mut modifier: Option<String> = None;
    let mut remaining = input.to_string();

    // Extract modifier prefix
    if let Some(caps) = MODIFIER_RE.captures(&remaining) {
        let prefix = caps.get(1).unwrap().as_str().to_lowercase();
        modifier = Some(normalize_modifier(&prefix));
        remaining = remaining[caps.get(0).unwrap().end()..].trim().to_string();
    } else if C_PREFIX_RE.is_match(&remaining) {
        // Handle "c1750" or "c 1750" — strip the "c" prefix
        modifier = Some("circa".to_string());
        remaining = remaining
            .trim_start_matches(['c', 'C', '.'])
            .trim()
            .to_string();
    }

    // Handle range dates (prob. bet. YYYY - YYYY): use first year
    if let Some(caps) = RANGE_RE.captures(&remaining) {
        let year1 = caps.get(1).unwrap().as_str();
        return Some(ParsedDate {
            display: input.to_string(),
            sort_key: format!("{year1}-01-01"),
            modifier,
        });
    }

    // Try full date: DD Mon YYYY
    if let Some(caps) = FULL_DATE_RE.captures(&remaining) {
        let day: u32 = caps.get(1).unwrap().as_str().parse().ok()?;
        let month_str = caps.get(2).unwrap().as_str().to_lowercase();
        let year_raw = caps.get(3).unwrap().as_str();
        let month = MONTH_MAP.get(month_str.as_str())?;
        let year = resolve_dual_year(year_raw);
        return Some(ParsedDate {
            display: input.to_string(),
            sort_key: format!("{year}-{month}-{day:02}"),
            modifier,
        });
    }

    // Try month-year: Mon YYYY
    if let Some(caps) = MONTH_YEAR_RE.captures(&remaining) {
        let month_str = caps.get(1).unwrap().as_str().to_lowercase();
        let year_raw = caps.get(2).unwrap().as_str();
        if let Some(month) = MONTH_MAP.get(month_str.as_str()) {
            let year = resolve_dual_year(year_raw);
            return Some(ParsedDate {
                display: input.to_string(),
                sort_key: format!("{year}-{month}-01"),
                modifier,
            });
        }
    }

    // Try year only: YYYY
    if let Some(caps) = YEAR_ONLY_RE.captures(&remaining) {
        let year_raw = caps.get(1).unwrap().as_str();
        let year = resolve_dual_year(year_raw);
        return Some(ParsedDate {
            display: input.to_string(),
            sort_key: format!("{year}-01-01"),
            modifier,
        });
    }

    // Fallback: try to find a 4-digit year anywhere
    let year_fallback = Regex::new(r"(\d{4})").unwrap();
    if let Some(caps) = year_fallback.captures(&remaining) {
        let year = caps.get(1).unwrap().as_str();
        return Some(ParsedDate {
            display: input.to_string(),
            sort_key: format!("{year}-01-01"),
            modifier,
        });
    }

    None
}

/// Resolve dual-year notation (e.g., 1527/28 -> 1528, 1737/8 -> 1738).
fn resolve_dual_year(raw: &str) -> String {
    if let Some(caps) = DUAL_YEAR_RE.captures(raw) {
        let base = caps.get(1).unwrap().as_str();
        let suffix = caps.get(2).unwrap().as_str();
        // Replace the last N digits of base with the suffix
        let prefix_len = base.len() - suffix.len();
        format!("{}{suffix}", &base[..prefix_len])
    } else {
        raw.to_string()
    }
}

fn normalize_modifier(prefix: &str) -> String {
    let p = prefix.trim_end_matches('.');
    match p {
        "ca" | "c" => "circa".to_string(),
        "abt" | "about" => "about".to_string(),
        "bef" | "before" => "before".to_string(),
        "aft" | "after" => "after".to_string(),
        _ if p.contains("bet") => "probably_between".to_string(),
        _ => p.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_year_only() {
        let d = parse_date("1762").unwrap();
        assert_eq!(d.sort_key, "1762-01-01");
        assert_eq!(d.modifier, None);
    }

    #[test]
    fn test_full_date() {
        let d = parse_date("21 Jan 1851").unwrap();
        assert_eq!(d.sort_key, "1851-01-21");
        assert_eq!(d.modifier, None);
    }

    #[test]
    fn test_circa() {
        let d = parse_date("ca 1480").unwrap();
        assert_eq!(d.sort_key, "1480-01-01");
        assert_eq!(d.modifier.as_deref(), Some("circa"));
    }

    #[test]
    fn test_about() {
        let d = parse_date("abt. 1694").unwrap();
        assert_eq!(d.sort_key, "1694-01-01");
        assert_eq!(d.modifier.as_deref(), Some("about"));
    }

    #[test]
    fn test_about_alternate() {
        let d = parse_date("abt 1856").unwrap();
        assert_eq!(d.sort_key, "1856-01-01");
        assert_eq!(d.modifier.as_deref(), Some("about"));
    }

    #[test]
    fn test_before_full_date() {
        let d = parse_date("bef. 11 Nov 1609").unwrap();
        assert_eq!(d.sort_key, "1609-11-11");
        assert_eq!(d.modifier.as_deref(), Some("before"));
    }

    #[test]
    fn test_after_dual_year() {
        let d = parse_date("aft. 25 Mar 1527/28").unwrap();
        assert_eq!(d.sort_key, "1528-03-25");
        assert_eq!(d.modifier.as_deref(), Some("after"));
    }

    #[test]
    fn test_probably_between() {
        let d = parse_date("prob. bet. 1543 - 1545").unwrap();
        assert_eq!(d.sort_key, "1543-01-01");
        assert_eq!(d.modifier.as_deref(), Some("probably_between"));
    }

    #[test]
    fn test_dual_year_single_digit() {
        let d = parse_date("16 Mar 1737/8").unwrap();
        assert_eq!(d.sort_key, "1738-03-16");
    }

    #[test]
    fn test_dual_year_two_digit() {
        let d = parse_date("02 Feb 1690/91").unwrap();
        assert_eq!(d.sort_key, "1691-02-02");
    }

    #[test]
    fn test_month_year() {
        let d = parse_date("Oct 1818").unwrap();
        assert_eq!(d.sort_key, "1818-10-01");
        assert_eq!(d.modifier, None);
    }

    #[test]
    fn test_long_month() {
        let d = parse_date("15 April 1996").unwrap();
        assert_eq!(d.sort_key, "1996-04-15");
    }

    #[test]
    fn test_june_date() {
        let d = parse_date("09 June 1842").unwrap();
        assert_eq!(d.sort_key, "1842-06-09");
    }

    #[test]
    fn test_empty() {
        assert!(parse_date("").is_none());
    }

    #[test]
    fn test_unknown() {
        assert!(parse_date("(-?-)").is_none());
        assert!(parse_date("[Unknown]").is_none());
    }

    #[test]
    fn test_c_prefix() {
        let d = parse_date("c1750").unwrap();
        assert_eq!(d.sort_key, "1750-01-01");
        assert_eq!(d.modifier.as_deref(), Some("circa"));
    }
}
