import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import IssueCard from '../components/ui/IssueCard';
import { Loader2, Plus, Layers, Zap } from 'lucide-react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const SEVERITY_COLORS = {
  critical: '#E84444',
  high: '#F5A623',
  medium: '#EAB308',
  low: '#00C896',
};

const CATEGORIES = ['All', 'Pothole', 'Water Leakage', 'Streetlight', 'Waste Management', 'Other'];
const STATUSES = ['All', 'open', 'in_progress', 'resolved'];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180, phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Recenter map when userLocation changes
function MapCenterUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center]);
  return null;
}

export default function IssueFeedPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [issues, setIssues] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState({ lat: 26.8467, lng: 80.9462 }); // default Lucknow
  const [selectedId, setSelectedId] = useState(null);
  const [showPredictions, setShowPredictions] = useState(false);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [sortBy, setSortBy] = useState('newest');
  const [radius, setRadius] = useState(10);

  // Get user GPS location
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserLocation({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {} // keep default Pune
    );
  }, []);

  // Firestore live listener
  useEffect(() => {
    let q = selectedCategory === 'All'
      ? query(collection(db, 'issues'), orderBy('createdAt', 'desc'), limit(50))
      : query(collection(db, 'issues'), where('category', '==', selectedCategory), orderBy('createdAt', 'desc'), limit(50));

    const unsub = onSnapshot(q, snap => {
      setIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [selectedCategory]);

  // Load predictions
  useEffect(() => {
    if (!showPredictions) return;
    const unsub = onSnapshot(
      query(collection(db, 'predictions'), orderBy('riskScore', 'desc'), limit(20)),
      snap => setPredictions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [showPredictions]);

  // Filter + sort
  const filtered = issues
    .filter(i => selectedStatus === 'All' || i.status === selectedStatus)
    .filter(i => {
      if (!i.location?.lat) return true;
      return haversine(userLocation.lat, userLocation.lng, i.location.lat, i.location.lng) <= radius * 1000;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      if (sortBy === 'upvotes') return (b.upvotes?.length || 0) - (a.upvotes?.length || 0);
      if (sortBy === 'nearest') {
        const da = a.location?.lat ? haversine(userLocation.lat, userLocation.lng, a.location.lat, a.location.lng) : Infinity;
        const db2 = b.location?.lat ? haversine(userLocation.lat, userLocation.lng, b.location.lat, b.location.lng) : Infinity;
        return da - db2;
      }
      return 0;
    });

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">

      {/* ── Filter Bar ─────────────────────────────────────────── */}
      <div className="bg-surface border-b border-border px-4 py-2 flex items-center gap-3 overflow-x-auto shrink-0">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-accent text-bg'
                : 'bg-bg text-muted border border-border hover:border-accent hover:text-accent'
            }`}
          >{cat}</button>
        ))}

        <div className="w-px h-5 bg-border shrink-0" />

        <select
          value={selectedStatus}
          onChange={e => setSelectedStatus(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-1 text-xs text-primary focus:border-accent focus:outline-none shrink-0"
        >
          {STATUSES.map(s => <option key={s} value={s}>{s === 'All' ? 'All Statuses' : s.replace('_', ' ')}</option>)}
        </select>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="bg-bg border border-border rounded-lg px-3 py-1 text-xs text-primary focus:border-accent focus:outline-none shrink-0"
        >
          <option value="newest">Newest</option>
          <option value="upvotes">Most Upvoted</option>
          <option value="nearest">Nearest</option>
        </select>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted">Radius:</span>
          <input
            type="range" min="0.5" max="50" step="0.5" value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="w-24 accent-[#00C896]"
          />
          <span className="text-xs text-accent font-mono w-12">{radius}km</span>
        </div>

        <button
          onClick={() => setShowPredictions(!showPredictions)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border shrink-0 transition-colors ${
            showPredictions
              ? 'bg-prediction/20 text-prediction border-prediction/40'
              : 'bg-bg text-muted border-border hover:border-prediction hover:text-prediction'
          }`}
        >
          <Zap className="w-3 h-3" /> Predictions
        </button>
      </div>

      {/* ── Main Content ───────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Issue list */}
        <div className="w-full md:w-[400px] shrink-0 overflow-y-auto border-r border-border bg-bg p-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No issues found</p>
              <p className="text-xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filtered.map(issue => (
              <div id={`issue-${issue.id}`} key={issue.id}>
                <IssueCard
                  issue={issue}
                  isSelected={selectedId === issue.id}
                  onClick={() => { setSelectedId(issue.id); navigate(`/issues/${issue.id}`); }}
                  userLocation={userLocation}
                />
              </div>
            ))
          )}
        </div>

        {/* ── Leaflet Map ────────────────────────────────────────── */}
        <div className="flex-1 hidden md:block">
          <MapContainer
            center={[userLocation.lat, userLocation.lng]}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            className="z-0"
          >
            <MapCenterUpdater center={[userLocation.lat, userLocation.lng]} />

            {/* OpenStreetMap tiles — dark-ish variant */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
            />

            {/* Issue markers */}
            {filtered.map(issue => {
              if (!issue.location?.lat || !issue.location?.lng) return null;
              const color = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.medium;
              return (
                <CircleMarker
                  key={issue.id}
                  center={[issue.location.lat, issue.location.lng]}
                  radius={10}
                  pathOptions={{ color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }}
                  eventHandlers={{
                    click: () => {
                      setSelectedId(issue.id);
                      document.getElementById(`issue-${issue.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                  }}
                >
                  <Popup className="leaflet-popup-dark">
                    <div style={{ background: '#1A2736', color: '#E8EDF2', padding: '8px', borderRadius: '8px', minWidth: '180px', fontFamily: 'Inter, sans-serif' }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>{issue.title}</p>
                      <p style={{ fontSize: '11px', color: '#6B8299', marginBottom: '8px' }}>{issue.category} · {issue.severity}</p>
                      <a href={`/issues/${issue.id}`} style={{ color: '#00C896', fontSize: '12px', fontWeight: 600 }}>View Details →</a>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Prediction markers */}
            {showPredictions && predictions.map(pred => {
              if (!pred.location?.lat || !pred.location?.lng) return null;
              return (
                <CircleMarker
                  key={pred.id}
                  center={[pred.location.lat, pred.location.lng]}
                  radius={14}
                  pathOptions={{ color: '#8B5CF6', weight: 2, fillColor: '#8B5CF6', fillOpacity: 0.3, dashArray: '6,4' }}
                >
                  <Popup>
                    <div style={{ background: '#1A2736', color: '#E8EDF2', padding: '8px', borderRadius: '8px', fontFamily: 'Inter, sans-serif' }}>
                      <p style={{ fontWeight: 600, color: '#8B5CF6', fontSize: '12px' }}>⚡ Predicted Hotspot</p>
                      <p style={{ fontSize: '11px', marginTop: '4px' }}>{pred.predictedCategory}</p>
                      <p style={{ fontSize: '11px', color: '#6B8299' }}>Risk: {((pred.riskScore || 0) * 100).toFixed(0)}%</p>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* User location marker */}
            <CircleMarker
              center={[userLocation.lat, userLocation.lng]}
              radius={8}
              pathOptions={{ color: '#00C896', weight: 3, fillColor: '#00C896', fillOpacity: 0.5 }}
            >
              <Popup><span style={{ color: '#00C896', fontWeight: 600 }}>📍 You are here</span></Popup>
            </CircleMarker>
          </MapContainer>
        </div>
      </div>

      {/* FAB — Report issue */}
      <button
        onClick={() => navigate('/report')}
        className="fixed bottom-6 right-24 z-30 w-14 h-14 bg-accent rounded-full shadow-2xl shadow-accent/30 items-center justify-center hover:scale-110 transition-transform hidden md:flex"
        title="Report Issue"
      >
        <Plus className="w-7 h-7 text-bg" />
      </button>
    </div>
  );
}
