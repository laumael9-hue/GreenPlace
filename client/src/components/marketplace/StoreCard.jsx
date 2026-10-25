import { Link } from 'react-router-dom';
import { Star, MapPin, Store, BadgeCheck } from 'lucide-react';
import Badge from '../ui/Badge';

export default function StoreCard({ business }) {
  if (!business) return null;

  return (
    <Link
      to={`/establishments/${business.slug}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 w-64 flex-shrink-0 hover:shadow-md hover:border-primary-200 transition-all"
    >
      <div className="flex gap-3">
        {business.logo_url ? (
          <img
            src={business.logo_url}
            alt={business.name}
            className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Store className="w-6 h-6 text-primary-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <h3 className="font-semibold text-gray-900 truncate">{business.name}</h3>
            {business.is_verified && (
              <BadgeCheck className="w-4 h-4 text-primary-600 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{business.category}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            {(business.rating_count || 0) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                {parseFloat(business.rating_avg || 0).toFixed(1)}
                <span>({business.rating_count})</span>
              </span>
            )}
            {business.distance_km != null && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {business.distance_km} km
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        {business.accepts_drop_offs && (
          <Badge variant="success" className="text-[10px]">Drop-off</Badge>
        )}
        {business.has_marketplace && (
          <Badge variant="info" className="text-[10px]">Marketplace</Badge>
        )}
        {business.recommendation && (
          <Badge variant="warning" className="text-[10px]">
            {Math.round(business.recommendation.score * 100)}% match
          </Badge>
        )}
      </div>
    </Link>
  );
}
