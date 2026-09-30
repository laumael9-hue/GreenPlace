import { Star } from 'lucide-react';
import StarRating from '../ui/StarRating';

export default function ReviewSummary({ summary }) {
  if (!summary) return null;

  const { avg = 0, count = 0, breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } = summary;
  const total = Object.values(breakdown).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
      {/* Average */}
      <div className="text-center sm:text-left sm:min-w-[140px]">
        <p className="text-4xl font-bold text-gray-900">{avg.toFixed(1)}</p>
        <StarRating value={avg} size="sm" className="justify-center sm:justify-start mt-1" />
        <p className="text-sm text-gray-500 mt-1">
          {count} review{count === 1 ? '' : 's'}
        </p>
      </div>

      {/* Per-star breakdown */}
      <div className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const ratingCount = breakdown[star] || 0;
          const percent = total > 0 ? (ratingCount / total) * 100 : 0;
          return (
            <div key={star} className="flex items-center gap-2 text-sm">
              <span className="w-4 text-gray-500 text-right">{star}</span>
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-8 text-right text-gray-500">{ratingCount}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
