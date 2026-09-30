import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Loader2, Star, ChevronLeft, ChevronRight, XCircle } from 'lucide-react';
import api from '../../lib/api';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import EmptyState from '../../components/ui/EmptyState';
import ReviewSummary from '../../components/reviews/ReviewSummary';
import ReviewCard from '../../components/reviews/ReviewCard';

export default function ReviewManagement() {
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState('');

  const fetchReviews = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: 10 };
      if (filter) params.rating = filter;
      const { data } = await api.get('/reviews/for-my-business', { params });
      setReviews(data.reviews || []);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err) {
      setReviews([]);
      if (err?.response?.status === 404) {
        setError('No business found for this account.');
      } else {
        setError(err?.response?.data?.error || 'Failed to load reviews');
      }
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchReviews(1); }, [fetchReviews]);

  const openReply = (review) => {
    setReplyTarget(review);
    setReplyText(review.business_reply || '');
    setReplyError('');
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) {
      setReplyError('Reply text is required');
      return;
    }
    setReplyLoading(true);
    setReplyError('');
    try {
      const { data } = await api.post(`/reviews/${replyTarget.id}/reply`, { reply: replyText });
      setReviews((prev) =>
        prev.map((review) => (review.id === replyTarget.id ? { ...review, ...data.review } : review))
      );
      setReplyTarget(null);
      setReplyText('');
    } catch (err) {
      setReplyError(err?.response?.data?.error || 'Failed to post reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const filterOptions = [
    { value: '', label: 'All' },
    { value: '5', label: '5★' },
    { value: '4', label: '4★' },
    { value: '3', label: '3★' },
    { value: '2', label: '2★' },
    { value: '1', label: '1★' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="text-gray-500 mt-1">See what customers are saying and respond to their feedback</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="p-1 text-red-400 hover:text-red-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Rating summary */}
      {!loading && summary && !error && (
        <Card>
          <ReviewSummary summary={summary} />
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === opt.value
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Star className="w-8 h-8" />}
            title={filter ? `No ${filter}-star reviews` : 'No reviews yet'}
            description={
              filter
                ? 'Try a different filter to see other reviews.'
                : 'Reviews from customers will appear here once they share their experience.'
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-gray-50 -my-1">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                actions={
                  <Button variant="outline" size="sm" onClick={() => openReply(review)}>
                    <MessageSquare className="w-4 h-4" />
                    {review.business_reply ? 'Edit Response' : 'Respond'}
                  </Button>
                }
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-1 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchReviews(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <span className="text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => fetchReviews(pagination.page + 1)}
                  disabled={pagination.page >= pagination.pages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Reply modal */}
      <Modal
        open={!!replyTarget}
        onClose={() => setReplyTarget(null)}
        title={replyTarget?.business_reply ? 'Edit Response' : 'Respond to Review'}
        maxWidth="max-w-md"
      >
        {replyTarget && (
          <form onSubmit={submitReply} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {replyTarget.is_anonymous
                    ? 'Anonymous'
                    : `${replyTarget.reviewer?.first_name || ''} ${replyTarget.reviewer?.last_name || ''}`.trim() || 'Customer'}
                </span>
                <span className="text-yellow-400 text-sm">
                  {'★'.repeat(replyTarget.rating)}
                  <span className="text-gray-300">{'★'.repeat(5 - replyTarget.rating)}</span>
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-1">{replyTarget.body}</p>
            </div>

            <div>
              <label htmlFor="reply-body" className="block text-sm font-medium text-gray-700 mb-1">
                Your response
              </label>
              <textarea
                id="reply-body"
                rows={4}
                maxLength={1000}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Thank the reviewer or address their feedback"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
              />
              <p className="text-xs text-gray-400 text-right mt-1">{replyText.length}/1000</p>
            </div>

            {replyError && <p className="text-sm text-red-600">{replyError}</p>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setReplyTarget(null)} disabled={replyLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={replyLoading}>
                {replyLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {replyTarget.business_reply ? 'Update Response' : 'Post Response'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
