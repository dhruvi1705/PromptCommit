import React, { useState, useRef, useEffect } from 'react';
import {
  Share2,
  Copy,
  Check,
  X,
  UserPlus,
  Trash2,
  Lock,
  Globe,
  Shield,
  Eye,
  MessageSquare,
  Edit3
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export const ShareModal = ({ prompt, isOpen, onClose }) => {
  const { sharePrompt, removeSharedUser, updateShareRole } = usePrompts();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Reviewer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [linkAccess, setLinkAccess] = useState('Restricted'); // 'Restricted' | 'Public'

  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !prompt) return null;

  const shareUrl = prompt.shareLink || `https://promptcommit.dev/share/${prompt.id}`;
  const sharedWith = prompt.sharedWith || [];

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    showToast({
      title: 'Link Copied!',
      message: 'Shareable link copied to clipboard.',
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleAddCollaborator = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      showToast({
        title: 'Email Required',
        message: 'Please enter a valid collaborator email address.',
        type: 'error'
      });
      return;
    }

    const res = sharePrompt(prompt.id, { email: email.trim(), role });
    if (res.success) {
      showToast({
        title: 'Collaborator Added!',
        message: res.message,
        type: 'success'
      });
      setEmail('');
    } else {
      showToast({
        title: 'Error',
        message: res.message,
        type: 'error'
      });
    }
  };

  const handleRevoke = (memberId, memberName) => {
    removeSharedUser(prompt.id, memberId);
    showToast({
      title: 'Access Revoked',
      message: `Removed sharing access for ${memberName || 'collaborator'}.`,
      type: 'info'
    });
  };

  const handleRoleChange = (memberId, newRole) => {
    updateShareRole(prompt.id, memberId, newRole);
    showToast({
      title: 'Permission Updated',
      message: `Role changed to ${newRole}.`,
      type: 'success'
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Share Prompt</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-sm">
                "{prompt.title}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Share Modal"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite by Email */}
        <form onSubmit={handleAddCollaborator} className="space-y-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Add Collaborator
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              placeholder="collaborator@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 h-11 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none transition"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="h-11 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none cursor-pointer"
            >
              <option value="Viewer">Viewer</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Editor">Editor</option>
            </select>
            <button
              type="submit"
              className="h-11 px-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer flex-shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </form>

        {/* Shareable Link Box */}
        <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-500" />
              <span>Shareable Link</span>
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              Access: Anyone with link ({role})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 h-9 bg-white dark:bg-slate-950 text-xs text-slate-600 dark:text-slate-300 px-3 rounded-xl border border-slate-200 dark:border-slate-800 font-mono select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="h-9 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-medium rounded-lg transition flex items-center space-x-1 cursor-pointer flex-shrink-0"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Access Roster / Who has access */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Who Has Access ({1 + sharedWith.length})
            </h4>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {/* Owner Entry */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-md bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                  {currentUser?.avatar || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || 'Workspace Owner'} <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400 font-mono">(You)</span>
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">{currentUser?.email || 'owner@promptcommit.dev'}</p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex-shrink-0">
                Owner
              </span>
            </div>

            {/* Shared Collaborators */}
            {sharedWith.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
                    {member.avatar || member.name?.slice(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{member.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-shrink-0">
                  <select
                    value={member.role}
                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                    className="h-8 bg-slate-50 dark:bg-slate-950 text-[11px] font-semibold text-slate-800 dark:text-slate-200 px-2 rounded-lg border border-slate-200 dark:border-slate-800 focus:outline-none cursor-pointer"
                  >
                    <option value="Viewer">Viewer</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Editor">Editor</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleRevoke(member.id, member.name)}
                    title="Revoke access"
                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
