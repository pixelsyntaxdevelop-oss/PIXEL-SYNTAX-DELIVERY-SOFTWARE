import React, { useState } from 'react';
import { ALL_NATIONALITIES, COMMON_NATIONALITIES } from '../../lib/nationalities';
import { Search } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export const NationalitySelector: React.FC<Props> = ({ value, onChange, className, disabled }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = ALL_NATIONALITIES.filter(n => n.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={isOpen ? search : value}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search nationality..."
          className={`block w-full rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:border-indigo-500 focus:ring-indigo-500 ${className}`}
          disabled={disabled}
        />
        <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
      </div>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {filtered.map(n => (
            <button
              key={n}
              onClick={() => {
                onChange(n);
                setSearch(n);
                setIsOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {n} {COMMON_NATIONALITIES.includes(n as any) && <span className="text-[10px] text-slate-400">(Popular)</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
