import React from 'react';
import { UAE_LOCATIONS } from '../../lib/uaeLocations';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export const UaeLocationSelector: React.FC<Props> = ({ value, onChange, className, disabled }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={`block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:border-indigo-500 focus:ring-indigo-500 ${className}`}
    >
      <option value="">Select Location</option>
      {UAE_LOCATIONS.map((loc) => (
        <option key={loc} value={loc}>
          {loc}
        </option>
      ))}
    </select>
  );
};
