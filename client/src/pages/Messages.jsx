import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Search, MessagesSquare, Loader2 } from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useMessages } from '../context/MessagesContext';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';

const LIST_LIMIT = 50;
const MESSAGE_LIMIT = 50;
const POLL_INTERVAL = 5000;
const PREVIEW_LENGTH = 100;

const fullName = (p) => (p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : 'Unknown user');

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

  const [messages, setMessages] = useState([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgPagination, setMsgPagination] = useState(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const pendingScrollRef = useRef(null);
  const lastCreatedAtRef = useRef(null);

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
            ? prev.map((c) => (c.id === conv.id ? conv : c))
            : [conv, ...prev]
        );
      })
      .catch((err) => console.error('Failed to fetch conversation:', err));
  }, [conversationId, fetchMessages, markRead]);

  // Track newest message timestamp for incremental polling
  useEffect(() => {
    lastCreatedAtRef.current = messages.length ? messages[messages.length - 1].created_at : null;
  }, [messages]);

  const pollMessages = useCallback(
    async (convId) => {
      const after = lastCreatedAtRef.current;
      if (!after) return;
      try {
        const { data } = await api.get(`/messages/conversations/${convId}/messages`, {
          params: { after },
        });
        const incoming = data.messages || [];
        if (!incoming.length) return;

        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = incoming.filter((m) => !ids.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });

        const newest = incoming[incoming.length - 1];
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  last_message_at: newest.created_at,
                  last_message_preview: newest.body.slice(0, PREVIEW_LENGTH),
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

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending || !conversationId) return;
    setSending(true);
    setSendError('');
    try {
      const { data } = await api.post(`/messages/conversations/${conversationId}/messages`, {
        body,
      });
      setMessages((prev) => [...prev, data.message]);
      setDraft('');
      setSendError('');
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
  // Derived
  // ----------------------------------------------------------
  const activeConversation =
    conversations.find((c) => c.id === conversationId) || null;

  const filteredConversations = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return fullName(c.other).toLowerCase().includes(q);
  });

  const otherName = fullName(activeConversation?.other);

  const showThread = !!conversationId;

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
              className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-colors"
            />
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
                {search ? 'No matching conversations' : 'No conversations yet'}
              </p>
              {!search && (
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
                    <Avatar name={fullName(conv.other)} src={conv.other?.avatar_url} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`text-sm truncate ${
                            unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-900'
                          }`}
                        >
                          {fullName(conv.other)}
                        </p>
                        <span className="text-[11px] text-gray-400 shrink-0">
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
                          <span className="shrink-0 min-w-[18px] h-[18px] px-1 bg-primary-600 text-white text-[10px] font-semibold rounded-full flex items-center justify-center">
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
                className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Avatar
                name={otherName}
                src={activeConversation?.other?.avatar_url}
                size="sm"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{otherName}</p>
                {activeConversation?.other?.city && (
                  <p className="text-xs text-gray-500">{activeConversation.other.city}</p>
                )}
              </div>
            </div>

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
                    return (
                      <div
                        key={message.id}
                        className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[75%] sm:max-w-[60%] ${mine ? 'text-right' : ''}`}>
                          <div
                            className={`px-3.5 py-2 text-sm rounded-2xl break-words ${
                              mine
                                ? 'bg-primary-600 text-white rounded-br-md'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-md'
                            }`}
                          >
                            {message.body}
                          </div>
                          <p
                            className={`text-[10px] text-gray-400 mt-1 ${
                              mine ? 'text-right' : 'text-left'
                            }`}
                          >
                            {formatMessageTime(message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* Composer */}
            <div className="bg-white border-t border-gray-200 p-3">
              {sendError && <p className="text-xs text-red-600 mb-2">{sendError}</p>}
              <div className="flex items-end gap-2">
                <textarea
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
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="!rounded-xl !p-3"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
