import React from 'react';
import { User, UserCheck, MapPin, Users, Dna } from 'lucide-react';
import { Person, Participant, Lineage } from '../../../lib/mock-data';

// Place type (simplified for now)
export interface Place {
  id: string;
  name: string;
  county?: string;
  state?: string;
  country?: string;
}

// Haplogroup type (simplified for now)
export interface Haplogroup {
  id: string;
  abbreviation: string;
  fullName?: string;
  type?: 'Y-DNA' | 'mtDNA';
}

/**
 * Format a Person entity for display in typeahead results
 */
export const formatPerson = (person: Person) => ({
  primary: `${person.givenName} ${person.surname}`,
  secondary: [
    person.birthDate ? `b. ${person.birthDate}` : null,
    person.birthPlace?.name,
    person.lineages?.[0]?.displayName,
  ].filter(Boolean).join(' · '),
  avatar: <User className="h-5 w-5 text-gray-500" />,
});

/**
 * Format a Participant entity for display in typeahead results
 */
export const formatParticipant = (participant: Participant) => ({
  primary: participant.displayName,
  secondary: [
    participant.email,
    participant.kitNumber ? `Kit ${participant.kitNumber}` : null,
    participant.haplogroup?.abbreviation,
  ].filter(Boolean).join(' · '),
  avatar: participant.active
    ? <UserCheck className="h-5 w-5 text-green-500" />
    : <User className="h-5 w-5 text-gray-400" />,
});

/**
 * Format a Place entity for display in typeahead results
 */
export const formatPlace = (place: Place) => ({
  primary: place.name,
  secondary: [
    place.county,
    place.state,
    place.country,
  ].filter(Boolean).join(', '),
  avatar: <MapPin className="h-5 w-5 text-blue-500" />,
});

/**
 * Format a Lineage entity for display in typeahead results
 */
export const formatLineage = (lineage: Lineage) => ({
  primary: lineage.displayName,
  secondary: `${lineage.region} · ${lineage.participantCount} members`,
  avatar: <Users className="h-5 w-5 text-purple-500" />,
});

/**
 * Format a Haplogroup entity for display in typeahead results
 */
export const formatHaplogroup = (haplogroup: Haplogroup) => ({
  primary: haplogroup.abbreviation,
  secondary: [
    haplogroup.fullName,
    haplogroup.type,
  ].filter(Boolean).join(' · '),
  avatar: <Dna className="h-5 w-5 text-indigo-500" />,
});
