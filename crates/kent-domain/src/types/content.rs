use async_graphql::SimpleObject;

/// An editable standalone page, addressed publicly by slug.
#[derive(SimpleObject, Debug, Clone)]
pub struct Page {
    pub id: String,
    pub slug: String,
    pub title: String,
    /// Markdown source.
    pub body: String,
    pub summary: Option<String>,
    pub is_published: bool,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

impl From<kent_db::PageRow> for Page {
    fn from(row: kent_db::PageRow) -> Self {
        Self {
            id: row.id,
            slug: row.slug,
            title: row.title,
            body: row.body,
            summary: row.summary,
            is_published: row.is_published,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}

/// A reusable block of copy referenced by key from the frontend.
#[derive(SimpleObject, Debug, Clone)]
pub struct Snippet {
    pub id: String,
    pub key: String,
    pub title: Option<String>,
    /// Markdown source.
    pub body: String,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

impl From<kent_db::SnippetRow> for Snippet {
    fn from(row: kent_db::SnippetRow) -> Self {
        Self {
            id: row.id,
            key: row.key,
            title: row.title,
            body: row.body,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}

/// A managed link in the header nav or a footer column.
#[derive(SimpleObject, Debug, Clone)]
pub struct NavItem {
    pub id: String,
    /// "header" or "footer".
    pub location: String,
    /// Footer column heading; unused for header items.
    pub group_label: Option<String>,
    pub label: String,
    /// Internal path ("/lineages", "/about") or absolute URL.
    pub target: String,
    pub sort_order: i32,
}

impl From<kent_db::NavItemRow> for NavItem {
    fn from(row: kent_db::NavItemRow) -> Self {
        Self {
            id: row.id,
            location: row.location,
            group_label: row.group_label,
            label: row.label,
            target: row.target,
            sort_order: row.sort_order as i32,
        }
    }
}
