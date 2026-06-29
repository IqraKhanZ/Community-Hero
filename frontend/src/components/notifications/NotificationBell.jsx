import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Heart, Shield, RefreshCw, Mail, AlertTriangle } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import axios from 'axios';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const TYPE_ICONS = {
  upvote: Heart,
  verification: Shield,
  status_change: RefreshCw,
  complaint_letter_sent: Mail,
  fraud_detected: AlertTriangle,
  default: Bell,
};

const TYPE_COLORS = {
  upvote: 'text-danger',
  verification: 'text-accent',
  status_change: 'text-blue-400',
  complaint_letter_sent: 'text-warning',
  fraud_detected: 'text-danger',
  default: 'text-muted',
};

export default function NotificationBell() {
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [currentUser]);

  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = async (notif) => {
    if (!notif.read) {
      await updateDoc(doc(db, 'notifications', notif.id), { read: true });
    }
    setOpen(false);
    if (notif.issueId) navigate(`/issues/${notif.issueId}`);
  };

  const markAllRead = async () => {
    try {
      const token = await getIdToken();
      await axios.patch(`${BACKEND}/api/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-muted hover:text-primary hover:bg-surface transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-semibold text-sm text-primary">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-muted text-sm">No notifications yet</div>
            ) : (
              notifications.map(notif => {
                const Icon = TYPE_ICONS[notif.type] || TYPE_ICONS.default;
                const iconColor = TYPE_COLORS[notif.type] || TYPE_COLORS.default;
                const ts = notif.createdAt?.toDate ? notif.createdAt.toDate() : notif.createdAt ? new Date(notif.createdAt) : null;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    className={`w-full text-left px-4 py-3 hover:bg-bg transition-colors border-b border-border/50 flex gap-3 ${
                      !notif.read ? 'border-l-2 border-l-accent' : ''
                    }`}
                  >
                    <div className={`shrink-0 mt-0.5 ${iconColor}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-xs leading-snug ${notif.read ? 'text-muted' : 'text-primary'}`}>
                        {notif.message}
                      </p>
                      {ts && (
                        <p className="text-xs text-muted/70 mt-1">{formatDistanceToNow(ts, { addSuffix: true })}</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
