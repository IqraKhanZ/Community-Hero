import { formatDistanceToNow } from 'date-fns';
import { Heart, MapPin } from 'lucide-react';
import { SeverityBadge, CategoryBadge, StatusPill } from './Badges';

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const phi1 = (lat1 * Math.PI) / 180, phi2 = (lat2 * Math.PI) / 180;
  const dphi = ((lat2 - lat1) * Math.PI) / 180;
  const dlambda = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dphi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dlambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

export default function IssueCard({ issue, isSelected, onClick, userLocation }) {
  const thumb = issue.mediaUrls?.[0];
  const createdAt = issue.createdAt?.toDate ? issue.createdAt.toDate() : issue.createdAt ? new Date(issue.createdAt) : null;
  const timeAgo = createdAt ? formatDistanceToNow(createdAt, { addSuffix: true }) : 'Unknown';
  const upvoteCount = issue.upvotes?.length || 0;

  let distanceText = null;
  if (userLocation && issue.location?.lat && issue.location?.lng) {
    const d = haversine(userLocation.lat, userLocation.lng, issue.location.lat, issue.location.lng);
    distanceText = formatDistance(d);
  }

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer hover:scale-[1.01] transition-all duration-200 p-0 overflow-hidden ${
        isSelected ? 'border-accent shadow-accent/20 shadow-lg' : 'hover:border-muted'
      }`}
    >
      {/* Thumbnail */}
      <div className="w-full h-36 bg-bg flex items-center justify-center overflow-hidden relative">
        {thumb ? (
          <img src={thumb} alt={issue.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-surface to-bg flex items-center justify-center">
            <span className="text-4xl opacity-30">
              {issue.category === 'Pothole' ? '🕳️' : issue.category === 'Water Leakage' ? '💧' : issue.category === 'Streetlight' ? '💡' : issue.category === 'Waste Management' ? '🗑️' : '📋'}
            </span>
          </div>
        )}
        {isSelected && (
          <div className="absolute inset-0 border-2 border-accent rounded-t-none pointer-events-none" />
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-primary text-sm leading-tight line-clamp-2 mb-2">{issue.title}</h3>
        <div className="flex flex-wrap gap-1.5 mb-3">
          <CategoryBadge category={issue.category} />
          <SeverityBadge severity={issue.severity} />
          <StatusPill status={issue.status} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" /> {upvoteCount}
          </span>
          {distanceText && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {distanceText}
            </span>
          )}
          <span>{timeAgo}</span>
        </div>
      </div>
    </div>
  );
}
