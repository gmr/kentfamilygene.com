use async_graphql::SimpleObject;

#[derive(SimpleObject, Debug, Clone)]
pub struct Person {
    pub id: String,
    pub given_name: String,
    pub surname: String,
    pub name_suffix: Option<String>,
    pub name_prefix: Option<String>,
    pub name_qualifier: Option<String>,
    pub sex: Option<String>,
    pub birth_date: Option<String>,
    pub birth_date_sort: Option<String>,
    pub birth_date_modifier: Option<String>,
    pub birth_place: Option<String>,
    pub death_date: Option<String>,
    pub death_date_sort: Option<String>,
    pub death_date_modifier: Option<String>,
    pub death_place: Option<String>,
    pub is_living: bool,
    pub privacy_label: Option<String>,
    pub is_immigrant_ancestor: bool,
    pub notes: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

impl From<kent_db::PersonRow> for Person {
    fn from(row: kent_db::PersonRow) -> Self {
        Self {
            id: row.id,
            given_name: row.given_name,
            surname: row.surname,
            name_suffix: row.name_suffix,
            name_prefix: row.name_prefix,
            name_qualifier: row.name_qualifier,
            sex: row.sex,
            birth_date: row.birth_date,
            birth_date_sort: row.birth_date_sort,
            birth_date_modifier: row.birth_date_modifier,
            birth_place: row.birth_place,
            death_date: row.death_date,
            death_date_sort: row.death_date_sort,
            death_date_modifier: row.death_date_modifier,
            death_place: row.death_place,
            is_living: row.is_living,
            privacy_label: row.privacy_label,
            is_immigrant_ancestor: row.is_immigrant_ancestor,
            notes: row.notes,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}
