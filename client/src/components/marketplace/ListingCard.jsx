import { Link } from 'react-router-dom';
import { ShoppingBag, Tag, Loader2, Package, Flag, Star } from 'lucide-react';
import Badge from '../ui/Badge';

const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  used: 'Used',
};

export default function ListingCard({ listing, onAddToCart, addingToCart, onReport, currentUser }) {
  const isAdding = addingToCart === listing.id;
  const seller = listing.seller;
  const business = listing.business;
  const sellerName = business?.name || (seller ? `${seller.first_name} ${seller.last_name}` : 'Seller');

  return (
    <div className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <Link to={`/marketplace/${listing.slug}`} className="block">
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-primary-50 to-emerald-50">
          {listing.primary_image ? (
            <img
              src={listing.primary_image}
              alt={listing.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="w-12 h-12 text-primary-300" />
            </div>
          )}
          {listing.original_price && parseFloat(listing.original_price) > listing.price && (
            <div className="absolute top-2 left-2">
              <Badge variant="danger" className="text-[10px]">
                {Math.round((1 - listing.price / listing.original_price) * 100)}% OFF
              </Badge>
            </div>
          )}
          {listing.is_featured && (
            <div className="absolute top-2 right-2">
              <Badge variant="warning" className="text-[10px]">Featured</Badge>
            </div>
          )}
          {/* Slide-up cart overlay */}
          {onAddToCart && (
            <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out bg-gradient-to-t from-primary-700 to-primary-600 px-3 py-2.5 flex items-center justify-between">
              <span className="text-white text-xs font-medium">
                {listing.quantity_available < 1 ? 'Out of stock' : 'Add to cart'}
              </span>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (listing.quantity_available >= 1) onAddToCart(listing.id);
                }}
                disabled={isAdding || listing.quantity_available < 1}
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-primary-600 hover:bg-emerald-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                aria-label="Add to cart"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex-1">
          <Link to={`/marketplace/${listing.slug}`}>
            <h3 className="font-semibold text-gray-900 line-clamp-2 hover:text-primary-600 transition-colors">
              {listing.title}
            </h3>
          </Link>
          <p className="text-xs text-gray-500 mt-1">{sellerName}</p>
          {(listing.rating_count || 0) > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-xs font-medium text-gray-700">
                {parseFloat(listing.rating_avg || 0).toFixed(1)}
              </span>
              <span className="text-xs text-gray-400">({listing.rating_count})</span>
            </div>
          )}
          {listing.category && (
            <div className="mt-2">
              <Badge variant="neutral" className="text-[10px]">
                {listing.category.name}
              </Badge>
            </div>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            {listing.condition && (
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {CONDITION_LABELS[listing.condition] || listing.condition}
              </span>
            )}
            {listing.city && <span>{listing.city}</span>}
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <p className="text-lg font-bold text-primary-600">
              ₱{parseFloat(listing.price).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </p>
            {listing.unit && listing.unit !== 'piece' && (
              <p className="text-[10px] text-gray-400">per {listing.unit}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {onReport && (!currentUser || listing.seller?.id !== currentUser.id) && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onReport(listing.id);
                }}
                className="p-1.5 text-gray-400 hover:text-orange-500 transition-colors"
                title="Report listing"
              >
                <Flag className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
