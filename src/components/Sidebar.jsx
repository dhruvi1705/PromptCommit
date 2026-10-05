import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderGit2,
  PlusCircle,
  PlaySquare,
  GitBranch,
  GitCompare,
  Wand2,
  FolderKanban,
  Star,
  BarChart3,
  Settings,
  LogOut,
  Lock,
  Layers,
  X,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const Sidebar = ({ isOpen, onClose }) => {
  const { currentUser, logout, demoLogin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Close mobile sidebar on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  const navGroups = [
    {
      label: 'OVERVIEW',
      items: [
        { name: t('dashboard'), path: '/app', icon: LayoutDashboard }
      ]
    },
    {
      label: 'PROMPTS',
      items: [
        { name: t('promptLibrary'), path: '/app/prompts', icon: FolderGit2 },
        { name: t('createPrompt'), path: '/app/create', icon: PlusCircle },
        { name: t('playground'), path: '/app/playground', icon: PlaySquare }
      ]
    },
    {
      label: 'VERSION CONTROL',
      items: [
        { name: t('versionHistory'), path: '/app/versions', icon: GitBranch },
        { name: t('compare'), path: '/app/compare', icon: GitCompare }
      ]
    },
    {
      label: 'MANAGE',
      items: [
        { name: t('aiToolkit'), path: '/app/toolkit', icon: Wand2 },
        { name: t('collections'), path: '/app/collections', icon: FolderKanban },
        { name: t('collaboration'), path: '/app/collaboration', icon: Users },
        { name: t('favorites'), path: '/app/favorites', icon: Star },
        { name: t('analytics'), path: '/app/analytics', icon: BarChart3 }
      ]
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[260px] bg-white dark:bg-[#1F2937] border-r border-slate-200 dark:border-[#374151] flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#374151] flex items-center justify-between">
          <Link
            to="/app"
            onClick={() => {
              if (window.innerWidth < 1024) onClose();
            }}
            className="flex items-center space-x-3 group cursor-pointer"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:bg-blue-700 transition">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-base text-slate-900 dark:text-[#F9FAFB] tracking-tight leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                PromptCommit
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="text-[11px] text-slate-500 dark:text-[#9CA3AF] font-medium flex items-center">
                  <Lock className="w-3 h-3 mr-1 text-slate-400 inline" /> Private Vault
                </span>
              </div>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#374151] text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center flex-shrink-0 transition border border-slate-200 dark:border-slate-600 cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Status Pill */}
        <div className="px-4 pt-3 pb-1">
          <div className="bg-slate-50 dark:bg-[#111827] rounded-lg p-2.5 border border-slate-200 dark:border-[#374151] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
              <span className="text-xs font-semibold text-slate-700 dark:text-[#F9FAFB] truncate">
                {currentUser?.name || 'My Workspace'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-400 bg-white dark:bg-[#1F2937] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#374151]">
              v2.4
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map((group, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="px-3 text-[10px] font-bold text-slate-400 dark:text-[#6B7280] tracking-wider uppercase mb-1">
                {group.label}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/app'}
                    onClick={() => {
                      if (window.innerWidth < 1024) onClose();
                    }}
                    className={({ isActive }) =>
                      `flex items-center space-x-2.5 px-3 py-2 rounded-lg font-medium text-xs transition-colors duration-150 ${isActive
                        ? 'bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-[#60A5FA] font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-[#9CA3AF] hover:text-slate-900 dark:hover:text-[#F9FAFB] hover:bg-slate-50 dark:hover:bg-[#293241]'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-blue-600 dark:text-[#60A5FA]' : 'text-slate-400 dark:text-[#9CA3AF]'}`} />
                        <span>{item.name}</span>
                        {item.name === 'Playground' && (
                          <span className="ml-auto text-[10px] bg-slate-100 dark:bg-[#374151] text-slate-500 dark:text-[#9CA3AF] px-1.5 py-0.5 rounded font-mono">Test</span>
                        )}
                        {item.name === 'Version History' && (
                          <span className="ml-auto text-[10px] bg-blue-50 dark:bg-[#1E3A5F] text-blue-600 dark:text-[#60A5FA] px-1.5 py-0.5 rounded font-mono">Git</span>
                        )}
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* User Profile & Footer Area */}
        <div className="p-3 border-t border-slate-200 dark:border-[#374151] bg-slate-50/70 dark:bg-[#111827]/60 space-y-2">

          {/* User card + Logout */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151]">
            <div className="flex items-center space-x-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-[#1E3A5F] text-blue-600 dark:text-[#60A5FA] font-bold text-xs flex items-center justify-center flex-shrink-0">
                {currentUser?.name ? currentUser.name.charAt(0) : 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-800 dark:text-[#F9FAFB] truncate leading-tight">
                  {currentUser?.name || 'User'}
                </div>
                <div className="text-[10px] text-slate-400 dark:text-[#9CA3AF] truncate">
                  {currentUser?.role || 'Member'}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-0.5">
              <button
                onClick={() => navigate('/app/settings')}
                title="Settings"
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-[#F9FAFB] rounded hover:bg-slate-100 dark:hover:bg-[#293241] transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Sign Out"
                className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <div
              className="bg-white dark:bg-[#1F2937] border border-slate-200 dark:border-[#374151] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">Sign Out?</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">You will return to login.</p>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-[#374151]">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2 bg-slate-100 dark:bg-[#374151] hover:bg-slate-200 dark:hover:bg-[#293241] text-slate-700 dark:text-[#F9FAFB] font-semibold text-xs rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg transition shadow-sm cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};
