import React, { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DateModifier } from '../../../lib/mock-data';

interface GenealogyDateInputProps {
  value: string;
  modifier: DateModifier;
  onChange: (value: string, modifier: DateModifier) => void;
  label: string;
}

const DATE_MODIFIERS: { value: DateModifier; label: string }[] = [
  { value: 'exact', label: 'Exact' },
  { value: 'about', label: 'About' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'between', label: 'Between' },
  { value: 'calculated', label: 'Calculated' },
  { value: 'estimated', label: 'Estimated' },
];

export function GenealogyDateInput({ value, modifier, onChange, label }: GenealogyDateInputProps) {
  const [dateValue, setDateValue] = useState(value);
  const [dateModifier, setDateModifier] = useState<DateModifier>(modifier);

  // Parse date on mount to extract modifier if present
  useEffect(() => {
    if (value) {
      const parsed = parseDateString(value);
      setDateValue(parsed.cleanDate);
      setDateModifier(parsed.modifier);
    }
  }, []);

  const parseDateString = (dateStr: string): { cleanDate: string; modifier: DateModifier } => {
    const upper = dateStr.trim().toUpperCase();

    if (upper.startsWith('ABT ')) {
      return { cleanDate: dateStr.substring(4).trim(), modifier: 'about' };
    }
    if (upper.startsWith('BEF ')) {
      return { cleanDate: dateStr.substring(4).trim(), modifier: 'before' };
    }
    if (upper.startsWith('AFT ')) {
      return { cleanDate: dateStr.substring(4).trim(), modifier: 'after' };
    }
    if (upper.includes(' BET ') && upper.includes(' AND ')) {
      return { cleanDate: dateStr, modifier: 'between' };
    }
    if (upper.startsWith('CAL ')) {
      return { cleanDate: dateStr.substring(4).trim(), modifier: 'calculated' };
    }
    if (upper.startsWith('EST ')) {
      return { cleanDate: dateStr.substring(4).trim(), modifier: 'estimated' };
    }

    return { cleanDate: dateStr, modifier: 'exact' };
  };

  const formatDateWithModifier = (date: string, mod: DateModifier): string => {
    if (!date || date.trim() === '') return '';

    switch (mod) {
      case 'about':
        return `ABT ${date}`;
      case 'before':
        return `BEF ${date}`;
      case 'after':
        return `AFT ${date}`;
      case 'calculated':
        return `CAL ${date}`;
      case 'estimated':
        return `EST ${date}`;
      case 'between':
        return date; // User enters full "BET 1800 AND 1810"
      case 'exact':
      default:
        return date;
    }
  };

  const handleDateChange = (newDate: string) => {
    setDateValue(newDate);
    const formatted = formatDateWithModifier(newDate, dateModifier);
    onChange(formatted, dateModifier);
  };

  const handleModifierChange = (newModifier: DateModifier) => {
    setDateModifier(newModifier);
    const formatted = formatDateWithModifier(dateValue, newModifier);
    onChange(formatted, newModifier);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Input
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
            placeholder="e.g., 1792, 5 APR 1856, BET 1800 AND 1810"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formats: 1792, 5 APR 1856, BET 1800 AND 1810
          </p>
        </div>
        <div>
          <Select value={dateModifier} onValueChange={(value) => handleModifierChange(value as DateModifier)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_MODIFIERS.map(mod => (
                <SelectItem key={mod.value} value={mod.value}>
                  {mod.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
