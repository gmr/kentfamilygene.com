use async_graphql::{Context, InputObject, Object};
use kent_db::Neo4jGraph as Graph;
use uuid::Uuid;

use crate::auth::require_auth;
use crate::types::*;

pub struct MutationRoot;

// ── Input types ────────────────────────────────────────────────────

#[derive(InputObject)]
pub struct CreateLineageInput {
    pub origin_state: Option<String>,
    pub lineage_number: Option<i32>,
    pub display_name: String,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: Option<bool>,
    pub new_lineage_date: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateLineageInput {
    pub origin_state: Option<String>,
    pub lineage_number: Option<i32>,
    pub display_name: Option<String>,
    pub region: Option<String>,
    pub status_note: Option<String>,
    pub is_new: Option<bool>,
    pub new_lineage_date: Option<String>,
}

#[derive(InputObject)]
pub struct CreatePersonInput {
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
    pub privacy_label: Option<String>,
    pub is_immigrant_ancestor: Option<bool>,
    pub notes: Option<String>,
}

#[derive(InputObject)]
pub struct UpdatePersonInput {
    pub given_name: Option<String>,
    pub surname: Option<String>,
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
    pub privacy_label: Option<String>,
    pub is_immigrant_ancestor: Option<bool>,
    pub notes: Option<String>,
}

#[derive(InputObject)]
pub struct CreateParticipantInput {
    pub display_name: String,
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub is_active: Option<bool>,
    pub ftdna_kit_number: Option<String>,
    pub join_date: Option<String>,
    pub contact_note: Option<String>,
    pub research_goal: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateParticipantInput {
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub is_active: Option<bool>,
    pub ftdna_kit_number: Option<String>,
    pub join_date: Option<String>,
    pub contact_note: Option<String>,
    pub research_goal: Option<String>,
}

#[derive(InputObject)]
pub struct CreatePlaceInput {
    pub name: String,
    pub county: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub familysearch_url: Option<String>,
}

#[derive(InputObject)]
pub struct UpdatePlaceInput {
    pub name: Option<String>,
    pub county: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub familysearch_url: Option<String>,
}

#[derive(InputObject)]
pub struct CreateHaplogroupInput {
    pub name: String,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    pub haplogroup_type: Option<String>,
}

#[derive(InputObject)]
pub struct UpdateHaplogroupInput {
    pub name: Option<String>,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    pub haplogroup_type: Option<String>,
}

#[derive(InputObject)]
pub struct CreateDnaTestInput {
    pub test_type: Option<String>,
    pub test_name: Option<String>,
    pub provider: Option<String>,
    pub kit_number: Option<String>,
    pub marker_count: Option<i32>,
    pub registered_with_project: Option<bool>,
    pub gedmatch_kit: Option<String>,
}

#[derive(InputObject)]
pub struct CreateOnlineTreeInput {
    pub platform: Option<String>,
    pub username: Option<String>,
    pub tree_name: Option<String>,
    pub url: Option<String>,
}

#[derive(InputObject)]
pub struct BelongsToInput {
    pub role: Option<String>,
    pub generation_number: Option<i32>,
    pub certainty: Option<String>,
}

#[derive(InputObject)]
pub struct SpouseOfInput {
    pub marriage_date: Option<String>,
    pub marriage_place: Option<String>,
    pub marriage_order: Option<i32>,
    pub spouse_surname: Option<String>,
}

#[derive(InputObject)]
pub struct ResearchesInput {
    pub branch_label: Option<String>,
}

#[derive(InputObject)]
pub struct GeneticMatchInput {
    pub marker_level: Option<i32>,
    pub match_type: Option<String>,
    pub notes: Option<String>,
}

#[derive(InputObject)]
pub struct MigrationStopInput {
    pub stop_order: i32,
    pub role: Option<String>,
}

#[derive(InputObject)]
pub struct CreateAdminNoteInput {
    pub color: Option<String>,
    pub text: String,
}

#[derive(InputObject)]
pub struct UpdateAdminNoteInput {
    pub color: Option<String>,
    pub text: Option<String>,
    pub resolved: Option<bool>,
}

fn now_str() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

#[Object]
impl MutationRoot {
    // ── Lineage CRUD ───────────────────────────────────────────────

    async fn create_lineage(
        &self,
        ctx: &Context<'_>,
        input: CreateLineageInput,
    ) -> async_graphql::Result<Lineage> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let now = now_str();
        let row = kent_db::LineageRow {
            id: Uuid::new_v4().to_string(),
            origin_state: input.origin_state,
            lineage_number: input.lineage_number.map(|n| n as i64),
            display_name: input.display_name,
            region: input.region,
            status_note: input.status_note,
            is_new: input.is_new.unwrap_or(false),
            new_lineage_date: input.new_lineage_date,
            created_date: Some(now.clone()),
            updated_date: Some(now),
        };
        let created = kent_db::create_lineage(graph, &row).await?;
        Ok(Lineage::from(created))
    }

    async fn update_lineage(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateLineageInput,
    ) -> async_graphql::Result<Lineage> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_lineage_by_id(graph, &id)
            .await?
            .ok_or("Lineage not found")?;
        let row = kent_db::LineageRow {
            id: id.clone(),
            origin_state: input.origin_state.or(existing.origin_state),
            lineage_number: input
                .lineage_number
                .map(|n| n as i64)
                .or(existing.lineage_number),
            display_name: input.display_name.unwrap_or(existing.display_name),
            region: input.region.or(existing.region),
            status_note: input.status_note.or(existing.status_note),
            is_new: input.is_new.unwrap_or(existing.is_new),
            new_lineage_date: input.new_lineage_date.or(existing.new_lineage_date),
            created_date: existing.created_date,
            updated_date: Some(now_str()),
        };
        let updated = kent_db::update_lineage(graph, &id, &row)
            .await?
            .ok_or("Lineage not found")?;
        Ok(Lineage::from(updated))
    }

    async fn delete_lineage(&self, ctx: &Context<'_>, id: String) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_lineage(graph, &id).await?)
    }

    // ── Person CRUD ────────────────────────────────────────────────

    async fn create_person(
        &self,
        ctx: &Context<'_>,
        input: CreatePersonInput,
    ) -> async_graphql::Result<Person> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let now = now_str();
        let row = kent_db::PersonRow {
            id: Uuid::new_v4().to_string(),
            given_name: input.given_name,
            surname: input.surname,
            name_suffix: input.name_suffix,
            name_prefix: input.name_prefix,
            name_qualifier: input.name_qualifier,
            sex: input.sex,
            birth_date: input.birth_date,
            birth_date_sort: input.birth_date_sort,
            birth_date_modifier: input.birth_date_modifier,
            birth_place: input.birth_place,
            death_date: input.death_date,
            death_date_sort: input.death_date_sort,
            death_date_modifier: input.death_date_modifier,
            death_place: input.death_place,
            is_living: false, // computed by privacy layer
            privacy_label: input.privacy_label,
            is_immigrant_ancestor: input.is_immigrant_ancestor.unwrap_or(false),
            notes: input.notes,
            created_date: Some(now.clone()),
            updated_date: Some(now),
        };
        let created = kent_db::create_person(graph, &row).await?;
        Ok(Person::from(created))
    }

    async fn update_person(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdatePersonInput,
    ) -> async_graphql::Result<Person> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_person_by_id(graph, &id)
            .await?
            .ok_or("Person not found")?;
        let row = kent_db::PersonRow {
            id: id.clone(),
            given_name: input.given_name.unwrap_or(existing.given_name),
            surname: input.surname.unwrap_or(existing.surname),
            name_suffix: input.name_suffix.or(existing.name_suffix),
            name_prefix: input.name_prefix.or(existing.name_prefix),
            name_qualifier: input.name_qualifier.or(existing.name_qualifier),
            sex: input.sex.or(existing.sex),
            birth_date: input.birth_date.or(existing.birth_date),
            birth_date_sort: input.birth_date_sort.or(existing.birth_date_sort),
            birth_date_modifier: input.birth_date_modifier.or(existing.birth_date_modifier),
            birth_place: input.birth_place.or(existing.birth_place),
            death_date: input.death_date.or(existing.death_date),
            death_date_sort: input.death_date_sort.or(existing.death_date_sort),
            death_date_modifier: input.death_date_modifier.or(existing.death_date_modifier),
            death_place: input.death_place.or(existing.death_place),
            is_living: existing.is_living,
            privacy_label: input.privacy_label.or(existing.privacy_label),
            is_immigrant_ancestor: input
                .is_immigrant_ancestor
                .unwrap_or(existing.is_immigrant_ancestor),
            notes: input.notes.or(existing.notes),
            created_date: existing.created_date,
            updated_date: Some(now_str()),
        };
        let updated = kent_db::update_person(graph, &id, &row)
            .await?
            .ok_or("Person not found")?;
        Ok(Person::from(updated))
    }

    async fn delete_person(&self, ctx: &Context<'_>, id: String) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_person(graph, &id).await?)
    }

    // ── Participant CRUD ───────────────────────────────────────────

    async fn create_participant(
        &self,
        ctx: &Context<'_>,
        input: CreateParticipantInput,
    ) -> async_graphql::Result<Participant> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let now = now_str();
        let row = kent_db::ParticipantRow {
            id: Uuid::new_v4().to_string(),
            display_name: input.display_name,
            email: input.email,
            membership_type: input.membership_type,
            is_active: input.is_active.unwrap_or(true),
            ftdna_kit_number: input.ftdna_kit_number,
            join_date: input.join_date,
            contact_note: input.contact_note,
            research_goal: input.research_goal,
            created_date: Some(now.clone()),
            updated_date: Some(now),
        };
        let created = kent_db::create_participant(graph, &row).await?;
        Ok(Participant::from(created))
    }

    async fn update_participant(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateParticipantInput,
    ) -> async_graphql::Result<Participant> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_participant_by_id(graph, &id)
            .await?
            .ok_or("Participant not found")?;
        let row = kent_db::ParticipantRow {
            id: id.clone(),
            display_name: input.display_name.unwrap_or(existing.display_name),
            email: input.email.or(existing.email),
            membership_type: input.membership_type.or(existing.membership_type),
            is_active: input.is_active.unwrap_or(existing.is_active),
            ftdna_kit_number: input.ftdna_kit_number.or(existing.ftdna_kit_number),
            join_date: input.join_date.or(existing.join_date),
            contact_note: input.contact_note.or(existing.contact_note),
            research_goal: input.research_goal.or(existing.research_goal),
            created_date: existing.created_date,
            updated_date: Some(now_str()),
        };
        let updated = kent_db::update_participant(graph, &id, &row)
            .await?
            .ok_or("Participant not found")?;
        Ok(Participant::from(updated))
    }

    async fn delete_participant(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_participant(graph, &id).await?)
    }

    // ── Place CRUD ─────────────────────────────────────────────────

    async fn create_place(
        &self,
        ctx: &Context<'_>,
        input: CreatePlaceInput,
    ) -> async_graphql::Result<Place> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::PlaceRow {
            id: Uuid::new_v4().to_string(),
            name: input.name,
            county: input.county,
            state: input.state,
            country: input.country,
            lat: input.lat,
            lon: input.lon,
            familysearch_url: input.familysearch_url,
        };
        let created = kent_db::create_place(graph, &row).await?;
        Ok(Place::from(created))
    }

    async fn update_place(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdatePlaceInput,
    ) -> async_graphql::Result<Place> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_place_by_id(graph, &id)
            .await?
            .ok_or("Place not found")?;
        let row = kent_db::PlaceRow {
            id: id.clone(),
            name: input.name.unwrap_or(existing.name),
            county: input.county.or(existing.county),
            state: input.state.or(existing.state),
            country: input.country.or(existing.country),
            lat: input.lat.or(existing.lat),
            lon: input.lon.or(existing.lon),
            familysearch_url: input.familysearch_url.or(existing.familysearch_url),
        };
        let updated = kent_db::update_place(graph, &id, &row)
            .await?
            .ok_or("Place not found")?;
        Ok(Place::from(updated))
    }

    async fn delete_place(&self, ctx: &Context<'_>, id: String) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_place(graph, &id).await?)
    }

    // ── Haplogroup CRUD ────────────────────────────────────────────

    async fn create_haplogroup(
        &self,
        ctx: &Context<'_>,
        input: CreateHaplogroupInput,
    ) -> async_graphql::Result<Haplogroup> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::HaplogroupRow {
            id: Uuid::new_v4().to_string(),
            name: input.name,
            subclade: input.subclade,
            abbreviation: input.abbreviation,
            confirmation_status: input.confirmation_status,
            haplogroup_type: input.haplogroup_type,
        };
        let created = kent_db::create_haplogroup(graph, &row).await?;
        Ok(Haplogroup::from(created))
    }

    async fn update_haplogroup(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateHaplogroupInput,
    ) -> async_graphql::Result<Haplogroup> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_haplogroup_by_id(graph, &id)
            .await?
            .ok_or("Haplogroup not found")?;
        let row = kent_db::HaplogroupRow {
            id: id.clone(),
            name: input.name.unwrap_or(existing.name),
            subclade: input.subclade.or(existing.subclade),
            abbreviation: input.abbreviation.or(existing.abbreviation),
            confirmation_status: input.confirmation_status.or(existing.confirmation_status),
            haplogroup_type: input.haplogroup_type.or(existing.haplogroup_type),
        };
        let updated = kent_db::update_haplogroup(graph, &id, &row)
            .await?
            .ok_or("Haplogroup not found")?;
        Ok(Haplogroup::from(updated))
    }

    async fn delete_haplogroup(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_haplogroup(graph, &id).await?)
    }

    // ── Relationship mutations ─────────────────────────────────────

    async fn add_person_to_lineage(
        &self,
        ctx: &Context<'_>,
        person_id: String,
        lineage_id: String,
        input: BelongsToInput,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::add_person_to_lineage(
            graph,
            &person_id,
            &lineage_id,
            input.role.as_deref(),
            input.generation_number.map(|n| n as i64),
            input.certainty.as_deref(),
        )
        .await?)
    }

    async fn remove_person_from_lineage(
        &self,
        ctx: &Context<'_>,
        person_id: String,
        lineage_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::relationship::remove_person_from_lineage(graph, &person_id, &lineage_id)
                .await?,
        )
    }

    async fn set_parent_of(
        &self,
        ctx: &Context<'_>,
        parent_id: String,
        child_id: String,
        relationship_type: Option<String>,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::set_parent_of(
            graph,
            &parent_id,
            &child_id,
            relationship_type.as_deref(),
        )
        .await?)
    }

    async fn remove_parent_of(
        &self,
        ctx: &Context<'_>,
        parent_id: String,
        child_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::remove_parent_of(graph, &parent_id, &child_id).await?)
    }

    async fn set_spouse_of(
        &self,
        ctx: &Context<'_>,
        person1_id: String,
        person2_id: String,
        input: Option<SpouseOfInput>,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let input = input.unwrap_or(SpouseOfInput {
            marriage_date: None,
            marriage_place: None,
            marriage_order: None,
            spouse_surname: None,
        });
        Ok(kent_db::relationship::set_spouse_of(
            graph,
            &person1_id,
            &person2_id,
            input.marriage_date.as_deref(),
            input.marriage_place.as_deref(),
            input.marriage_order.map(|n| n as i64),
            input.spouse_surname.as_deref(),
        )
        .await?)
    }

    async fn remove_spouse_of(
        &self,
        ctx: &Context<'_>,
        person1_id: String,
        person2_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::remove_spouse_of(graph, &person1_id, &person2_id).await?)
    }

    async fn link_participant_to_person(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        person_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::relationship::link_participant_to_person(graph, &participant_id, &person_id)
                .await?,
        )
    }

    async fn unlink_participant_from_person(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::unlink_participant_from_person(graph, &participant_id).await?)
    }

    async fn add_participant_to_lineage(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        lineage_id: String,
        input: ResearchesInput,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::add_participant_to_lineage(
            graph,
            &participant_id,
            &lineage_id,
            input.branch_label.as_deref(),
        )
        .await?)
    }

    async fn remove_participant_from_lineage(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        lineage_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::remove_participant_from_lineage(
            graph,
            &participant_id,
            &lineage_id,
        )
        .await?)
    }

    async fn add_dna_test(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        input: CreateDnaTestInput,
    ) -> async_graphql::Result<DnaTest> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::DnaTestRow {
            id: Uuid::new_v4().to_string(),
            test_type: input.test_type,
            test_name: input.test_name,
            provider: input.provider,
            kit_number: input.kit_number,
            marker_count: input.marker_count.map(|n| n as i64),
            registered_with_project: input.registered_with_project.unwrap_or(false),
            gedmatch_kit: input.gedmatch_kit,
        };
        let created = kent_db::create_dna_test(graph, &participant_id, &row).await?;
        Ok(DnaTest::from(created))
    }

    async fn remove_dna_test(
        &self,
        ctx: &Context<'_>,
        test_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_dna_test(graph, &test_id).await?)
    }

    async fn assign_haplogroup(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        haplogroup_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::relationship::assign_haplogroup(graph, &participant_id, &haplogroup_id)
                .await?,
        )
    }

    async fn unassign_haplogroup(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        haplogroup_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::relationship::unassign_haplogroup(graph, &participant_id, &haplogroup_id)
                .await?,
        )
    }

    async fn add_online_tree(
        &self,
        ctx: &Context<'_>,
        participant_id: String,
        input: CreateOnlineTreeInput,
    ) -> async_graphql::Result<OnlineTree> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::OnlineTreeRow {
            id: Uuid::new_v4().to_string(),
            platform: input.platform,
            username: input.username,
            tree_name: input.tree_name,
            url: input.url,
        };
        let created = kent_db::create_online_tree(graph, &participant_id, &row).await?;
        Ok(OnlineTree::from(created))
    }

    async fn remove_online_tree(
        &self,
        ctx: &Context<'_>,
        tree_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_online_tree(graph, &tree_id).await?)
    }

    async fn record_genetic_match(
        &self,
        ctx: &Context<'_>,
        participant1_id: String,
        participant2_id: String,
        input: GeneticMatchInput,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::record_genetic_match(
            graph,
            &participant1_id,
            &participant2_id,
            input.marker_level.map(|n| n as i64),
            input.match_type.as_deref(),
            input.notes.as_deref(),
        )
        .await?)
    }

    async fn remove_genetic_match(
        &self,
        ctx: &Context<'_>,
        participant1_id: String,
        participant2_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::relationship::remove_genetic_match(graph, &participant1_id, &participant2_id)
                .await?,
        )
    }

    async fn add_migration_stop(
        &self,
        ctx: &Context<'_>,
        lineage_id: String,
        place_id: String,
        input: MigrationStopInput,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::add_migration_stop(
            graph,
            &lineage_id,
            &place_id,
            input.stop_order as i64,
            input.role.as_deref(),
        )
        .await?)
    }

    async fn remove_migration_stop(
        &self,
        ctx: &Context<'_>,
        lineage_id: String,
        place_id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::relationship::remove_migration_stop(graph, &lineage_id, &place_id).await?)
    }

    // ── AdminNote CRUD ─────────────────────────────────────────────

    async fn create_admin_note(
        &self,
        ctx: &Context<'_>,
        input: CreateAdminNoteInput,
    ) -> async_graphql::Result<AdminNote> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let row = kent_db::AdminNoteRow {
            id: Uuid::new_v4().to_string(),
            color: input.color,
            text: input.text,
            created_date: Some(now_str()),
            resolved: false,
        };
        let created = kent_db::create_admin_note(graph, &row).await?;
        Ok(AdminNote::from(created))
    }

    async fn update_admin_note(
        &self,
        ctx: &Context<'_>,
        id: String,
        input: UpdateAdminNoteInput,
    ) -> async_graphql::Result<AdminNote> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        let existing = kent_db::find_admin_note_by_id(graph, &id)
            .await?
            .ok_or("AdminNote not found")?;
        let row = kent_db::AdminNoteRow {
            id: id.clone(),
            color: input.color.or(existing.color),
            text: input.text.unwrap_or(existing.text),
            created_date: existing.created_date,
            resolved: input.resolved.unwrap_or(existing.resolved),
        };
        let updated = kent_db::update_admin_note(graph, &id, &row)
            .await?
            .ok_or("AdminNote not found")?;
        Ok(AdminNote::from(updated))
    }

    async fn delete_admin_note(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(kent_db::delete_admin_note(graph, &id).await?)
    }

    async fn attach_admin_note(
        &self,
        ctx: &Context<'_>,
        note_id: String,
        target_id: String,
        target_type: AnnotationTarget,
    ) -> async_graphql::Result<bool> {
        require_auth(ctx)?;
        let graph = ctx.data::<Graph>()?;
        Ok(
            kent_db::attach_admin_note(graph, &note_id, &target_id, &target_type.to_string())
                .await?,
        )
    }
}
