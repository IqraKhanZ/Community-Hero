import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ReputationBadge, CategoryBadge, SeverityBadge, StatusPill } from '../components/ui/Badges';
import { formatDistanceToNow, format } from 'date-fns';
import {
  FileText, Heart, Shield, Star, Mail, AlertTriangle, RefreshCw,
  ChevronRight, Loader2, TrendingUp, Clock
} from 'lucide-react';

const LEVELS = [
  { min: 1000, label: 'City Hero', next: Infinity },
  { min: 600, label: 'Civic Champion', next: 1000 },
  { min: 300, label: 'Community Guardian', next: 600 },
  { min: 100, label: 'Active Citizen', next: 300 },
  { min: 0, label: 'Newcomer', next: 100 },
];

const NOTIF_ICONS = {
  upvote: Heart, verification: Shield, status_change: RefreshCw,
  complaint_letter_sent: Mail, fraud_detected: AlertTriangle,
};

export default function UserDashboardPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [userData, setUserData] = useState(null);
  const [myIssues, setMyIssues] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    // User doc
    const userUnsub = onSnapshot(doc(db, 'users', currentUser.uid), snap => {
      if (snap.exists()) setUserData(snap.data());
    });
    // My issues
    const issuesQuery = query(
      collection(db, 'issues'),
      where('reportedBy', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const issuesUnsub = onSnapshot(issuesQuery, snap => {
      setMyIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    // Notifications
    const notifsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const notifsUnsub = onSnapshot(notifsQuery, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { userUnsub(); issuesUnsub(); notifsUnsub(); };
  }, [currentUser]);

  const points = userData?.reputationPoints || 0;
  const level = LEVELS.find(l => points >= l.min) || LEVELS[LEVELS.length - 1];
  const progressPct = level.next === Infinity
    ? 100
    : Math.min(((points - level.min) / (level.next - level.min)) * 100, 100);

  const totalUpvotes = myIssues.reduce((sum, i) => sum + (i.upvotes?.length || 0), 0);

  const statCards = [
    { label: 'Reports Filed', value: userData?.reportsCount || myIssues.length, icon: FileText, color: 'text-accent' },
    { label: 'Total Upvotes', value: totalUpvotes, icon: Heart, color: 'text-danger' },
    { label: 'Verifications', value: userData?.verificationsCount || 0, icon: Shield, color: 'text-blue-400' },
    { label: 'Reputation Points', value: points, icon: Star, color: 'text-warning' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-primary">My Dashboard</h1>
          <p className="text-muted text-sm mt-1">Welcome back, {currentUser?.displayName || 'Citizen'}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex flex-col gap-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <p className="text-2xl font-bold text-primary font-mono">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* Reputation */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary">Reputation Level</h2>
            <ReputationBadge points={points} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted">
              <span>{points} points</span>
              {level.next !== Infinity && <span>{level.next} points for next level</span>}
            </div>
            <div className="w-full bg-bg rounded-full h-2">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-accent to-prediction transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted">
              {LEVELS.slice().reverse().map(l => (
                <span key={l.label} className={points >= l.min ? 'text-accent font-semibold' : ''}>
                  {l.min === 0 ? 'Newcomer' : `${l.min}+`}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* My Issues Table */}
          <div className="lg:col-span-2 card">
            <h2 className="font-semibold text-primary mb-4">My Reports ({myIssues.length})</h2>
            {myIssues.length === 0 ? (
              <div className="text-center py-8 text-muted">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reports yet</p>
                <button onClick={() => navigate('/report')} className="btn-primary text-sm mt-3 px-4 py-2">
                  Report an Issue
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted border-b border-border">
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Category</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium hidden md:table-cell">Letter</th>
                      <th className="pb-2 font-medium text-center">👍</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myIssues.map(issue => (
                      <tr
                        key={issue.id}
                        onClick={() => navigate(`/issues/${issue.id}`)}
                        className="border-b border-border/50 hover:bg-surface cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-primary line-clamp-1">{issue.title}</p>
                          {issue.createdAt?.toDate && (
                            <p className="text-xs text-muted">{format(issue.createdAt.toDate(), 'dd MMM yyyy')}</p>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 hidden md:table-cell">
                          <CategoryBadge category={issue.category} />
                        </td>
                        <td className="py-2.5 pr-3">
                          <StatusPill status={issue.status} />
                        </td>
                        <td className="py-2.5 pr-3 hidden md:table-cell">
                          <span className={`text-xs font-semibold ${issue.complaintLetterSent ? 'text-accent' : 'text-muted'}`}>
                            {issue.complaintLetterSent ? '✓ Sent' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-muted text-xs font-mono">
                          {issue.upvotes?.length || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="card">
            <h2 className="font-semibold text-primary mb-4">Activity Feed</h2>
            {notifications.length === 0 ? (
              <p className="text-muted text-sm text-center py-4">No recent activity</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {notifications.map(notif => {
                  const Icon = NOTIF_ICONS[notif.type] || Bell;
                  const ts = notif.createdAt?.toDate ? notif.createdAt.toDate() : null;
                  return (
                    <div
                      key={notif.id}
                      className={`flex gap-3 p-2.5 rounded-lg ${!notif.read ? 'border-l-2 border-l-accent bg-accent/5' : ''}`}
                    >
                      <Icon className="w-4 h-4 text-muted shrink-0 mt-0.5" />
                      <div>
                        <p className={`text-xs leading-snug ${notif.read ? 'text-muted' : 'text-primary'}`}>
                          {notif.message}
                        </p>
                        {ts && <p className="text-xs text-muted/60 mt-0.5">{formatDistanceToNow(ts, { addSuffix: true })}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
