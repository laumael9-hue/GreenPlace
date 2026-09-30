import { Calendar, ShoppingBag, PackageCheck, MessageSquare } from 'lucide-react';
import StarRating from '../ui/StarRating';

const initials = (review) => {
  const name = review?.reviewer;
  if (!name) return '?';
  const first = (name.first_name || '').trim()[0] || '';
  const last = (name.last_name || '').trim()[0] || '';
  return (first + last).toUpperCase() || '?';
};

const displayName = (review) => {
  const name = review?.reviewer;
  if (!name) return 'Anonymous';
  return `${name.first_name || ''} ${name.last_name || ''}`.trim() || 'Anonymous';
};

export default function ReviewCard({ review, actions }) {
  if (!review) return null;

  const verifiedOrder = !!review.order_id || !!review.source_order;
  const verifiedDropOff = !!review.drop_off_id || !!review.source_drop_off;
  const contextLabel = review.source_order
    ? `Order ${review.source_order}`
    : review.source_drop_off
      ? `Drop-off ${review.source_drop_off}`
      : null;

  return (
    <div className="py-5 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
          {initials(review)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-gray-900">{displayName(review)}</span>
              <StarRating value={review.rating} size="sm" />
            </div>
            <span className="text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap">
              <Calendar className="w-3 h-3" />
              {new Date(review.created_at).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          {(verifiedOrder || verifiedDropOff) && (
            <span
              className={`inline-flex items-center gap-1 mt-1 text-[11px] font-medium px-1.5 py-0.5 rounded ${
                verifiedOrder
                  ? 'bg-green-50 text-green-700'
                  : 'bg-primary-50 text-primary-700'
              }`}
            >
              {verifiedOrder ? (
                <ShoppingBag className="w-3 h-3" />
              ) : (
                <PackageCheck className="w-3 h-3" />
              )}
              Verified {verifiedOrder ? 'order' : 'drop-off'}
              {contextLabel ? ` · ${contextLabel}` : ''}
            </span>
          )}

          {review.title && (
            <p className="text-sm font-semibold text-gray-900 mt-2">{review.title}</p>
          )}
          <p className="text-sm text-gray-600 mt-1 whitespace-pre-line break-words">{review.body}</p>

          {/* Business reply */}
          {review.business_reply && (
            <div className="mt-3 ml-1 pl-3 border-l-2 border-primary-200 bg-gray-50 rounded-r-lg p-3">
              <p className="text-xs font-semibold text-primary-700 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                Business response
              </p>
              <p className="text-sm text-gray-600 mt-1 whitespace-pre-line break-words">
                {review.business_reply}
              </p>
              {review.business_replied_at && (
                <p className="text-[11px] text-gray-400 mt-1">
                  {new Date(review.business_replied_at).toLocaleDateString('en-PH', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          )}

          {actions && <div className="mt-3">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
