use neo4rs::{Graph, Query};

use crate::{Error, PersonRow};

pub async fn find_all_persons(
    graph: &Graph,
    surname: Option<&str>,
    offset: i64,
    limit: i64,
) -> Result<(Vec<PersonRow>, i64), Error> {
    let (query, count_query) = if let Some(surname) = surname {
        (
            Query::new(
                "MATCH (p:Person) WHERE p.surname = $surname \
                 RETURN p ORDER BY p.surname, p.given_name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("surname", surname)
            .param("offset", offset)
            .param("limit", limit),
            Query::new(
                "MATCH (p:Person) WHERE p.surname = $surname RETURN count(p) AS total".to_string(),
            )
            .param("surname", surname),
        )
    } else {
        (
            Query::new(
                "MATCH (p:Person) \
                 RETURN p ORDER BY p.surname, p.given_name \
                 SKIP $offset LIMIT $limit"
                    .to_string(),
            )
            .param("offset", offset)
            .param("limit", limit),
            Query::new("MATCH (p:Person) RETURN count(p) AS total".to_string()),
        )
    };

    let total = {
        let mut result = graph.execute(count_query).await?;
        if let Some(row) = result.next().await? {
            row.get::<i64>("total").unwrap_or(0)
        } else {
            0
        }
    };

    let mut result = graph.execute(query).await?;
    let mut persons = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        persons.push(node_to_person_row(&node));
    }

    Ok((persons, total))
}

pub async fn find_person_by_id(graph: &Graph, id: &str) -> Result<Option<PersonRow>, Error> {
    let query = Query::new("MATCH (p:Person {id: $id}) RETURN p".to_string()).param("id", id);
    let mut result = graph.execute(query).await?;

    if let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        Ok(Some(node_to_person_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn create_person(graph: &Graph, row: &PersonRow) -> Result<PersonRow, Error> {
    let query = Query::new(
        "CREATE (p:Person {
            id: $id, given_name: $given_name, surname: $surname,
            name_suffix: $name_suffix, name_prefix: $name_prefix,
            name_qualifier: $name_qualifier, sex: $sex,
            birth_date: $birth_date, birth_date_sort: $birth_date_sort,
            birth_date_modifier: $birth_date_modifier, birth_place: $birth_place,
            death_date: $death_date, death_date_sort: $death_date_sort,
            death_date_modifier: $death_date_modifier, death_place: $death_place,
            is_living: $is_living, privacy_label: $privacy_label,
            is_immigrant_ancestor: $is_immigrant_ancestor, notes: $notes,
            created_date: $created_date, updated_date: $updated_date
        }) RETURN p"
            .to_string(),
    )
    .param("id", row.id.clone())
    .param("given_name", row.given_name.clone())
    .param("surname", row.surname.clone())
    .param("name_suffix", row.name_suffix.clone().unwrap_or_default())
    .param("name_prefix", row.name_prefix.clone().unwrap_or_default())
    .param(
        "name_qualifier",
        row.name_qualifier.clone().unwrap_or_default(),
    )
    .param("sex", row.sex.clone().unwrap_or_default())
    .param("birth_date", row.birth_date.clone().unwrap_or_default())
    .param(
        "birth_date_sort",
        row.birth_date_sort.clone().unwrap_or_default(),
    )
    .param(
        "birth_date_modifier",
        row.birth_date_modifier.clone().unwrap_or_default(),
    )
    .param("birth_place", row.birth_place.clone().unwrap_or_default())
    .param("death_date", row.death_date.clone().unwrap_or_default())
    .param(
        "death_date_sort",
        row.death_date_sort.clone().unwrap_or_default(),
    )
    .param(
        "death_date_modifier",
        row.death_date_modifier.clone().unwrap_or_default(),
    )
    .param("death_place", row.death_place.clone().unwrap_or_default())
    .param("is_living", row.is_living)
    .param(
        "privacy_label",
        row.privacy_label.clone().unwrap_or_default(),
    )
    .param("is_immigrant_ancestor", row.is_immigrant_ancestor)
    .param("notes", row.notes.clone().unwrap_or_default())
    .param("created_date", row.created_date.clone().unwrap_or_default())
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    let r = result
        .next()
        .await?
        .ok_or(Error::Deserialization("No row returned from CREATE".into()))?;
    let node: neo4rs::Node = r.get("p")?;
    Ok(node_to_person_row(&node))
}

pub async fn update_person(
    graph: &Graph,
    id: &str,
    row: &PersonRow,
) -> Result<Option<PersonRow>, Error> {
    let query = Query::new(
        "MATCH (p:Person {id: $id}) \
         SET p.given_name = $given_name, p.surname = $surname, \
             p.name_suffix = $name_suffix, p.name_prefix = $name_prefix, \
             p.name_qualifier = $name_qualifier, p.sex = $sex, \
             p.birth_date = $birth_date, p.birth_date_sort = $birth_date_sort, \
             p.birth_date_modifier = $birth_date_modifier, p.birth_place = $birth_place, \
             p.death_date = $death_date, p.death_date_sort = $death_date_sort, \
             p.death_date_modifier = $death_date_modifier, p.death_place = $death_place, \
             p.is_living = $is_living, p.privacy_label = $privacy_label, \
             p.is_immigrant_ancestor = $is_immigrant_ancestor, p.notes = $notes, \
             p.updated_date = $updated_date \
         RETURN p"
            .to_string(),
    )
    .param("id", id)
    .param("given_name", row.given_name.clone())
    .param("surname", row.surname.clone())
    .param("name_suffix", row.name_suffix.clone().unwrap_or_default())
    .param("name_prefix", row.name_prefix.clone().unwrap_or_default())
    .param(
        "name_qualifier",
        row.name_qualifier.clone().unwrap_or_default(),
    )
    .param("sex", row.sex.clone().unwrap_or_default())
    .param("birth_date", row.birth_date.clone().unwrap_or_default())
    .param(
        "birth_date_sort",
        row.birth_date_sort.clone().unwrap_or_default(),
    )
    .param(
        "birth_date_modifier",
        row.birth_date_modifier.clone().unwrap_or_default(),
    )
    .param("birth_place", row.birth_place.clone().unwrap_or_default())
    .param("death_date", row.death_date.clone().unwrap_or_default())
    .param(
        "death_date_sort",
        row.death_date_sort.clone().unwrap_or_default(),
    )
    .param(
        "death_date_modifier",
        row.death_date_modifier.clone().unwrap_or_default(),
    )
    .param("death_place", row.death_place.clone().unwrap_or_default())
    .param("is_living", row.is_living)
    .param(
        "privacy_label",
        row.privacy_label.clone().unwrap_or_default(),
    )
    .param("is_immigrant_ancestor", row.is_immigrant_ancestor)
    .param("notes", row.notes.clone().unwrap_or_default())
    .param("updated_date", row.updated_date.clone().unwrap_or_default());

    let mut result = graph.execute(query).await?;
    if let Some(r) = result.next().await? {
        let node: neo4rs::Node = r.get("p")?;
        Ok(Some(node_to_person_row(&node)))
    } else {
        Ok(None)
    }
}

pub async fn delete_person(graph: &Graph, id: &str) -> Result<bool, Error> {
    let check = Query::new(
        "MATCH (p:Person {id: $id}) \
         OPTIONAL MATCH (p)-[r]-() \
         RETURN p IS NOT NULL AS exists, count(r) AS rel_count"
            .to_string(),
    )
    .param("id", id);

    let mut result = graph.execute(check).await?;
    if let Some(row) = result.next().await? {
        let exists: bool = row.get("exists").unwrap_or(false);
        if !exists {
            return Ok(false);
        }
        let rel_count: i64 = row.get("rel_count").unwrap_or(0);
        if rel_count > 0 {
            return Err(Error::Deserialization(format!(
                "Cannot delete person {id}: has {rel_count} relationships"
            )));
        }
    }

    let query = Query::new(
        "MATCH (p:Person {id: $id}) WITH p, p IS NOT NULL AS existed DELETE p RETURN existed AS deleted".to_string(),
    )
    .param("id", id);
    let mut result = graph.execute(query).await?;
    if let Some(row) = result.next().await? {
        Ok(row.get::<bool>("deleted").unwrap_or(false))
    } else {
        Ok(false)
    }
}

/// Find persons belonging to a lineage.
pub async fn find_persons_by_lineage(
    graph: &Graph,
    lineage_id: &str,
) -> Result<Vec<(PersonRow, Option<String>, Option<i64>, Option<String>)>, Error> {
    let query = Query::new(
        "MATCH (p:Person)-[b:BELONGS_TO]->(l:Lineage {id: $lineage_id}) \
         RETURN p, b.role AS role, b.generation_number AS gen, b.certainty AS certainty \
         ORDER BY b.generation_number"
            .to_string(),
    )
    .param("lineage_id", lineage_id);

    let mut result = graph.execute(query).await?;
    let mut persons = Vec::new();
    while let Some(row) = result.next().await? {
        let node: neo4rs::Node = row.get("p")?;
        let role: Option<String> = row.get("role").ok();
        let generation: Option<i64> = row.get("gen").ok();
        let certainty: Option<String> = row.get("certainty").ok();
        persons.push((node_to_person_row(&node), role, generation, certainty));
    }
    Ok(persons)
}

pub(crate) fn node_to_person_row(node: &neo4rs::Node) -> PersonRow {
    PersonRow {
        id: node.get("id").unwrap_or_default(),
        given_name: node.get("given_name").unwrap_or_default(),
        surname: node.get("surname").unwrap_or_default(),
        name_suffix: node.get("name_suffix").ok(),
        name_prefix: node.get("name_prefix").ok(),
        name_qualifier: node.get("name_qualifier").ok(),
        sex: node.get("sex").ok(),
        birth_date: node.get("birth_date").ok(),
        birth_date_sort: node.get("birth_date_sort").ok(),
        birth_date_modifier: node.get("birth_date_modifier").ok(),
        birth_place: node.get("birth_place").ok(),
        death_date: node.get("death_date").ok(),
        death_date_sort: node.get("death_date_sort").ok(),
        death_date_modifier: node.get("death_date_modifier").ok(),
        death_place: node.get("death_place").ok(),
        is_living: node.get("is_living").unwrap_or(false),
        privacy_label: node.get("privacy_label").ok(),
        is_immigrant_ancestor: node.get("is_immigrant_ancestor").unwrap_or(false),
        notes: node.get("notes").ok(),
        created_date: node.get("created_date").ok(),
        updated_date: node.get("updated_date").ok(),
    }
}
