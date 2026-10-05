import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Link as LinkIcon,
  ShieldCheck,
  Share2,
  Lock,
  Check,
  X,
  Clock,
  Trash2,
  ArrowRight,
  UserMinus,
  Copy,
  Sparkles,
  ExternalLink,
  Shield,
  FileText,
  Mail,
  RefreshCw,
  AlertCircle,
  FolderLock,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Activity as ActivityIcon,
  GitCommit,
  MessageSquare,
  ChevronRight,
  Layers,
  Settings
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { collaborationService } from '../services/collaborationService';
import { PromptDetailsModal } from '../components/PromptDetailsModal';

export const Collaboration = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { ownedPrompts, sharedPrompts, refreshData: refreshPromptData, setActivePromptId } = usePrompts();
  const { showToast, addToast } = useToast();

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'shared_with_me' | 'pending_invites' | 'active_links' | 'activity'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Authoritative backend data
  const [overviewData, setOverviewData] = useState(null);
  const [membersList, setMembersList] = useState([]);
  const [invitationsList, setInvitationsList] = useState([]);
  const [activityList, setActivityList] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Collaboration prompt details & discussion modal
  const [collabPromptForModal, setCollabPromptForModal] = useState(null);
  const [collabModalTab, setCollabModalTab] = useState('comments');

  // Modals state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [modalTab, setModalTab] = useState('email'); // 'email' | 'link'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInviteResult, setCreatedInviteResult] = useState(null);

  // View Shared Prompts Drawer / Modal
  const [selectedCollaborator, setSelectedCollaborator] = useState(null);
  const [managingPromptAccessId, setManagingPromptAccessId] = useState(null);

  // Email form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('Reviewer');
  const [inviteScope, setInviteScope] = useState('workspace');
  const [invitePromptId, setInvitePromptId] = useState('');
  const [inviteExpiration, setInviteExpiration] = useState('7');

  // Share link form state
  const [linkRole, setLinkRole] = useState('Viewer');
  const [linkScope, setLinkScope] = useState('workspace');
  const [linkPromptId, setLinkPromptId] = useState('');
  const [linkExpiration, setLinkExpiration] = useState('7');
  const [linkMaxUses, setLinkMaxUses] = useState('');

  // Confirmation modals
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [inviteToRevoke, setInviteToRevoke] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const copyTimerRef = useRef(null);
  const collabRequestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const notify = useCallback((message, type = 'success', title = '') => {
    if (addToast) {
      addToast(message, type, title);
    } else if (showToast) {
      showToast({
        title: title || (type === 'error' ? 'Error' : type === 'info' ? 'Info' : type === 'warning' ? 'Notice' : 'Success'),
        message: String(message || ''),
        type
      });
    }
  }, [addToast, showToast]);

  // Single authoritative fetch function for all collaboration data
  const loadCollaborationData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setError(null);
    const reqId = ++collabRequestIdRef.current;
    try {
      const [overview, members, invites, activities] = await Promise.all([
        collaborationService.getOverview().catch(() => null),
        collaborationService.getMembers().catch(() => []),
        collaborationService.getInvitations().catch(() => []),
        collaborationService.getActivity().catch(() => [])
      ]);

      if (!isMountedRef.current || reqId !== collabRequestIdRef.current) return;

      setOverviewData(overview);
      setMembersList(Array.isArray(members) ? members : []);
      setInvitationsList(Array.isArray(invites) ? invites : []);
      setActivityList(Array.isArray(activities) ? activities : []);

      // If a collaborator is currently open in the drawer, keep their data updated
      if (selectedCollaborator) {
        const updated = (members || []).find(m => m.email?.toLowerCase() === selectedCollaborator.email?.toLowerCase());
        if (updated) setSelectedCollaborator(updated);
      }

      // Also ensure prompt context is in sync
      if (refreshPromptData) {
        await refreshPromptData().catch(() => null);
      }
    } catch (err) {
      if (!isMountedRef.current || reqId !== collabRequestIdRef.current) return;
      console.error('Failed to load collaboration data:', err);
      setError('Unable to load collaboration data.');
    } finally {
      if (isMountedRef.current && reqId === collabRequestIdRef.current && !isSilent) {
        setLoading(false);
      }
    }
  }, [refreshPromptData, selectedCollaborator]);

  // Initial load
  useEffect(() => {
    loadCollaborationData();
  }, []);

  // Re-fetch when returning to the tab / window focus
  useEffect(() => {
    const handleFocus = () => {
      loadCollaborationData(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCollaborationData]);

  // Handle Tab Click with auto-refresh
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    loadCollaborationData(true);
  };

  // Derived filtered lists from authoritative backend data
  const activePendingInvites = useMemo(() => {
    return invitationsList.filter(inv => Boolean(inv.recipientEmail) && inv.status === 'Pending');
  }, [invitationsList]);

  const activeShareLinks = useMemo(() => {
    return invitationsList.filter(inv => !inv.recipientEmail && inv.status === 'Active');
  }, [invitationsList]);

  // Members list (ensure owner exists as fallback if backend list empty)
  const displayMembers = useMemo(() => {
    if (membersList.length > 0) return membersList;
    return [
      {
        id: currentUser?.id || 'owner',
        name: currentUser?.name || 'Workspace Owner',
        email: currentUser?.email || '',
        role: 'Owner',
        status: 'Active',
        isOwner: true,
        avatar: currentUser?.avatar || (currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'ME'),
        avatarBg: 'from-blue-600 to-indigo-600',
        joinedAt: 'Workspace Creator',
        promptsCount: (ownedPrompts || []).length,
        sharedPrompts: []
      }
    ];
  }, [membersList, currentUser, ownedPrompts]);

  // Reliable Clipboard Copier with Fallback
  const copyToClipboard = (rawUrlOrPath, buttonId) => {
    let fullUrl = String(rawUrlOrPath || '');
    if (fullUrl.startsWith('/')) {
      fullUrl = `${window.location.origin}${fullUrl}`;
    } else if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = `${window.location.origin}/invite/${fullUrl}`;
    }

    const fallbackCopy = (text) => {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) {
          setCopiedId(buttonId);
          notify('Invite link copied to clipboard!', 'info');
          if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
          }
          copyTimerRef.current = setTimeout(() => setCopiedId(null), 2500);
          return true;
        }
      } catch (err) {
        console.error('Fallback clipboard copy failed:', err);
      }
      return false;
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(fullUrl)
        .then(() => {
          setCopiedId(buttonId);
          notify('Invite link copied to clipboard!', 'info');
          if (copyTimerRef.current) {
            clearTimeout(copyTimerRef.current);
          }
          copyTimerRef.current = setTimeout(() => setCopiedId(null), 2500);
        })
        .catch(() => {
          const success = fallbackCopy(fullUrl);
          if (!success) {
            notify('Unable to copy automatically. Please copy the link manually.', 'warning');
          }
        });
    } else {
      const success = fallbackCopy(fullUrl);
      if (!success) {
        notify('Unable to copy automatically. Please copy the link manually.', 'warning');
      }
    }
  };

  // Create Email Invitation
  const handleCreateEmailInvite = async (e) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) {
      notify('Recipient email address is required.', 'error');
      return;
    }

    if (inviteScope === 'prompt' && !invitePromptId) {
      notify('Please select a specific prompt to share.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        email: cleanEmail,
        name: inviteName.trim() || undefined,
        role: inviteRole,
        scope: inviteScope,
        promptId: inviteScope === 'prompt' ? String(invitePromptId) : null,
        expiresInDays: inviteExpiration === 'never' ? null : Number(inviteExpiration)
      };

      const res = await collaborationService.createEmailInvite(payload);
      const fullInviteUrl = `${window.location.origin}/invite/${res.token}`;
      const promptObj = (ownedPrompts || []).find(p => String(p.id) === String(invitePromptId));

      setCreatedInviteResult({
        type: 'email',
        token: res.token,
        inviteUrl: fullInviteUrl,
        recipientEmail: cleanEmail,
        recipientName: inviteName.trim() || undefined,
        role: res.role || inviteRole,
        scope: inviteScope,
        promptTitle: inviteScope === 'prompt' ? (promptObj?.title || res.promptTitle || 'Selected Prompt') : 'All Workspace Prompts',
        expiresAt: res.expiresAt || (inviteExpiration === 'never' ? 'Never' : `${inviteExpiration} days`),
        emailSent: res.emailSent,
        emailError: res.emailError,
        recipientUserFound: res.recipientUserFound
      });

      if (res.emailSent) {
        notify(`Invitation sent! An email was dispatched to ${cleanEmail}.`, 'success');
      } else {
        notify('Invitation created successfully.', 'success');
      }

      // Authoritative state refresh
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to create email invitation.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Resend Email Invitation
  const handleResendInvite = async (inv) => {
    if (resendingId) return;
    setResendingId(inv.id);
    try {
      await collaborationService.resendInvitation(inv.id);
      notify('Invitation resent.', 'success');
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to resend invitation.', 'error');
    } finally {
      setResendingId(null);
    }
  };

  // Create Shareable Link
  const handleCreateShareLink = async (e) => {
    e.preventDefault();
    if (linkScope === 'prompt' && !linkPromptId) {
      notify('Please select a specific prompt to share.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        role: linkRole,
        scope: linkScope,
        promptId: linkScope === 'prompt' ? String(linkPromptId) : null,
        expiresInDays: linkExpiration === 'never' ? null : Number(linkExpiration),
        maxUses: linkMaxUses ? Number(linkMaxUses) : null
      };

      const res = await collaborationService.createShareLink(payload);
      const fullInviteUrl = `${window.location.origin}/invite/${res.token}`;
      const promptObj = (ownedPrompts || []).find(p => String(p.id) === String(linkPromptId));

      setCreatedInviteResult({
        type: 'link',
        token: res.token,
        inviteUrl: fullInviteUrl,
        role: res.role || linkRole,
        scope: linkScope,
        promptTitle: linkScope === 'prompt' ? (promptObj?.title || res.promptTitle || 'Selected Prompt') : 'All Workspace Prompts',
        expiresAt: res.expiresAt || (linkExpiration === 'never' ? 'Never' : `${linkExpiration} days`),
        maxUses: linkMaxUses ? `${linkMaxUses} uses` : 'Unlimited'
      });

      notify('Share link created.', 'success');
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to create share link.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update Member Global Role
  const handleUpdateRole = async (email, newRole) => {
    try {
      await collaborationService.updateMemberRole(email, newRole);
      notify(`Role updated to ${newRole}.`, 'success');
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to update role.', 'error');
    }
  };

  // Update Member Role for a specific prompt
  const handleUpdatePromptRole = async (email, promptId, newRole) => {
    try {
      await collaborationService.updateMemberPromptRole(email, promptId, newRole);
      notify(`Role updated to ${newRole} for this prompt.`, 'success');
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to update prompt role.', 'error');
    }
  };

  // Remove Collaborator from a single prompt
  const handleRemoveCollaboratorFromPrompt = async (email, promptId, promptTitle) => {
    try {
      await collaborationService.removeMemberPromptAccess(email, promptId);
      notify(`Removed access to "${promptTitle}".`, 'info');
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to revoke prompt access.', 'error');
    }
  };

  // Remove Collaborator Access completely
  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove || actionLoading) return;
    setActionLoading(true);
    try {
      await collaborationService.removeMember(memberToRemove.email);
      notify(`Collaborator removed.`, 'info');
      setMemberToRemove(null);
      if (selectedCollaborator?.email?.toLowerCase() === memberToRemove.email?.toLowerCase()) {
        setSelectedCollaborator(null);
      }
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to remove member.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Revoke Invitation or Share Link
  const handleConfirmRevokeInvite = async () => {
    if (!inviteToRevoke || actionLoading) return;
    setActionLoading(true);
    try {
      await collaborationService.revokeInvitation(inviteToRevoke.id);
      notify(inviteToRevoke.recipientEmail ? 'Invitation revoked.' : 'Share link revoked.', 'info');
      setInviteToRevoke(null);
      await loadCollaborationData(true);
    } catch (err) {
      notify(err.message || 'Failed to revoke invitation.', 'error');
    } finally {
      setActionLoading(false);
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

  const openCollabModal = (prompt, tab = 'comments') => {
    setCollabPromptForModal(prompt);
    setCollabModalTab(tab);
  };

  const getActivityIcon = (type, status) => {
    switch (type) {
      case 'review':
        if (status === 'APPROVED') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        if (status === 'CHANGES_REQUESTED') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
        return <Eye className="w-4 h-4 text-blue-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case 'version':
        return <GitCommit className="w-4 h-4 text-purple-500" />;
      case 'share':
        return <Share2 className="w-4 h-4 text-blue-500" />;
      default:
        return <ActivityIcon className="w-4 h-4 text-slate-500" />;
    }
  };

  // Count calculations
  const teamMembersCount = overviewData?.membersCount !== undefined ? overviewData.membersCount : displayMembers.length;
  const sharedWithMeCount = overviewData?.sharedPromptsCount !== undefined ? overviewData.sharedPromptsCount : (sharedPrompts?.length || 0);
  const pendingInvitesCount = overviewData?.pendingInvitesCount !== undefined ? overviewData.pendingInvitesCount : activePendingInvites.length;
  const activeLinksCount = overviewData?.activeLinksCount !== undefined ? overviewData.activeLinksCount : activeShareLinks.length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-1 sm:px-2">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Team Collaboration & Sharing
            </h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex-shrink-0 inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              RBAC Vault
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Manage authorized collaborators, view shared prompts across team members, and review version discussions.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center flex-shrink-0">
          <button
            onClick={() => loadCollaborationData()}
            disabled={loading}
            className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition shadow-sm cursor-pointer disabled:opacity-50"
            title="Refresh Collaboration Data"
            aria-label="Refresh Collaboration Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
          </button>
          <button
            onClick={() => {
              setCreatedInviteResult(null);
              setShowInviteModal(true);
            }}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <span>Invite Collaborator</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && !loading && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 text-xs text-red-700 dark:text-red-400 font-medium">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => loadCollaborationData()}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer shrink-0"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Top 4 Stat Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm animate-pulse min-h-[102px] flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-20" />
                <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-lg" />
              </div>
              <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-12 mt-2" />
            </div>
          ))
        ) : (
          <>
            {/* 1. Team Members */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[102px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Team Members</span>
                <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {teamMembersCount}
                </span>
                <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
                  {teamMembersCount > 1 ? `${teamMembersCount} Collaborators` : 'Workspace Owner'}
                </span>
              </div>
            </div>

            {/* 2. Shared With Me */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[102px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Shared With Me</span>
                <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                  <Share2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {sharedWithMeCount}
                </span>
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                  {sharedWithMeCount > 0 ? `${sharedWithMeCount} Accessible Prompts` : 'No shared prompts'}
                </span>
              </div>
            </div>

            {/* 3. Pending Invites */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[102px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Pending Invites</span>
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                  <Mail className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {pendingInvitesCount}
                </span>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  {pendingInvitesCount > 0 ? `${pendingInvitesCount} Awaiting Acceptance` : 'No pending invitations'}
                </span>
              </div>
            </div>

            {/* 4. Active Share Links */}
            <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-4 shadow-sm flex flex-col justify-between min-h-[102px]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <span>Active Share Links</span>
                <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                  <LinkIcon className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2.5 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">
                  {activeLinksCount}
                </span>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  {activeLinksCount > 0 ? `${activeLinksCount} Live URLs` : 'No active links'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tabs Navigation Bar (Scrollable on small screens with no page overflow) */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center space-x-1 sm:space-x-2 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => handleTabChange('members')}
            className={`h-9 px-3.5 rounded-xl text-xs font-medium transition flex items-center space-x-2 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              activeTab === 'members'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>Team Members</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'members'
                ? 'bg-blue-200/60 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {displayMembers.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('shared_with_me')}
            className={`h-9 px-3.5 rounded-xl text-xs font-medium transition flex items-center space-x-2 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              activeTab === 'shared_with_me'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>Shared With Me</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'shared_with_me'
                ? 'bg-blue-200/60 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {sharedPrompts?.length || 0}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('pending_invites')}
            className={`h-9 px-3.5 rounded-xl text-xs font-medium transition flex items-center space-x-2 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              activeTab === 'pending_invites'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>Pending Invitations</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'pending_invites'
                ? 'bg-blue-200/60 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {activePendingInvites.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('active_links')}
            className={`h-9 px-3.5 rounded-xl text-xs font-medium transition flex items-center space-x-2 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              activeTab === 'active_links'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Active Links</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              activeTab === 'active_links'
                ? 'bg-blue-200/60 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}>
              {activeShareLinks.length}
            </span>
          </button>

          <button
            onClick={() => handleTabChange('activity')}
            className={`h-9 px-3.5 rounded-xl text-xs font-medium transition flex items-center space-x-2 cursor-pointer whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${
              activeTab === 'activity'
                ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5 shrink-0" />
            <span>Activity</span>
            {activityList.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                activeTab === 'activity'
                  ? 'bg-blue-200/60 dark:bg-blue-800 text-blue-900 dark:text-blue-200'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}>
                {activityList.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Loading Skeleton for Tab Content */}
      {loading && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 animate-pulse" />
          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {[1, 2, 3].map((i) => (
              <div key={i} className="py-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center space-x-3 w-2/3">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="space-y-2 w-full">
                    <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
                    <div className="h-2.5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-lg w-24 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 1: TEAM MEMBERS */}
      {!loading && activeTab === 'members' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Workspace Members & Prompt Access</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Collaborators authorized to access your prompts. Permissions can differ by prompt.</p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md shrink-0">
              RBAC Enforced
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {displayMembers.map((mem) => {
              const isOwner = mem.role === 'Owner' || mem.isOwner;
              const sharedCount = mem.sharedPrompts?.length || mem.promptsCount || 0;
              
              if (isOwner) {
                return (
                  <div key={mem.id || mem.email} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${mem.avatarBg || 'from-blue-600 to-indigo-600'} text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0`}>
                        {mem.avatar || (mem.name ? mem.name.slice(0, 2).toUpperCase() : 'ME')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{mem.name}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-md shrink-0">
                            Workspace Owner
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Active
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 break-all">{mem.email}</div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-400 italic shrink-0">
                      Full Workspace Permissions ({mem.promptsCount || (ownedPrompts || []).length} owned prompts)
                    </div>
                  </div>
                );
              }

              return (
                <div key={mem.id || mem.email} className="p-4 sm:p-5 flex flex-col gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                  {/* Top Row: User Information + Quick Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${mem.avatarBg || 'from-blue-500 to-cyan-600'} text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0`}>
                        {mem.avatar || (mem.name ? mem.name.slice(0, 2).toUpperCase() : 'CO')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                          <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{mem.name}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0">
                            Active
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 break-all">{mem.email}</div>
                      </div>
                    </div>

                    {/* Prompts Count Trigger + Revoke Button */}
                    <div className="flex items-center space-x-2 self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedCollaborator(mem)}
                        className="h-8 px-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-semibold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
                        title={`View all prompts shared with ${mem.name}`}
                      >
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        <span>{sharedCount} Shared Prompt{sharedCount !== 1 ? 's' : ''} →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMemberToRemove(mem)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                        title={`Revoke all access for ${mem.name}`}
                        aria-label={`Revoke all access for ${mem.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Compact Prompt-Access Summary */}
                  {mem.sharedPrompts && mem.sharedPrompts.length > 0 ? (
                    <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3 sm:p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        <span>Prompt-Level Access Summary</span>
                        <span className="text-[10px] text-slate-400 font-normal lowercase">permissions vary by prompt</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {mem.sharedPrompts.slice(0, 3).map((sp) => (
                          <div
                            key={sp.promptId}
                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 text-xs shadow-2xs"
                          >
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate" title={sp.title}>
                                {sp.title}
                              </span>
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${getRoleBadgeStyle(sp.role)}`}>
                              {sp.role || 'Reviewer'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {mem.sharedPrompts.length > 3 && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                          <span>+ {mem.sharedPrompts.length - 3} more prompt{mem.sharedPrompts.length - 3 > 1 ? 's' : ''}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedCollaborator(mem)}
                            className="text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer text-xs"
                          >
                            View All {mem.sharedPrompts.length} Prompts →
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/40">
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborator(mem)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>View Shared Prompts</span>
                        </button>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <button
                          type="button"
                          onClick={() => setSelectedCollaborator(mem)}
                          className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium flex items-center gap-1 cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>Manage Access</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic bg-slate-50/50 dark:bg-slate-900/30 p-2.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700/60">
                      No specific prompts currently assigned to this collaborator.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: SHARED WITH ME */}
      {!loading && activeTab === 'shared_with_me' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Prompts Shared With You</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Prompts authored by other users that you have been granted access to.</p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-md shrink-0">
              Cross-User Access
            </span>
          </div>

          {sharedPrompts && sharedPrompts.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {sharedPrompts.map((prompt) => (
                <div key={prompt.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shrink-0 mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white break-words">{prompt.title}</h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${getRoleBadgeStyle(prompt.userRole)}`}>
                          {prompt.userRole || 'Viewer'}
                        </span>
                        {prompt.reviewStatus && (
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${getReviewBadgeStyle(prompt.reviewStatus)}`}>
                            {prompt.reviewStatus.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {prompt.description || 'No description provided.'}
                      </p>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                        <span>Shared by <strong className="text-slate-700 dark:text-slate-300 font-medium">{prompt.ownerName || prompt.ownerEmail || 'Workspace Owner'}</strong></span>
                        <span>•</span>
                        <span>Category: <strong className="text-slate-700 dark:text-slate-300 font-medium">{prompt.category || 'General'}</strong></span>
                        {prompt.version && (
                          <>
                            <span>•</span>
                            <span className="font-mono">Ver: <strong className="text-slate-700 dark:text-slate-300">{prompt.version}</strong></span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => openCollabModal(prompt, 'comments')}
                      className="h-8 px-3 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Open comments discussion and review status"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Comments & Review</span>
                    </button>
                    <button
                      onClick={() => {
                        setActivePromptId(prompt.id);
                        navigate('/app/playground');
                      }}
                      className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Playground</span>
                    </button>
                    <button
                      onClick={() => openCollabModal(prompt, 'details')}
                      className="h-8 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-xs">
                <Share2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Shared Prompts</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                No prompts have been shared with you yet.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PENDING INVITATIONS */}
      {!loading && activeTab === 'pending_invites' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pending Email Invitations</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Direct invitations sent to specific email addresses awaiting acceptance.</p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-md shrink-0">
              Secure Direct Invites
            </span>
          </div>

          {activePendingInvites.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {activePendingInvites.map((inv) => {
                const fullUrl = `${window.location.origin}/invite/${inv.token}`;
                const isCurrentlyResending = resendingId === inv.id;
                return (
                  <div key={inv.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                    {/* LEFT & CENTER */}
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      {/* Left Icon */}
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 shrink-0 mt-0.5">
                        <Mail className="w-4 h-4" />
                      </div>
                      {/* Center Details */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white break-all">{inv.recipientEmail}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${getRoleBadgeStyle(inv.role)}`}>
                            {inv.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>Target: <strong className="text-slate-700 dark:text-slate-300 font-medium">{inv.promptTitle || 'All Workspace Prompts'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {inv.expiresAt ? `Expires ${inv.expiresAt}` : 'Never expires'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT ACTIONS */}
                    <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0 flex-wrap">
                      <button
                        onClick={() => handleResendInvite(inv)}
                        disabled={isCurrentlyResending}
                        className="h-8 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-blue-200 dark:border-blue-800"
                        title="Resend email and in-app notification"
                        aria-label={`Resend invitation to ${inv.recipientEmail}`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isCurrentlyResending ? 'animate-spin' : ''}`} />
                        <span>{isCurrentlyResending ? 'Resending...' : 'Resend'}</span>
                      </button>
                      <button
                        onClick={() => copyToClipboard(fullUrl, `inv_${inv.id}`)}
                        className="h-8 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                        aria-label={`Copy invite URL for ${inv.recipientEmail}`}
                      >
                        {copiedId === `inv_${inv.id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === `inv_${inv.id}` ? 'Copied ✓' : 'Copy Link'}</span>
                      </button>
                      <button
                        onClick={() => setInviteToRevoke(inv)}
                        className="h-8 w-8 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer flex items-center justify-center"
                        title="Revoke Invitation"
                        aria-label={`Revoke invitation to ${inv.recipientEmail}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Pending Invitations</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                No invitations are waiting for acceptance.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setCreatedInviteResult(null);
                    setModalTab('email');
                    setShowInviteModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Invite Collaborator</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ACTIVE LINKS */}
      {!loading && activeTab === 'active_links' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Active Shareable Links</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Cryptographically secure links that allow any team member with the URL to join.</p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-md shrink-0">
              Instant Access
            </span>
          </div>

          {activeShareLinks.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {activeShareLinks.map((link) => {
                const fullUrl = `${window.location.origin}/invite/${link.token}`;
                return (
                  <div key={link.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 shrink-0 mt-0.5">
                        <LinkIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-white break-words">
                            {link.scope === 'workspace' ? 'All Workspace Prompts' : (link.promptTitle || 'Prompt Link')}
                          </span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${getRoleBadgeStyle(link.role)}`}>
                            {link.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                          <span>Uses: <strong className="text-slate-700 dark:text-slate-300 font-medium">{link.useCount || 0}{link.maxUses ? ` / ${link.maxUses}` : ' (Unlimited)'}</strong></span>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            {link.expiresAt ? `Expires ${link.expiresAt}` : 'Never expires'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start md:self-center shrink-0 pt-2 md:pt-0">
                      <button
                        onClick={() => copyToClipboard(fullUrl, `link_${link.id}`)}
                        className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        aria-label="Copy share link"
                      >
                        {copiedId === `link_${link.id}` ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedId === `link_${link.id}` ? 'Copied ✓' : 'Copy Link'}</span>
                      </button>
                      <button
                        onClick={() => setInviteToRevoke(link)}
                        className="h-8 w-8 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition cursor-pointer flex items-center justify-center"
                        title="Revoke Share Link"
                        aria-label="Revoke Share Link"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-xs">
                <LinkIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Active Share Links</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                There are no active share links.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => {
                    setCreatedInviteResult(null);
                    setModalTab('link');
                    setShowInviteModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Create Share Link</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: ACTIVITY TIMELINE */}
      {!loading && activeTab === 'activity' && (
        <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/70 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Collaboration Activity Feed</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Authenticated timeline of reviews, comments, versions, and prompt shares.</p>
            </div>
            <span className="text-[11px] font-medium px-2.5 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-md shrink-0">
              Live Audit
            </span>
          </div>

          {activityList.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {activityList.map((act) => (
                <div key={act.id} className="p-4 flex items-start space-x-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shrink-0 mt-0.5">
                    {getActivityIcon(act.type, act.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white break-words">
                        {act.title}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                        {act.timestamp}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      {act.description}
                    </p>
                    {act.promptTitle && (
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            if (act.promptId) {
                              setActivePromptId(act.promptId);
                              navigate('/app/prompts');
                            }
                          }}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{act.promptTitle}</span>
                        </button>
                        {act.versionTag && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400">
                            {act.versionTag}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 text-purple-600 dark:text-purple-400 flex items-center justify-center mx-auto shadow-xs">
                <ActivityIcon className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Collaboration Activity</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                When collaborators are invited, review prompts, or participate in discussions, recent activity will appear here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* DRAWER / MODAL: VIEW SHARED PROMPTS FOR A COLLABORATOR */}
      {selectedCollaborator && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-2xl w-full shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${selectedCollaborator.avatarBg || 'from-blue-600 to-indigo-600'} text-white font-bold flex items-center justify-center text-sm shadow-md shrink-0`}>
                  {selectedCollaborator.avatar || (selectedCollaborator.name ? selectedCollaborator.name.slice(0, 2).toUpperCase() : 'CO')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                      {selectedCollaborator.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shrink-0">
                      Prompt-Level Access
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">
                    {selectedCollaborator.email}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                    {selectedCollaborator.sharedPrompts?.length || selectedCollaborator.promptsCount || 0} Shared Prompt{selectedCollaborator.sharedPrompts?.length !== 1 ? 's' : ''} (permissions configured individually)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedCollaborator(null);
                  setManagingPromptAccessId(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prompts list (Scrollable internally) */}
            <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
              {selectedCollaborator.sharedPrompts && selectedCollaborator.sharedPrompts.length > 0 ? (
                selectedCollaborator.sharedPrompts.map((sp) => (
                  <div
                    key={sp.promptId}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white break-words">
                          {sp.title}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {sp.category || 'General'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                        <span>Role on this prompt:</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded-md border ${getRoleBadgeStyle(sp.role)}`}>
                          {sp.role || 'Reviewer'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0 flex-wrap">
                      <button
                        type="button"
                        onClick={() => {
                          const fullPrompt = (ownedPrompts || []).find(p => String(p.id) === String(sp.promptId)) ||
                                             (sharedPrompts || []).find(p => String(p.id) === String(sp.promptId)) ||
                                             { id: sp.promptId, title: sp.title, category: sp.category, userRole: sp.role };
                          openCollabModal(fullPrompt, 'comments');
                        }}
                        className="h-8 px-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                        title="View comments and review discussion"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Discussion</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActivePromptId(sp.promptId);
                          setSelectedCollaborator(null);
                          navigate('/app/playground');
                        }}
                        className="h-8 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Open Prompt</span>
                      </button>

                      {/* Manage Access Dropdown / Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setManagingPromptAccessId(managingPromptAccessId === sp.promptId ? null : sp.promptId)}
                          className="h-8 px-3 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-500" />
                          <span>Manage Access</span>
                        </button>

                        {managingPromptAccessId === sp.promptId && (
                          <div className="absolute right-0 top-full mt-1.5 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-2 z-50 space-y-2 text-xs">
                            <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                              Change Role for this Prompt
                            </div>
                            <div className="space-y-1">
                              {['Viewer', 'Reviewer', 'Editor'].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  onClick={() => {
                                    handleUpdatePromptRole(selectedCollaborator.email, sp.promptId, r);
                                    setManagingPromptAccessId(null);
                                  }}
                                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                    sp.role === r
                                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 font-bold'
                                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                  }`}
                                >
                                  <span>{r}</span>
                                  {sp.role === r && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </button>
                              ))}
                            </div>

                            <div className="pt-1.5 border-t border-slate-100 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => {
                                  handleRemoveCollaboratorFromPrompt(selectedCollaborator.email, sp.promptId, sp.title);
                                  setManagingPromptAccessId(null);
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 font-medium flex items-center gap-1.5 cursor-pointer transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Revoke Access for Prompt</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No individual shared prompt access records found for this collaborator.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Only prompts accessible by this collaborator are listed.
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCollaborator(null);
                  setManagingPromptAccessId(null);
                }}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Invite Collaborator (Email & Shareable Link Tabs) */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 shrink-0">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Invite Collaborator</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Grant authorized access via direct email or shareable link</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInviteModal(false);
                  setCreatedInviteResult(null);
                }}
                className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteResult ? (
              <div className="space-y-4 py-2">
                <div className={`p-4 rounded-2xl text-center space-y-1 ${
                  createdInviteResult.type === 'email' && createdInviteResult.emailSent
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-blue-500/10 border border-blue-500/20'
                }`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-sm ${
                    createdInviteResult.type === 'email' && createdInviteResult.emailSent
                      ? 'bg-emerald-500 text-white'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {createdInviteResult.type === 'email' && createdInviteResult.emailSent ? <Mail className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {createdInviteResult.type === 'email'
                      ? (createdInviteResult.emailSent ? 'Invitation Sent & Email Delivered' : 'Invitation Created Successfully')
                      : 'Collaboration Link Generated'}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {createdInviteResult.type === 'email'
                      ? (createdInviteResult.emailSent
                          ? `An official invitation has been emailed to ${createdInviteResult.recipientEmail}. You can also copy the direct link below.`
                          : `Invitation created for ${createdInviteResult.recipientEmail}. ${createdInviteResult.recipientUserFound ? 'In-app notification dispatched to their account.' : 'Share the direct invitation link below.'}`)
                      : 'Anyone with this link can join your workspace with the configured permissions.'}
                  </p>
                </div>

                {/* Summary Metadata Card */}
                <div className="bg-slate-50 dark:bg-slate-900/80 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs">
                  {createdInviteResult.recipientEmail && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Recipient:</span>
                      <strong className="text-slate-900 dark:text-white font-mono break-all">{createdInviteResult.recipientEmail}</strong>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Assigned Role:</span>
                    <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase border ${getRoleBadgeStyle(createdInviteResult.role)}`}>
                      {createdInviteResult.role}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Scope:</span>
                    <strong className="text-slate-900 dark:text-white">{createdInviteResult.promptTitle || 'All Workspace Prompts'}</strong>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Expires:</span>
                    <span className="text-amber-600 dark:text-amber-400 font-medium">{createdInviteResult.expiresAt || '7 days'}</span>
                  </div>
                  {createdInviteResult.maxUses && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Usage Limit:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">{createdInviteResult.maxUses}</span>
                    </div>
                  )}
                </div>

                {/* Full URL Box with 1-Click Copy */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Invitation URL
                  </label>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                    <input
                      type="text"
                      readOnly
                      value={createdInviteResult.inviteUrl}
                      className="w-full bg-transparent text-xs font-mono text-slate-900 dark:text-slate-100 px-2 outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdInviteResult.inviteUrl, 'modal_link')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shrink-0 flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      {copiedId === 'modal_link' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedId === 'modal_link' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setCreatedInviteResult(null);
                    }}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Method Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl mb-4 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setModalTab('email')}
                    className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                      modalTab === 'email'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email Invitation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTab('link')}
                    className={`py-2 rounded-lg flex items-center justify-center space-x-1.5 transition cursor-pointer ${
                      modalTab === 'link'
                        ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    <span>Shareable Link</span>
                  </button>
                </div>

                {modalTab === 'email' ? (
                  <form onSubmit={handleCreateEmailInvite} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Recipient Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Role
                        </label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="Reviewer">Reviewer (View, run, rate)</option>
                          <option value="Editor">Editor (View, run, edit, versions)</option>
                          <option value="Viewer">Viewer (View & run)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Expiration
                        </label>
                        <select
                          value={inviteExpiration}
                          onChange={(e) => setInviteExpiration(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="1">1 Day</option>
                          <option value="7">7 Days (Default)</option>
                          <option value="30">30 Days</option>
                          <option value="never">Never Expires</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Scope
                      </label>
                      <select
                        value={inviteScope}
                        onChange={(e) => {
                          setInviteScope(e.target.value);
                          if (e.target.value === 'workspace') setInvitePromptId('');
                        }}
                        className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                      >
                        <option value="workspace">Entire Workspace (All Prompts)</option>
                        <option value="prompt">Specific Prompt Only</option>
                      </select>
                    </div>

                    {inviteScope === 'prompt' && (
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Select Prompt *
                        </label>
                        <select
                          required
                          value={invitePromptId}
                          onChange={(e) => setInvitePromptId(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Choose Prompt from Library --</option>
                          {(ownedPrompts || []).map(p => (
                            <option key={p.id} value={p.id}>{p.title} ({p.category})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setShowInviteModal(false)}
                        className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        <span>{isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleCreateShareLink} className="space-y-3.5 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Role
                        </label>
                        <select
                          value={linkRole}
                          onChange={(e) => setLinkRole(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="Viewer">Viewer (View & run)</option>
                          <option value="Reviewer">Reviewer (View, run, rate)</option>
                          <option value="Editor">Editor (View, run, edit, versions)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Expiration
                        </label>
                        <select
                          value={linkExpiration}
                          onChange={(e) => setLinkExpiration(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="1">1 Day</option>
                          <option value="7">7 Days (Default)</option>
                          <option value="30">30 Days</option>
                          <option value="never">Never Expires</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Scope
                        </label>
                        <select
                          value={linkScope}
                          onChange={(e) => {
                            setLinkScope(e.target.value);
                            if (e.target.value === 'workspace') setLinkPromptId('');
                          }}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="workspace">Entire Workspace (All Prompts)</option>
                          <option value="prompt">Specific Prompt Only</option>
                        </select>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Max Uses
                        </label>
                        <select
                          value={linkMaxUses}
                          onChange={(e) => setLinkMaxUses(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="">Unlimited</option>
                          <option value="1">1 Use Only (Single Use)</option>
                          <option value="5">5 Uses</option>
                          <option value="10">10 Uses</option>
                          <option value="25">25 Uses</option>
                        </select>
                      </div>
                    </div>

                    {linkScope === 'prompt' && (
                      <div>
                        <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                          Select Prompt *
                        </label>
                        <select
                          required
                          value={linkPromptId}
                          onChange={(e) => setLinkPromptId(e.target.value)}
                          className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                        >
                          <option value="">-- Choose Prompt from Library --</option>
                          {(ownedPrompts || []).map(p => (
                            <option key={p.id} value={p.id}>{p.title} ({p.category})</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setShowInviteModal(false)}
                        className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                        <span>{isSubmitting ? 'Generating Link...' : 'Generate Link'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Revoke Member Access */}
      {memberToRemove && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <UserMinus className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Revoke Access for {memberToRemove.name}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will immediately revoke <strong>{memberToRemove.email}</strong>'s access to all your shared prompts.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setMemberToRemove(null)}
                className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRemoveMember}
                className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{actionLoading ? 'Revoking...' : 'Revoke Access'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Revoke Invitation Link */}
      {inviteToRevoke && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Revoke {inviteToRevoke.recipientEmail ? 'Invitation' : 'Share Link'}?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {inviteToRevoke.recipientEmail
                  ? `The invitation token sent to ${inviteToRevoke.recipientEmail} will be invalidated immediately.`
                  : 'Anyone attempting to use this invitation token in the future will be denied access.'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setInviteToRevoke(null)}
                className="w-full py-2.5 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmRevokeInvite}
                className="w-full py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>{actionLoading ? 'Revoking...' : 'Revoke Token'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PROMPT DETAILS & COLLABORATION MODAL */}
      {collabPromptForModal && (
        <PromptDetailsModal
          prompt={collabPromptForModal}
          isOpen={Boolean(collabPromptForModal)}
          onClose={() => {
            setCollabPromptForModal(null);
            loadCollaborationData(true);
          }}
          initialTab={collabModalTab}
        />
      )}
    </div>
  );
};
