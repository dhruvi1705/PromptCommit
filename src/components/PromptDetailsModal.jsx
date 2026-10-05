import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Copy,
  Check,
  Star,
  StarHalf,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  GitBranch,
  PlayCircle,
  Share2,
  Download,
  Edit3,
  GitCompare,
  Lock,
  Tag,
  Folder,
  Cpu,
  Users,
  MessageSquare,
  ThumbsUp,
  Trash2,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  RefreshCw,
  Plus
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/dateFormatter';
import { commentService } from '../services/commentService';
import { reviewService } from '../services/reviewService';

export const PromptDetailsModal = ({
  prompt,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenShare,
  onOpenExport,
  initialTab = 'details'
}) => {
  const navigate = useNavigate();
  const { userPrompts, toggleFavorite, ratePrompt, setActivePromptId, refreshData } = usePrompts();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [activeModalTab, setActiveModalTab] = useState(initialTab || 'details'); // 'details' | 'comments' | 'review' | 'collaborators'
  const [copied, setCopied] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  // Comments state
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedCommentVersion, setSelectedCommentVersion] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState(null);

  // Review state
  const [showRequestReviewModal, setShowRequestReviewModal] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesFeedback, setChangesFeedback] = useState('');
  const [reviewMessage, setReviewMessage] = useState('');
  const [selectedReviewerEmail, setSelectedReviewerEmail] = useState('');
  const [reviewVersionTag, setReviewVersionTag] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const copyTimerRef = useRef(null);
  const commentsRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const livePrompt = userPrompts.find(p => p.id === prompt?.id) || prompt;

  const loadComments = useCallback(async () => {
    if (!prompt?.id) return;
    const reqId = ++commentsRequestIdRef.current;
    setLoadingComments(true);
    try {
      const res = await commentService.getComments(prompt.id);
      if (reqId !== commentsRequestIdRef.current) return;
      setComments(Array.isArray(res) ? res : []);
    } catch (err) {
      if (reqId !== commentsRequestIdRef.current) return;
      console.error('Failed to fetch comments:', err);
    } finally {
      if (reqId === commentsRequestIdRef.current) {
        setLoadingComments(false);
      }
    }
  }, [prompt?.id]);

  useEffect(() => {
    if (isOpen && prompt?.id) {
      setActiveModalTab(initialTab || 'details');
      setCommentError(null);
      setReviewError(null);
      loadComments();
      const currentVer = livePrompt?.version || (livePrompt?.versions?.[0]?.version) || 'v1.0';
      setSelectedCommentVersion(currentVer);
      setReviewVersionTag(currentVer);
    }
  }, [isOpen, prompt?.id, loadComments, livePrompt?.version, initialTab]);

  if (!isOpen || !prompt) return null;

  const currentRating = (livePrompt.rating !== undefined && livePrompt.rating !== null) ? livePrompt.rating : null;
  const formattedCreated = formatDate(livePrompt.createdAt);
  const formattedUpdated = formatDate(livePrompt.updatedAt);
  const isOwner = livePrompt.isOwner !== false;
  const userRole = livePrompt.userRole || (isOwner ? 'Owner' : 'Viewer');
  const canEdit = isOwner || userRole === 'Editor';
  const canReview = isOwner || userRole === 'Reviewer' || userRole === 'Editor';
  const canComment = true;

  const collaborators = livePrompt.sharedWith || [];
  const currentVersionObj = (livePrompt.versions || []).find(v => v.version === livePrompt.version) || (livePrompt.versions || [])[0] || null;
  const reviewStatus = currentVersionObj?.reviewStatus || livePrompt.reviewStatus || 'DRAFT';

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt.content || '');
    setCopied(true);
    showToast({
      title: 'Prompt Copied!',
      message: 'System prompt instructions copied to clipboard.',
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleRate = (score) => {
    ratePrompt(prompt.id, score);
    showToast({
      title: 'Prompt Rated!',
      message: `Rated ${prompt.title} ${score}/5 stars.`,
      type: 'info'
    });
  };

  const handleTestInPlayground = () => {
    setActivePromptId(prompt.id);
    onClose();
    navigate('/app/playground');
  };

  const handleViewVersions = () => {
    setActivePromptId(prompt.id);
    onClose();
    navigate('/app/versions');
  };

  const handleCompare = () => {
    setActivePromptId(prompt.id);
    onClose();
    navigate('/app/compare');
  };

  // Submit Comment
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim() || submittingComment) return;
    setSubmittingComment(true);
    setCommentError(null);
    try {
      await commentService.addComment(prompt.id, {
        content: newCommentText.trim(),
        versionTag: selectedCommentVersion || undefined
      });
      setNewCommentText('');
      setCommentError(null);
      await loadComments();
      showToast({ title: 'Comment Posted', message: 'Your comment was added to the discussion.', type: 'success' });
    } catch (err) {
      const errMsg = err?.detail || err?.message || 'Unable to add comment. Please try again.';
      setCommentError(errMsg);
      showToast({ title: 'Unable to add comment', message: errMsg, type: 'error' });
    } finally {
      setSubmittingComment(false);
    }
  };

  // Like Comment
  const handleLikeComment = async (commentId) => {
    try {
      await commentService.likeComment(prompt.id, commentId);
      await loadComments();
    } catch (err) {
      console.error('Failed to like comment:', err);
    }
  };

  // Delete Comment
  const handleDeleteComment = async (commentId) => {
    try {
      await commentService.deleteComment(prompt.id, commentId);
      await loadComments();
      showToast({ title: 'Comment Deleted', message: 'Comment was removed.', type: 'info' });
    } catch (err) {
      const errMsg = err?.detail || err?.message || 'Failed to delete comment.';
      setCommentError(errMsg);
      showToast({ title: 'Error', message: errMsg, type: 'error' });
    }
  };

  // Request Review
  const handleSubmitReviewRequest = async (e) => {
    e.preventDefault();
    if (!selectedReviewerEmail || submittingReview) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      await reviewService.requestReview(prompt.id, reviewVersionTag || livePrompt.version || 'v1.0', {
        reviewerEmail: selectedReviewerEmail,
        message: reviewMessage.trim()
      });
      setShowRequestReviewModal(false);
      setReviewMessage('');
      setReviewError(null);
      if (refreshData) await refreshData();
      await loadComments();
      showToast({ title: 'Review Requested', message: `Review request sent to ${selectedReviewerEmail}.`, type: 'success' });
    } catch (err) {
      const errMsg = err?.detail || err?.message || 'Failed to request review.';
      setReviewError(errMsg);
      showToast({ title: 'Error', message: errMsg, type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Approve Version
  const handleApproveReview = async () => {
    if (submittingReview) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const vTag = livePrompt.version || 'v1.0';
      await reviewService.submitReviewAction(prompt.id, vTag, {
        action: 'approve',
        feedback: 'Approved by reviewer.'
      });
      setReviewError(null);
      if (refreshData) await refreshData();
      await loadComments();
      showToast({ title: 'Version Approved', message: `Prompt version ${vTag} has been approved!`, type: 'success' });
    } catch (err) {
      const errMsg = err?.detail || err?.message || 'Unable to update review status.';
      setReviewError(errMsg);
      showToast({ title: 'Error', message: errMsg, type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Request Changes
  const handleSubmitChanges = async (e) => {
    e.preventDefault();
    if (!changesFeedback.trim() || submittingReview) return;
    setSubmittingReview(true);
    setReviewError(null);
    try {
      const vTag = livePrompt.version || 'v1.0';
      await reviewService.submitReviewAction(prompt.id, vTag, {
        action: 'request_changes',
        feedback: changesFeedback.trim()
      });
      setShowChangesModal(false);
      setChangesFeedback('');
      setReviewError(null);
      if (refreshData) await refreshData();
      await loadComments();
      showToast({ title: 'Changes Requested', message: `Feedback submitted for ${vTag}.`, type: 'info' });
    } catch (err) {
      const errMsg = err?.detail || err?.message || 'Unable to update review status.';
      setReviewError(errMsg);
      showToast({ title: 'Error', message: errMsg, type: 'error' });
    } finally {
      setSubmittingReview(false);
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'editor':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'reviewer':
        return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'owner':
        return 'bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  const getReviewBadgeStyle = (status) => {
    switch (status) {
      case 'IN_REVIEW':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'CHANGES_REQUESTED':
        return 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'APPROVED':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 sm:p-6 max-w-3xl w-full shadow-2xl max-h-[85vh] overflow-y-auto flex flex-col my-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                {livePrompt.category || 'General'}
              </span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {livePrompt.version || 'v1.0'}
              </span>
              {reviewStatus && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getReviewBadgeStyle(reviewStatus)}`}>
                  {reviewStatus.replace('_', ' ')}
                </span>
              )}
              {livePrompt.targetModel && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center space-x-1">
                  <Cpu className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>{livePrompt.targetModel || 'gemini-3.6-flash'}</span>
                </span>
              )}
              {isOwner ? (
                <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span>Owner Vault</span>
                </span>
              ) : (
                <span className={`inline-flex items-center space-x-1 text-[11px] font-bold uppercase px-2 py-0.5 rounded border ${getRoleBadgeStyle(userRole)}`}>
                  <Share2 className="w-3 h-3" />
                  <span>Role: {userRole}</span>
                </span>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight break-words">
              {livePrompt.title}
            </h2>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            <button
              onClick={() => {
                toggleFavorite(livePrompt.id);
                showToast({
                  title: livePrompt.isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
                  message: livePrompt.title,
                  type: livePrompt.isFavorite ? 'info' : 'success'
                });
              }}
              title={livePrompt.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              aria-label={livePrompt.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                livePrompt.isFavorite
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Star className={`w-4 h-4 ${livePrompt.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close details"
              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center space-x-2 py-2 border-b border-slate-100 dark:border-slate-700 overflow-x-auto scrollbar-none text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveModalTab('details')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeModalTab === 'details'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Prompt Instructions
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('comments')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeModalTab === 'comments'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Comments & Review ({comments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveModalTab('collaborators')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeModalTab === 'collaborators'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Collaborators ({collaborators.length})</span>
          </button>
        </div>

        {/* TAB 1: DETAILS & INSTRUCTIONS */}
        {activeModalTab === 'details' && (
          <div className="space-y-3 py-3 flex-1 flex flex-col">
            {/* Description & Metadata bar */}
            <div className="space-y-2">
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {livePrompt.description}
              </p>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Created: <strong className="text-slate-700 dark:text-slate-300">{formattedCreated}</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Updated: <strong className="text-slate-700 dark:text-slate-300">{formattedUpdated}</strong></span>
                </div>
                <div className="flex items-center space-x-1">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span>Collection: <strong className="text-slate-700 dark:text-slate-300">{livePrompt.collection || livePrompt.category}</strong></span>
                </div>

                {/* Interactive Rating */}
                <div className="flex items-center space-x-1.5 ml-auto">
                  <span className="font-medium text-slate-700 dark:text-slate-300">Rating:</span>
                  <div className="flex items-center space-x-0.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isHovered = hoverRating > 0;
                      const isFull = isHovered ? hoverRating >= star : (currentRating !== null && currentRating >= star);
                      const isHalf = !isHovered && currentRating !== null && currentRating >= (star - 0.75) && currentRating < star;

                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRate(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          className="p-0.5 text-slate-400 hover:text-amber-500 transition cursor-pointer"
                        >
                          {isHalf ? (
                            <StarHalf className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ) : (
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isFull
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300 dark:text-slate-600'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono ml-1 text-xs">
                    {hoverRating > 0 ? hoverRating : (currentRating !== null ? currentRating : 'No ratings')}
                  </span>
                </div>
              </div>

              {/* Tags */}
              <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                {livePrompt.tags?.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Prompt Content Section with Copy */}
            <div className="space-y-1.5 flex-1 flex flex-col my-1">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Prompt Instructions / System Prompt
                </h4>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-blue-50 text-slate-700 dark:text-slate-300 hover:text-blue-600 border border-slate-200 dark:border-slate-600 text-xs font-medium rounded-lg transition flex items-center space-x-1 cursor-pointer"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>

              <pre className="max-h-[28vh] bg-slate-50 dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-[#374151] overflow-y-auto leading-relaxed select-all">
                {livePrompt.content}
              </pre>
            </div>
          </div>
        )}

        {/* TAB 2: COMMENTS & REVIEWS */}
        {activeModalTab === 'comments' && (
          <div className="space-y-4 py-3 flex-1 flex flex-col max-h-[50vh] overflow-y-auto">
            {/* Review Status Banner & Controls */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-3 text-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center space-x-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Review Status:</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getReviewBadgeStyle(reviewStatus)}`}>
                    {reviewStatus.replace('_', ' ')}
                  </span>
                  <span className="text-slate-400 font-mono">({livePrompt.version || 'v1.0'})</span>
                </div>

                {/* Reviewer Action Buttons */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => setShowRequestReviewModal(true)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Request Review</span>
                    </button>
                  )}

                  {canReview && reviewStatus === 'IN_REVIEW' && (
                    <>
                      <button
                        type="button"
                        onClick={handleApproveReview}
                        disabled={submittingReview}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChangesModal(true)}
                        disabled={submittingReview}
                        className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1 disabled:opacity-50"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Request Changes</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {reviewError && (
                <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                  <button type="button" onClick={() => setReviewError(null)} className="text-rose-500 hover:text-rose-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {currentVersionObj?.reviewMessage && (
                <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs">
                  <strong>Review Note:</strong> "{currentVersionObj.reviewMessage}"
                </div>
              )}

              {currentVersionObj?.reviewFeedback && reviewStatus === 'CHANGES_REQUESTED' && (
                <div className="p-2.5 rounded-lg bg-rose-50/60 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs">
                  <strong>Changes Requested:</strong> "{currentVersionObj.reviewFeedback}"
                </div>
              )}
            </div>

            {/* Comments List */}
            <div className="space-y-3 flex-1">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wider">
                <span>Discussion Thread</span>
                <span className="text-[11px] font-normal lowercase">{comments.length} comment{comments.length !== 1 ? 's' : ''}</span>
              </div>

              {loadingComments ? (
                <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Loading comments...</span>
                </div>
              ) : comments.length > 0 ? (
                <div className="space-y-2.5">
                  {comments.map((cmt) => (
                    <div
                      key={cmt.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center space-x-2">
                          <strong className="text-slate-900 dark:text-white">{cmt.userName || cmt.userEmail}</strong>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.2 rounded border ${getRoleBadgeStyle(cmt.userRole)}`}>
                            {cmt.userRole}
                          </span>
                          {cmt.versionTag && (
                            <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {cmt.versionTag}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">{cmt.createdAt}</span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
                        {cmt.content}
                      </p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => handleLikeComment(cmt.id)}
                          className="flex items-center space-x-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer transition"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>{cmt.likesCount || 0}</span>
                        </button>

                        {(cmt.userId === currentUser?.id || isOwner) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteComment(cmt.id)}
                            className="text-slate-400 hover:text-red-500 transition p-1 cursor-pointer"
                            title="Delete comment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 px-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400 space-y-1">
                  <p className="font-medium text-slate-600 dark:text-slate-300">No comments yet.</p>
                  <p>Start a review discussion about this prompt or request changes on a specific version.</p>
                </div>
              )}
            </div>

            {/* Post Comment Input */}
            {commentError && (
              <div className="p-2.5 rounded-lg bg-rose-50/80 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{commentError}</span>
                </div>
                <button type="button" onClick={() => setCommentError(null)} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <form onSubmit={handlePostComment} className="pt-2 space-y-2 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Link to Version:</span>
                <select
                  value={selectedCommentVersion}
                  onChange={(e) => setSelectedCommentVersion(e.target.value)}
                  className="h-7 px-2 bg-slate-100 dark:bg-slate-900 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  <option value="">General Discussion</option>
                  {(livePrompt.versions || []).map(v => (
                    <option key={v.id || v.version} value={v.version}>{v.version}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <textarea
                  required
                  rows={2}
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Write a review comment or discussion feedback..."
                  className="flex-1 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:outline-none resize-none"
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newCommentText.trim()}
                  className="px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shrink-0"
                >
                  {submittingComment ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Post</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: COLLABORATORS */}
        {activeModalTab === 'collaborators' && (
          <div className="space-y-4 py-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between text-xs">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white">Active Prompt Collaborators</h4>
                <p className="text-slate-500">Users with authorized access to this specific prompt.</p>
              </div>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenShare();
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Manage Access</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {/* Owner Item */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                    {livePrompt.ownerName ? livePrompt.ownerName.slice(0, 2).toUpperCase() : 'OW'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {livePrompt.ownerName || livePrompt.ownerEmail || 'Workspace Owner'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">{livePrompt.ownerEmail}</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  Owner
                </span>
              </div>

              {/* Collaborators List */}
              {collaborators.map((c) => (
                <div key={c.id || c.email} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 to-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                      {c.name ? c.name.slice(0, 2).toUpperCase() : 'CO'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{c.name || c.email}</div>
                      <div className="text-[11px] text-slate-500 font-mono truncate">{c.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getRoleBadgeStyle(c.role)}`}>
                      {c.role || 'Reviewer'}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Toolbar */}
        <div className="pt-3.5 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2.5 flex-shrink-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {canEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEdit();
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            )}

            {isOwner && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenShare();
                }}
                className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExport();
              }}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCompare}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-medium text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer shadow-sm"
            >
              <GitCompare className="w-3.5 h-3.5 text-blue-600" />
              <span>Compare</span>
            </button>

            <button
              type="button"
              onClick={handleViewVersions}
              className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-medium text-xs rounded-lg transition flex items-center space-x-1 cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Versions ({livePrompt.versions?.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={handleTestInPlayground}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition flex items-center space-x-1 cursor-pointer"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Test in Playground</span>
            </button>
          </div>
        </div>

        {/* MODAL: Request Review */}
        {showRequestReviewModal && (
          <div
            onClick={() => setShowRequestReviewModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Request Prompt Review</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestReviewModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitReviewRequest} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Select Version
                  </label>
                  <select
                    value={reviewVersionTag}
                    onChange={(e) => setReviewVersionTag(e.target.value)}
                    className="w-full h-9 bg-slate-50 dark:bg-slate-900 font-mono text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                  >
                    {(livePrompt.versions || []).map(v => (
                      <option key={v.id || v.version} value={v.version}>{v.version} - {v.commitMessage || 'Version'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Select Reviewer *
                  </label>
                  {collaborators.length > 0 ? (
                    <select
                      required
                      value={selectedReviewerEmail}
                      onChange={(e) => setSelectedReviewerEmail(e.target.value)}
                      className="w-full h-9 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                    >
                      <option value="">-- Choose Reviewer --</option>
                      {collaborators.map(c => (
                        <option key={c.id || c.email} value={c.email}>
                          {c.name || c.email} ({c.role})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="email"
                      required
                      placeholder="reviewer@example.com"
                      value={selectedReviewerEmail}
                      onChange={(e) => setSelectedReviewerEmail(e.target.value)}
                      className="w-full h-9 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none"
                    />
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Review Instructions / Optional Message
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Please check the responsive UI constraints and safety guidelines."
                    value={reviewMessage}
                    onChange={(e) => setReviewMessage(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowRequestReviewModal(false)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview || !selectedReviewerEmail}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
                  >
                    {submittingReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Send Review Request</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Request Changes Feedback */}
        {showChangesModal && (
          <div
            onClick={() => setShowChangesModal(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center space-x-2 text-amber-600">
                  <AlertTriangle className="w-4 h-4" />
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Request Changes</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowChangesModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitChanges} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Feedback & Required Changes *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="e.g. Please specify tablet breakpoint behavior and clarify ambiguous spacing requirements."
                    value={changesFeedback}
                    onChange={(e) => setChangesFeedback(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowChangesModal(false)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview || !changesFeedback.trim()}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg flex items-center gap-1 disabled:opacity-50"
                  >
                    {submittingReview ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>Submit Changes Requested</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
