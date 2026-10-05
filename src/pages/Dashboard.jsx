import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  GitBranch,
  PlayCircle,
  Star,
  PlusCircle,
  PlaySquare,
  GitCompare,
  History,
  Lock,
  ArrowRight,
  Clock,
  FolderPlus,
  FolderKanban,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usePrompts } from '../context/PromptContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useToast } from '../context/ToastContext';
import { StatCard } from '../components/StatCard';
import { PromptCard } from '../components/PromptCard';
import { formatDateTime } from '../utils/dateFormatter';

export const Dashboard = () => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();
  const {
    userPrompts,
    userActivities,
    totalPrompts,
    totalVersions,
    totalFavorites,
    totalTested,
    collections,
    addCollection
  } = usePrompts();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Quick Action: New Collection Modal State
  const [showCreateColModal, setShowCreateColModal] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  const [newColIcon, setNewColIcon] = useState('FolderKanban');
  const [colError, setColError] = useState('');

  const firstName = currentUser?.name ? currentUser.name.split(' ')[0] : 'Engineer';
  const recentPrompts = userPrompts.slice(0, 3);
  const recentActivities = userActivities.slice(0, 5);

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) {
      setColError('Collection name cannot be empty.');
      return;
    }

    const res = await addCollection({
      name: newColName.trim(),
      description: newColDesc.trim(),
      icon: newColIcon
    });

    if (res.success) {
      showToast({
        title: 'Collection Created!',
        message: `Folder "${newColName.trim()}" is ready to organize prompts.`,
        type: 'success'
      });
      setNewColName('');
      setNewColDesc('');
      setColError('');
      setShowCreateColModal(false);
    } else {
      setColError(res.message || 'Failed to create collection.');
      showToast({
        title: 'Validation Error',
        message: res.message || 'Collection already exists.',
        type: 'error'
      });
    }
  };

  const quickActions = [
    {
      title: '+ New Collection',
      subtitle: 'Create a curated folder workspace',
      icon: FolderPlus,
      action: () => setShowCreateColModal(true)
    },
    {
      title: '+ Create Prompt',
      subtitle: 'Author a new private prompt template',
      icon: PlusCircle,
      action: () => navigate('/app/create')
    },
    {
      title: 'Open Playground',
      subtitle: 'Simulate multi-model AI execution',
      icon: PlaySquare,
      action: () => navigate('/app/playground')
    },
    {
      title: 'Compare Prompts',
      subtitle: 'Diff prompt versions side-by-side',
      icon: GitCompare,
      action: () => navigate('/app/compare')
    },
    {
      title: 'Version History',
      subtitle: 'Inspect commit logs & roll back snapshots',
      icon: History,
      action: () => navigate('/app/versions')
    }
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {t('welcomeBack', 'Welcome back')}, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('dashboardSubtitle', 'Manage, test, and benchmark your private AI prompt workspace.')}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <div className="flex items-center space-x-1.5 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-lg shadow-sm">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            <span>Vault: {currentUser?.name}</span>
          </div>

          <button
            onClick={() => setShowCreateColModal(true)}
            title="Create a new collection folder"
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm"
          >
            <FolderPlus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{t('newCollection', 'New Collection')}</span>
          </button>

          <button
            onClick={() => navigate('/app/create')}
            className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>{t('createPrompt', 'Create Prompt')}</span>
          </button>
        </div>
      </div>

      {/* TOP STATISTICS (4 Clean KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <StatCard
          title={t('totalPrompts', 'Total Prompts')}
          value={totalPrompts}
          icon={FileText}
          change={totalPrompts > 0 ? `+${totalPrompts} in vault` : '0 active'}
        />
        <StatCard
          title={t('totalVersions', 'Total Versions')}
          value={totalVersions}
          icon={GitBranch}
          change={totalVersions > 0 ? `${totalVersions} commits` : 'v1.0 ready'}
        />
        <StatCard
          title={t('totalTested', 'Prompts Tested')}
          value={totalTested}
          icon={PlayCircle}
          change={totalTested > 0 ? '98% pass rate' : 'Ready to test'}
        />
        <StatCard
          title={t('favorites', 'Favorites')}
          value={totalFavorites}
          icon={Star}
          change={totalFavorites > 0 ? `${totalFavorites} pinned` : '0 pinned'}
        />
      </div>

      {/* QUICK ACTIONS SECTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
              Quick Actions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Launch instant workflows across your vault
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateColModal(true)}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
          >
            <FolderPlus className="w-3.5 h-3.5 mr-0.5" />
            <span>+ New Collection</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            const isFirst = idx === 0;
            return (
              <button
                key={idx}
                type="button"
                onClick={action.action}
                className={`bg-white dark:bg-slate-800 border rounded-xl p-4 text-left transition-colors shadow-sm group cursor-pointer ${
                  isFirst
                    ? 'border-blue-200 dark:border-blue-800/80 bg-blue-50/20 dark:bg-blue-950/20 hover:bg-blue-50/50'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50/70 dark:hover:bg-slate-700/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {action.title}
                  </h3>
                  <ArrowRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all" />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                  {action.subtitle}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* MAIN TWO-COLUMN SECTION: Recent Prompts vs Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Recent Prompts (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Recent Prompts</h2>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono px-2 py-0.5 rounded">
                {userPrompts.length} total
              </span>
            </div>
            <button
              onClick={() => navigate('/app/prompts')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <span>View Library</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {recentPrompts.length > 0 ? (
              recentPrompts.map((prompt) => (
                <PromptCard key={prompt.id} prompt={prompt} />
              ))
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center shadow-sm">
                <p className="text-slate-500 dark:text-slate-400 text-xs">No prompts in your workspace yet.</p>
                <button
                  onClick={() => navigate('/app/create')}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  Create Your First Prompt
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Recent Activity Stream (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Recent Activity</h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
              <Clock className="w-3.5 h-3.5 mr-1" /> Live Feed
            </span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3.5 shadow-sm">
            {recentActivities.length > 0 ? (
              recentActivities.map((act, idx) => (
                <div
                  key={`${act.id || 'act'}-${idx}`}
                  className="flex items-start space-x-3 pb-3 border-b border-slate-100 dark:border-slate-700/60 last:border-0 last:pb-0 text-xs"
                >
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <GitBranch className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {act.title}
                      </span>
                      <span className="text-[10px] text-slate-400 flex-shrink-0">
                        {formatDateTime(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 line-clamp-1">
                      {act.desc}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs">
                No activity recorded yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW COLLECTION MODAL */}
      {showCreateColModal && (
        <div
          onClick={() => setShowCreateColModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Collection</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Organize prompts into curated folders</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateColModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {colError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{colError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCollection} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => {
                    setNewColName(e.target.value);
                    if (colError) setColError('');
                  }}
                  placeholder="e.g. Production RAG Pipeline"
                  className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newColDesc}
                  onChange={(e) => setNewColDesc(e.target.value)}
                  placeholder="Describe the purpose of this prompt collection..."
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateColModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
