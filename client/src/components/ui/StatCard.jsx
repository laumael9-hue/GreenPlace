import Card from './Card';

export default function StatCard({ icon, label, value, change, changeType = 'neutral' }) {
  const changeColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  };

  return (
    <Card className="flex items-start gap-4">
      <div className="w-12 h-12 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500 truncate">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {change !== undefined && (
          <p className={`text-xs mt-1 font-medium ${changeColors[changeType]}`}>
            {change}
          </p>
        )}
      </div>
    </Card>
  );
}
