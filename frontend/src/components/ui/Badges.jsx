import { Zap, Droplets, Trash2, Circle, AlertTriangle, CheckCircle, XCircle, Star } from 'lucide-react';

// ─── SeverityBadge ───────────────────────────────────────────────────
export function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-danger/20 text-danger border-danger/40',
    high: 'bg-warning/20 text-warning border-warning/40',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    low: 'bg-accent/20 text-accent border-accent/40',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border font-mono uppercase ${map[severity] || map.medium}`}>
      {severity || 'medium'}
    </span>
  );
}

// ─── CategoryBadge ───────────────────────────────────────────────────
export function CategoryBadge({ category }) {
  const map = {
    'Pothole': { color: 'bg-orange-500/20 text-orange-400 border-orange-500/40', icon: '🕳️' },
    'Water Leakage': { color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: '💧' },
    'Streetlight': { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: '💡' },
    'Waste Management': { color: 'bg-green-500/20 text-green-400 border-green-500/40', icon: '🗑️' },
    'Other': { color: 'bg-muted/20 text-muted border-muted/40', icon: '📋' },
  };
  const cfg = map[category] || map['Other'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.color}`}>
      <span>{cfg.icon}</span> {category || 'Other'}
    </span>
  );
}

// ─── StatusPill ──────────────────────────────────────────────────────
export function StatusPill({ status }) {
  const map = {
    open: 'bg-blue-500/20 text-blue-400',
    in_progress: 'bg-warning/20 text-warning',
    resolved: 'bg-accent/20 text-accent',
    duplicate: 'bg-muted/20 text-muted',
  };
  const labels = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    duplicate: 'Duplicate',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status] || map.open}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {labels[status] || status}
    </span>
  );
}

// ─── ReputationBadge ─────────────────────────────────────────────────
export function ReputationBadge({ points }) {
  const levels = [
    { min: 1000, label: 'City Hero', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40', icon: '⭐' },
    { min: 600, label: 'Civic Champion', color: 'bg-prediction/20 text-prediction border-prediction/40', icon: '🏆' },
    { min: 300, label: 'Community Guardian', color: 'bg-blue-500/20 text-blue-400 border-blue-500/40', icon: '🛡️' },
    { min: 100, label: 'Active Citizen', color: 'bg-accent/20 text-accent border-accent/40', icon: '✅' },
    { min: 0, label: 'Newcomer', color: 'bg-muted/20 text-muted border-muted/40', icon: '👤' },
  ];
  const level = levels.find(l => points >= l.min) || levels[levels.length - 1];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${level.color}`}>
      {level.icon} {level.label}
    </span>
  );
}

// ─── ShameScoreBar ───────────────────────────────────────────────────
export function ShameScoreBar({ score }) {
  const pct = Math.min(Math.max(score || 0, 0), 100);
  const label = pct > 70 ? 'Critical' : pct > 40 ? 'Poor' : pct > 20 ? 'Fair' : 'Good';
  const color = pct > 70 ? 'bg-danger' : pct > 40 ? 'bg-warning' : 'bg-accent';
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 bg-bg rounded-full h-2">
        <div className={`h-2 rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-primary shrink-0">{pct.toFixed(0)}</span>
      <span className={`text-xs font-semibold shrink-0 ${pct > 70 ? 'text-danger' : pct > 40 ? 'text-warning' : 'text-accent'}`}>{label}</span>
    </div>
  );
}

// ─── FraudVerdictBadge ───────────────────────────────────────────────
export function FraudVerdictBadge({ verdict }) {
  if (!verdict) return null;
  const map = {
    GENUINE: { color: 'bg-accent/20 text-accent border-accent/40', icon: <CheckCircle className="w-3 h-3" /> },
    SUSPICIOUS: { color: 'bg-warning/20 text-warning border-warning/40', icon: <AlertTriangle className="w-3 h-3" /> },
    FAKE: { color: 'bg-danger/20 text-danger border-danger/40', icon: <XCircle className="w-3 h-3" /> },
  };
  const cfg = map[verdict] || map.SUSPICIOUS;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${cfg.color}`}>
      {cfg.icon} {verdict}
    </span>
  );
}

// ─── PredictionRiskBar ───────────────────────────────────────────────
export function PredictionRiskBar({ score }) {
  const pct = Math.min(Math.max((score || 0) * 100, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-bg rounded-full h-2">
        <div className="h-2 rounded-full bg-prediction transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-prediction shrink-0">{pct.toFixed(0)}%</span>
    </div>
  );
}
