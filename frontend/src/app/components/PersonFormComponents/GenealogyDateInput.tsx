import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

type DateModifier = 'EXACT' | 'ABOUT' | 'BEFORE' | 'AFTER' | 'CALCULATED' | 'PROBABLY';

interface GenealogyDateInputProps {
  value: string;
  modifier: DateModifier;
  onChange: (value: string, modifier: DateModifier) => void;
  label: string;
}

const DATE_MODIFIERS: { value: DateModifier; label: string }[] = [
  { value: 'EXACT', label: 'Exact' },
  { value: 'ABOUT', label: 'About' },
  { value: 'BEFORE', label: 'Before' },
  { value: 'AFTER', label: 'After' },
  { value: 'CALCULATED', label: 'Calculated' },
  { value: 'PROBABLY', label: 'Probably' },
];

export type { DateModifier };

export function GenealogyDateInput({ value, modifier, onChange, label }: GenealogyDateInputProps) {
  const [dateValue, setDateValue] = useState(value);
  const [dateModifier, setDateModifier] = useState<DateModifier>(modifier);

  useEffect(() => {
    const parsed = parseDateString(value);
    setDateValue(parsed.cleanDate);
    if (value) {
      setDateModifier(parsed.modifier);
    }
  }, [value]);

  const parseDateString = (dateStr: string): { cleanDate: string; modifier: DateModifier } => {
    const lower = dateStr.trim().toLowerCase();

    // Handle various genealogical date prefixes
    if (/^(abt\.?|about)\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(abt\.?|about)\s+/i, '').trim(), modifier: 'ABOUT' };
    }
    if (/^(ca\.?|circa)\s?/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(ca\.?|circa)\s?/i, '').trim(), modifier: 'ABOUT' };
    }
    if (/^(bef\.?|before)\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(bef\.?|before)\s+/i, '').trim(), modifier: 'BEFORE' };
    }
    if (/^(aft\.?|after)\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(aft\.?|after)\s+/i, '').trim(), modifier: 'AFTER' };
    }
    if (/^(cal\.?|calculated)\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(cal\.?|calculated)\s+/i, '').trim(), modifier: 'CALCULATED' };
    }
    if (/^(prob\.?\s?bet\.?|probably)\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^(prob\.?\s?bet\.?|probably)\s+/i, '').trim(), modifier: 'PROBABLY' };
    }
    if (/^bet\.?\s/i.test(lower)) {
      return { cleanDate: dateStr.replace(/^bet\.?\s+/i, '').trim(), modifier: 'PROBABLY' };
    }

    return { cleanDate: dateStr, modifier: 'EXACT' };
  };

  const formatDateWithModifier = (date: string, mod: DateModifier): string => {
    if (!date || date.trim() === '') return '';

    switch (mod) {
      case 'ABOUT':
        return `ABT ${date}`;
      case 'BEFORE':
        return `BEF ${date}`;
      case 'AFTER':
        return `AFT ${date}`;
      case 'CALCULATED':
        return `CAL ${date}`;
      case 'PROBABLY':
        return `PROB ${date}`;
      case 'EXACT':
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
            placeholder="e.g., 1792, 5 APR 1856"
          />
          <p className="text-xs text-gray-500 mt-1">
            Formats: 1792, 5 APR 1856, APR 1856
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
