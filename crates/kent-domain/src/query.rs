use async_graphql::{Context, Object, SimpleObject};
use kent_db::Neo4jGraph as Graph;

use crate::auth::require_auth;
use crate::privacy;
use crate::types::*;

pub struct QueryRoot;

#[Object]
impl QueryRoot {
    // ── Public queries (no auth, privacy-masked persons) ───────────

    /// List lineages with optional region filter and pagination.
    async fn lineages(
        &self,
        ctx: &Context<'_>,
        region: Option<String>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<LineageConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_lineages(graph, region.as_deref(), offset, limit).await?;

        let items: Vec<Lineage> = rows.into_iter().map(Lineage::from).collect();
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(LineageConnection {
            items,
            total,
            has_more,
        })
    }

    /// Fetch a single lineage by ID.
    async fn lineage(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<Lineage>> {
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_lineage_by_id(graph, &id).await?;
        Ok(row.map(Lineage::from))
    }

    /// List persons with optional surname filter (privacy-masked).
    async fn persons(
        &self,
        ctx: &Context<'_>,
        surname: Option<String>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<PersonConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_persons(graph, surname.as_deref(), offset, limit).await?;

        let mut items: Vec<Person> = rows.into_iter().map(Person::from).collect();
        privacy::mask_persons(&mut items);
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(PersonConnection {
            items,
            total,
            has_more,
        })
    }

    /// Fetch a single person by ID (privacy-masked).
    async fn person(&self, ctx: &Context<'_>, id: String) -> async_graphql::Result<Option<Person>> {
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_person_by_id(graph, &id).await?;
        Ok(row.map(|r| {
            let mut p = Person::from(r);
            privacy::mask_person(&mut p);
            p
        }))
    }

    /// List participants with optional active filter.
    async fn participants(
        &self,
        ctx: &Context<'_>,
        active_only: Option<bool>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<ParticipantConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_participants(graph, active_only, offset, limit).await?;

        let mut items: Vec<Participant> = rows.into_iter().map(Participant::from).collect();
        privacy::mask_participants(&mut items);
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(ParticipantConnection {
            items,
            total,
            has_more,
        })
    }

    /// Fetch a single participant by ID (email masked for public).
    async fn participant(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<Participant>> {
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_participant_by_id(graph, &id).await?;
        Ok(row.map(|r| {
            let mut p = Participant::from(r);
            privacy::mask_participant(&mut p);
            p
        }))
    }

    /// List haplogroups.
    async fn haplogroups(
        &self,
        ctx: &Context<'_>,
        haplogroup_type: Option<String>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<HaplogroupConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_haplogroups(graph, haplogroup_type.as_deref(), offset, limit).await?;

        let items: Vec<Haplogroup> = rows.into_iter().map(Haplogroup::from).collect();
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(HaplogroupConnection {
            items,
            total,
            has_more,
        })
    }

    /// List places.
    async fn places(
        &self,
        ctx: &Context<'_>,
        country: Option<String>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<PlaceConnection> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_places(graph, country.as_deref(), offset, limit).await?;

        let items: Vec<Place> = rows.into_iter().map(Place::from).collect();
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(PlaceConnection {
            items,
            total,
            has_more,
        })
    }

    /// Full-text search across entities.
    async fn search(
        &self,
        ctx: &Context<'_>,
        query: String,
        types: Option<Vec<SearchType>>,
        #[graphql(default = 20)] limit: i32,
    ) -> async_graphql::Result<SearchResponse> {
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 100) as i64;

        let type_strs: Option<Vec<String>> =
            types.map(|ts| ts.iter().map(|t| t.to_string()).collect());
        let type_refs: Option<Vec<&str>> = type_strs
            .as_ref()
            .map(|ts| ts.iter().map(|s| s.as_str()).collect());

        let results =
            kent_db::search::search_all(graph, &query, type_refs.as_deref(), limit).await?;

        let items = results
            .into_iter()
            .map(|r| SearchResultItem {
                id: r.id,
                result_type: r.result_type,
                display: r.display,
                score: r.score,
            })
            .collect();

        Ok(SearchResponse { items })
    }

    /// Aggregate stats.
    async fn stats(&self, ctx: &Context<'_>) -> async_graphql::Result<Stats> {
        let graph = ctx.data::<Graph>()?;
        let s = kent_db::search::get_stats(graph).await?;
        Ok(Stats {
            lineage_count: s.lineage_count as i32,
            person_count: s.person_count as i32,
            participant_count: s.participant_count as i32,
            haplogroup_count: s.haplogroup_count as i32,
            place_count: s.place_count as i32,
        })
    }

    // ── Admin queries (auth required, unmasked data) ───────────────

    /// Fetch a single person by ID (admin, unmasked).
    async fn admin_person(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<Person>> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_person_by_id(graph, &id).await?;
        Ok(row.map(Person::from))
    }

    /// Fetch a single participant by ID (admin, unmasked).
    async fn admin_participant(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<Option<Participant>> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::find_participant_by_id(graph, &id).await?;
        Ok(row.map(Participant::from))
    }

    /// List admin notes.
    async fn admin_notes(
        &self,
        ctx: &Context<'_>,
        color: Option<String>,
        resolved: Option<bool>,
        #[graphql(default = 0)] offset: i32,
        #[graphql(default = 50)] limit: i32,
    ) -> async_graphql::Result<AdminNoteConnection> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let limit = limit.clamp(1, 200) as i64;
        let offset = offset.max(0) as i64;

        let (rows, total) =
            kent_db::find_all_admin_notes(graph, color.as_deref(), resolved, offset, limit).await?;

        let items: Vec<AdminNote> = rows.into_iter().map(AdminNote::from).collect();
        let total = total as i32;
        let has_more = (offset + limit) < total as i64;

        Ok(AdminNoteConnection {
            items,
            total,
            has_more,
        })
    }
}

#[derive(SimpleObject, Debug)]
pub struct SearchResultItem {
    pub id: String,
    pub result_type: String,
    pub display: String,
    pub score: f64,
}

#[derive(SimpleObject, Debug)]
pub struct SearchResponse {
    pub items: Vec<SearchResultItem>,
}

#[derive(SimpleObject, Debug)]
pub struct Stats {
    pub lineage_count: i32,
    pub person_count: i32,
    pub participant_count: i32,
    pub haplogroup_count: i32,
    pub place_count: i32,
}
