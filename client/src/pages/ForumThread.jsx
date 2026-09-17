import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle, Flag, Lock, Loader2, Send, Bookmark, Share2, Smile } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';

const REACTIONS = [
  { type: 'thumbs_up', emoji: '\uD83D\uDC4D', label: 'Like' },
  { type: 'heart', emoji: '\u2764\uFE0F', label: 'Love' },
  { type: 'celebrate', emoji: '\uD83C\uDF89', label: 'Celebrate' },
  { type: 'insightful', emoji: '\uD83D\uDCA1', label: 'Insightful' },
  { type: 'funny', emoji: '\uD83D\uDE04', label: 'Funny' },
];

function ReactionBar({ reactionCounts, userReaction, onReact }) {
  const [showPicker, setShowPicker] = useState(false);
  const counts = reactionCounts || {};
  const totalReactions = Object.values(counts).reduce((s, c) => s + c, 0);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {REACTIONS.map((r) => {
        const count = counts[r.type] || 0;
        const isActive = userReaction === r.type;
        if (count === 0 && !isActive) return null;
        return (
          <button
            key={r.type}
            onClick={() => onReact(r.type)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={r.label}
          >
            <span>{r.emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          title="Add reaction"
        >
          <Smile className="w-3.5 h-3.5" />
        </button>
        {showPicker && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPicker(false)} />
            <div className="absolute bottom-full left-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1.5 flex gap-1 z-20">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  onClick={() => { onReact(r.type); setShowPicker(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg"
                  title={r.label}
                >
                  {r.emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {totalReactions > 0 && (
        <span className="text-xs text-gray-400 ml-1">{totalReactions}</span>
      )}
    </div>
  );
}

function PostItem({ post, onReact, onReply, onReport }) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className={`${post.parent_id ? 'ml-8 pl-4 border-l-2 border-gray-100' : ''}`}>
      <div className="py-4">
        <div className="flex items-start gap-3">
          <Avatar
            src={post.author?.avatar_url}
            name={`${post.author?.first_name || ''} ${post.author?.last_name || ''}`}
            size="sm"
          />
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
            <div className="mt-2">
              <ReactionBar
                reactionCounts={post.reaction_counts}
                userReaction={post.userReaction}
                onReact={(type) => onReact(post.id, type)}
              />
            </div>
            <div className="flex items-center gap-4 mt-2">
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
          onReact={onReact}
          onReply={onReply}
          onReport={onReport}
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
  const { isAuthenticated } = useAuth();
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
  const [shareToast, setShareToast] = useState(false);

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

  const handleReact = async (postId, type) => {
    try {
      const { data } = await api.post(`/forum/posts/${postId}/reaction`, { type });
      setPosts(prev => prev.map(post => {
        if (post.id === postId) {
          return { ...post, reaction_counts: data.reactionCounts, userReaction: data.reacted ? type : null };
        }
        return {
          ...post,
          replies: (post.replies || []).map(reply => {
            if (reply.id === postId) {
              return { ...reply, reaction_counts: data.reactionCounts, userReaction: data.reacted ? type : null };
            }
            return reply;
          }),
        };
      }));
    } catch (err) {
      console.error('Error reacting:', err);
    }
  };

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
    } catch (err) {
      console.error('Error posting reply:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleBookmark = async () => {
    try {
      const { data } = await api.post(`/forum/threads/${thread.id}/bookmark`);
      setThread(prev => ({ ...prev, isBookmarked: data.bookmarked }));
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = window.location.href;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2000);
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
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar
              src={thread.author?.avatar_url}
              name={`${thread.author?.first_name || ''} ${thread.author?.last_name || ''}`}
              size="md"
            />
            <div className="flex-1 min-w-0">
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
                <span>{thread.author?.first_name} {thread.author?.last_name}</span>
                <span>{new Date(thread.created_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}</span>
                <span>{thread.view_count} views</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <button
                onClick={handleBookmark}
                className={`p-2 rounded-lg transition-colors ${
                  thread.isBookmarked
                    ? 'text-yellow-500 bg-yellow-50'
                    : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-50'
                }`}
                title={thread.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              >
                <Bookmark className={`w-5 h-5 ${thread.isBookmarked ? 'fill-current' : ''}`} />
              </button>
            )}
            <button
              onClick={handleShare}
              className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors relative"
              title="Share"
            >
              <Share2 className="w-5 h-5" />
              {shareToast && (
                <span className="absolute -top-8 right-0 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  Link copied!
                </span>
              )}
            </button>
          </div>
        </div>
        <div className="mt-4 text-gray-700 whitespace-pre-wrap border-t border-gray-100 pt-4">{thread.body}</div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {pagination?.total || posts.length} {(pagination?.total || posts.length) === 1 ? 'Reply' : 'Replies'}
        </h2>
      </div>

      <div className="space-y-1 divide-y divide-gray-100">
        {posts.map((post) => (
          <PostItem
            key={post.id}
            post={post}
            onReact={handleReact}
            onReply={handleReply}
            onReport={openReport}
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
            <Link to="/login" state={{ from: { pathname: `/forum/thread/${slug}` } }} className="text-primary-600 hover:text-primary-500 font-medium">Log in</Link>
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
