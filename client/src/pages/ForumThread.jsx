import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MessageCircle, Flag, Lock, Loader2, Send, Bookmark, Share2, Smile,
  Image as ImageIcon, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
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

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function ImageGallery({ images, onOpen, compact = false }) {
  if (!images || images.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-1 rounded-xl overflow-hidden ${
      images.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-2'
    }`}>
      {images.slice(0, MAX_IMAGES).map((url, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onOpen(i); }}
          className="group relative"
        >
          <img
            src={url}
            alt=""
            className={`w-full object-cover transition-opacity hover:opacity-90 ${
              compact ? 'h-24' : 'h-40'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function Lightbox({ images, index, onClose, onNavigate }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2"
        onClick={onClose}
        title="Close"
      >
        <X className="w-6 h-6" />
      </button>
      {images.length > 1 && (
        <>
          <button
            className="absolute left-4 text-white/80 hover:text-white p-2"
            onClick={(e) => { e.stopPropagation(); onNavigate(index - 1); }}
            title="Previous"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            className="absolute right-4 text-white/80 hover:text-white p-2"
            onClick={(e) => { e.stopPropagation(); onNavigate(index + 1); }}
            title="Next"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}
      <img
        src={images[index]}
        alt=""
        className="max-h-[85vh] max-w-[90vw] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <span className="absolute bottom-4 text-white/60 text-sm">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}

function ImagePickerButton({ files, onFilesSelected, disabled }) {
  const inputRef = useRef(null);
  const full = files.length >= MAX_IMAGES;

  const handleChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    e.target.value = '';
    if (incoming.length > 0) onFilesSelected(incoming);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled || full}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || full}
        className="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        title={full ? 'Photo limit reached' : 'Add photos'}
      >
        <ImageIcon className="w-5 h-5" />
      </button>
    </>
  );
}

function ImagePreviews({ previews, onRemove }) {
  if (previews.length === 0) return null;
  return (
    <div className="flex gap-2 mb-2">
      {previews.map((preview, i) => (
        <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden group">
          <img src={preview} alt="" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(i)}
            className="absolute top-0.5 right-0.5 w-4 h-4 bg-gray-900/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title="Remove photo"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

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

function PostItem({ post, onReact, onReply, onReport, onOpenLightbox, isAuthenticated }) {
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyFiles, setReplyFiles] = useState([]);
  const [replyPreviews, setReplyPreviews] = useState([]);
  const [replyError, setReplyError] = useState('');

  const addFiles = (incoming) => {
    setReplyError('');
    const remaining = MAX_IMAGES - replyFiles.length;
    if (incoming.length > remaining) {
      setReplyError(`Max ${MAX_IMAGES} photos.`);
      return;
    }
    for (const file of incoming) {
      if (file.size > MAX_IMAGE_SIZE) { setReplyError('Each photo must be under 5MB.'); return; }
      if (!ACCEPTED_TYPES.includes(file.type)) { setReplyError('Only JPG, PNG, WebP.'); return; }
    }
    setReplyFiles(prev => [...prev, ...incoming]);
    incoming.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setReplyPreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removePreview = (index) => {
    setReplyFiles(prev => prev.filter((_, i) => i !== index));
    setReplyPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() && replyFiles.length === 0) return;
    setSubmitting(true);
    try {
      await onReply(replyBody.trim() || '(image)', post.id, replyFiles);
      setReplyBody('');
      setReplyFiles([]);
      setReplyPreviews([]);
      setReplyError('');
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
            <ImageGallery
              images={post.images}
              compact
              onOpen={(i) => onOpenLightbox(post.images, i)}
            />
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
          onOpenLightbox={onOpenLightbox}
          isAuthenticated={isAuthenticated}
        />
      ))}

      {showReply && isAuthenticated && (
        <form onSubmit={handleReply} className="ml-11 mb-4">
          <ImagePreviews previews={replyPreviews} onRemove={removePreview} />
          {replyError && <p className="text-xs text-red-500 mb-1">{replyError}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
            <ImagePickerButton
              files={replyFiles}
              onFilesSelected={addFiles}
              disabled={submitting}
            />
            <Button type="submit" size="sm" disabled={submitting || (!replyBody.trim() && replyFiles.length === 0)}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
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
  const [lightbox, setLightbox] = useState(null);
  const [rootFiles, setRootFiles] = useState([]);
  const [rootPreviews, setRootPreviews] = useState([]);
  const [rootError, setRootError] = useState('');

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

  const uploadImages = async (files) => {
    const urls = [];
    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/forum/upload-image', formData);
      urls.push(data.image_url);
    }
    return urls;
  };

  const addRootFiles = (incoming) => {
    setRootError('');
    const remaining = MAX_IMAGES - rootFiles.length;
    if (incoming.length > remaining) {
      setRootError(`Max ${MAX_IMAGES} photos.`);
      return;
    }
    for (const file of incoming) {
      if (file.size > MAX_IMAGE_SIZE) { setRootError('Each photo must be under 5MB.'); return; }
      if (!ACCEPTED_TYPES.includes(file.type)) { setRootError('Only JPG, PNG, WebP.'); return; }
    }
    setRootFiles(prev => [...prev, ...incoming]);
    incoming.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setRootPreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeRootPreview = (index) => {
    setRootFiles(prev => prev.filter((_, i) => i !== index));
    setRootPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleReply = async (body, parentId = null, files = []) => {
    let images = [];
    if (files.length > 0) {
      images = await uploadImages(files);
    }
    await api.post(`/forum/threads/${thread.id}/posts`, { body, parentId, images });
    fetchThread();
  };

  const handleRootReply = async (e) => {
    e.preventDefault();
    if (!replyBody.trim() && rootFiles.length === 0) return;
    setSubmitting(true);
    try {
      await handleReply(replyBody.trim() || '(image)', null, rootFiles);
      setReplyBody('');
      setRootFiles([]);
      setRootPreviews([]);
      setRootError('');
    } catch (err) {
      console.error('Error posting reply:', err);
      setRootError(err.response?.data?.error || 'Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  const openLightbox = (images, index) => {
    setLightbox({ images, index });
  };

  const navigateLightbox = (newIndex) => {
    setLightbox(prev => {
      if (!prev) return prev;
      const len = prev.images.length;
      return { ...prev, index: ((newIndex % len) + len) % len };
    });
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
        <ImageGallery
          images={thread.images}
          onOpen={(i) => openLightbox(thread.images, i)}
        />
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
            onOpenLightbox={openLightbox}
            isAuthenticated={isAuthenticated}
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
            <ImagePreviews previews={rootPreviews} onRemove={removeRootPreview} />
            {rootError && <p className="text-xs text-red-500 mb-1">{rootError}</p>}
            <textarea
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Share your thoughts..."
            />
            <div className="flex items-center justify-between mt-3">
              <ImagePickerButton
                files={rootFiles}
                onFilesSelected={addRootFiles}
                disabled={submitting}
              />
              <Button type="submit" disabled={submitting || (!replyBody.trim() && rootFiles.length === 0)}>
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

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onNavigate={navigateLightbox}
        />
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
