import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Search,
  Plus,
  FolderGit2,
  Lock,
  Sparkles
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PromptCard } from '../components/PromptCard';

export const Favorites = () => {
  const { userFavorites, userPrompts } = usePrompts();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');

  const filtered = userFavorites.filter(
    p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Favorite Prompts
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center space-x-1">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              <span>{userFavorites.length} Pinned</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Quick access to your most frequently used and benchmarked prompts.
          </p>
        </div>

        <button
          onClick={() => navigate('/app/create')}
          className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Prompt</span>
        </button>
      </div>

      {/* Search Filter Toolbar */}
      {userFavorites.length > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 shadow-sm">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search your favorite prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-9 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
            />
          </div>
        </div>
      )}

      {/* Grid or Empty state */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Star className="w-6 h-6 fill-amber-500/20" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {search ? 'No matching favorite prompts' : (t('noFavoritesYet') || 'No favorites pinned yet')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
              {search
                ? 'Try a different search query.'
                : 'Click the star icon on any prompt in your library to pin it here for instant access.'}
            </p>
          </div>

          <div>
            <button
              onClick={() => navigate('/app/prompts')}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium text-xs rounded-lg transition border border-slate-200 dark:border-slate-600 cursor-pointer"
            >
              {t('promptLibrary') || 'Browse Prompt Library'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
