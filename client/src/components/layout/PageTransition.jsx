import { useLocation } from 'react-router-dom';

// Fades and lifts each page in when the route changes. Keyed by path so the
// animation replays on navigation; Messages keeps one key across conversations
// so switching chats does not remount the whole inbox.
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  const key = pathname.startsWith('/dashboard/messages') ? '/dashboard/messages' : pathname;
  return (
    <div key={key} className="animate-page-in">
      {children}
    </div>
  );
}
