import { useRef } from 'react';

export interface SearchBarProps {
  onSearch: (value: string) => unknown;
  className?: string;
  placeholder?: string;
  debounceMs?: number;
}

export default function SearchBar({
  onSearch,
  className = '',
  placeholder = 'Search matters...',
  debounceMs = 500,
}: SearchBarProps) {
  // search state is in parent no need for duplication of state or useEffect
  const timeoutRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, debounceMs);
  };

  const handleClear = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onSearch('');
  };
  return (
    <div className="relative flex content-start gap-3 items-center w-full">
      <input
        ref={inputRef}
        onChange={handleChange}
        placeholder={placeholder}
        className={`rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500${className}`}
      />
      <button
        onClick={handleClear}
        className="text-gray-400 hover:text-gray-600"
      >
        Clear
      </button>
    </div>
  );
}
