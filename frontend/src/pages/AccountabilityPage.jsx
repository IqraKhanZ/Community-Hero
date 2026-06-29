import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { ShameScoreBar, CategoryBadge, SeverityBadge } from '../components/ui/Badges';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, X, Mail } from 'lucide-react';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const PARTY_COLORS = {
  BJP: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  INC: 'bg-green-500/20 text-green-400 border-green-500/30',
  NCP: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SS:  'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

function getPolygonColor(score) {
  if (score > 70) return '#E84444';
  if (score > 40) return '#F5A623';
  return '#00C896';
}

// Fly to bounds when a politician is selected
function FlyToPol({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds?.length) {
      try { map.fitBounds(bounds, { padding: [40, 40] }); } catch {}
    }
  }, [bounds]);
  return null;
}

export default function AccountabilityPage() {
  const { currentUser, getIdToken } = useAuth();

  const [politicians, setPoliticians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPol, setSelectedPol] = useState(null);
  const [toast, setToast] = useState('');
  const [emailSending, setEmailSending] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  useEffect(() => {
    axios.get(`${BACKEND}/api/politicians`)
      .then(res => { setPoliticians(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleSendEmail = async (pol) => {
    if (!currentUser) { showToast('Please log in to send awareness emails'); return; }
    setEmailSending(true);
    try {
      const token = await getIdToken();
      await axios.post(`${BACKEND}/api/politicians/${pol.id}/notify`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(`Awareness email sent to ${pol.name}'s office`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to send email');
    } finally {
      setEmailSending(false);
    }
  };

  // Convert constituency bounds to Leaflet polygon positions
  const getPolygonPositions = (bounds) =>
    (bounds || []).map(b => [b.lat, b.lng]);

  // Leaflet bounds for fitBounds
  const getLeafletBounds = (bounds) =>
    (bounds || []).map(b => [b.lat, b.lng]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <h1 className="text-2xl font-bold text-primary">Politician Accountability Tracker</h1>
        <p className="text-muted text-sm mt-1">Live shame scores based on unresolved civic issues in each constituency</p>
      </div>

      <div className="flex flex-col lg:flex-row h-[calc(100vh-180px)]">

        {/* ── Leaderboard ─────────────────────────────────────── */}
        <div className="w-full lg:w-[480px] shrink-0 overflow-y-auto border-r border-border bg-bg">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : politicians.map((pol, i) => (
            <div
              key={pol.id}
              onClick={() => setSelectedPol(pol)}
              className={`px-5 py-4 border-b border-border cursor-pointer hover:bg-surface transition-colors ${
                selectedPol?.id === pol.id ? 'bg-surface border-l-2 border-l-accent' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`text-lg font-bold font-mono w-7 shrink-0 ${
                  i === 0 ? 'text-danger' : i === 1 ? 'text-warning' : i === 2 ? 'text-yellow-500' : 'text-muted'
                }`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-primary text-sm">{pol.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${PARTY_COLORS[pol.party] || 'bg-muted/20 text-muted border-muted/30'}`}>
                      {pol.party}
                    </span>
                  </div>
                  <p className="text-xs text-muted mb-2">{pol.constituencyName}</p>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted mb-2">
                    <span>Issues: <strong className="text-primary">{pol.totalIssues || 0}</strong></span>
                    <span>Resolved: <strong className="text-accent">{pol.resolvedIssues || 0}</strong></span>
                    <span>Avg: <strong className="text-warning">{pol.avgResolutionDays || 0}d</strong></span>
                  </div>
                  <ShameScoreBar score={pol.shameScore || 0} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Leaflet Map ─────────────────────────────────────── */}
        <div className="flex-1 hidden lg:block relative">
          <MapContainer
            center={[26.8467, 80.9462]}
            zoom={11}
            style={{ width: '100%', height: '100%' }}
            className="z-0"
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />

            {/* Fly to selected constituency */}
            {selectedPol?.constituencyBounds && (
              <FlyToPol bounds={getLeafletBounds(selectedPol.constituencyBounds)} />
            )}

            {/* Constituency polygons */}
            {politicians.map(pol => {
              const positions = getPolygonPositions(pol.constituencyBounds);
              if (!positions.length) return null;
              const color = getPolygonColor(pol.shameScore || 0);
              const isSelected = selectedPol?.id === pol.id;
              return (
                <Polygon
                  key={pol.id}
                  positions={positions}
                  pathOptions={{
                    color: color,
                    weight: isSelected ? 3 : 2,
                    fillColor: color,
                    fillOpacity: isSelected ? 0.35 : 0.15,
                    dashArray: isSelected ? '' : '5,3',
                  }}
                  eventHandlers={{ click: () => setSelectedPol(pol) }}
                >
                  <Popup>
                    <div style={{ background: '#1A2736', color: '#E8EDF2', padding: '10px', borderRadius: '8px', minWidth: '200px', fontFamily: 'Inter, sans-serif' }}>
                      <p style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>{pol.name}</p>
                      <p style={{ fontSize: '11px', color: '#6B8299', marginBottom: '6px' }}>{pol.party} · {pol.constituencyName}</p>
                      <p style={{ fontSize: '12px' }}>
                        Shame Score: <strong style={{ color: color }}>{(pol.shameScore || 0).toFixed(1)}</strong>
                      </p>
                      <p style={{ fontSize: '11px', color: '#6B8299', marginTop: '4px' }}>
                        {pol.totalIssues || 0} total · {pol.resolvedIssues || 0} resolved
                      </p>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* ── Side Detail Panel ──────────────────────────────────── */}
      {selectedPol && (
        <div className="fixed right-0 top-16 bottom-0 w-80 bg-surface border-l border-border z-30 flex flex-col shadow-2xl animate-slide-up overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div>
              <p className="font-semibold text-primary">{selectedPol.name}</p>
              <p className="text-xs text-muted">{selectedPol.constituencyName}</p>
            </div>
            <button onClick={() => setSelectedPol(null)}>
              <X className="w-5 h-5 text-muted hover:text-primary" />
            </button>
          </div>

          {/* Avatar + score */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-xl font-bold text-accent">
                  {selectedPol.name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </span>
              </div>
              <div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${PARTY_COLORS[selectedPol.party] || ''}`}>
                  {selectedPol.party}
                </span>
                <p className="text-xs text-muted mt-1">
                  Shame Score: <strong className="text-danger font-mono">{(selectedPol.shameScore || 0).toFixed(1)}</strong>
                </p>
              </div>
            </div>
            <ShameScoreBar score={selectedPol.shameScore || 0} />
          </div>

          {/* Open issues list */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide">Open Issues in Constituency</p>
            {(selectedPol.openIssues || []).length === 0 ? (
              <p className="text-sm text-muted">No open issues — great performance! 🎉</p>
            ) : (
              (selectedPol.openIssues || []).map(issue => (
                <div key={issue.id} className="p-3 bg-bg rounded-lg border border-border text-xs">
                  <p className="font-medium text-primary mb-1 line-clamp-2">{issue.title}</p>
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={issue.severity} />
                    {issue.daysPending > 0 && (
                      <span className="text-warning">{issue.daysPending}d pending</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Send Email */}
          <div className="px-5 py-4 border-t border-border">
            <button
              onClick={() => handleSendEmail(selectedPol)}
              disabled={emailSending}
              className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
            >
              {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Awareness Email
            </button>
            <p className="text-xs text-muted text-center mt-1.5">Rate limited to once per 48 hours</p>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-surface border border-accent/30 text-primary text-sm px-5 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
