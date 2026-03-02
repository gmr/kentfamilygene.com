/**
 * TypeaheadSearch Usage Examples
 *
 * This file contains practical examples of how to use the TypeaheadSearch component
 * in different contexts throughout the admin interface.
 */

import React from 'react';
import { TypeaheadSearch } from './TypeaheadSearch';
import { formatPerson, formatParticipant, formatPlace, formatLineage } from './typeahead-formatters';
import { Person, Participant, Lineage } from '../../../lib/mock-data';
import type { Place } from './typeahead-formatters';

/**
 * Example 1: Person Search for Adding a Parent
 *
 * Use case: Adding a father or mother to a person's record
 */
export function PersonSearchExample() {
  const handleSelectFather = (person: Person) => {
    console.log('Selected father:', person);
    // addParent(person, 'father');
  };

  const handleCreateNewPerson = () => {
    console.log('Create new person');
    // openCreatePersonModal('father');
  };

  return (
    <TypeaheadSearch<Person>
      entityType="person"
      label="Father"
      placeholder="Search for father..."
      formatResult={formatPerson}
      onSelect={handleSelectFather}
      onCreate={handleCreateNewPerson}
    />
  );
}

/**
 * Example 2: Place Search for Birth Location
 *
 * Use case: Selecting a birth place from the place database
 */
export function PlaceSearchExample() {
  const handleSelectPlace = (place: Place) => {
    console.log('Selected place:', place);
    // form.setValue('birthPlace', place);
  };

  const handleCreateNewPlace = () => {
    console.log('Create new place');
    // openCreatePlaceModal();
  };

  return (
    <TypeaheadSearch<Place>
      entityType="place"
      label="Birth Place"
      placeholder="Search for place..."
      formatResult={formatPlace}
      onSelect={handleSelectPlace}
      onCreate={handleCreateNewPlace}
      error={undefined} // form.formState.errors.birthPlace?.message
    />
  );
}

/**
 * Example 3: Participant Search for Genetic Match
 *
 * Use case: Searching for a participant to add as a genetic match
 */
export function ParticipantSearchExample() {
  const handleSelectParticipant = (participant: Participant) => {
    console.log('Selected participant:', participant);
    // addGeneticMatch(participant);
  };

  return (
    <TypeaheadSearch<Participant>
      entityType="participant"
      label="Matching Participant"
      placeholder="Search by name or kit number..."
      formatResult={formatParticipant}
      onSelect={handleSelectParticipant}
      minChars={1} // Allow searching with just 1 char for kit numbers
    />
  );
}

/**
 * Example 4: Lineage Search for Assignment
 *
 * Use case: Assigning a person or participant to a lineage
 */
export function LineageSearchExample() {
  const handleSelectLineage = (lineage: Lineage) => {
    console.log('Selected lineage:', lineage);
    // assignToLineage(lineage);
  };

  return (
    <TypeaheadSearch<Lineage>
      entityType="lineage"
      label="Assign to Lineage"
      placeholder="Search for lineage..."
      formatResult={formatLineage}
      onSelect={handleSelectLineage}
    />
  );
}

/**
 * Example 5: With Initial Value
 *
 * Use case: Editing an existing relationship
 */
export function WithInitialValueExample() {
  const existingPerson: Person = {
    id: 'person-1',
    givenName: 'Thomas',
    surname: 'Kent',
    birthDate: 'ABT 1792',
    birthPlace: { id: 'place-1', name: 'North Carolina' },
    lineages: [{ id: 'lineage-1', displayName: 'NC Lineage No. 2' }],
  } as Person;

  const handleSelect = (person: Person) => {
    console.log('Changed to:', person);
  };

  return (
    <TypeaheadSearch<Person>
      entityType="person"
      label="Father"
      placeholder="Search for father..."
      formatResult={formatPerson}
      onSelect={handleSelect}
      initialValue={existingPerson}
    />
  );
}

/**
 * Example 6: Custom Search Endpoint
 *
 * Use case: Using a specialized search endpoint
 */
export function CustomEndpointExample() {
  const handleSelect = (participant: Participant) => {
    console.log('Selected participant:', participant);
  };

  return (
    <TypeaheadSearch<Participant>
      entityType="participant"
      label="Active Participants Only"
      placeholder="Search active participants..."
      formatResult={formatParticipant}
      onSelect={handleSelect}
      searchEndpoint="/api/admin/participants/search/active"
      maxResults={20}
    />
  );
}

/**
 * Example 7: Disabled State
 *
 * Use case: Form field that should be disabled
 */
export function DisabledExample() {
  return (
    <TypeaheadSearch<Person>
      entityType="person"
      label="Father (inherited)"
      placeholder="Search for father..."
      formatResult={formatPerson}
      onSelect={() => {}}
      disabled={true}
    />
  );
}

/**
 * Example 8: With React Hook Form Integration
 *
 * Use case: Using with react-hook-form
 */
export function WithReactHookFormExample() {
  // import { useForm, Controller } from 'react-hook-form';
  // const { control, formState: { errors } } = useForm();

  return (
    <div>
      {/*
      <Controller
        name="birthPlace"
        control={control}
        rules={{ required: 'Birth place is required' }}
        render={({ field }) => (
          <TypeaheadSearch<Place>
            entityType="place"
            label="Birth Place"
            placeholder="Search for place..."
            formatResult={formatPlace}
            onSelect={(place) => field.onChange(place)}
            initialValue={field.value}
            error={errors.birthPlace?.message}
          />
        )}
      />
      */}
    </div>
  );
}
