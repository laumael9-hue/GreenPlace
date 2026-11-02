import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Send, Search, MessagesSquare, Loader2, MoreVertical, MoreHorizontal, Smile,
  Copy, Pencil, Trash2, Flag, BellOff, Bell, Archive, ArchiveRestore, Ban, MailOpen,
  Check, CheckCheck, X,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../context/MessagesContext';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

const LIST_LIMIT = 50;
const MESSAGE_LIMIT = 50;
const POLL_INTERVAL = 5000;
const PREVIEW_LENGTH = 100;

const EMOJIS = ['😀', '😊', '😂', '😍', '🙏', '👍', '👏', '🎉', '🌱', '♻️', '🌿', '💚', '🙌', '😅', '🤝', '❤️'];
const QUICK_REPLIES = [
  'Is this still available?',
  'Thank you!',
  'Can we meet up?',
  'What is the best price?',
  'Sounds good, see you then.',
];
const REPORT_REASONS = ['Spam', 'Harassment or abuse', 'Scam or fraud', 'Inappropriate content', 'Other'];
const DEFAULT_SETTINGS = { muted: false, archived: false, blocked: false, blocked_by_other: false };

const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown user');

// Business owners are shown under their business name
const displayName = (conv) => conv?.other?.business?.name || fullName(conv?.other);
const displayAvatar = (conv) => conv?.other?.business?.logo_url || conv?.other?.avatar_url;

const sortConversations = (list) =>
  [...list].sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : Number.MAX_SAFE_INTEGER;
    return tb - ta;
  });

const formatListTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
  }
  if ((now - date) / 86400000 < 7) {
    return date.toLocaleDateString('en-PH', { weekday: 'short' });
  }
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const formatMessageTime = (value) =>
  new Date(value).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

// pos ({ top, left }) renders the menu fixed to the viewport so scroll containers can't clip it
function Menu({ open, onClose, align = 'right', pos = null, children }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        style={pos ? { top: pos.top, left: pos.left } : undefined}
        className={`z-40 w-48 py-1 bg-white border border-gray-200 rounded-xl shadow-lg ${
          pos ? 'fixed' : `absolute mt-1 ${align === 'right' ? 'right-0' : 'left-0'}`
        }`}
      >
        {children}
      </div>
    </>
  );
}

function MenuItem({ icon: Icon, onClick, danger, children }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 ${
        danger ? 'text-red-600' : 'text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {children}
    </button>
  );
}

export default function Messages() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnread } = useMessages();

  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(true);
  const [convPagination, setConvPagination] = useState(null);
  const [convPage, setConvPage] = useState(1);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('inbox');

  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPagination, setMsgPagination] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const [convMenuOpen, setConvMenuOpen] = useState(false);
  const [menuMessageId, setMenuMessageId] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [notice, setNotice] = useState('');

  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportDescription, setReportDescription] = useState('');
  const [reportError, setReportError] = useState('');
  const [reporting, setReporting] = useState(false);

  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingScrollRef = useRef(null);
  const lastCreatedAtRef = useRef(null);
  const messagesRef = useRef([]);

  // ----------------------------------------------------------
  // Conversations
  // ----------------------------------------------------------
  const fetchConversations = useCallback(async (page = 1) => {
    if (page === 1) setConvLoading(true);
    try {
      const { data } = await api.get('/messages/conversations', {
        params: { page, limit: LIST_LIMIT },
      });
      const rows = data.conversations || [];
      setConversations((prev) => {
        if (page === 1) return rows;
        const ids = new Set(prev.map((c) => c.id));
        return [...prev, ...rows.filter((c) => !ids.has(c.id))];
      });
      setConvPagination(data.pagination || null);
      setConvPage(page);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setConvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations(1);
  }, [fetchConversations]);

  const loadMoreConversations = () => {
    if (convPagination && convPage < convPagination.pages) {
      fetchConversations(convPage + 1);
    }
  };

  const patchConversation = useCallback((id, patch) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  // ----------------------------------------------------------
  // Messages
  // ----------------------------------------------------------
  const fetchMessages = useCallback(async (convId, page = 1) => {
    if (page === 1) setMsgLoading(true);
    try {
      const { data } = await api.get(`/messages/conversations/${convId}/messages`, {
        params: { page, limit: MESSAGE_LIMIT },
      });
      const rows = data.messages || [];
      setMessages((prev) => (page === 1 ? rows : [...rows, ...prev]));
      setMsgPagination(data.pagination || null);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      if (page === 1) setMsgLoading(false);
    }
  }, []);

  const markRead = useCallback(async (convId) => {
    try {
      await api.post(`/messages/conversations/${convId}/read`);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c))
      );
      refreshUnread();
    } catch (err) {
      console.error('Failed to mark conversation as read:', err);
    }
  }, [refreshUnread]);

  // Reset + load when the selected conversation changes
  useEffect(() => {
    setMessages([]);
    setMsgPagination(null);
    setDraft('');
    setSendError('');
    setNotice('');
    setConvMenuOpen(false);
    setMenuMessageId(null);
    setEditingId(null);
    setShowEmoji(false);
    lastCreatedAtRef.current = null;
    stickToBottomRef.current = true;
    pendingScrollRef.current = null;

    if (!conversationId) return;

    fetchMessages(conversationId, 1);
    markRead(conversationId);

    // Ensure the conversation exists in the list (handles direct URL visits)
    api
      .get(`/messages/conversations/${conversationId}`)
      .then(({ data }) => {
        const conv = data.conversation;
        setConversations((prev) =>
          prev.some((c) => c.id === conv.id)
            ? prev.map((c) => (c.id === conv.id ? { ...conv, unread_count: 0 } : c))
            : [conv, ...prev]
        );
      })
      .catch((err) => console.error('Failed to fetch conversation:', err));
  }, [conversationId, fetchMessages, markRead]);

  // Track newest message timestamp + latest list for incremental polling
  useEffect(() => {
    messagesRef.current = messages;
    lastCreatedAtRef.current = messages.length ? messages[messages.length - 1].created_at : null;
  }, [messages]);

  // Re-fetch the newest window so new messages, edits, deletes and read receipts all sync
  const pollMessages = useCallback(
    async (convId) => {
      if (!lastCreatedAtRef.current) return;
      try {
        const { data } = await api.get(`/messages/conversations/${convId}/messages`, {
          params: { page: 1, limit: MESSAGE_LIMIT },
        });
        const incoming = data.messages || [];
        if (!incoming.length) return;

        const current = messagesRef.current;
        const known = new Set(current.map((m) => m.id));
        const fresh = incoming.filter((m) => !known.has(m.id));
        const byId = new Map(incoming.map((m) => [m.id, m]));
        const changed = current.some((m) => {
          const next = byId.get(m.id);
          return (
            next &&
            (next.edited_at !== m.edited_at || next.deleted_at !== m.deleted_at || next.is_read !== m.is_read)
          );
        });
        if (!fresh.length && !changed) return;

        setMessages((prev) => {
          const prevIds = new Set(prev.map((m) => m.id));
          const merged = prev.map((m) => byId.get(m.id) || m);
          return [...merged, ...incoming.filter((m) => !prevIds.has(m.id))];
        });

        if (!fresh.length) return;
        const newest = fresh[fresh.length - 1];
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  last_message_at: newest.created_at,
                  last_message_preview: newest.deleted_at ? 'Message deleted' : newest.body.slice(0, PREVIEW_LENGTH),
                  unread_count: 0,
                }
              : c
          );
          return sortConversations(updated);
        });

        markRead(convId);
      } catch (err) {
        console.error('Failed to poll messages:', err);
      }
    },
    [markRead]
  );

  // Poll open conversation every 5 seconds
  useEffect(() => {
    if (!conversationId) return undefined;
    const timer = setInterval(() => pollMessages(conversationId), POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [conversationId, pollMessages]);

  const handleSend = async (text) => {
    const body = (typeof text === 'string' ? text : draft).trim();
    if (!body || sending || !conversationId) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post(`/messages/conversations/${conversationId}/messages`, {
        body,
      });
      setMessages((prev) => [...prev, data.message]);
      if (typeof text !== 'string') setDraft('');
      setShowEmoji(false);
      stickToBottomRef.current = true;
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                last_message_at: data.message.created_at,
                last_message_preview: body.slice(0, PREVIEW_LENGTH),
                unread_count: 0,
              }
            : c
        );
        return sortConversations(updated);
      });
    } catch (err) {
      setSendError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const loadOlderMessages = () => {
    if (!conversationId || !msgPagination || msgPagination.page >= msgPagination.pages) return;
    const el = scrollRef.current;
    if (el) pendingScrollRef.current = { height: el.scrollHeight, top: el.scrollTop };
    fetchMessages(conversationId, msgPagination.page + 1);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  // Scroll handling: stick to bottom on new messages, preserve offset on backfill
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (pendingScrollRef.current) {
      const { height, top } = pendingScrollRef.current;
      pendingScrollRef.current = null;
      el.scrollTop = top + (el.scrollHeight - height);
    } else if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, conversationId]);

  // ----------------------------------------------------------
  // Conversation options
  // ----------------------------------------------------------
  const flash = (text) => {
    setNotice(text);
    setTimeout(() => setNotice(''), 3000);
  };

  const updateSettings = async (patch, successText) => {
    setConvMenuOpen(false);
    try {
      const { data } = await api.patch(`/messages/conversations/${conversationId}/settings`, patch);
      patchConversation(conversationId, { settings: data.settings });
      if (successText) flash(successText);
      if (patch.archived) navigate('/dashboard/messages');
    } catch (err) {
      flash(err.response?.data?.error || 'Failed to update conversation');
    }
  };

  const handleMarkUnread = async () => {
    setConvMenuOpen(false);
    try {
      await api.post(`/messages/conversations/${conversationId}/unread`);
      refreshUnread();
      navigate('/dashboard/messages');
      fetchConversations(1);
    } catch (err) {
      flash(err.response?.data?.error || 'Failed to mark as unread');
    }
  };

  // ----------------------------------------------------------
  // Message options
  // ----------------------------------------------------------
  const handleCopy = async (message) => {
    setMenuMessageId(null);
    try {
      await navigator.clipboard.writeText(message.body);
      flash('Message copied');
    } catch {
      flash('Could not copy message');
    }
  };

  const startEdit = (message) => {
    setMenuMessageId(null);
    setEditingId(message.id);
    setEditDraft(message.body);
  };

  const saveEdit = async () => {
    const body = editDraft.trim();
    if (!body || !editingId) return;
    try {
      const { data } = await api.patch(`/messages/messages/${editingId}`, { body });
      setMessages((prev) => prev.map((m) => (m.id === editingId ? data.message : m)));
      if (messages[messages.length - 1]?.id === editingId) {
        patchConversation(conversationId, { last_message_preview: body.slice(0, PREVIEW_LENGTH) });
      }
      setEditingId(null);
    } catch (err) {
      flash(err.response?.data?.error || 'Failed to edit message');
    }
  };

  const handleDelete = async (message) => {
    setMenuMessageId(null);
    if (!window.confirm('Delete this message for everyone?')) return;
    try {
      const { data } = await api.delete(`/messages/messages/${message.id}`);
      setMessages((prev) => prev.map((m) => (m.id === message.id ? data.message : m)));
      if (messages[messages.length - 1]?.id === message.id) {
        patchConversation(conversationId, { last_message_preview: 'Message deleted' });
      }
    } catch (err) {
      flash(err.response?.data?.error || 'Failed to delete message');
    }
  };

  const openReport = (message) => {
    setMenuMessageId(null);
    setReportReason(REPORT_REASONS[0]);
    setReportDescription('');
    setReportError('');
    setReportTarget(message);
  };

  const openReportUser = () => {
    setConvMenuOpen(false);
    setReportReason(REPORT_REASONS[0]);
    setReportDescription('');
    setReportError('');
    setReportTarget({ kind: 'user', id: activeConversation.id, body: otherName });
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!reportTarget) return;
    setReporting(true);
    setReportError('');
    try {
      const url = reportTarget.kind === 'user'
        ? `/messages/conversations/${reportTarget.id}/report-user`
        : `/messages/messages/${reportTarget.id}/report`;
      await api.post(url, {
        reason: reportReason,
        description: reportDescription.trim() || undefined,
      });
      setReportTarget(null);
      flash('Report submitted. Our moderators will review it.');
    } catch (err) {
      setReportError(err.response?.data?.error || 'Failed to submit report');
    } finally {
      setReporting(false);
    }
  };

  // ----------------------------------------------------------
  // Composer
  // ----------------------------------------------------------
  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) {
      setDraft((d) => d + emoji);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    setDraft(draft.slice(0, start) + emoji + draft.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // ----------------------------------------------------------
  // Derived
  // ----------------------------------------------------------
  const activeConversation =
    conversations.find((c) => c.id === conversationId) || null;
  const settings = activeConversation?.settings || DEFAULT_SETTINGS;
  const canSend = !settings.blocked && !settings.blocked_by_other;

  const archivedCount = conversations.filter((c) => c.settings?.archived).length;

  const filteredConversations = conversations.filter((c) => {
    const archived = !!c.settings?.archived;
    if (tab === 'archived' ? !archived : archived) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      displayName(c).toLowerCase().includes(q) || fullName(c.other).toLowerCase().includes(q)
    );
  });

  const otherName = displayName(activeConversation);
  const ownerName = fullName(activeConversation?.other);
  const isBusiness = !!activeConversation?.other?.business;

  const showThread = !!conversationId;

  // Receipt is shown only under my newest sent message
  const lastMineId = [...messages].reverse().find((m) => m.sender_id === user?.id && !m.deleted_at)?.id;

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------
  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[480px] bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Conversations list */}
      <div
        className={`${
          showThread ? 'hidden lg:flex' : 'flex'
        } w-full lg:w-80 xl:w-96 flex-col border-r border-gray-200 min-w-0`}
      >
        <div className="px-4 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Messages</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-full text-sm bg-gray-50 focus:outline-none focus:ring-4 focus:ring-primary-500/15 focus:border-primary-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex gap-1 mt-3">
            {[
              { id: 'inbox', label: 'Inbox' },
              { id: 'archived', label: `Archived${archivedCount ? ` (${archivedCount})` : ''}` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  tab === t.id ? 'bg-primary-50 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {convLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-6">
              <MessagesSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">
                {search
                  ? 'No matching conversations'
                  : tab === 'archived'
                    ? 'No archived conversations'
                    : 'No conversations yet'}
              </p>
              {!search && tab === 'inbox' && (
                <p className="mt-1 text-xs text-gray-500">
                  Start a conversation from a product or establishment page.
                </p>
              )}
            </div>
          ) : (
            <>
              {filteredConversations.map((conv) => {
                const unread = conv.unread_count || 0;
                const active = conv.id === conversationId;
                return (
                  <button
                    key={conv.id}
                    onClick={() => navigate(`/dashboard/messages/${conv.id}`)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-gray-50 transition-colors ${
                      active ? 'bg-primary-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <Avatar name={displayName(conv)} src={displayAvatar(conv)} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                          }`}
                        >
                          {displayName(conv)}
                        </p>
                        <span className="flex items-center gap-1 text-[11px] text-gray-400 shrink-0">
                          {conv.settings?.muted && <BellOff className="w-3 h-3" aria-label="Muted" />}
                          {formatListTime(conv.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            unread > 0 ? 'text-gray-900 font-medium' : 'text-gray-500'
                          }`}
                        >
                          {conv.last_message_preview || 'No messages yet'}
                        </p>
                        {unread > 0 && (
                          <span
                            className={`shrink-0 min-w-[18px] h-[18px] px-1 text-white text-[10px] font-semibold rounded-full flex items-center justify-center ${
                              conv.settings?.muted ? 'bg-gray-400' : 'bg-primary-600'
                            }`}
                          >
                            {unread > 9 ? '9+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {convPagination && convPage < convPagination.pages && (
                <div className="text-center py-3">
                  <Button variant="ghost" size="sm" onClick={loadMoreConversations}>
                    Load more
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Thread pane */}
      <div
        className={`${
          showThread ? 'flex' : 'hidden lg:flex'
        } flex-1 flex-col min-w-0 bg-gray-50`}
      >
        {!conversationId ? (
          <div className="flex-1 hidden lg:flex items-center justify-center">
            <div className="text-center">
              <MessagesSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-900">Select a conversation</p>
              <p className="mt-1 text-xs text-gray-500">Choose a conversation to read and reply.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
              <button
                onClick={() => navigate('/dashboard/messages')}
                className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar
                name={otherName}
                src={displayAvatar(activeConversation)}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{otherName}</p>
                {(isBusiness || activeConversation?.other?.city) && (
                  <p className="text-xs text-gray-500 truncate">
                    {[isBusiness ? `Business · ${ownerName}` : null, activeConversation?.other?.city]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </div>
              {settings.muted && <BellOff className="w-4 h-4 text-gray-400" aria-label="Muted" />}
              <div className="relative">
                <button
                  onClick={() => setConvMenuOpen((o) => !o)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                  aria-label="Conversation options"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                <Menu open={convMenuOpen} onClose={() => setConvMenuOpen(false)}>
                  <MenuItem icon={MailOpen} onClick={handleMarkUnread}>Mark as unread</MenuItem>
                  <MenuItem
                    icon={settings.muted ? Bell : BellOff}
                    onClick={() =>
                      updateSettings(
                        { muted: !settings.muted },
                        settings.muted ? 'Notifications turned on' : 'Conversation muted'
                      )
                    }
                  >
                    {settings.muted ? 'Unmute' : 'Mute'}
                  </MenuItem>
                  <MenuItem
                    icon={settings.archived ? ArchiveRestore : Archive}
                    onClick={() =>
                      updateSettings(
                        { archived: !settings.archived },
                        settings.archived ? 'Moved back to inbox' : 'Conversation archived'
                      )
                    }
                  >
                    {settings.archived ? 'Move to inbox' : 'Archive'}
                  </MenuItem>
                  <MenuItem
                    icon={Ban}
                    danger={!settings.blocked}
                    onClick={() => {
                      if (!settings.blocked && !window.confirm(`Block ${otherName}? They won't be able to message you.`)) {
                        setConvMenuOpen(false);
                        return;
                      }
                      updateSettings(
                        { blocked: !settings.blocked },
                        settings.blocked ? `${otherName} unblocked` : `${otherName} blocked`
                      );
                    }}
                  >
                    {settings.blocked ? 'Unblock' : 'Block user'}
                  </MenuItem>
                  <MenuItem icon={Flag} danger onClick={openReportUser}>
                    Report user
                  </MenuItem>
                </Menu>
              </div>
            </div>

            {notice && (
              <div className="px-4 py-2 text-xs text-primary-800 bg-primary-50 border-b border-primary-100">
                {notice}
              </div>
            )}

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {msgLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <MessagesSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No messages yet — say hello!</p>
                  </div>
                </div>
              ) : (
                <>
                  {msgPagination && msgPagination.page < msgPagination.pages && (
                    <div className="text-center">
                      <Button variant="ghost" size="sm" onClick={loadOlderMessages}>
                        Load earlier messages
                      </Button>
                    </div>
                  )}
                  {messages.map((message) => {
                    const mine = message.sender_id === user?.id;
                    const deleted = !!message.deleted_at;
                    const editing = editingId === message.id;
                    return (
                      <div
                        key={message.id}
                        className={`group flex items-start gap-1 ${mine ? 'justify-start flex-row-reverse' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] sm:max-w-[60%] ${mine ? 'text-right' : ''}`}>
                          {editing ? (
                            <div className="text-left">
                              <textarea
                                autoFocus
                                rows={2}
                                value={editDraft}
                                onChange={(e) => setEditDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    saveEdit();
                                  } else if (e.key === 'Escape') {
                                    setEditingId(null);
                                  }
                                }}
                                className="w-full resize-none px-3 py-2 border border-primary-300 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                              <div className="flex justify-end gap-2 mt-1">
                                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                                  Cancel
                                </Button>
                                <Button size="sm" onClick={saveEdit} disabled={!editDraft.trim()}>
                                  Save
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`px-3.5 py-2 text-sm rounded-2xl break-words whitespace-pre-wrap text-left ${
                                deleted
                                  ? 'italic text-gray-400 bg-transparent border border-dashed border-gray-300'
                                  : mine
                                    ? 'bg-primary-600 text-white rounded-br-md'
                                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                              }`}
                            >
                              {deleted ? 'This message was deleted' : message.body}
                            </div>
                          )}
                          <p
                            className={`flex items-center gap-1 text-[10px] text-gray-400 mt-1 ${
                              mine ? 'justify-end' : 'justify-start'
                            }`}
                          >
                            {formatMessageTime(message.created_at)}
                            {message.edited_at && !deleted && <span>· edited</span>}
                            {mine && message.id === lastMineId && (
                              message.is_read ? (
                                <span className="flex items-center gap-0.5 text-primary-600">
                                  <CheckCheck className="w-3 h-3" /> Read
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Sent
                                </span>
                              )
                            )}
                          </p>
                        </div>

                        {!deleted && !editing && (
                          <div className="relative shrink-0">
                            <button
                              onClick={(e) => {
                                if (menuMessageId === message.id) {
                                  setMenuMessageId(null);
                                  return;
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const menuHeight = mine ? 140 : 100;
                                const top =
                                  window.innerHeight - rect.bottom > menuHeight + 8
                                    ? rect.bottom + 4
                                    : Math.max(8, rect.top - menuHeight - 4);
                                const left = Math.min(Math.max(8, rect.left), window.innerWidth - 200);
                                setMenuPos({ top, left });
                                setMenuMessageId(message.id);
                              }}
                              className="p-1.5 text-gray-500 bg-white border border-gray-200 shadow-sm hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
                              aria-label="Message options"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                            <Menu
                              open={menuMessageId === message.id}
                              onClose={() => setMenuMessageId(null)}
                              pos={menuPos}
                            >
                              <MenuItem icon={Copy} onClick={() => handleCopy(message)}>Copy</MenuItem>
                              {mine ? (
                                <>
                                  <MenuItem icon={Pencil} onClick={() => startEdit(message)}>Edit</MenuItem>
                                  <MenuItem icon={Trash2} danger onClick={() => handleDelete(message)}>
                                    Delete
                                  </MenuItem>
                                </>
                              ) : (
                                <MenuItem icon={Flag} danger onClick={() => openReport(message)}>
                                  Report
                                </MenuItem>
                              )}
                            </Menu>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Composer */}
            <div className="bg-white border-t border-gray-200 p-3">
              {!canSend ? (
                <p className="text-sm text-center text-gray-500 py-2">
                  {settings.blocked ? (
                    <>
                      You blocked {otherName}.{' '}
                      <button
                        onClick={() => updateSettings({ blocked: false }, `${otherName} unblocked`)}
                        className="text-primary-600 font-medium hover:underline"
                      >
                        Unblock
                      </button>{' '}
                      to send messages.
                    </>
                  ) : (
                    'You can no longer send messages in this conversation.'
                  )}
                </p>
              ) : (
                <>
                  {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
                  {messages.length === 0 && !msgLoading && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-1">
                      {QUICK_REPLIES.map((reply) => (
                        <button
                          key={reply}
                          onClick={() => handleSend(reply)}
                          disabled={sending}
                          className="shrink-0 px-3 py-1 text-xs text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-full transition-colors"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="relative flex items-end gap-2">
                    <button
                      onClick={() => setShowEmoji((v) => !v)}
                      className="p-2.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-xl transition-colors"
                      aria-label="Insert emoji"
                    >
                      {showEmoji ? <X className="w-5 h-5" /> : <Smile className="w-5 h-5" />}
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-full left-0 mb-2 p-2 grid grid-cols-8 gap-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20">
                        {EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => insertEmoji(emoji)}
                            className="w-8 h-8 text-lg rounded-lg hover:bg-gray-100"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Type a message..."
                      className="flex-1 resize-none max-h-32 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
                    />
                    <Button
                      onClick={() => handleSend()}
                      disabled={sending || !draft.trim()}
                      className="!rounded-xl !p-3"
                      aria-label="Send message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <Modal open={!!reportTarget} onClose={() => setReportTarget(null)} title={reportTarget?.kind === 'user' ? 'Report user' : 'Report message'}>
        <form onSubmit={submitReport} className="space-y-4">
          {reportTarget && (
            <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 break-words">
              {reportTarget.body}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {REPORT_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
            <textarea
              rows={3}
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {reportError && <p className="text-sm text-red-600">{reportError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={reporting}>
              {reporting ? 'Submitting...' : 'Submit report'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
