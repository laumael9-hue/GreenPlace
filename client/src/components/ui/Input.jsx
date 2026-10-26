export default function Input({ label, error, id, className = '', ...props }) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`block w-full px-3.5 py-2.5 bg-white text-gray-900 border rounded-xl shadow-sm focus:outline-none focus:ring-4 sm:text-sm transition-all ${
          error
            ? 'border-red-300 focus:ring-red-500/15 focus:border-red-500'
            : 'border-gray-200 hover:border-gray-300 focus:ring-primary-500/15 focus:border-primary-500'
        }`}
        {...props}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
