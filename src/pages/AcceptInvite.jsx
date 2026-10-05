import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Users, Shield, ArrowRight, CheckCircle2, XCircle, Clock, 
  Sparkles, FileText, AlertTriangle, LogIn, ExternalLink, Sun, Moon 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { useNotifications } from '../context/NotificationContext';
import { invitationService } from '../services/invitationService';

export const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated, isLoading: authLoading, theme, toggleTheme } = useAuth();
  const { refreshData, setActivePromptId } = usePrompts();
  const { addToast } = useToast();
  const { fetchNotifications } = useNotifications();

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('pending'); // 'pending' | 'accepted' | 'declined'
  const redirectTimerRef = useRef(null);

  // Clean up redirect timer on unmount
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchInvite = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await invitationService.getInvitation(token);
        if (isMounted) {
          setInvitation(data);
          if (!data.valid) {
            setError(data.statusMessage || data.message || 'This invitation is not active.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load invitation details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (token) {
      fetchInvite();
    }

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated]);

  const handleAccept = async () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }

    setProcessing(true);
    try {
      const res = await invitationService.acceptInvitation(token);
      setStatus('accepted');
      addToast(res.message || 'Invitation accepted successfully!', 'success');
      
      // Refresh prompt and collaboration context
      if (refreshData) {
        await refreshData();
      }
      if (fetchNotifications) {
        fetchNotifications();
      }

      if (res.promptId) {
        setActivePromptId(res.promptId);
      }

      // Redirect after brief pause with cleanup protection
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        if (res.promptId) {
          navigate('/app/prompts');
        } else {
          navigate('/app/collaboration');
        }
        redirectTimerRef.current = null;
      }, 1200);
    } catch (err) {
      addToast(err.message || 'Failed to accept invitation', 'error');
      // Re-fetch to transition into specific granular error state if invitation was revoked/expired/accepted
      try {
        const updated = await invitationService.getInvitation(token);
        if (updated) {
          setInvitation(updated);
          if (!updated.valid) {
            setError(updated.statusMessage || updated.message || err.message);
          }
        }
      } catch (_) {}
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      await invitationService.declineInvitation(token);
      setStatus('declined');
      addToast('Invitation declined', 'info');
      if (fetchNotifications) {
        fetchNotifications();
      }
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
      redirectTimerRef.current = setTimeout(() => {
        navigate(isAuthenticated ? '/app' : '/');
        redirectTimerRef.current = null;
      }, 1500);
    } catch (err) {
      addToast(err.message || 'Failed to decline invitation', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const getRoleBadge = (role) => {
    switch ((role || '').toLowerCase()) {
      case 'editor':
        return {
          bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          label: 'Editor',
          desc: 'Can view, run, edit prompt content, and create version commits.'
        };
      case 'reviewer':
        return {
          bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
          label: 'Reviewer',
          desc: 'Can view, run, test against models, and rate prompts.'
        };
      default:
        return {
          bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
          label: 'Viewer',
          desc: 'Can view prompt details and test prompt runs.'
        };
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 transition-colors duration-200">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">Verifying invitation security token...</p>
        </div>
      </div>
    );
  }

  // Granular Invalid / Inactive Status Screen
  if (error || !invitation || !invitation.valid) {
    const statusCode = invitation?.statusCode || 'INVALID';

    let statusTitle = 'Invalid Invitation';
    let statusDesc = invitation?.statusMessage || error || 'Invitation not found or link is invalid.';
    let iconBg = 'bg-red-500/10 border-red-500/20 text-red-500';
    let StatusIcon = XCircle;

    if (statusCode === 'EXPIRED') {
      statusTitle = 'Invitation Expired';
      statusDesc = invitation?.expiresAt ? `This invitation expired on ${invitation.expiresAt}.` : 'This invitation has expired.';
      iconBg = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      StatusIcon = Clock;
    } else if (statusCode === 'REVOKED') {
      statusTitle = 'Invitation Revoked';
      statusDesc = 'This invitation was revoked by the workspace owner.';
      iconBg = 'bg-rose-500/10 border-rose-500/20 text-rose-500';
      StatusIcon = XCircle;
    } else if (statusCode === 'ACCEPTED' || statusCode === 'ALREADY_ACCEPTED') {
      statusTitle = 'Invitation Already Accepted';
      statusDesc = 'This invitation has already been accepted.';
      iconBg = 'bg-blue-500/10 border-blue-500/20 text-blue-500';
      StatusIcon = CheckCircle2;
    } else if (statusCode === 'USAGE_LIMIT_REACHED') {
      statusTitle = 'Usage Limit Reached';
      statusDesc = 'This invitation link has reached its usage limit.';
      iconBg = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      StatusIcon = Users;
    } else if (statusCode === 'EMAIL_MISMATCH') {
      statusTitle = 'Email Mismatch';
      statusDesc = 'This invitation was sent to a different email address.';
      iconBg = 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      StatusIcon = AlertTriangle;
    }

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 transition-colors duration-200">
        <div className="max-w-md w-full bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/60 rounded-3xl p-8 text-center shadow-xl shadow-slate-200/50 dark:shadow-2xl dark:shadow-black/40">
          <div className={`w-16 h-16 ${iconBg} border rounded-2xl flex items-center justify-center mx-auto mb-5`}>
            <StatusIcon className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{statusTitle}</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6 leading-relaxed">
            {statusDesc}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-semibold transition-colors"
            >
              Go to Home
            </Link>
            {isAuthenticated && (
              <Link
                to="/app"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              >
                Open Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  const roleInfo = getRoleBadge(invitation.role);
  const isEmailMismatch = 
    isAuthenticated && 
    invitation.invitedEmail && 
    currentUser?.email?.toLowerCase() !== invitation.invitedEmail.toLowerCase();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-200">
      {/* Floating Theme Toggle in Top Right */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl shadow-sm transition-all cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-lg w-full bg-white/95 dark:bg-slate-800/90 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-slate-300/60 dark:shadow-black/60 relative z-10 transition-colors duration-200">
        
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            PromptCommit
          </span>
        </div>

        {status === 'accepted' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
              <CheckCircle2 className="w-9 h-9 animate-bounce" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Invitation Accepted!</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
              You now have access to <strong className="text-slate-900 dark:text-slate-200">{invitation.promptTitle || 'the workspace'}</strong> as an {roleInfo.label}. Redirecting...
            </p>
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : status === 'declined' ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-500 dark:text-slate-400">
              <XCircle className="w-9 h-9" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invitation Declined</h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm">Returning you to the home page...</p>
          </div>
        ) : (
          <div>
            {/* Inviter Info Header */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-4">
                <Users className="w-3.5 h-3.5" />
                Collaboration Invite
              </div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Join <span className="text-blue-600 dark:text-blue-400">{invitation.inviterName || invitation.inviterEmail}</span>
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                You have been invited to collaborate on PromptCommit.
              </p>
            </div>

            {/* Invitation Details Card */}
            <div className="bg-slate-50/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 mb-6 space-y-4">
              {/* Resource Target */}
              <div className="flex items-start gap-3.5">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {invitation.scope === 'workspace' ? 'Workspace Access' : 'Target Prompt'}
                  </div>
                  <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                    {invitation.scope === 'workspace' ? 'Entire Prompt Workspace' : (invitation.promptTitle || 'Untitled Prompt')}
                  </div>
                </div>
              </div>

              {/* Assigned Role */}
              <div className="flex items-start gap-3.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Role</span>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${roleInfo.bg}`}>
                      {roleInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {roleInfo.desc}
                  </p>
                </div>
              </div>

              {/* Expiration info if applicable */}
              {invitation.expiresAt && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Expires on {isNaN(new Date(invitation.expiresAt).getTime()) ? invitation.expiresAt : new Date(invitation.expiresAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              )}
            </div>

            {/* Email Mismatch Warning */}
            {isEmailMismatch && (
              <div className="mb-6 p-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-900 dark:text-amber-300">Email Address Notice</p>
                  <p className="leading-relaxed">
                    This invite was sent specifically to <strong className="text-amber-950 dark:text-white font-mono">{invitation.invitedEmail}</strong>, but you are currently logged in as <strong className="text-amber-950 dark:text-white font-mono">{currentUser?.email}</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            {!isAuthenticated ? (
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in to Accept Invitation
                </button>
                <div className="text-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">Don't have an account? </span>
                  <Link
                    to={`/signup?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold ml-1"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDecline}
                  disabled={processing}
                  className="sm:w-1/3 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700/80 dark:border-slate-700 dark:text-slate-300 font-semibold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="sm:w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Accept Invitation</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
