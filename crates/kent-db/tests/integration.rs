//! Integration tests for kent-db using testcontainers with Neo4j.
//!
//! These tests require Docker to be running. Skip with:
//!   cargo test --lib  (only run unit tests)
//!
//! Run integration tests with:
//!   cargo test -p kent-db --test integration

use testcontainers::runners::AsyncRunner;
use testcontainers_modules::neo4j::Neo4j;

use kent_db::*;

async fn setup() -> (
    neo4rs::Graph,
    testcontainers::ContainerAsync<testcontainers_modules::neo4j::Neo4jImage>,
) {
    let container = Neo4j::default().start().await.unwrap();
    let uri = format!(
        "bolt://{}:{}",
        container.get_host().await.unwrap(),
        container.get_host_port_ipv4(7687).await.unwrap()
    );
    let graph = create_pool(&uri, "neo4j", "password").await.unwrap();
    (graph, container)
}

#[tokio::test]
async fn test_lineage_crud() {
    let (graph, _container) = setup().await;

    // Create
    let row = LineageRow {
        id: "test-lineage-1".into(),
        origin_state: Some("Virginia".into()),
        lineage_number: Some(1),
        display_name: "Virginia, Lineage No. 1".into(),
        region: Some("U.S. South".into()),
        status_note: None,
        is_new: false,
        new_lineage_date: None,
        created_date: Some("2024-01-01".into()),
        updated_date: Some("2024-01-01".into()),
    };
    let created = create_lineage(&graph, &row).await.unwrap();
    assert_eq!(created.id, "test-lineage-1");
    assert_eq!(created.display_name, "Virginia, Lineage No. 1");

    // Read by ID
    let found = find_lineage_by_id(&graph, "test-lineage-1").await.unwrap();
    assert!(found.is_some());
    assert_eq!(found.unwrap().display_name, "Virginia, Lineage No. 1");

    // List all
    let (lineages, total) = find_all_lineages(&graph, None, 0, 50).await.unwrap();
    assert_eq!(total, 1);
    assert_eq!(lineages.len(), 1);

    // List with filter
    let (lineages, total) = find_all_lineages(&graph, Some("U.S. South"), 0, 50)
        .await
        .unwrap();
    assert_eq!(total, 1);
    assert_eq!(lineages.len(), 1);

    let (lineages, total) = find_all_lineages(&graph, Some("Nonexistent"), 0, 50)
        .await
        .unwrap();
    assert_eq!(total, 0);
    assert_eq!(lineages.len(), 0);

    // Update
    let mut updated_row = row.clone();
    updated_row.status_note = Some("Updated note".into());
    let updated = update_lineage(&graph, "test-lineage-1", &updated_row)
        .await
        .unwrap();
    assert!(updated.is_some());
    assert_eq!(
        updated.unwrap().status_note,
        Some("Updated note".to_string())
    );

    // Delete
    let deleted = delete_lineage(&graph, "test-lineage-1").await.unwrap();
    assert!(deleted);

    // Verify deleted
    let found = find_lineage_by_id(&graph, "test-lineage-1").await.unwrap();
    assert!(found.is_none());
}

#[tokio::test]
async fn test_person_crud() {
    let (graph, _container) = setup().await;

    let row = PersonRow {
        id: "test-person-1".into(),
        given_name: "Thomas".into(),
        surname: "Kent".into(),
        name_suffix: None,
        name_prefix: None,
        name_qualifier: None,
        sex: Some("M".into()),
        birth_date: Some("1826".into()),
        birth_date_sort: Some("1826-01-01".into()),
        birth_date_modifier: Some("about".into()),
        birth_place: Some("Virginia".into()),
        death_date: Some("1890".into()),
        death_date_sort: Some("1890-01-01".into()),
        death_date_modifier: None,
        death_place: Some("Georgia".into()),
        is_living: false,
        privacy_label: None,
        is_immigrant_ancestor: false,
        notes: None,
        created_date: Some("2024-01-01".into()),
        updated_date: Some("2024-01-01".into()),
    };

    let created = create_person(&graph, &row).await.unwrap();
    assert_eq!(created.id, "test-person-1");
    assert_eq!(created.given_name, "Thomas");

    let found = find_person_by_id(&graph, "test-person-1").await.unwrap();
    assert!(found.is_some());

    let (persons, total) = find_all_persons(&graph, None, 0, 50).await.unwrap();
    assert_eq!(total, 1);
    assert_eq!(persons.len(), 1);

    let deleted = delete_person(&graph, "test-person-1").await.unwrap();
    assert!(deleted);
}

#[tokio::test]
async fn test_participant_crud() {
    let (graph, _container) = setup().await;

    let row = ParticipantRow {
        id: "test-part-1".into(),
        display_name: "R. A. Kent".into(),
        email: Some("ra@example.com".into()),
        membership_type: Some("project_member".into()),
        is_active: true,
        ftdna_kit_number: Some("967523".into()),
        join_date: Some("2021".into()),
        contact_note: None,
        research_goal: None,
        created_date: Some("2024-01-01".into()),
        updated_date: Some("2024-01-01".into()),
    };

    let created = create_participant(&graph, &row).await.unwrap();
    assert_eq!(created.display_name, "R. A. Kent");

    let found = find_participant_by_id(&graph, "test-part-1").await.unwrap();
    assert!(found.is_some());

    let deleted = delete_participant(&graph, "test-part-1").await.unwrap();
    assert!(deleted);
}

#[tokio::test]
async fn test_place_crud() {
    let (graph, _container) = setup().await;

    let row = PlaceRow {
        id: "test-place-1".into(),
        name: "Warren Co., Georgia".into(),
        county: Some("Warren".into()),
        state: Some("Georgia".into()),
        country: Some("USA".into()),
        lat: Some(33.4),
        lon: Some(-82.7),
        familysearch_url: None,
    };

    let created = create_place(&graph, &row).await.unwrap();
    assert_eq!(created.name, "Warren Co., Georgia");

    let deleted = delete_place(&graph, "test-place-1").await.unwrap();
    assert!(deleted);
}

#[tokio::test]
async fn test_haplogroup_crud() {
    let (graph, _container) = setup().await;

    let row = HaplogroupRow {
        id: "test-haplo-1".into(),
        name: "R1b1a2".into(),
        subclade: Some("M269".into()),
        abbreviation: Some("R-M269".into()),
        confirmation_status: Some("confirmed".into()),
        haplogroup_type: Some("y-dna".into()),
    };

    let created = create_haplogroup(&graph, &row).await.unwrap();
    assert_eq!(created.name, "R1b1a2");

    let deleted = delete_haplogroup(&graph, "test-haplo-1").await.unwrap();
    assert!(deleted);
}

#[tokio::test]
async fn test_dna_test_lifecycle() {
    let (graph, _container) = setup().await;

    // Create participant first
    let part = ParticipantRow {
        id: "test-part-dna".into(),
        display_name: "Test Participant".into(),
        email: None,
        membership_type: None,
        is_active: true,
        ftdna_kit_number: None,
        join_date: None,
        contact_note: None,
        research_goal: None,
        created_date: None,
        updated_date: None,
    };
    create_participant(&graph, &part).await.unwrap();

    // Create DNA test linked to participant
    let test_row = DnaTestRow {
        id: "test-dna-1".into(),
        test_type: Some("y-dna".into()),
        test_name: Some("Y-DNA37".into()),
        provider: Some("FTDNA".into()),
        kit_number: Some("123456".into()),
        marker_count: Some(37),
        registered_with_project: true,
        gedmatch_kit: None,
    };

    let created = create_dna_test(&graph, "test-part-dna", &test_row)
        .await
        .unwrap();
    assert_eq!(created.test_name, Some("Y-DNA37".to_string()));

    // Find tests for participant
    let tests = find_dna_tests_by_participant(&graph, "test-part-dna")
        .await
        .unwrap();
    assert_eq!(tests.len(), 1);

    // Delete test
    let deleted = delete_dna_test(&graph, "test-dna-1").await.unwrap();
    assert!(deleted);

    // Cleanup
    delete_participant(&graph, "test-part-dna").await.unwrap();
}

#[tokio::test]
async fn test_relationships() {
    let (graph, _container) = setup().await;

    // Create two persons and a lineage
    let parent = PersonRow {
        id: "parent-1".into(),
        given_name: "William".into(),
        surname: "Kent".into(),
        name_suffix: None,
        name_prefix: None,
        name_qualifier: None,
        sex: Some("M".into()),
        birth_date: None,
        birth_date_sort: None,
        birth_date_modifier: None,
        birth_place: None,
        death_date: None,
        death_date_sort: None,
        death_date_modifier: None,
        death_place: None,
        is_living: false,
        privacy_label: None,
        is_immigrant_ancestor: false,
        notes: None,
        created_date: None,
        updated_date: None,
    };
    let child = PersonRow {
        id: "child-1".into(),
        given_name: "James".into(),
        surname: "Kent".into(),
        ..parent.clone()
    };
    let lineage = LineageRow {
        id: "lineage-rel-1".into(),
        origin_state: None,
        lineage_number: None,
        display_name: "Test Lineage".into(),
        region: None,
        status_note: None,
        is_new: false,
        new_lineage_date: None,
        created_date: None,
        updated_date: None,
    };

    create_person(&graph, &parent).await.unwrap();
    create_person(&graph, &child).await.unwrap();
    create_lineage(&graph, &lineage).await.unwrap();

    // PARENT_OF
    let ok = relationship::set_parent_of(&graph, "parent-1", "child-1", Some("natural"))
        .await
        .unwrap();
    assert!(ok);

    let ok = relationship::remove_parent_of(&graph, "parent-1", "child-1")
        .await
        .unwrap();
    assert!(ok);

    // BELONGS_TO
    let ok = relationship::add_person_to_lineage(
        &graph,
        "parent-1",
        "lineage-rel-1",
        Some("confirmed_ancestor"),
        Some(1),
        Some("confirmed"),
    )
    .await
    .unwrap();
    assert!(ok);

    // Find persons by lineage
    let persons = find_persons_by_lineage(&graph, "lineage-rel-1")
        .await
        .unwrap();
    assert_eq!(persons.len(), 1);
    assert_eq!(persons[0].0.given_name, "William");

    // SPOUSE_OF
    let ok = relationship::set_spouse_of(
        &graph,
        "parent-1",
        "child-1",
        Some("1850"),
        Some("Virginia"),
        Some(1),
        Some("Smith"),
    )
    .await
    .unwrap();
    assert!(ok);

    let ok = relationship::remove_spouse_of(&graph, "parent-1", "child-1")
        .await
        .unwrap();
    assert!(ok);

    // Cleanup: remove relationship first, then nodes
    relationship::remove_person_from_lineage(&graph, "parent-1", "lineage-rel-1")
        .await
        .unwrap();
    delete_person(&graph, "parent-1").await.unwrap();
    delete_person(&graph, "child-1").await.unwrap();
    delete_lineage(&graph, "lineage-rel-1").await.unwrap();
}

#[tokio::test]
async fn test_delete_with_relationships_fails() {
    let (graph, _container) = setup().await;

    let lineage = LineageRow {
        id: "lineage-del-1".into(),
        origin_state: None,
        lineage_number: None,
        display_name: "Test Delete".into(),
        region: None,
        status_note: None,
        is_new: false,
        new_lineage_date: None,
        created_date: None,
        updated_date: None,
    };
    let person = PersonRow {
        id: "person-del-1".into(),
        given_name: "Test".into(),
        surname: "Kent".into(),
        name_suffix: None,
        name_prefix: None,
        name_qualifier: None,
        sex: None,
        birth_date: None,
        birth_date_sort: None,
        birth_date_modifier: None,
        birth_place: None,
        death_date: None,
        death_date_sort: None,
        death_date_modifier: None,
        death_place: None,
        is_living: false,
        privacy_label: None,
        is_immigrant_ancestor: false,
        notes: None,
        created_date: None,
        updated_date: None,
    };

    create_lineage(&graph, &lineage).await.unwrap();
    create_person(&graph, &person).await.unwrap();

    // Add relationship
    relationship::add_person_to_lineage(&graph, "person-del-1", "lineage-del-1", None, None, None)
        .await
        .unwrap();

    // Attempting to delete lineage with relationships should fail
    let result = delete_lineage(&graph, "lineage-del-1").await;
    assert!(result.is_err());

    // Attempting to delete person with relationships should fail
    let result = delete_person(&graph, "person-del-1").await;
    assert!(result.is_err());

    // Cleanup
    relationship::remove_person_from_lineage(&graph, "person-del-1", "lineage-del-1")
        .await
        .unwrap();
    delete_person(&graph, "person-del-1").await.unwrap();
    delete_lineage(&graph, "lineage-del-1").await.unwrap();
}

#[tokio::test]
async fn test_stats() {
    let (graph, _container) = setup().await;

    // Empty database
    let stats = search::get_stats(&graph).await.unwrap();
    assert_eq!(stats.lineage_count, 0);
    assert_eq!(stats.person_count, 0);

    // Add a lineage
    let lineage = LineageRow {
        id: "stats-lineage".into(),
        origin_state: None,
        lineage_number: None,
        display_name: "Stats Test".into(),
        region: None,
        status_note: None,
        is_new: false,
        new_lineage_date: None,
        created_date: None,
        updated_date: None,
    };
    create_lineage(&graph, &lineage).await.unwrap();

    let stats = search::get_stats(&graph).await.unwrap();
    assert_eq!(stats.lineage_count, 1);

    delete_lineage(&graph, "stats-lineage").await.unwrap();
}
