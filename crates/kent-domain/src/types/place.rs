use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct Place {
    pub id: String,
    pub name: String,
    pub county: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub familysearch_url: Option<String>,
}

impl From<kent_db::PlaceRow> for Place {
    fn from(row: kent_db::PlaceRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            county: row.county,
            state: row.state,
            country: row.country,
            lat: row.lat,
            lon: row.lon,
            familysearch_url: row.familysearch_url,
        }
    }
}
