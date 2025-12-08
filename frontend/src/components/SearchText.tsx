export interface SearchTextProps {
  searchVal: string;
  loading: boolean;
  results: number;
}

export default function SearchText({
  searchVal,
  loading,
  results,
}: SearchTextProps) {
  const text = loading
    ? 'Searching'
    : searchVal
    ? `Search for "${searchVal}" : ${results} results`
    : `Showing all ${results} matters`;
  return <span className="text-xs text-gray-700"> {text}</span>;
}
