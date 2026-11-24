export function Spinner({ size = 'md', label }: { size?: 'sm' | 'md' | 'lg'; label?: string }) {
  const dims =
    size === 'sm' ? 'h-4 w-4 border-2' : size === 'lg' ? 'h-8 w-8 border-2' : 'h-5 w-5 border-2';

  return (
    <div className="flex items-center justify-center gap-2 text-gray-500">
      <div
        className={`${dims} animate-spin rounded-full border-gray-200 border-t-[#00A838]`}
        role="status"
        aria-label={label || 'Loading'}
      />
      {label && <span className="text-xs text-gray-500">{label}</span>}
    </div>
  );
}
