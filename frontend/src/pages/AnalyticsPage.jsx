import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { PredictionRiskBar, FraudVerdictBadge, CategoryBadge } from '../components/ui/Badges';
import { Loader2, TrendingUp, Clock, AlertTriangle, Zap, ExternalLink } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const CHART_THEME = {
  background: 'transparent',
  text: '#6B8299',
  grid: '#253347',
  accent: '#00C896',
  warning: '#F5A623',
  danger: '#E84444',
  prediction: '#8B5CF6',
};

const STATUS_COLORS = { open: '#3B82F6', in_progress: '#F5A623', resolved: '#00C896', duplicate: '#6B8299' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border px-3 py-2 rounded-lg text-xs shadow-xl">
      {label && <p className="text-muted mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || CHART_THEME.accent }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${BACKEND}/api/analytics`)
      .then(res => { setData(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Failed to load analytics data.
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Open Issues', value: data.totalOpen, icon: AlertTriangle, color: 'text-danger' },
    { label: 'Resolved This Week', value: data.resolvedThisWeek, icon: TrendingUp, color: 'text-accent' },
    { label: 'Avg Resolution (hrs)', value: data.avgResolutionHours || 'N/A', icon: Clock, color: 'text-warning' },
    { label: 'Most Reported', value: data.mostReportedCategory, icon: Zap, color: 'text-prediction' },
  ];

  return (
    <div className="min-h-screen bg-bg py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-primary">City Analytics</h1>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryCards.map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="card flex flex-col gap-2">
              <Icon className={`w-5 h-5 ${color}`} />
              <p className="text-xl font-bold text-primary font-mono truncate">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Bar chart: by category */}
          <div className="card">
            <h2 className="font-semibold text-primary mb-4">Issues by Category</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.categoryBreakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
                <XAxis dataKey="category" tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
                <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" fill={CHART_THEME.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie: status distribution */}
          <div className="card">
            <h2 className="font-semibold text-primary mb-4">Status Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.statusBreakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.statusBreakdown.map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#6B8299'} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line chart: last 30 days */}
        <div className="card">
          <h2 className="font-semibold text-primary mb-4">Issues Reported — Last 30 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data.dailySeries} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} />
              <XAxis
                dataKey="date"
                tick={{ fill: CHART_THEME.text, fontSize: 9 }}
                tickFormatter={v => v.slice(5)}
                interval={4}
              />
              <YAxis tick={{ fill: CHART_THEME.text, fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke={CHART_THEME.accent} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top areas */}
        {data.topAreas?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-primary mb-4">Top 5 Areas by Open Issues</h2>
            <div className="space-y-3">
              {data.topAreas.map(({ area, count }, i) => (
                <div key={area} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted w-4">{i + 1}</span>
                  <span className="text-sm text-primary flex-1">{area || 'Unknown'}</span>
                  <span className="text-xs font-mono text-accent">{count}</span>
                  <div className="w-24 bg-bg rounded-full h-1.5">
                    <div
                      className="h-1.5 bg-accent rounded-full"
                      style={{ width: `${(count / (data.topAreas[0]?.count || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Predicted Hotspots */}
        {data.predictions?.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-prediction" />
              <h2 className="font-semibold text-primary">Predicted Hotspots</h2>
            </div>
            <div className="space-y-4">
              {data.predictions.map((pred, i) => (
                <div key={pred.id || i} className="p-3 bg-bg rounded-xl border border-prediction/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted">#{i + 1}</span>
                      <CategoryBadge category={pred.predictedCategory} />
                      <span className="text-xs text-muted">{pred.wardName || pred.location?.ward}</span>
                    </div>
                    <span className="text-xs text-prediction font-mono">within {pred.timeframe}</span>
                  </div>
                  <PredictionRiskBar score={pred.riskScore} />
                  {pred.factors && (
                    <div className="flex gap-2 mt-2">
                      {pred.factors.weatherFactor > 0 && (
                        <span className="text-xs bg-prediction/10 text-prediction px-2 py-0.5 rounded-full">
                          🌧 Weather +{(pred.factors.weatherFactor * 100).toFixed(0)}%
                        </span>
                      )}
                      <span className="text-xs bg-muted/10 text-muted px-2 py-0.5 rounded-full">
                        🛣 Road age ×{pred.factors.roadAgeFactor}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fraud Alerts */}
        {data.fraudAlerts?.length > 0 && (
          <div className="card border-danger/20">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-danger" />
              <h2 className="font-semibold text-primary">Repair Fraud Alerts</h2>
              <span className="ml-auto text-xs font-mono text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                {data.fraudAlerts.length} flagged
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">Issue</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Category</th>
                    <th className="pb-2 font-medium hidden md:table-cell">Department</th>
                    <th className="pb-2 font-medium">Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fraudAlerts.map(issue => (
                    <tr key={issue.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-3">
                        <p className="text-primary line-clamp-1">{issue.title}</p>
                        <p className="text-xs text-muted">{issue.location?.address?.slice(0, 40)}</p>
                      </td>
                      <td className="py-2.5 pr-3 hidden md:table-cell">
                        <CategoryBadge category={issue.category} />
                      </td>
                      <td className="py-2.5 pr-3 hidden md:table-cell text-xs text-muted">{issue.department}</td>
                      <td className="py-2.5">
                        <FraudVerdictBadge verdict={issue.fraudVerdict} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Footer Banner */}
        <div className="card border-muted/20 flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Community Hero is a proof-of-concept.{' '}
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline inline-flex items-center gap-1">
              See our documentation for the real-world integration roadmap <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
