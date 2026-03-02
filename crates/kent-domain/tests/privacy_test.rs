use kent_domain::privacy::{mask_participant, mask_participants, mask_person, mask_persons};
use kent_domain::types::{Participant, Person};

fn make_person(
    birth_sort: Option<&str>,
    death_date: Option<&str>,
    privacy_label: Option<&str>,
) -> Person {
    Person {
        id: "test-id".into(),
        given_name: "Jane".into(),
        surname: "Kent".into(),
        name_suffix: None,
        name_prefix: None,
        name_qualifier: None,
        sex: Some("F".into()),
        birth_date: Some("1990".into()),
        birth_date_sort: birth_sort.map(String::from),
        birth_date_modifier: None,
        birth_place: Some("Virginia".into()),
        death_date: death_date.map(String::from),
        death_date_sort: death_date.map(String::from),
        death_date_modifier: None,
        death_place: None,
        is_living: false,
        privacy_label: privacy_label.map(String::from),
        is_immigrant_ancestor: false,
        notes: Some("Some notes".into()),
        created_date: None,
        updated_date: None,
    }
}

#[test]
fn test_deceased_person_not_masked() {
    let mut person = make_person(Some("1826-01-01"), Some("1890-01-01"), None);
    mask_person(&mut person);

    assert_eq!(person.given_name, "Jane");
    assert_eq!(person.surname, "Kent");
    assert!(person.birth_date.is_some());
}

#[test]
fn test_living_person_masked_with_default_label() {
    let mut person = make_person(Some("1990-01-01"), None, None);
    mask_person(&mut person);

    assert_eq!(person.given_name, "[Living]");
    assert!(person.surname.is_empty());
    assert!(person.birth_date.is_none());
    assert!(person.notes.is_none());
}

#[test]
fn test_living_person_masked_with_custom_label() {
    let mut person = make_person(Some("1990-01-01"), None, Some("[Grandmother]"));
    mask_person(&mut person);

    assert_eq!(person.given_name, "[Grandmother]");
    assert!(person.surname.is_empty());
}

#[test]
fn test_no_dates_assumed_living() {
    let mut person = make_person(None, None, None);
    mask_person(&mut person);

    assert_eq!(person.given_name, "[Living]");
}

#[test]
fn test_future_birth_date_not_masked() {
    // Future birth year (bad data) should not be treated as living
    let mut person = make_person(Some("2099-01-01"), None, None);
    mask_person(&mut person);

    assert_eq!(person.given_name, "Jane");
}

#[test]
fn test_old_person_without_death_not_masked() {
    // Born 200 years ago, no death date — still treated as not living because > 100 years
    let mut person = make_person(Some("1800-01-01"), None, None);
    mask_person(&mut person);

    assert_eq!(person.given_name, "Jane");
}

#[test]
fn test_mask_persons_batch() {
    let mut persons = vec![
        make_person(Some("1826-01-01"), Some("1890-01-01"), None), // deceased
        make_person(Some("1990-01-01"), None, None),               // living
    ];
    mask_persons(&mut persons);

    assert_eq!(persons[0].given_name, "Jane");
    assert_eq!(persons[1].given_name, "[Living]");
}

fn make_participant(email: Option<&str>, contact_note: Option<&str>) -> Participant {
    Participant {
        id: "part-1".into(),
        display_name: "John Kent".into(),
        email: email.map(String::from),
        membership_type: Some("full".into()),
        is_active: true,
        ftdna_kit_number: Some("12345".into()),
        join_date: Some("2020-01-01".into()),
        contact_note: contact_note.map(String::from),
        research_goal: Some("Find common ancestor".into()),
        created_date: None,
        updated_date: None,
    }
}

#[test]
fn test_mask_participant_strips_email_and_contact() {
    let mut p = make_participant(Some("john@example.com"), Some("Call after 5pm"));
    mask_participant(&mut p);

    assert!(p.email.is_none());
    assert!(p.contact_note.is_none());
    // Non-PII fields preserved
    assert_eq!(p.display_name, "John Kent");
    assert_eq!(p.ftdna_kit_number, Some("12345".into()));
    assert_eq!(p.research_goal, Some("Find common ancestor".into()));
}

#[test]
fn test_mask_participant_already_none() {
    let mut p = make_participant(None, None);
    mask_participant(&mut p);

    assert!(p.email.is_none());
    assert!(p.contact_note.is_none());
    assert_eq!(p.display_name, "John Kent");
}

#[test]
fn test_mask_participants_batch() {
    let mut participants = vec![
        make_participant(Some("a@example.com"), Some("Note A")),
        make_participant(Some("b@example.com"), None),
    ];
    mask_participants(&mut participants);

    assert!(participants[0].email.is_none());
    assert!(participants[0].contact_note.is_none());
    assert!(participants[1].email.is_none());
    assert!(participants[1].contact_note.is_none());
}
