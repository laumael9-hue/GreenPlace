import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Heart, MessageCircle, Flag, Lock, Loader2, Send } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';

function PostItem({ post, onLike, onReply, onReport, currentUserId }) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localLiked, setLocalLiked] = useState(false);
  const [localLikeCount, setLocalLikeCount] = useState(post.like_count || 0);

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      await onReply(replyBody.trim(), post.id);
      setReplyBody('');
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async () => {
    try {
      const res = await api.post(`/forum/posts/${post.id}/like`);
      setLocalLiked(res.data.liked);
      setLocalLikeCount(res.data.likeCount);
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  return (
    <div className={`${post.parent_id ? 'ml-8 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className="py-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-sm font-medium flex-shrink-0">
            {post.author?.first_name?.[0]}{post.author?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">
                {post.author?.first_name} {post.author?.last_name}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(post.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {post.is_edited && (
                <span className="text-xs text-gray-400 italic">(edited)</span>
              )}
            </div>
            <div className="mt-1 text-gray-700 whitespace-pre-wrap text-sm">{post.body}</div>
            <div className="flex items-center gap-4 mt-2">
              <button
                onClick={handleLike}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  localLiked ? 'text-red-500' : 'text-gray-400 hover:text-red-400'
                }`}
              >
                <Heart className={`w-4 h-4 ${localLiked ? 'fill-current' : ''}`} />
                {localLikeCount}
              </button>
              <button
                onClick={() => setShowReply(!showReply)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Reply
              </button>
              <button
                onClick={() => onReport(post.id)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors"
              >
                <Flag className="w-4 h-4" />
                Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {post.replies && post.replies.map((reply) => (
        <PostItem
          key={reply.id}
          post={{ ...reply, parent_id: post.id }}
          onLike={onLike}
          onReply={onReply}
          onReport={onReport}
          currentUserId={currentUserId}
        />
      ))}

      {showReply && (
        <form onSubmit={handleReply} className="ml-11 mb-4 flex gap-2">
          <input
            type="text"
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            autoFocus
          />
          <Button type="submit" size="sm" disabled={submitting || !replyBody.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
      )}
    </div>
  );
}

export default function ForumThread() {
  const { slug } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [thread, setThread] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reporting, setReporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const fetchThread = useCallback(async () => {
    try {
      const { data } = await api.get(`/forum/threads/${slug}`, { params: { page, limit: 30 } });
      setThread(data.thread);
      setPosts(data.posts || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching thread:', err);
    } finally {
      setLoading(false);
    }
  }, [slug, page]);

  useEffect(() => { fetchThread(); }, [fetchThread]);

  const handleReply = async (body, parentId = null) => {
    await api.post(`/forum/threads/${thread.id}/posts`, { body, parentId });
    fetchThread();
  };

  const handleRootReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      await handleReply(replyBody.trim());
      setReplyBody('');
    } finally {
      setSubmitting(false);
    }
  };

  const openReport = (targetId) => {
    setReportTarget(targetId);
    setShowReport(true);
  };

  const handleReport = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;
    setReporting(true);
    try {
      await api.post('/forum/report', {
        targetType: 'post',
        targetId: reportTarget,
        reason: reportReason.trim(),
        description: reportDescription.trim() || undefined,
      });
      setShowReport(false);
      setReportReason('');
      setReportDescription('');
      setReportTarget(null);
    } catch (err) {
      console.error('Error reporting:', err);
    } finally {
      setReporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold text-gray-900">Thread not found</h2>
        <Link to="/forum" className="text-primary-600 hover:text-primary-500 mt-2 inline-block">Back to Forum</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/forum" className="hover:text-primary-600">Forum</Link>
        <span>/</span>
        {thread.category && (
          <>
            <Link to={`/forum/${thread.category.slug}`} className="hover:text-primary-600">
              {thread.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-900 font-medium truncate">{thread.title}</span>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {thread.is_pinned && (
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded">Pinned</span>
              )}
              {thread.is_locked && (
                <span className="flex items-center gap-1 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  <Lock className="w-3 h-3" />Locked
                </span>
              )}
              {thread.category && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: (thread.category.color || '#10B981') + '20',
                    color: thread.category.color || '#10B981',
                  }}
                >
                  {thread.category.name}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">{thread.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>by {thread.author?.first_name} {thread.author?.last_name}</span>
              <span>{new Date(thread.created_at).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}</span>
              <span>{thread.view_count} views</span>
            </div>
          </div>
        </div>
        <div className="mt-4 text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">{thread.body}</div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {pagination?.total || posts.length} {pagination?.total === 1 ? 'Reply' : 'Replies'}
        </h2>
      </div>

      <div className="space-y-1 divide-y divide-gray-100">
        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            onLike={() => {}}
            onReply={handleReply}
            onReport={openReport}
            currentUserId={user?.id}
          />
        ))}
      </div>

      {posts.length === 0 && (
        <Card>
          <p className="text-center text-gray-500 py-8">No replies yet. Be the first to respond!</p>
        </Card>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-gray-600">Page {page} of {pagination.pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {isAuthenticated && !thread.is_locked && (
        <Card>
          <h3 className="font-medium text-gray-900 mb-3">Post a Reply</h3>
          <form onSubmit={handleRootReply}>
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Share your thoughts..."
            />
            <div className="flex justify-end mt-3">
              <Button type="submit" disabled={submitting || !replyBody.trim()}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                Post Reply
              </Button>
            </div>
          </form>
        </Card>
      )}

      {thread.is_locked && (
        <Card>
          <div className="flex items-center gap-2 text-orange-600 justify-center py-4">
            <Lock className="w-5 h-5" />
            <span className="font-medium">This thread is locked. No new replies can be posted.</span>
          </div>
        </Card>
      )}

      {!isAuthenticated && (
        <Card>
          <p className="text-center text-gray-500 py-4">
            <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">Log in</Link>
            {' '}to join the discussion.
          </p>
        </Card>
      )}

      <Modal open={showReport} onClose={() => setShowReport(false)} title="Report Content">
        <form onSubmit={handleReport} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam</option>
              <option value="harassment">Harassment</option>
              <option value="misinformation">Misinformation</option>
              <option value="inappropriate">Inappropriate Content</option>
              <option value="off-topic">Off-Topic</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Details (optional)</label>
            <textarea
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Provide more context..."
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setShowReport(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={reporting || !reportReason.trim()}>
              {reporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
              Submit Report
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
