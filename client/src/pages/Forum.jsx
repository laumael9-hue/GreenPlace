import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, Bookmark, Plus, Loader2, MessageCircle, Share2, Image as ImageIcon, X, Megaphone } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Avatar from '../components/ui/Avatar';
import Modal from '../components/ui/Modal';

const SORT_TABS = [
  { value: 'newest', label: 'New', icon: Clock },
  { value: 'trending', label: 'Trending', icon: TrendingUp },
  { value: 'popular', label: 'Top', icon: TrendingUp },
];

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

function getReactionSummary(reactionCounts) {
  if (!reactionCounts || typeof reactionCounts !== 'object') return 0;
  return Object.values(reactionCounts).reduce((sum, c) => sum + c, 0);
}

function PostCard({ thread }) {
  const totalReactions = getReactionSummary(thread.reaction_counts);

  return (
    <Link to={`/forum/thread/${thread.slug}`}>
      <Card className={`hover:shadow-md transition-all cursor-pointer ${
        thread.is_announcement ? 'border-red-200 bg-red-50/40' : ''
      }`}>
        <div className="flex items-start gap-3">
          <Avatar
            src={thread.author?.avatar_url}
            name={`${thread.author?.first_name || ''} ${thread.author?.last_name || ''}`}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {thread.author?.first_name} {thread.author?.last_name}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(thread.created_at).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })}
              </span>
              {thread.is_announcement && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                  <Megaphone className="w-3 h-3" />
                  Announcement
                </span>
              )}
              {thread.is_pinned && (
                <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">Pinned</span>
              )}
            </div>
            <h3 className="font-medium text-gray-900 mt-1 text-base">{thread.title}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{thread.body}</p>
            {thread.images && thread.images.length > 0 && (
              <div className={`mt-2 grid gap-1 rounded-xl overflow-hidden ${
                thread.images.length === 1 ? 'grid-cols-1 max-w-sm' : 'grid-cols-2'
              }`}>
                {thread.images.slice(0, 4).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-full h-32 object-cover"
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" />
                {thread.reply_count || 0}
              </span>
              {totalReactions > 0 && (
                <span className="flex items-center gap-1">
                  <span className="text-sm leading-none">+</span>
                  {totalReactions}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5" />
                Share
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export default function Forum() {
  const { isAuthenticated, role } = useAuth();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState('');
  const fileInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const navigate = useNavigate();

  const fetchThreads = useCallback(async () => {
    try {
      const { data } = await api.get('/forum/threads', { params: { page, limit: 20, sort: sortBy } });
      setThreads(data.threads || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching threads:', err);
    } finally {
      setLoading(false);
    }
  }, [sortBy, page]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/forum/search?q=${encodeURIComponent(search.trim())}`);
    }
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setImageError('');

    const remaining = MAX_IMAGES - imageFiles.length;
    if (files.length > remaining) {
      setImageError(`You can only add ${MAX_IMAGES} photos.`);
      return;
    }

    for (const file of files) {
      if (file.size > MAX_IMAGE_SIZE) {
        setImageError('Each photo must be less than 5MB.');
        return;
      }
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setImageError('Only JPG, PNG, and WebP are allowed.');
        return;
      }
    }

    setImageFiles(prev => [...prev, ...files]);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreviews(prev => [...prev, reader.result]);
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
    setImageError('');
  };

  const closeNewThreadModal = () => {
    setShowNewThread(false);
    setImageFiles([]);
    setImagePreviews([]);
    setImageError('');
    setIsAnnouncement(false);
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      let uploadedUrls = [];
      if (imageFiles.length > 0) {
        setUploadingImages(true);
        for (const file of imageFiles) {
          const formData = new FormData();
          formData.append('image', file);
          const { data } = await api.post('/forum/upload-image', formData);
          uploadedUrls.push(data.image_url);
        }
        setUploadingImages(false);
      }

      const { data } = await api.post('/forum/threads', {
        title: newTitle.trim(),
        body: newBody.trim(),
        images: uploadedUrls,
        ...(role === 'admin' && isAnnouncement ? { isAnnouncement: true } : {}),
      });
      setNewTitle('');
      setNewBody('');
      setImageFiles([]);
      setImagePreviews([]);
      setImageError('');
      setIsAnnouncement(false);
      setShowNewThread(false);
      navigate(`/forum/thread/${data.thread.slug}`);
    } catch (err) {
      console.error('Error creating thread:', err);
      setImageError(err.response?.data?.error || 'Failed to create post.');
    } finally {
      setUploadingImages(false);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Community</h1>
        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Link to="/bookmarks">
              <Button variant="ghost" size="sm">
                <Bookmark className="w-4 h-4" />
              </Button>
            </Link>
          )}
          {isAuthenticated ? (
            <Button onClick={() => setShowNewThread(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" />New Post
            </Button>
          ) : (
            <Link to="/login">
              <Button variant="outline" size="sm">Log in</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Compose box */}
      {isAuthenticated && (
        <Card className="overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <Avatar
              src={null}
              name="You"
              size="md"
            />
            <button
              onClick={() => setShowNewThread(true)}
              className="flex-1 text-left px-4 py-2.5 bg-gray-100 rounded-full text-gray-400 hover:bg-gray-200 transition-colors text-sm"
            >
              What&apos;s on your mind?
            </button>
          </div>
        </Card>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search discussions..."
          className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-full text-sm focus:ring-2 focus:ring-primary-500 focus:bg-white border border-transparent focus:border-gray-300 transition-all"
        />
      </form>

      {/* Sort tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-full p-1">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setSortBy(tab.value); setPage(1); }}
            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
              sortBy === tab.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {threads.length === 0 ? (
        <div className="text-center py-16">
          <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No posts yet. Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <PostCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}

      {/* Pagination */}
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

      {/* New Thread Modal */}
      <Modal open={showNewThread} onClose={closeNewThreadModal} title={role === 'admin' && isAnnouncement ? 'New Announcement' : 'New Post'}>
        <form onSubmit={handleCreateThread} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="What's your post about?"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Share your thoughts..."
              required
            />
          </div>

          {/* Photo previews */}
          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {imagePreviews.map((preview, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                  <img src={preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 bg-gray-900/70 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove photo"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {imageError && (
            <p className="text-xs text-red-500">{imageError}</p>
          )}

          {/* Admin announcement toggle */}
          {role === 'admin' && (
            <label className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={isAnnouncement}
                onChange={(e) => setIsAnnouncement(e.target.checked)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="flex items-center gap-2 text-sm">
                <Megaphone className="w-4 h-4 text-red-500" />
                <span className="font-medium text-gray-700">Post as announcement</span>
                <span className="text-gray-400">— shown at the top of the feed</span>
              </span>
            </label>
          )}

          {/* Photo picker */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              multiple
              onChange={handleImageSelect}
              className="hidden"
              disabled={imageFiles.length >= MAX_IMAGES}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={imageFiles.length >= MAX_IMAGES}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              <ImageIcon className="w-4 h-4" />
              {imageFiles.length >= MAX_IMAGES
                ? 'Photo limit reached'
                : `Add photos (${imageFiles.length}/${MAX_IMAGES})`}
            </button>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeNewThreadModal}>Cancel</Button>
            <Button type="submit" disabled={submitting || uploadingImages || !newTitle.trim() || !newBody.trim()}>
              {submitting || uploadingImages ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {uploadingImages ? 'Uploading…' : 'Post'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
