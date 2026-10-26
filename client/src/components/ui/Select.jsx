export default function Select({ label, options = [], error, className = '', ...props }) {
  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>}
      <select
        className={`block w-full px-3.5 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-4 sm:text-sm bg-white text-gray-900 transition-all ${
          error
            ? 'border-red-300 focus:ring-red-500/15 focus:border-red-500'
            : 'border-gray-200 hover:border-gray-300 focus:ring-primary-500/15 focus:border-primary-500'
        }`}
        {...props}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
