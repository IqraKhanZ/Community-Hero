import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, arrayUnion, arrayRemove,
  collection, addDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useAuth } from '../contexts/AuthContext';
import { SeverityBadge, CategoryBadge, StatusPill, FraudVerdictBadge } from '../components/ui/Badges';
import { formatDistanceToNow, format } from 'date-fns';
import {
  Heart, Shield, MapPin, Building2, Mail, ExternalLink,
  CheckCircle, AlertTriangle, ChevronLeft, ChevronRight,
  X, Upload, Loader2, Send, User
} from 'lucide-react';
import axios from 'axios';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const STATUS_STEPS = ['open', 'in_progress', 'resolved'];
const STATUS_LABELS = { open: 'Reported', in_progress: 'In Progress', resolved: 'Resolved' };

export default function IssueDetailPage() {
  const { id } = useParams();
  const { currentUser, getIdToken } = useAuth();
  const navigate = useNavigate();

  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [currentImg, setCurrentImg] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [letterModal, setLetterModal] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [afterUploadLoading, setAfterUploadLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500); };

  // Load issue
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'issues', id), snap => {
      if (snap.exists()) setIssue({ id: snap.id, ...snap.data() });
      else navigate('/');
      setLoading(false);
    });
    return unsub;
  }, [id]);

  // Load comments
  useEffect(() => {
    const q = query(collection(db, 'issues', id, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, snap => setComments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [id]);

  const isUpvoted = issue?.upvotes?.includes(currentUser?.uid);
  const isVerified = issue?.verifiedBy?.includes(currentUser?.uid);

  const handleUpvote = async () => {
    const ref = doc(db, 'issues', id);
    if (isUpvoted) {
      await updateDoc(ref, { upvotes: arrayRemove(currentUser.uid) });
    } else {
      await updateDoc(ref, { upvotes: arrayUnion(currentUser.uid) });
      showToast('Upvoted!');
    }
  };

  const handleVerify = async () => {
    if (isVerified) return;
    await updateDoc(doc(db, 'issues', id), { verifiedBy: arrayUnion(currentUser.uid) });
    // Add reputation
    const userRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const pts = userDoc.data().reputationPoints || 0;
      await updateDoc(userRef, { reputationPoints: pts + 15, verificationsCount: (userDoc.data().verificationsCount || 0) + 1 });
    }
    showToast('Issue verified! +15 reputation points');
  };

  const handleAfterPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAfterUploadLoading(true);
    try {
      // Upload to Cloudinary (free, no Firebase Storage billing needed)
      const url = await uploadToCloudinary(file);
      const token = await getIdToken();
      await axios.post(`${BACKEND}/api/issues/${id}/after-photo`, { after_repair_url: url }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('After photo uploaded!');
    } catch (err) {
      showToast(err.message || 'Upload failed. Try again.');
    } finally {
      setAfterUploadLoading(false);
    }
  };

  const handleFraudVerify = async () => {
    setVerifyLoading(true);
    try {
      const token = await getIdToken();
      const res = await axios.post(`${BACKEND}/api/issues/${id}/verify-repair`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast(`Verdict: ${res.data.verdict}`);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Verification failed.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setCommentLoading(true);
    await addDoc(collection(db, 'issues', id, 'comments'), {
      text: commentText.trim(),
      authorId: currentUser.uid,
      authorName: currentUser.displayName || 'Anonymous',
      createdAt: serverTimestamp(),
    });
    setCommentText('');
    setCommentLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    );
  }
  if (!issue) return null;

  const media = issue.mediaUrls || [];
  const createdDate = issue.createdAt?.toDate ? issue.createdAt.toDate() : null;
  const stepIndex = STATUS_STEPS.indexOf(issue.status);

  return (
    <div className="min-h-screen bg-bg py-6 px-4">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Back */}
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-muted hover:text-primary text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {/* Duplicate warning */}
        {issue.duplicateOf && (
          <div className="card border-warning/30 bg-warning/5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-sm text-warning">
              This is a duplicate of <Link to={`/issues/${issue.duplicateOf}`} className="underline font-semibold">issue #{issue.duplicateOf.slice(-8)}</Link>
            </p>
          </div>
        )}

        {/* Complaint Letter Banner */}
        {issue.complaintLetterSent && (
          <div className="card border-accent/30 bg-accent/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold text-accent">Official complaint letter sent</p>
                <p className="text-xs text-muted">
                  Emailed to {issue.department} on{' '}
                  {issue.complaintLetterSentAt?.toDate
                    ? format(issue.complaintLetterSentAt.toDate(), 'dd MMM yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>
            {issue.complaintLetterText && (
              <button onClick={() => setLetterModal(true)} className="btn-secondary text-xs py-1.5 px-3 shrink-0">
                View Letter
              </button>
            )}
          </div>
        )}

        {/* Media Gallery */}
        {media.length > 0 && (
          <div className="card p-0 overflow-hidden relative group">
            <div className="relative h-72 md:h-96 bg-bg">
              {media[currentImg]?.match(/\.(mp4|webm|mov)/i) ? (
                <video src={media[currentImg]} controls className="w-full h-full object-contain" />
              ) : (
                <img
                  src={media[currentImg]}
                  alt="Issue"
                  className="w-full h-full object-cover cursor-zoom-in"
                  onClick={() => setLightbox(true)}
                />
              )}
              {media.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImg(i => (i - 1 + media.length) % media.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-bg/80 rounded-full flex items-center justify-center hover:bg-bg"
                  ><ChevronLeft className="w-4 h-4" /></button>
                  <button
                    onClick={() => setCurrentImg(i => (i + 1) % media.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-bg/80 rounded-full flex items-center justify-center hover:bg-bg"
                  ><ChevronRight className="w-4 h-4" /></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {media.map((_, i) => (
                      <button key={i} onClick={() => setCurrentImg(i)}
                        className={`w-2 h-2 rounded-full ${i === currentImg ? 'bg-accent' : 'bg-muted/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Issue Header */}
        <div className="card">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <h1 className="text-xl font-bold text-primary flex-1">{issue.title}</h1>
            {issue.fraudFlagged && (
              <span className="bg-danger/20 text-danger text-xs font-bold px-2 py-1 rounded-md border border-danger/40">⚠ FRAUD FLAGGED</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <CategoryBadge category={issue.category} />
            <SeverityBadge severity={issue.severity} />
            <StatusPill status={issue.status} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {issue.location?.address && (
              <div className="flex items-center gap-2 text-muted">
                <MapPin className="w-4 h-4 text-accent" />
                <span>{issue.location.address}</span>
              </div>
            )}
            {issue.department && (
              <div className="flex items-center gap-2 text-muted">
                <Building2 className="w-4 h-4 text-accent" />
                <span>{issue.department}</span>
              </div>
            )}
            {issue.constituencyName && (
              <div className="flex items-center gap-2 text-muted">
                <ExternalLink className="w-4 h-4 text-accent" />
                <Link to="/accountability" className="hover:text-accent">{issue.constituencyName} constituency</Link>
              </div>
            )}
            {createdDate && (
              <p className="text-muted text-xs">{format(createdDate, 'dd MMM yyyy, HH:mm')}</p>
            )}
          </div>
          <p className="mt-4 text-sm text-primary/80 leading-relaxed">{issue.description}</p>

          {/* Actions */}
          <div className="flex gap-3 mt-5 pt-4 border-t border-border">
            <button
              onClick={handleUpvote}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isUpvoted ? 'bg-danger/20 text-danger border border-danger/40' : 'bg-surface border border-border text-muted hover:border-danger hover:text-danger'
              }`}
            >
              <Heart className={`w-4 h-4 ${isUpvoted ? 'fill-current' : ''}`} />
              <span>{issue.upvotes?.length || 0}</span>
            </button>
            <button
              onClick={handleVerify}
              disabled={isVerified}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isVerified ? 'bg-accent/20 text-accent border border-accent/40 cursor-default' : 'bg-surface border border-border text-muted hover:border-accent hover:text-accent'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{isVerified ? 'Verified' : 'Verify'} ({issue.verifiedBy?.length || 0})</span>
            </button>
            <span className="font-mono text-xs text-muted/60 ml-auto self-center">#{id.slice(-8)}</span>
          </div>
        </div>

        {/* Status Timeline */}
        <div className="card">
          <h2 className="font-semibold text-primary mb-4">Status Timeline</h2>
          <div className="flex items-center">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                    i <= stepIndex
                      ? 'bg-accent border-accent text-bg'
                      : 'bg-bg border-border text-muted'
                  }`}>
                    {i < stepIndex ? <CheckCircle className="w-4 h-4" /> : i + 1}
                  </div>
                  <span className="text-xs text-muted mt-1 text-center">{STATUS_LABELS[step]}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < stepIndex ? 'bg-accent' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* AI Analysis Card */}
        {issue.aiAnalysis && (
          <div className="card border-prediction/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-prediction font-mono text-xs">✦ AI ANALYSIS</span>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-muted">Detected:</span> <span className="text-primary">{issue.aiAnalysis.detected_issue}</span></p>
              <p><span className="text-muted">Confidence:</span> <span className="text-accent font-mono">{((issue.aiAnalysis.confidence || 0) * 100).toFixed(0)}%</span></p>
              <p><span className="text-muted">AI Category:</span> <span className="text-primary">{issue.aiAnalysis.suggested_category}</span>
                {issue.aiAnalysis.suggested_category !== issue.category && (
                  <span className="text-warning ml-2 text-xs">(User selected: {issue.category})</span>
                )}
              </p>
              {issue.aiAnalysis.reasoning && (
                <p className="text-muted text-xs italic">{issue.aiAnalysis.reasoning}</p>
              )}
            </div>
          </div>
        )}

        {/* Fraud Detection */}
        <div className="card">
          <h2 className="font-semibold text-primary mb-4">Repair Verification</h2>
          {issue.afterRepairUrl ? (
            <div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <p className="text-xs text-muted mb-1">Before Repair</p>
                  <img src={issue.beforeRepairUrl || issue.mediaUrls?.[0]} alt="Before" className="w-full h-36 object-cover rounded-lg" />
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">After Repair</p>
                  <img src={issue.afterRepairUrl} alt="After" className="w-full h-36 object-cover rounded-lg" />
                </div>
              </div>
              {issue.fraudVerdict ? (
                <div className="flex items-center gap-2">
                  <FraudVerdictBadge verdict={issue.fraudVerdict} />
                  {issue.fraudAnalysis?.reasoning && (
                    <p className="text-xs text-muted">{issue.fraudAnalysis.reasoning}</p>
                  )}
                </div>
              ) : (
                <button onClick={handleFraudVerify} disabled={verifyLoading} className="btn-secondary text-sm flex items-center gap-2">
                  {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Run AI Fraud Verification
                </button>
              )}
            </div>
          ) : issue.status === 'resolved' ? (
            <div className="flex flex-col items-center py-4 text-center gap-3">
              <Upload className="w-8 h-8 text-muted" />
              <p className="text-sm text-muted">Upload proof of repair to verify this fix</p>
              <label className="btn-secondary text-sm cursor-pointer flex items-center gap-2">
                {afterUploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload After-Repair Photo
                <input type="file" accept="image/*" className="hidden" onChange={handleAfterPhoto} disabled={afterUploadLoading} />
              </label>
            </div>
          ) : (
            <p className="text-sm text-muted">Repair verification will be available once this issue is resolved.</p>
          )}
        </div>

        {/* Comments */}
        <div className="card">
          <h2 className="font-semibold text-primary mb-4">Comments ({comments.length})</h2>
          <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
            {comments.length === 0 && <p className="text-muted text-sm">No comments yet. Be the first!</p>}
            {comments.map(c => {
              const ts = c.createdAt?.toDate ? c.createdAt.toDate() : null;
              return (
                <div key={c.id} className="flex gap-3">
                  <div className="w-7 h-7 bg-accent/20 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-primary">{c.authorName}</span>
                      {ts && <span className="text-xs text-muted">{formatDistanceToNow(ts, { addSuffix: true })}</span>}
                    </div>
                    <p className="text-sm text-primary/80 mt-0.5">{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Add a comment..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitComment()}
            />
            <button onClick={submitComment} disabled={commentLoading || !commentText.trim()} className="btn-primary px-3 py-2">
              {commentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Letter Modal */}
      {letterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-surface border border-border rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-primary">Complaint Letter</h3>
              <button onClick={() => setLetterModal(false)}><X className="w-5 h-5 text-muted hover:text-primary" /></button>
            </div>
            <pre className="flex-1 overflow-y-auto p-5 text-sm text-primary/80 whitespace-pre-wrap font-mono">
              {issue.complaintLetterText}
            </pre>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
          <img src={media[currentImg]} alt="Full" className="max-w-full max-h-full object-contain" />
          <button className="absolute top-4 right-4 text-white/70 hover:text-white"><X className="w-8 h-8" /></button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-20 right-6 z-50 bg-surface border border-accent/30 text-accent text-sm px-4 py-2.5 rounded-xl shadow-lg animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}
