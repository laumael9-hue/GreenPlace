import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import api from '../../lib/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StarRating from '../ui/StarRating';

export default function ReviewModal({
  open,
  onClose,
  businessId,
  orderId = null,
  dropOffId = null,
  businessName = '',
  existingReview = null,
  onSaved,
}) {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating || 0);
      setTitle(existingReview?.title || '');
      setBody(existingReview?.body || '');
      setIsAnonymous(!!existingReview?.is_anonymous);
      setError('');
      setSubmitting(false);
    }
  }, [open, existingReview]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!rating) {
      setError('Please select a rating');
      return;
    }
    if (!body.trim()) {
      setError('Please write a few words about your experience');
      return;
    }

    setSubmitting(true);
    try {
      const payload = { rating, title, body, isAnonymous };
      const { data } = existingReview
        ? await api.patch(`/reviews/${existingReview.id}`, payload)
        : await api.post('/reviews', { ...payload, businessId, orderId, dropOffId });

      onSaved?.(data.review);
      onClose();
    } catch (err) {
      if (err?.response?.status === 401) {
        navigate('/login');
        return;
      }
      setError(err?.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existingReview ? 'Edit Your Review' : businessName ? `Review ${businessName}` : 'Write a Review'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Your rating</label>
          <StarRating value={rating} onChange={setRating} size="lg" />
        </div>

        <div>
          <label htmlFor="review-title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            id="review-title"
            type="text"
            maxLength={255}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Sum it up"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="review-body" className="block text-sm font-medium text-gray-700 mb-1">
            Review
          </label>
          <textarea
            id="review-body"
            rows={4}
            maxLength={2000}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Share your experience (at least 10 characters)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <p className="text-xs text-gray-400 text-right mt-1">{body.length}/2000</p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.checked)}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Post anonymously
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {existingReview ? 'Save Changes' : 'Submit Review'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
