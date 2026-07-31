use async_graphql::{ComplexObject, Context, SimpleObject};
use kent_db::Neo4jGraph as Graph;

use super::{Haplogroup, LineagePerson, MigrationStop, Participant, Person, Place};
use crate::privacy;

#[derive(SimpleObject, Debug, Clone)]
#[graphql(complex)]
pub struct Lineage {
    pub id: String,
    pub origin_state: Option<String>,
    pub lineage_number: Option<i32>,
    pub display_name: String,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: bool,
    pub new_lineage_date: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

#[ComplexObject]
impl Lineage {
    /// Ordered migration path (places this lineage moved through).
    async fn migration_stops(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Vec<MigrationStop>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_migration_stops_of_lineage(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(place, stop_order, role)| MigrationStop {
                place: Place::from(place),
                stop_order: i32::try_from(stop_order).ok(),
                role,
            })
            .collect())
    }

    /// Documented ancestors assigned to this lineage (privacy-masked for public).
    async fn assigned_persons(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Vec<LineagePerson>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_persons_of_lineage(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(p, role, generation, certainty)| {
                let mut person = Person::from(p);
                privacy::mask_person_for_ctx(ctx, &mut person);
                LineagePerson {
                    person,
                    role,
                    generation_number: generation.and_then(|n| i32::try_from(n).ok()),
                    certainty,
                }
            })
            .collect())
    }

    /// The earliest documented ancestor (lowest generation) — the "brick wall".
    async fn brick_wall_ancestor(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Option<Person>> {
        let graph = ctx.data::<Graph>()?;
        // find_persons_of_lineage is ordered by generation ascending.
        let rows = kent_db::relationship::find_persons_of_lineage(graph, &self.id).await?;
        Ok(rows.into_iter().next().map(|(p, _, _, _)| {
            let mut person = Person::from(p);
            privacy::mask_person_for_ctx(ctx, &mut person);
            person
        }))
    }

    /// Project members / researchers who research this lineage (PII-masked for public).
    async fn participants(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Participant>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_participants_of_lineage(graph, &self.id).await?;
        let mut participants: Vec<Participant> = rows
            .into_iter()
            .map(|(p, _branch)| Participant::from(p))
            .collect();
        privacy::mask_participants_for_ctx(ctx, &mut participants);
        Ok(participants)
    }

    /// Number of participants researching this lineage.
    async fn participant_count(&self, ctx: &Context<'_>) -> async_graphql::Result<i32> {
        let graph = ctx.data::<Graph>()?;
        let total = kent_db::relationship::count_participants_of_lineage(graph, &self.id).await?;
        Ok(i32::try_from(total).unwrap_or(i32::MAX))
    }

    /// Distinct haplogroups across this lineage's participants.
    async fn haplogroups(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Haplogroup>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_haplogroups_of_lineage(graph, &self.id).await?;
        Ok(rows.into_iter().map(Haplogroup::from).collect())
    }

    /// True when at least one participant has a Y-DNA test confirming this line.
    async fn has_y_dna_participant(&self, ctx: &Context<'_>) -> async_graphql::Result<bool> {
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::lineage_has_ydna_participant(graph, &self.id).await?)
    }
}

impl From<kent_db::LineageRow> for Lineage {
    fn from(row: kent_db::LineageRow) -> Self {
        Self {
            id: row.id,
            origin_state: row.origin_state,
            lineage_number: row.lineage_number.and_then(|n| i32::try_from(n).ok()),
            display_name: row.display_name,
            region: row.region,
            status_note: row.status_note,
            is_new: row.is_new,
            new_lineage_date: row.new_lineage_date,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}
