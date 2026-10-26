export default function EmptyState({ icon, title, description, action }) {
  return (
    <div className="text-center py-14 px-4">
      {icon && (
        <div className="mx-auto w-14 h-14 bg-gray-50 ring-1 ring-gray-200/70 rounded-2xl flex items-center justify-center text-gray-400 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
