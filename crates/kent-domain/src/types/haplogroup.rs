use async_graphql::{ComplexObject, Context, SimpleObject};
use kent_db::Neo4jGraph as Graph;

use super::Participant;
use crate::privacy;

#[derive(SimpleObject, Debug, Clone)]
#[graphql(complex)]
pub struct Haplogroup {
    pub id: String,
    pub name: String,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    pub haplogroup_type: Option<String>,
}

#[ComplexObject]
impl Haplogroup {
    /// Participants assigned this haplogroup (PII-masked for public).
    async fn participants(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Participant>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_participants_of_haplogroup(graph, &self.id).await?;
        let mut participants: Vec<Participant> = rows.into_iter().map(Participant::from).collect();
        privacy::mask_participants_for_ctx(ctx, &mut participants);
        Ok(participants)
    }

    /// Number of participants assigned this haplogroup.
    async fn participant_count(&self, ctx: &Context<'_>) -> async_graphql::Result<i32> {
        let graph = ctx.data::<Graph>()?;
        let total =
            kent_db::relationship::count_participants_of_haplogroup(graph, &self.id).await?;
        Ok(i32::try_from(total).unwrap_or(i32::MAX))
    }
}

impl From<kent_db::HaplogroupRow> for Haplogroup {
    fn from(row: kent_db::HaplogroupRow) -> Self {
        Self {
            id: row.id,
            name: row.name,
            subclade: row.subclade,
            abbreviation: row.abbreviation,
            confirmation_status: row.confirmation_status,
            haplogroup_type: row.haplogroup_type,
        }
    }
}
