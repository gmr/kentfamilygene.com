use kent_db::Neo4jGraph as Graph;
use kent_db::Neo4jQuery as Query;
use uuid::Uuid;

use super::dedup::DedupContext;
use super::types::*;

/// Namespace UUID for deterministic ID generation (UUID v5).
const KENT_NAMESPACE: Uuid = Uuid::from_bytes([
    0x6b, 0x65, 0x6e, 0x74, 0x2d, 0x66, 0x61, 0x6d, 0x69, 0x6c, 0x79, 0x2d, 0x64, 0x6e, 0x61, 0x21,
]);

/// Generate a deterministic UUID from a namespace + key string.
fn deterministic_id(key: &str) -> String {
    Uuid::new_v5(&KENT_NAMESPACE, key.as_bytes()).to_string()
}

/// Persist the full parsed document to Neo4j.
pub async fn persist_to_neo4j(graph: &Graph, doc: &ParsedDocument) {
    let mut ctx = DedupContext::new();
    let mut stats = ImportStats::default();

    tracing::info!("Creating haplogroups...");
    create_haplogroups(graph, doc, &mut ctx, &mut stats).await;

    tracing::info!("Creating places...");
    create_places(graph, doc, &mut ctx, &mut stats).await;

    tracing::info!("Creating lineages...");
    create_lineages(graph, doc, &mut ctx, &mut stats).await;

    tracing::info!("Creating persons (common ancestors)...");
    create_common_ancestor_persons(graph, doc, &mut ctx, &mut stats).await;

    tracing::info!("Processing participants and ancestor chains...");
    // Process newest members
    for participant_block in &doc.newest_members {
        process_participant(graph, participant_block, None, &mut ctx, &mut stats).await;
    }

    // Process lineage participants
    for lineage in &doc.lineages {
        let lineage_id = ctx.get_or_create_lineage_id(lineage);
        for participant_block in &lineage.participants {
            process_participant(
                graph,
                participant_block,
                Some(&lineage_id),
                &mut ctx,
                &mut stats,
            )
            .await;
        }
    }

    tracing::info!("Import complete:");
    tracing::info!("  Lineages:      {}", stats.lineages);
    tracing::info!("  Participants:  {}", stats.participants);
    tracing::info!("  Persons:       {}", stats.persons);
    tracing::info!("  Haplogroups:   {}", stats.haplogroups);
    tracing::info!("  Places:        {}", stats.places);
    tracing::info!("  DNA Tests:     {}", stats.dna_tests);
    tracing::info!("  Online Trees:  {}", stats.online_trees);
    tracing::info!("  Relationships: {}", stats.relationships);
}

#[derive(Default)]
struct ImportStats {
    lineages: usize,
    participants: usize,
    persons: usize,
    haplogroups: usize,
    places: usize,
    dna_tests: usize,
    online_trees: usize,
    relationships: usize,
}

async fn create_haplogroups(
    graph: &Graph,
    doc: &ParsedDocument,
    ctx: &mut DedupContext,
    stats: &mut ImportStats,
) {
    // Collect all unique haplogroups from participant y-DNA data
    let all_participants = doc
        .newest_members
        .iter()
        .chain(doc.lineages.iter().flat_map(|l| l.participants.iter()));

    for p in all_participants {
        if let Some(ydna) = &p.y_dna {
            let subclade = ydna.subclade.as_deref().unwrap_or("");
            let id = ctx.get_or_create_haplogroup_id(&ydna.haplogroup_name, subclade);

            let query = Query::new(
                "MERGE (h:Haplogroup {id: $id}) \
                 SET h.name = $name, h.subclade = $subclade, \
                     h.abbreviation = $abbreviation, \
                     h.confirmation_status = $confirmation_status, \
                     h.type = 'y-DNA' \
                 RETURN h.id"
                    .to_string(),
            )
            .param("id", id)
            .param("name", ydna.haplogroup_name.clone())
            .param("subclade", subclade.to_string())
            .param("abbreviation", ydna.abbreviation.clone())
            .param("confirmation_status", ydna.confirmation_status.clone());

            if execute_query(graph, query).await {
                stats.haplogroups += 1;
            }
        }
    }
}

async fn create_places(
    graph: &Graph,
    doc: &ParsedDocument,
    ctx: &mut DedupContext,
    stats: &mut ImportStats,
) {
    // Collect all place references from ancestor entries and migration paths
    let mut raw_places: Vec<String> = Vec::new();

    let all_participants = doc
        .newest_members
        .iter()
        .chain(doc.lineages.iter().flat_map(|l| l.participants.iter()));

    for p in all_participants {
        for ancestor in &p.ancestors {
            if let Some(bp) = &ancestor.person.birth_place {
                raw_places.push(bp.clone());
            }
            if let Some(dp) = &ancestor.person.death_place {
                raw_places.push(dp.clone());
            }
        }
    }

    for lineage in &doc.lineages {
        for stop in &lineage.migration_path {
            raw_places.push(stop.place_text.clone());
        }
        for ancestor in &lineage.common_ancestors {
            if let Some(bp) = &ancestor.birth_place {
                raw_places.push(bp.clone());
            }
            if let Some(dp) = &ancestor.death_place {
                raw_places.push(dp.clone());
            }
        }
    }

    // Deduplicate and create
    for raw_place in &raw_places {
        let (id, normalized) = ctx.get_or_create_place_id(raw_place);

        let query = Query::new(
            "MERGE (p:Place {id: $id}) \
             SET p.name = $name, p.county = $county, \
                 p.state = $state, p.country = $country \
             RETURN p.id"
                .to_string(),
        )
        .param("id", id)
        .param("name", normalized.name)
        .param("county", normalized.county)
        .param("state", normalized.state)
        .param("country", normalized.country);

        if execute_query(graph, query).await {
            stats.places += 1;
        }
    }
}

async fn create_lineages(
    graph: &Graph,
    doc: &ParsedDocument,
    ctx: &mut DedupContext,
    stats: &mut ImportStats,
) {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    for lineage in &doc.lineages {
        let id = ctx.get_or_create_lineage_id(lineage);

        let query = Query::new(
            "MERGE (l:Lineage {id: $id}) \
             SET l.origin_state = $origin_state, l.lineage_number = $lineage_number, \
                 l.display_name = $display_name, l.region = $region, \
                 l.is_new = $is_new, l.new_lineage_date = $new_lineage_date, \
                 l.created_date = coalesce(l.created_date, $now), l.updated_date = $now \
             RETURN l.id"
                .to_string(),
        )
        .param("id", id.clone())
        .param("origin_state", lineage.origin_state.clone())
        .param("lineage_number", lineage.lineage_number)
        .param("display_name", lineage.name.clone())
        .param("region", lineage.region.clone())
        .param("is_new", lineage.is_new)
        .param("new_lineage_date", lineage.new_lineage_date.clone())
        .param("now", now.clone());

        if execute_query(graph, query).await {
            stats.lineages += 1;
        }

        // Create migration stops
        for stop in &lineage.migration_path {
            let (place_id, _) = ctx.get_or_create_place_id(&stop.place_text);
            if let Err(e) = kent_db::relationship::add_migration_stop(
                graph,
                &id,
                &place_id,
                stop.stop_order,
                None,
            )
            .await
            {
                tracing::warn!("Failed to create migration stop: {e}");
            } else {
                stats.relationships += 1;
            }
        }
    }
}

async fn create_common_ancestor_persons(
    graph: &Graph,
    doc: &ParsedDocument,
    ctx: &mut DedupContext,
    stats: &mut ImportStats,
) {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    for lineage in &doc.lineages {
        let lineage_id = ctx.get_or_create_lineage_id(lineage);

        for (i, person) in lineage.common_ancestors.iter().enumerate() {
            let person_id = ctx.get_or_create_person_id(person);
            if create_person_node(graph, &person_id, person, None, &now).await {
                stats.persons += 1;
            }

            // Link to lineage
            let generation = person.common_ancestor_gen.unwrap_or((i + 1) as i64);
            if let Err(e) = kent_db::relationship::add_person_to_lineage(
                graph,
                &person_id,
                &lineage_id,
                Some("common_ancestor"),
                Some(generation),
                None,
            )
            .await
            {
                tracing::warn!("Failed to link common ancestor to lineage: {e}");
            } else {
                stats.relationships += 1;
            }

            // Create parent-child relationships between consecutive common ancestors
            if i > 0 {
                let parent_person = &lineage.common_ancestors[i - 1];
                let parent_id = ctx.get_or_create_person_id(parent_person);
                if let Err(e) =
                    kent_db::relationship::set_parent_of(graph, &parent_id, &person_id, None).await
                {
                    tracing::warn!("Failed to create parent-child for common ancestors: {e}");
                } else {
                    stats.relationships += 1;
                }
            }
        }
    }
}

async fn process_participant(
    graph: &Graph,
    block: &ParsedParticipantBlock,
    lineage_id: Option<&str>,
    ctx: &mut DedupContext,
    stats: &mut ImportStats,
) {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let kit_number = block
        .kit_bracket
        .as_ref()
        .and_then(|kb| kb.ftdna_kit_number.as_deref());

    let participant_id = ctx.get_or_create_participant_id(kit_number, &block.display_name);

    let membership_type = block
        .kit_bracket
        .as_ref()
        .map(|kb| kb.membership_type.clone())
        .unwrap_or_else(|| "Project Member".to_string());

    let join_date: Option<String> = block
        .kit_bracket
        .as_ref()
        .and_then(|kb| kb.join_year.as_ref())
        .map(|y| format!("{y}-01-01"));

    let marker_count: Option<i64> = block.kit_bracket.as_ref().and_then(|kb| kb.marker_count);

    let query = Query::new(
        "MERGE (p:Participant {id: $id}) \
         SET p.display_name = $display_name, p.email = $email, \
             p.membership_type = $membership_type, p.is_active = true, \
             p.ftdna_kit_number = $ftdna_kit_number, p.join_date = $join_date, \
             p.research_goal = $research_goal, \
             p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
         RETURN p.id"
            .to_string(),
    )
    .param("id", participant_id.clone())
    .param("display_name", block.display_name.clone())
    .param("email", block.email.clone())
    .param("membership_type", membership_type)
    .param("ftdna_kit_number", kit_number.map(String::from))
    .param("join_date", join_date)
    .param("research_goal", block.research_goal.clone())
    .param("now", now.clone());

    if execute_query(graph, query).await {
        stats.participants += 1;
    }

    // Link participant to lineage
    if let Some(lid) = lineage_id {
        if let Err(e) =
            kent_db::relationship::add_participant_to_lineage(graph, &participant_id, lid, None)
                .await
        {
            tracing::warn!("Failed to link participant to lineage: {e}");
        } else {
            stats.relationships += 1;
        }
    }

    // Create y-DNA test and haplogroup assignment
    if let Some(ydna) = &block.y_dna {
        let test_id = deterministic_id(&format!("{participant_id}:ydna"));
        let query = Query::new(
            "MATCH (p:Participant {id: $participant_id}) \
             MERGE (t:DNATest {id: $id}) \
             SET t.test_type = 'y-DNA', t.test_name = 'y-DNA Test', \
                 t.provider = 'FTDNA', t.marker_count = $marker_count, \
                 t.registered_with_project = true \
             MERGE (p)-[:TOOK_TEST]->(t) \
             RETURN t.id"
                .to_string(),
        )
        .param("participant_id", participant_id.clone())
        .param("id", test_id)
        .param("marker_count", marker_count);

        if execute_query(graph, query).await {
            stats.dna_tests += 1;
        }

        // Assign haplogroup
        let subclade = ydna.subclade.as_deref().unwrap_or("");
        let haplo_id = ctx.get_or_create_haplogroup_id(&ydna.haplogroup_name, subclade);
        if let Err(e) =
            kent_db::relationship::assign_haplogroup(graph, &participant_id, &haplo_id).await
        {
            tracing::warn!("Failed to assign haplogroup: {e}");
        } else {
            stats.relationships += 1;
        }
    }

    // Create at-DNA test
    if let Some(atdna) = &block.at_dna {
        let test_id = deterministic_id(&format!("{participant_id}:atdna"));
        let query = Query::new(
            "MATCH (p:Participant {id: $participant_id}) \
             MERGE (t:DNATest {id: $id}) \
             SET t.test_type = 'at-DNA', t.test_name = 'Family Finder', \
                 t.provider = $provider, \
                 t.registered_with_project = $registered, \
                 t.gedmatch_kit = $gedmatch_kit \
             MERGE (p)-[:TOOK_TEST]->(t) \
             RETURN t.id"
                .to_string(),
        )
        .param("participant_id", participant_id.clone())
        .param("id", test_id)
        .param(
            "provider",
            atdna
                .provider
                .clone()
                .unwrap_or_else(|| "FTDNA".to_string()),
        )
        .param("registered", atdna.registered_with_project)
        .param("gedmatch_kit", atdna.gedmatch_kit.clone());

        if execute_query(graph, query).await {
            stats.dna_tests += 1;
        }
    }

    // Create online tree
    if let Some(tree) = &block.online_tree {
        let tree_id = deterministic_id(&format!(
            "{participant_id}:tree:{}:{}",
            tree.platform.as_deref().unwrap_or(""),
            tree.username.as_deref().unwrap_or("")
        ));
        let query = Query::new(
            "MATCH (p:Participant {id: $participant_id}) \
             MERGE (t:OnlineTree {id: $id}) \
             SET t.platform = $platform, t.username = $username, \
                 t.tree_name = $tree_name, t.url = $url \
             MERGE (p)-[:HAS_TREE]->(t) \
             RETURN t.id"
                .to_string(),
        )
        .param("participant_id", participant_id.clone())
        .param("id", tree_id)
        .param("platform", tree.platform.clone())
        .param("username", tree.username.clone())
        .param("tree_name", tree.tree_name.clone())
        .param("url", tree.url.clone());

        if execute_query(graph, query).await {
            stats.online_trees += 1;
        }
    }

    // Create ancestor person nodes and relationships
    let mut prev_person_id: Option<String> = None;

    for entry in &block.ancestors {
        if entry.is_participant_self {
            // Link participant to this "person" (the participant's identity)
            // Use deterministic ID so re-imports merge instead of duplicating
            let person_id = deterministic_id(&format!(
                "participant_self:{}:gen{}",
                participant_id, entry.generation_number
            ));
            let query = Query::new(
                "MERGE (p:Person {id: $id}) \
                 SET p.given_name = null, p.surname = null, \
                     p.is_living = true, p.privacy_label = $label, \
                     p.is_immigrant_ancestor = false, \
                     p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
                 RETURN p.id"
                    .to_string(),
            )
            .param("id", person_id.clone())
            .param("label", entry.privacy_label.clone())
            .param("now", now.clone());

            if execute_query(graph, query).await {
                stats.persons += 1;
            }

            // Link participant to person
            if let Err(e) = kent_db::relationship::link_participant_to_person(
                graph,
                &participant_id,
                &person_id,
            )
            .await
            {
                tracing::warn!("Failed to link participant to person: {e}");
            } else {
                stats.relationships += 1;
            }

            // Parent-child: previous ancestor is parent of this person
            if let Some(ref parent_id) = prev_person_id {
                if let Err(e) =
                    kent_db::relationship::set_parent_of(graph, parent_id, &person_id, None).await
                {
                    tracing::warn!("Failed to create parent-child: {e}");
                } else {
                    stats.relationships += 1;
                }
            }

            // Link to lineage
            if let Some(lid) = lineage_id
                && kent_db::relationship::add_person_to_lineage(
                    graph,
                    &person_id,
                    lid,
                    Some("participant_self"),
                    Some(entry.generation_number),
                    None,
                )
                .await
                .is_ok()
            {
                stats.relationships += 1;
            }

            prev_person_id = Some(person_id);
            continue;
        }

        if entry.privacy_label.is_some() && entry.person.given_name.is_empty() {
            // Privacy-labeled person (Father, Grandfather, etc.)
            // Use deterministic ID so re-imports merge instead of duplicating
            let person_id = deterministic_id(&format!(
                "privacy:{}:gen{}:{}",
                participant_id,
                entry.generation_number,
                entry.privacy_label.as_deref().unwrap_or("")
            ));
            let query = Query::new(
                "MERGE (p:Person {id: $id}) \
                 SET p.given_name = null, p.surname = null, \
                     p.sex = $sex, p.is_living = $is_living, \
                     p.privacy_label = $label, \
                     p.is_immigrant_ancestor = false, \
                     p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
                 RETURN p.id"
                    .to_string(),
            )
            .param("id", person_id.clone())
            .param("sex", entry.person.sex.clone())
            .param("is_living", entry.person.is_living)
            .param("label", entry.privacy_label.clone())
            .param("now", now.clone());

            if execute_query(graph, query).await {
                stats.persons += 1;
            }

            // Parent-child link
            if let Some(ref parent_id) = prev_person_id {
                if let Err(e) =
                    kent_db::relationship::set_parent_of(graph, parent_id, &person_id, None).await
                {
                    tracing::warn!("Failed to create parent-child: {e}");
                } else {
                    stats.relationships += 1;
                }
            }

            if let Some(lid) = lineage_id
                && kent_db::relationship::add_person_to_lineage(
                    graph,
                    &person_id,
                    lid,
                    Some("descendant"),
                    Some(entry.generation_number),
                    None,
                )
                .await
                .is_ok()
            {
                stats.relationships += 1;
            }

            prev_person_id = Some(person_id);
            continue;
        }

        // Normal person entry
        let person_id = ctx.get_or_create_person_id(&entry.person);
        if create_person_node(graph, &person_id, &entry.person, None, &now).await {
            stats.persons += 1;
        }

        // Parent-child: ancestor at gen N is parent of ancestor at gen N-1
        // Note: ancestors are listed highest gen first (oldest ancestor first)
        // So the PREVIOUS entry is the PARENT of this entry
        if let Some(ref parent_id) = prev_person_id {
            if let Err(e) =
                kent_db::relationship::set_parent_of(graph, parent_id, &person_id, None).await
            {
                tracing::warn!("Failed to create parent-child: {e}");
            } else {
                stats.relationships += 1;
            }
        }

        // Link person to lineage
        if let Some(lid) = lineage_id
            && kent_db::relationship::add_person_to_lineage(
                graph,
                &person_id,
                lid,
                Some("descendant"),
                Some(entry.generation_number),
                None,
            )
            .await
            .is_ok()
        {
            stats.relationships += 1;
        }

        // Create spouse persons and SPOUSE_OF relationships
        for spouse in &entry.person.spouses {
            let spouse_person_id = deterministic_id(&format!(
                "{person_id}:spouse:{}:{}:{}",
                spouse.given_name.as_deref().unwrap_or(""),
                spouse.surname,
                spouse.marriage_order
            ));
            let query = Query::new(
                "MERGE (p:Person {id: $id}) \
                 SET p.given_name = $given_name, p.surname = $surname, \
                     p.is_living = false, \
                     p.is_immigrant_ancestor = false, \
                     p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
                 RETURN p.id"
                    .to_string(),
            )
            .param("id", spouse_person_id.clone())
            .param("given_name", spouse.given_name.clone())
            .param("surname", spouse.surname.clone())
            .param("now", now.clone());

            if execute_query(graph, query).await {
                stats.persons += 1;
            }

            if let Err(e) = kent_db::relationship::set_spouse_of(
                graph,
                &person_id,
                &spouse_person_id,
                None,
                None,
                Some(spouse.marriage_order),
                Some(&spouse.surname),
            )
            .await
            {
                tracing::warn!("Failed to create spouse relationship: {e}");
            } else {
                stats.relationships += 1;
            }
        }

        prev_person_id = Some(person_id);
    }
}

async fn create_person_node(
    graph: &Graph,
    id: &str,
    person: &ParsedPerson,
    sex_override: Option<&str>,
    now: &str,
) -> bool {
    // Use the person's sex if set, otherwise fall back to the override
    let sex = person
        .sex
        .clone()
        .or_else(|| sex_override.map(String::from));

    let query = Query::new(
        "MERGE (p:Person {id: $id}) \
         SET p.given_name = $given_name, p.surname = $surname, \
             p.name_suffix = $name_suffix, p.name_prefix = $name_prefix, \
             p.sex = $sex, p.birth_date = $birth_date, \
             p.birth_date_sort = $birth_date_sort, p.birth_date_modifier = $birth_date_modifier, \
             p.death_date = $death_date, p.death_date_sort = $death_date_sort, \
             p.death_date_modifier = $death_date_modifier, \
             p.birth_place = $birth_place, p.death_place = $death_place, \
             p.is_living = $is_living, p.is_immigrant_ancestor = $is_immigrant, \
             p.notes = $notes, \
             p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
         RETURN p.id"
            .to_string(),
    )
    .param("id", id.to_string())
    .param("given_name", person.given_name.clone())
    .param("surname", person.surname.clone())
    .param("name_suffix", person.name_suffix.clone())
    .param("name_prefix", person.name_prefix.clone())
    .param("sex", sex)
    .param("birth_date", person.birth_date.clone())
    .param("birth_date_sort", person.birth_date_sort.clone())
    .param("birth_date_modifier", person.birth_date_modifier.clone())
    .param("death_date", person.death_date.clone())
    .param("death_date_sort", person.death_date_sort.clone())
    .param("death_date_modifier", person.death_date_modifier.clone())
    .param("birth_place", person.birth_place.clone())
    .param("death_place", person.death_place.clone())
    .param("is_living", person.is_living)
    .param("is_immigrant", person.is_immigrant_ancestor)
    .param("notes", person.notes.clone())
    .param("now", now.to_string());

    execute_query(graph, query).await
}

async fn execute_query(graph: &Graph, query: Query) -> bool {
    match graph.execute(query).await {
        Ok(mut result) => result.next().await.is_ok_and(|r| r.is_some()),
        Err(e) => {
            tracing::warn!("Neo4j query failed: {e}");
            false
        }
    }
}
