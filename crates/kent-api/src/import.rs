use kent_db::{Neo4jGraph as Graph, Neo4jQuery as Query};
use serde::Deserialize;
use uuid::Uuid;

/// Top-level structure of the extracted-data.json file.
#[derive(Deserialize)]
pub struct ExtractedData {
    #[serde(default)]
    pub lineages: Vec<ImportLineage>,
    #[serde(default)]
    pub participants: Vec<ImportParticipant>,
    #[serde(default)]
    pub places: Vec<ImportPlace>,
    #[serde(default)]
    pub haplogroups: Vec<ImportHaplogroup>,
    #[serde(default)]
    pub people: Vec<ImportPerson>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportLineage {
    pub id: Option<String>,
    pub region: Option<String>,
    pub origin_state: Option<String>,
    pub lineage_number: Option<i64>,
    pub display_name: Option<String>,
    pub status_note: Option<String>,
    pub is_new_lineage: Option<bool>,
    #[serde(alias = "isNew")]
    pub is_new: Option<bool>,
    pub new_lineage_date: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportParticipant {
    pub id: Option<String>,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub membership_type: Option<String>,
    pub active: Option<bool>,
    #[serde(alias = "isActive")]
    pub is_active: Option<bool>,
    pub ftdna_kit_number: Option<String>,
    #[serde(alias = "kitNumber")]
    pub kit_number: Option<String>,
    pub join_date: Option<String>,
    pub contact_note: Option<String>,
    pub research_goal: Option<String>,
    #[serde(default)]
    pub dna_tests: Vec<ImportDnaTest>,
    #[allow(dead_code)]
    pub haplogroup: Option<ImportHaplogroupRef>,
    #[allow(dead_code)]
    pub haplogroup_status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportDnaTest {
    pub id: Option<String>,
    pub test_type: Option<String>,
    pub test_name: Option<String>,
    pub provider: Option<String>,
    pub kit_number: Option<String>,
    pub marker_count: Option<i64>,
    pub registered_with_project: Option<bool>,
    pub gedmatch_kit: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ImportHaplogroupRef {
    pub id: Option<String>,
    pub name: Option<String>,
    pub abbreviation: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPlace {
    pub id: Option<String>,
    pub name: Option<String>,
    pub county: Option<String>,
    pub state: Option<String>,
    pub country: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub familysearch_url: Option<String>,
    #[serde(alias = "familySearchUrl")]
    pub family_search_url_alt: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportHaplogroup {
    pub id: Option<String>,
    pub name: Option<String>,
    pub subclade: Option<String>,
    pub abbreviation: Option<String>,
    pub confirmation_status: Option<String>,
    #[serde(alias = "type")]
    pub haplogroup_type: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportPerson {
    pub id: Option<String>,
    pub given_name: Option<String>,
    pub surname: Option<String>,
    pub name_suffix: Option<String>,
    pub name_prefix: Option<String>,
    pub sex: Option<String>,
    pub birth_date: Option<String>,
    pub birth_date_sort: Option<String>,
    pub death_date: Option<String>,
    pub death_date_sort: Option<String>,
    pub birth_place: Option<String>,
    pub death_place: Option<String>,
    pub is_immigrant_ancestor: Option<bool>,
    pub notes: Option<String>,
}

pub async fn run_import(graph: &Graph, file_path: &str) {
    tracing::info!("Reading import file: {file_path}");

    let content = match std::fs::read_to_string(file_path) {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to read file: {e}");
            return;
        }
    };

    let data: ExtractedData = match serde_json::from_str(&content) {
        Ok(d) => d,
        Err(e) => {
            tracing::error!("Failed to parse JSON: {e}");
            return;
        }
    };

    let mut lineage_count = 0;
    let mut participant_count = 0;
    let mut place_count = 0;
    let mut haplogroup_count = 0;
    let mut person_count = 0;
    let mut dna_test_count = 0;

    // Import lineages
    for lineage in &data.lineages {
        let id = lineage
            .id
            .clone()
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let display_name = lineage.display_name.clone().unwrap_or_default();
        if display_name.is_empty() {
            continue;
        }
        let is_new = lineage.is_new_lineage.or(lineage.is_new).unwrap_or(false);

        let query = Query::new(
            "MERGE (l:Lineage {id: $id}) \
             SET l.origin_state = $origin_state, l.lineage_number = $lineage_number, \
                 l.display_name = $display_name, l.region = $region, \
                 l.status_note = $status_note, l.is_new = $is_new, \
                 l.new_lineage_date = $new_lineage_date, \
                 l.created_date = coalesce(l.created_date, $now), l.updated_date = $now \
             RETURN l.id"
                .to_string(),
        )
        .param("id", id)
        .param(
            "origin_state",
            lineage.origin_state.clone().unwrap_or_default(),
        )
        .param("lineage_number", lineage.lineage_number.unwrap_or(0))
        .param("display_name", display_name)
        .param("region", lineage.region.clone().unwrap_or_default())
        .param(
            "status_note",
            lineage.status_note.clone().unwrap_or_default(),
        )
        .param("is_new", is_new)
        .param(
            "new_lineage_date",
            lineage.new_lineage_date.clone().unwrap_or_default(),
        )
        .param(
            "now",
            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        );

        match graph.execute(query).await {
            Ok(mut result) => {
                if result.next().await.is_ok_and(|r| r.is_some()) {
                    lineage_count += 1;
                }
            }
            Err(e) => tracing::warn!("Failed to import lineage: {e}"),
        }
    }

    // Import haplogroups
    for haplogroup in &data.haplogroups {
        let id = haplogroup
            .id
            .clone()
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let name = haplogroup.name.clone().unwrap_or_default();
        if name.is_empty() {
            continue;
        }

        let query = Query::new(
            "MERGE (h:Haplogroup {id: $id}) \
             SET h.name = $name, h.subclade = $subclade, \
                 h.abbreviation = $abbreviation, \
                 h.confirmation_status = $confirmation_status, h.type = $type \
             RETURN h.id"
                .to_string(),
        )
        .param("id", id)
        .param("name", name)
        .param("subclade", haplogroup.subclade.clone().unwrap_or_default())
        .param(
            "abbreviation",
            haplogroup.abbreviation.clone().unwrap_or_default(),
        )
        .param(
            "confirmation_status",
            haplogroup.confirmation_status.clone().unwrap_or_default(),
        )
        .param(
            "type",
            haplogroup.haplogroup_type.clone().unwrap_or_default(),
        );

        match graph.execute(query).await {
            Ok(mut result) => {
                if result.next().await.is_ok_and(|r| r.is_some()) {
                    haplogroup_count += 1;
                }
            }
            Err(e) => tracing::warn!("Failed to import haplogroup: {e}"),
        }
    }

    // Import places
    for place in &data.places {
        let id = place
            .id
            .clone()
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let name = place.name.clone().unwrap_or_default();
        if name.is_empty() {
            continue;
        }
        let fs_url = place
            .familysearch_url
            .clone()
            .or_else(|| place.family_search_url_alt.clone())
            .unwrap_or_default();

        let query = Query::new(
            "MERGE (p:Place {id: $id}) \
             SET p.name = $name, p.county = $county, p.state = $state, \
                 p.country = $country, p.lat = $lat, p.lon = $lon, \
                 p.familysearch_url = $familysearch_url \
             RETURN p.id"
                .to_string(),
        )
        .param("id", id)
        .param("name", name)
        .param("county", place.county.clone().unwrap_or_default())
        .param("state", place.state.clone().unwrap_or_default())
        .param("country", place.country.clone().unwrap_or_default())
        .param("lat", place.latitude)
        .param("lon", place.longitude)
        .param("familysearch_url", fs_url);

        match graph.execute(query).await {
            Ok(mut result) => {
                if result.next().await.is_ok_and(|r| r.is_some()) {
                    place_count += 1;
                }
            }
            Err(e) => tracing::warn!("Failed to import place: {e}"),
        }
    }

    // Import participants (and their DNA tests)
    for participant in &data.participants {
        let id = participant
            .id
            .clone()
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let display_name = participant.display_name.clone().unwrap_or_default();
        if display_name.is_empty() {
            continue;
        }
        let is_active = participant.active.or(participant.is_active).unwrap_or(true);
        let kit = participant
            .ftdna_kit_number
            .clone()
            .or_else(|| participant.kit_number.clone())
            .unwrap_or_default();

        let query = Query::new(
            "MERGE (p:Participant {id: $id}) \
             SET p.display_name = $display_name, p.email = $email, \
                 p.membership_type = $membership_type, p.is_active = $is_active, \
                 p.ftdna_kit_number = $ftdna_kit_number, p.join_date = $join_date, \
                 p.contact_note = $contact_note, p.research_goal = $research_goal, \
                 p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
             RETURN p.id"
                .to_string(),
        )
        .param("id", id.clone())
        .param("display_name", display_name)
        .param("email", participant.email.clone().unwrap_or_default())
        .param(
            "membership_type",
            participant.membership_type.clone().unwrap_or_default(),
        )
        .param("is_active", is_active)
        .param("ftdna_kit_number", kit)
        .param(
            "join_date",
            participant.join_date.clone().unwrap_or_default(),
        )
        .param(
            "contact_note",
            participant.contact_note.clone().unwrap_or_default(),
        )
        .param(
            "research_goal",
            participant.research_goal.clone().unwrap_or_default(),
        )
        .param(
            "now",
            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        );

        match graph.execute(query).await {
            Ok(mut result) => {
                if result.next().await.is_ok_and(|r| r.is_some()) {
                    participant_count += 1;
                }
            }
            Err(e) => {
                tracing::warn!("Failed to import participant: {e}");
                continue;
            }
        }

        // Import DNA tests for this participant
        for test in &participant.dna_tests {
            let test_id = test
                .id
                .clone()
                .unwrap_or_else(|| Uuid::now_v7().to_string());

            let query = Query::new(
                "MATCH (p:Participant {id: $participant_id}) \
                 MERGE (t:DNATest {id: $id}) \
                 SET t.test_type = $test_type, t.test_name = $test_name, \
                     t.provider = $provider, t.kit_number = $kit_number, \
                     t.marker_count = $marker_count, \
                     t.registered_with_project = $registered, \
                     t.gedmatch_kit = $gedmatch_kit \
                 MERGE (p)-[:TOOK_TEST]->(t) \
                 RETURN t.id"
                    .to_string(),
            )
            .param("participant_id", id.clone())
            .param("id", test_id)
            .param("test_type", test.test_type.clone().unwrap_or_default())
            .param("test_name", test.test_name.clone().unwrap_or_default())
            .param("provider", test.provider.clone().unwrap_or_default())
            .param("kit_number", test.kit_number.clone().unwrap_or_default())
            .param("marker_count", test.marker_count.unwrap_or(0))
            .param("registered", test.registered_with_project.unwrap_or(false))
            .param(
                "gedmatch_kit",
                test.gedmatch_kit.clone().unwrap_or_default(),
            );

            match graph.execute(query).await {
                Ok(mut result) => {
                    if result.next().await.is_ok_and(|r| r.is_some()) {
                        dna_test_count += 1;
                    } else {
                        tracing::warn!("DNA test not linked: participant {} may not exist", id);
                    }
                }
                Err(e) => tracing::warn!("Failed to import DNA test: {e}"),
            }
        }
    }

    // Import people
    for person in &data.people {
        let id = person
            .id
            .clone()
            .unwrap_or_else(|| Uuid::now_v7().to_string());
        let given_name = person.given_name.clone().unwrap_or_default();
        let surname = person.surname.clone().unwrap_or_default();
        if given_name.is_empty() && surname.is_empty() {
            continue;
        }

        let query = Query::new(
            "MERGE (p:Person {id: $id}) \
             SET p.given_name = $given_name, p.surname = $surname, \
                 p.name_suffix = $name_suffix, p.name_prefix = $name_prefix, \
                 p.sex = $sex, p.birth_date = $birth_date, \
                 p.birth_date_sort = $birth_date_sort, \
                 p.death_date = $death_date, p.death_date_sort = $death_date_sort, \
                 p.birth_place = $birth_place, p.death_place = $death_place, \
                 p.is_immigrant_ancestor = $is_immigrant_ancestor, \
                 p.notes = $notes, p.is_living = false, \
                 p.created_date = coalesce(p.created_date, $now), p.updated_date = $now \
             RETURN p.id"
                .to_string(),
        )
        .param("id", id)
        .param("given_name", given_name)
        .param("surname", surname)
        .param(
            "name_suffix",
            person.name_suffix.clone().unwrap_or_default(),
        )
        .param(
            "name_prefix",
            person.name_prefix.clone().unwrap_or_default(),
        )
        .param("sex", person.sex.clone().unwrap_or_default())
        .param("birth_date", person.birth_date.clone().unwrap_or_default())
        .param(
            "birth_date_sort",
            person.birth_date_sort.clone().unwrap_or_default(),
        )
        .param("death_date", person.death_date.clone().unwrap_or_default())
        .param(
            "death_date_sort",
            person.death_date_sort.clone().unwrap_or_default(),
        )
        .param(
            "birth_place",
            person.birth_place.clone().unwrap_or_default(),
        )
        .param(
            "death_place",
            person.death_place.clone().unwrap_or_default(),
        )
        .param(
            "is_immigrant_ancestor",
            person.is_immigrant_ancestor.unwrap_or(false),
        )
        .param("notes", person.notes.clone().unwrap_or_default())
        .param(
            "now",
            chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
        );

        match graph.execute(query).await {
            Ok(mut result) => {
                if result.next().await.is_ok_and(|r| r.is_some()) {
                    person_count += 1;
                }
            }
            Err(e) => tracing::warn!("Failed to import person: {e}"),
        }
    }

    tracing::info!("Import complete:");
    tracing::info!("  Lineages:     {lineage_count}");
    tracing::info!("  Participants: {participant_count}");
    tracing::info!("  DNA Tests:    {dna_test_count}");
    tracing::info!("  Haplogroups:  {haplogroup_count}");
    tracing::info!("  Places:       {place_count}");
    tracing::info!("  People:       {person_count}");
}
