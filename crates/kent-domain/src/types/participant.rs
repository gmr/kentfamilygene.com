use async_graphql::{ComplexObject, Context, SimpleObject};
use kent_db::Neo4jGraph as Graph;

use super::{
    AdminNote, DnaTest, GeneticMatchEntry, Haplogroup, LineageMembership, OnlineTree, Person,
};

#[derive(SimpleObject, Debug, Clone)]
#[graphql(complex)]
pub struct Participant {
    pub id: String,
    pub display_name: String,
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub is_active: bool,
    pub ftdna_kit_number: Option<String>,
    pub join_date: Option<String>,
    pub contact_note: Option<String>,
    pub research_goal: Option<String>,
    pub created_date: Option<String>,
    pub updated_date: Option<String>,
}

#[ComplexObject]
impl Participant {
    async fn linked_person(&self, ctx: &Context<'_>) -> async_graphql::Result<Option<Person>> {
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::relationship::find_person_for_participant(graph, &self.id).await?;
        Ok(row.map(Person::from))
    }

    async fn dna_tests(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<DnaTest>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::find_dna_tests_by_participant(graph, &self.id).await?;
        Ok(rows.into_iter().map(DnaTest::from).collect())
    }

    async fn online_trees(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<OnlineTree>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::find_online_trees_by_participant(graph, &self.id).await?;
        Ok(rows.into_iter().map(OnlineTree::from).collect())
    }

    async fn haplogroups(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Haplogroup>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_haplogroups_of_participant(graph, &self.id).await?;
        Ok(rows.into_iter().map(Haplogroup::from).collect())
    }

    async fn lineage_memberships(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Vec<LineageMembership>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_lineages_of_participant(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(l, branch_label)| {
                use super::Lineage;
                LineageMembership {
                    lineage: Lineage::from(l),
                    branch_label,
                }
            })
            .collect())
    }

    async fn genetic_matches(
        &self,
        ctx: &Context<'_>,
    ) -> async_graphql::Result<Vec<GeneticMatchEntry>> {
        let graph = ctx.data::<Graph>()?;
        let rows =
            kent_db::relationship::find_genetic_matches_of_participant(graph, &self.id).await?;
        Ok(rows
            .into_iter()
            .map(|(p, marker_level, match_type, notes)| GeneticMatchEntry {
                participant: Participant::from(p),
                marker_level: marker_level.and_then(|n| i32::try_from(n).ok()),
                match_type,
                notes,
            })
            .collect())
    }

    async fn admin_notes(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<AdminNote>> {
        let graph = ctx.data::<Graph>()?;
        let rows = kent_db::relationship::find_admin_notes_for_entity(graph, &self.id).await?;
        Ok(rows.into_iter().map(AdminNote::from).collect())
    }
}

impl From<kent_db::ParticipantRow> for Participant {
    fn from(row: kent_db::ParticipantRow) -> Self {
        Self {
            id: row.id,
            display_name: row.display_name,
            email: row.email,
            membership_type: row.membership_type,
            is_active: row.is_active,
            ftdna_kit_number: row.ftdna_kit_number,
            join_date: row.join_date,
            contact_note: row.contact_note,
            research_goal: row.research_goal,
            created_date: row.created_date,
            updated_date: row.updated_date,
        }
    }
}
