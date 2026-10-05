import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Lock,
  Star,
  GitBranch,
  Play,
  Copy,
  Check,
  Share2,
  Download,
  Edit3,
  GitCompare,
  MoreVertical,
  Eye,
  Cpu,
  Clock,
  Trash2,
  Users,
  ShieldCheck,
  X
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { formatDateTime } from '../utils/dateFormatter';
import { PromptDetailsModal } from './PromptDetailsModal';
import { EditPromptModal } from './EditPromptModal';
import { ShareModal } from './ShareModal';
import { ExportModal } from './ExportModal';

export const PromptCard = ({ prompt }) => {
  const navigate = useNavigate();
  const { toggleFavorite, setActivePromptId, deletePrompt } = usePrompts();
  const { showToast } = useToast();

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const menuRef = useRef(null);
  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMoreMenu]);

  const handleCopyPrompt = (e) => {
    e.stopPropagation();
    const contentToCopy = prompt.content || prompt.description || prompt.title;
    navigator.clipboard.writeText(contentToCopy);
    setCopied(true);
    showToast({
      title: 'Prompt Copied!',
      message: `"${prompt.title}" copied to clipboard.`,
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCardClick = () => {
    setActivePromptId(prompt.id);
    setShowDetailsModal(true);
  };

  const handleOpenVersions = (e) => {
    e.stopPropagation();
    setShowMoreMenu(false);
    setActivePromptId(prompt.id);
    navigate('/app/versions');
  };

  const handleOpenPlayground = (e) => {
    e.stopPropagation();
    setActivePromptId(prompt.id);
    navigate('/app/playground');
  };

  const handleOpenCompare = (e) => {
    e.stopPropagation();
    setShowMoreMenu(false);
    setActivePromptId(prompt.id);
    navigate('/app/compare');
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    deletePrompt(prompt.id);
    setShowDeleteConfirm(false);
    setShowMoreMenu(false);
    showToast({
      title: 'Prompt Deleted',
      message: `"${prompt.title}" was removed.`,
      type: 'info'
    });
  };

  const getCategoryColor = (cat) => {
    switch (cat?.toLowerCase()) {
      case 'coding':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'research':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      case 'marketing':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'education':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'engineering':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'general':
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getReviewBadgeStyle = (status) => {
    switch (status) {
      case 'IN_REVIEW':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
      case 'CHANGES_REQUESTED':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30';
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
      default:
        return null;
    }
  };

  const formattedDate = formatDateTime(prompt.updatedAt);
  const collaboratorCount = prompt.collaboratorsCount !== undefined ? prompt.collaboratorsCount : (prompt.sharedWith?.length || 0);
  const reviewBadgeClass = getReviewBadgeStyle(prompt.reviewStatus);

  return (
    <>
      <div
        onClick={handleCardClick}
        className="group relative bg-white dark:bg-slate-800 hover:bg-slate-50/70 dark:hover:bg-slate-700/40 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-xl p-5 transition-colors cursor-pointer flex flex-col justify-between shadow-sm"
      >
        {/* Top bar */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${getCategoryColor(prompt.category)}`}>
                {prompt.category}
              </span>
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {prompt.version}
              </span>
              {reviewBadgeClass && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${reviewBadgeClass}`}>
                  {prompt.reviewStatus.replace('_', ' ')}
                </span>
              )}
              {prompt.targetModel && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hidden sm:inline-flex items-center space-x-1">
                  <Cpu className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>{prompt.targetModel}</span>
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1.5">
              {prompt.isOwner === false ? (
                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-md" title={`Shared by ${prompt.ownerName || prompt.ownerEmail || 'Collaborator'}`}>
                  <Share2 className="w-3 h-3 text-indigo-500" />
                  <span>{prompt.userRole || 'Viewer'}</span>
                </span>
              ) : collaboratorCount > 0 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCollaboratorsModal(true);
                  }}
                  title="View collaborators for this prompt"
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition cursor-pointer"
                >
                  <Users className="w-3 h-3" />
                  <span>👥 {collaboratorCount} collaborator{collaboratorCount !== 1 ? 's' : ''}</span>
                </button>
              ) : (
                <span className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                  <Lock className="w-3 h-3 text-slate-400" />
                  <span className="hidden sm:inline">Private</span>
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(prompt.id);
                  showToast({
                    title: prompt.isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
                    message: prompt.title,
                    type: prompt.isFavorite ? 'info' : 'success'
                  });
                }}
                title={prompt.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  prompt.isFavorite
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Star className={`w-3.5 h-3.5 ${prompt.isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
            </div>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
            {prompt.title}
          </h3>

          {/* Description */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
            {prompt.description}
          </p>

          {/* Tags */}
          <div className="flex items-center flex-wrap gap-1.5 mt-3">
            {prompt.tags?.slice(0, 3).map((tag, idx) => (
              <span
                key={idx}
                className="text-[11px] font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
          {/* Left: Date */}
          <div className="flex items-center space-x-1.5 text-slate-400 dark:text-slate-500 min-w-0">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate text-[11px] font-medium">{formattedDate}</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center space-x-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* 1. TEST BUTTON */}
            <button
              type="button"
              onClick={handleOpenPlayground}
              title="Test in Playground"
              className="h-8 px-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-semibold transition flex items-center space-x-1 cursor-pointer"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Test</span>
            </button>

            {/* 2. COPY BUTTON */}
            <button
              type="button"
              onClick={handleCopyPrompt}
              title="Copy Prompt"
              className={`h-8 px-2.5 rounded-lg border text-xs font-medium transition flex items-center space-x-1 cursor-pointer ${
                copied
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            {/* 3. MORE OPTIONS DROPDOWN */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                title="More Options"
                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center transition cursor-pointer"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 bottom-full mb-1.5 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1.5 z-40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      handleCardClick();
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                    <span>View Details</span>
                  </button>

                  {(prompt.isOwner !== false || prompt.userRole === 'Editor') && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowEditModal(true);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Edit Prompt</span>
                    </button>
                  )}

                  {prompt.isOwner !== false && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreMenu(false);
                        setShowShareModal(true);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Share</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowExportModal(true);
                    }}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-slate-500" />
                    <span>Export</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenVersions}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5 text-slate-500" />
                    <span>Version History</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenCompare}
                    className="w-full px-3 py-2 text-left text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center space-x-2 font-medium transition cursor-pointer"
                  >
                    <GitCompare className="w-3.5 h-3.5 text-slate-500" />
                    <span>Compare</span>
                  </button>

                  {prompt.isOwner !== false && (
                    <>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />

                      <button
                        type="button"
                        onClick={() => {
                          setShowMoreMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full px-3 py-2 text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center space-x-2 font-medium transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* POPOVER / MODAL: PROMPT COLLABORATORS */}
      {showCollaboratorsModal && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setShowCollaboratorsModal(false);
          }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <Users className="w-4 h-4 text-blue-600" />
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Collaborators</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowCollaboratorsModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {prompt.sharedWith && prompt.sharedWith.length > 0 ? (
                prompt.sharedWith.map((c) => (
                  <div key={c.id || c.email} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate">{c.name || c.email}</div>
                      <div className="text-[11px] text-slate-500 truncate">{c.email}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 border border-blue-200 dark:border-blue-800">
                        {c.role || 'Reviewer'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-600">Active</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  No collaborators on this prompt yet.
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  setShowCollaboratorsModal(false);
                  setShowShareModal(true);
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Manage Collaboration</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <PromptDetailsModal
        prompt={prompt}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
        onOpenEdit={() => setShowEditModal(true)}
        onOpenShare={() => setShowShareModal(true)}
        onOpenExport={() => setShowExportModal(true)}
      />

      <EditPromptModal
        prompt={prompt}
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
      />

      <ShareModal
        prompt={prompt}
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      <ExportModal
        prompt={prompt}
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Prompt?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>"{prompt.title}"</strong>?
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteConfirm(false);
                }}
                className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
