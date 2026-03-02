use crate::types::{Participant, Person};

/// Determine if a person should be treated as living (and thus privacy-masked).
fn is_living(person: &Person) -> bool {
    // If there's a death date, they're not living
    if person.death_date.is_some() {
        return false;
    }

    // If birth_date_sort exists, check if they'd be over 100
    // birth_date_sort is stored as "YYYY-MM-DD" string
    if let Some(ref sort_date) = person.birth_date_sort
        && let Some(year_str) = sort_date.split('-').next()
        && let Ok(birth_year) = year_str.parse::<i32>()
    {
        let current_year = chrono::Utc::now().format("%Y").to_string();
        if let Ok(cy) = current_year.parse::<i32>() {
            // Future birth years (bad data) are not living
            if birth_year > cy {
                return false;
            }
            return cy - birth_year < 100;
        }
    }

    // No dates at all → assume living
    true
}

/// Apply privacy masking to a person for public queries.
/// Replaces personal details with privacy label for living persons.
pub fn mask_person(person: &mut Person) {
    if !is_living(person) {
        return;
    }

    let label = person
        .privacy_label
        .clone()
        .unwrap_or_else(|| "[Living]".to_string());

    person.given_name = label;
    person.surname = String::new();
    person.name_suffix = None;
    person.name_prefix = None;
    person.name_qualifier = None;
    person.birth_date = None;
    person.birth_date_sort = None;
    person.birth_date_modifier = None;
    person.birth_place = None;
    person.death_date = None;
    person.death_date_sort = None;
    person.death_date_modifier = None;
    person.death_place = None;
    person.notes = None;
}

/// Apply privacy masking to a list of persons.
pub fn mask_persons(persons: &mut [Person]) {
    for person in persons.iter_mut() {
        mask_person(person);
    }
}

/// Strip PII (email, contact notes) from a participant for public queries.
pub fn mask_participant(participant: &mut Participant) {
    participant.email = None;
    participant.contact_note = None;
}

/// Strip PII from a list of participants for public queries.
pub fn mask_participants(participants: &mut [Participant]) {
    for participant in participants.iter_mut() {
        mask_participant(participant);
    }
}
