import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  User,
  ShieldCheck,
  Moon,
  Sun,
  Save,
  LogOut,
  CheckCircle2,
  Lock,
  Sparkles,
  Key,
  FolderGit2,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../i18n/LanguageContext';

export const Settings = () => {
  const { currentUser, updateUser, logout, theme, setTheme } = useAuth();
  const { currentLang, setLanguage, languages, t } = useLanguage();
  const navigate = useNavigate();

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [role, setRole] = useState(currentUser?.role || 'Senior AI Engineer');
  const [bio, setBio] = useState(currentUser?.bio || 'Prompt Engineering Architect & Evaluator');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const saveTimerRef = useRef(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      setRole(currentUser.role || 'Senior AI Engineer');
      setBio(currentUser.bio || 'Prompt Engineering Architect & Evaluator');
    }
  }, [currentUser]);

  const handleSave = (e) => {
    e.preventDefault();
    updateUser({
      name,
      email,
      role,
      bio
    });
    setSavedSuccess(true);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      setSavedSuccess(false);
      saveTimerRef.current = null;
    }, 3000);
  };

  const confirmLogout = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <div className="flex items-center space-x-2.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('workspaceSettings')}
          </h1>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            {t('vaultPreferences')}
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settingsDesc')}
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{t('savedSuccessMsg')}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Appearance & Theme Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('appearanceTheme')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('appearanceDesc')}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Dark Theme Option */}
            <div
              onClick={() => setTheme('dark')}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex items-center space-x-3 ${
                theme === 'dark'
                  ? 'border-blue-600 bg-slate-900 text-white shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold">
                <Moon className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('darkThemeTitle')}</div>
                <div className="text-[11px] text-slate-400">{t('darkThemeDesc')}</div>
              </div>
            </div>

            {/* Light Theme Option */}
            <div
              onClick={() => setTheme('light')}
              className={`p-3.5 rounded-lg border-2 cursor-pointer transition flex items-center space-x-3 ${
                theme === 'light'
                  ? 'border-blue-600 bg-blue-50 text-slate-900 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-white text-amber-500 border border-slate-200 flex items-center justify-center font-bold shadow-sm">
                <Sun className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-xs font-bold">{t('lightThemeTitle')}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('lightThemeDesc')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Language & Localization Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('workspaceLanguage')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('languageDesc')}</p>
            </div>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => setLanguage(l.code)}
                className={`p-3 rounded-lg border text-left transition flex items-center space-x-2.5 cursor-pointer ${
                  currentLang === l.code
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <span className="text-base">{l.flag}</span>
                <div>
                  <div className="text-xs font-semibold">{l.name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500">{l.native}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('userProfile')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('userProfileDesc')}</p>
            </div>
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
              {currentUser?.avatar || 'U'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {t('fullName')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {t('roleTag')}
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. AI Research Scientist"
                className="w-full h-10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                {t('emailAddress')}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              {t('bioSpecialization')}
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('bioPlaceholder')}
              className="w-full bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
            />
          </div>
        </div>

        {/* Workspace Security & Privacy */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 dark:border-slate-700">
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">{t('vaultSecurity')}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('vaultSecurityDesc')}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-200 block text-xs">{t('strictPrivacy')}</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">{t('strictPrivacyDesc')}</span>
              </div>
              <span className="px-2.5 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded text-[11px] font-bold">
                LOCKED (Active)
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 dark:text-slate-200 block text-xs">Local Storage & Cache</span>
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">Your prompt drafts, test assets, and version commits persist in your browser vault.</span>
              </div>
              <span className="px-2.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[11px] font-mono">
                localStorage OK
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Save & Logout Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full sm:w-auto px-4 py-2 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs font-medium rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{t('signOut')}</span>
          </button>

          <button
            type="submit"
            className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer"
          >
            {t('saveChanges')}
          </button>
        </div>
      </form>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <LogOut className="w-5 h-5" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('signOutConfirm')}
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                {t('signOutDesc')}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-lg transition border border-slate-200 dark:border-slate-600 cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition cursor-pointer"
              >
                {t('confirmSignOut')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
