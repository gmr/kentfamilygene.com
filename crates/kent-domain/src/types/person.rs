use async_graphql::{ComplexObject, Context, SimpleObject};
use kent_db::Neo4jGraph as Graph;

use super::{AdminNote, LineageAssignment, PersonRelationship, SpouseRelationship};

#[derive(SimpleObject, Debug, Clone)]
#[graphql(complex)]
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

#[ComplexObject]
impl Person {
    async fn parents(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<PersonRelationship>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_parents_of(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(p, rel_type)| PersonRelationship {
                person: Person::from(p),
                relationship_type: rel_type,
            })
            .collect())
    }

    async fn children(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Person>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_children_of(graph, &self.id).await?;
        Ok(rows.into_iter().map(Person::from).collect())
    }

    async fn spouses(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<SpouseRelationship>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_spouses_of(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(
                |(spouse, marriage_date, marriage_place, marriage_order, spouse_surname)| {
                    SpouseRelationship {
                        spouse: Person::from(spouse),
                        marriage_date,
                        marriage_place,
                        marriage_order: marriage_order.and_then(|n| i32::try_from(n).ok()),
                        spouse_surname,
                    }
                },
            )
            .collect())
    }

    async fn lineage_assignments(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Vec<LineageAssignment>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_lineages_of_person(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(l, role, gen_num, certainty)| {
                use super::Lineage;
                LineageAssignment {
                    lineage: Lineage::from(l),
                    role,
                    generation_number: gen_num.and_then(|n| i32::try_from(n).ok()),
                    certainty,
                }
            })
            .collect())
    }

    async fn admin_notes(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<AdminNote>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_admin_notes_for_entity(graph, &self.id).await?;
        Ok(rows.into_iter().map(AdminNote::from).collect())
    }
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
