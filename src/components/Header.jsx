import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bell,
  Plus,
  Menu,
  Lock,
  ChevronDown,
  Sun,
  Moon,
  LogOut,
  Globe,
  X,
  User,
  Settings as SettingsIcon,
  FolderKanban,
  GitPullRequest,
  Activity,
  ShieldCheck,
  UserX,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrompts } from '../context/PromptContext';
import { useNotifications } from '../context/NotificationContext';
import { useLanguage } from '../i18n/LanguageContext';
import { formatDateTime } from '../utils/dateFormatter';

export const Header = ({ onMenuClick }) => {
  const { currentUser, logout, theme, toggleTheme } = useAuth();
  const { userPrompts, setActivePromptId } = usePrompts();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { currentLang, setLanguage, languages, t } = useLanguage();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const userMenuRef = useRef(null);
  const langMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const searchRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target)) {
        setShowLangMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPrompts = searchQuery.trim()
    ? userPrompts.filter(p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    : [];

  const handleSelectPrompt = (promptId) => {
    setActivePromptId(promptId);
    setSearchQuery('');
    setShowSearchResults(false);
    navigate('/app/prompts');
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setShowUserMenu(false);
    logout();
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/95 dark:bg-[#1F2937]/95 backdrop-blur-md border-b border-slate-200 dark:border-[#374151] px-4 sm:px-6 md:px-8 flex items-center justify-between gap-4 transition-colors duration-200">
      {/* Left: Mobile hamburger + Global Search */}
      <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0 max-w-md">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#374151] focus:outline-none flex-shrink-0 cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Search Bar */}
        <div className="relative w-full" ref={searchRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchResults(true);
            }}
            onFocus={() => setShowSearchResults(true)}
            placeholder={t('searchPromptsPlaceholder', 'Search prompts, categories, tags...')}
            className="w-full h-9 pl-9 pr-8 bg-slate-50 dark:bg-[#111827] text-xs text-slate-900 dark:text-[#F9FAFB] placeholder-slate-400 rounded-lg border border-slate-200 dark:border-[#374151] focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Results Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl shadow-lg py-2 z-50 max-h-72 overflow-y-auto">
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Matching Prompts ({filteredPrompts.length})
              </div>
              {filteredPrompts.length === 0 ? (
                <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 text-center">
                  No prompts match "{searchQuery}"
                </div>
              ) : (
                filteredPrompts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPrompt(p.id)}
                    className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#293241] flex items-center justify-between group transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB] group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                        {p.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {p.category} • {p.version}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        {/* Create Prompt Quick Button */}
        <button
          onClick={() => navigate('/app/create')}
          className="hidden sm:flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createPrompt', 'New Prompt')}</span>
        </button>

        {/* Language Selector */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#374151] rounded-lg transition cursor-pointer"
            title="Language"
          >
            <Globe className="w-4 h-4" />
          </button>

          {showLangMenu && (
            <div className="absolute right-0 mt-1.5 w-36 bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl shadow-lg py-1.5 z-50 text-xs">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => {
                    setLanguage(l.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-[#293241] font-medium cursor-pointer ${currentLang === l.code ? 'text-blue-600 font-bold bg-blue-50/50 dark:bg-blue-950/30' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  <span>{l.name}</span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{l.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#374151] rounded-lg transition cursor-pointer"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifMenuRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#374151] rounded-lg transition cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-1.5 w-[calc(100vw-32px)] sm:w-96 max-w-sm bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[#374151] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">{t('notifications', 'Notifications')}</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                  <span
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                    onClick={() => setShowNotifications(false)}
                  >
                    Close
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#374151]/60 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No notifications yet</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">When colleagues invite you to prompts, they will appear here.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 hover:bg-slate-50/80 dark:hover:bg-[#293241]/60 transition text-xs flex items-start space-x-3 ${!n.isRead ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''}`}
                    >
                      {/* Avatar / Icon */}
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-xs ${
                        n.type === 'COLLABORATION_INVITATION' 
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                          : n.type === 'COLLABORATION_INVITATION_DECLINED'
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {n.senderAvatar || (
                          n.type === 'COLLABORATION_INVITATION' ? <Users className="w-4 h-4" /> :
                          n.type === 'COLLABORATION_INVITATION_DECLINED' ? <UserX className="w-4 h-4" /> :
                          <ShieldCheck className="w-4 h-4" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="font-semibold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />}
                            <span>{n.title}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{n.timeAgo || n.createdAt}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-1 leading-relaxed">
                          {n.message}
                        </p>

                        {/* Action buttons */}
                        <div className="mt-2 flex items-center space-x-2">
                          {n.actionUrl && (
                            <button
                              onClick={() => {
                                markAsRead(n.id);
                                setShowNotifications(false);
                                navigate(n.actionUrl);
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-[11px] rounded-md transition shadow-xs cursor-pointer flex items-center space-x-1"
                            >
                              <span>{n.type === 'COLLABORATION_INVITATION_DECLINED' ? 'View Collaboration' : n.type === 'COLLABORATION_INVITATION' ? 'View Invitation' : 'View Details'}</span>
                              <ChevronDown className="w-3 h-3 -rotate-90" />
                            </button>
                          )}
                          {!n.isRead && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="px-2 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[10px] font-medium cursor-pointer"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(n.id);
                        }}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                        title="Dismiss"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-[#374151]" />

        {/* USER PROFILE SECTION (TOP RIGHT) */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center space-x-2 p-1 sm:px-2 sm:py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#374151] transition cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-[#374151]"
            aria-label="User Profile Menu"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              {currentUser?.avatar || (currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U')}
            </div>
            <div className="hidden md:block text-left min-w-0">
              <div className="text-xs font-semibold text-slate-900 dark:text-[#F9FAFB] truncate leading-tight">
                {currentUser?.name || 'User'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-[#9CA3AF] truncate leading-tight mt-0.5">
                {currentUser?.role || 'Member'}
              </div>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {/* User Profile Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100 text-xs">
              {/* Header Info */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-[#374151] flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center flex-shrink-0 shadow-sm">
                  {currentUser?.avatar || (currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : 'U')}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 dark:text-white truncate">
                    {currentUser?.name || 'User'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {currentUser?.email || ''}
                  </div>
                  <div className="mt-1 inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 dark:bg-[#1E3A5F] text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{t('workspaceOwner', 'Workspace Owner')}</span>
                  </div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="py-1.5">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/app/settings');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#293241] flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  <SettingsIcon className="w-4 h-4 text-slate-400" />
                  <span>{t('profileSettings', 'Profile & Workspace Settings')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/app/collections');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#293241] flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  <FolderKanban className="w-4 h-4 text-slate-400" />
                  <span>{t('collections', 'Vault Collections')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/app/collaboration');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#293241] flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  <GitPullRequest className="w-4 h-4 text-slate-400" />
                  <span>{t('collaboration', 'Collaboration')}</span>
                </button>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    navigate('/app/analytics');
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 dark:hover:bg-[#293241] flex items-center space-x-2.5 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer"
                >
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>{t('analytics', 'Performance Analytics')}</span>
                </button>
              </div>

              {/* Sign Out Action */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-[#374151]">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center space-x-2.5 text-red-600 dark:text-red-400 font-semibold transition cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('signOut', 'Sign Out of Workspace')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && createPortal(
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{t('signOutConfirm', 'Sign Out of Workspace?')}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('signOutDesc', `You will be logged out of ${currentUser?.name}'s vault.`)}</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-[#374151]">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2 bg-slate-100 dark:bg-[#374151] hover:bg-slate-200 dark:hover:bg-[#293241] text-slate-700 dark:text-[#F9FAFB] font-medium text-xs rounded-lg transition cursor-pointer"
              >
                {t('cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition shadow-sm cursor-pointer"
              >
                {t('confirmSignOut', 'Sign Out')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
