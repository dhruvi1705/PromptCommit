import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  SlidersHorizontal,
  Plus,
  Tag,
  FolderGit2,
  FolderKanban,
  Sparkles,
  Lock,
  X,
  Layers,
  RotateCcw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../i18n/LanguageContext';
import { PromptCard } from '../components/PromptCard';

export const PromptLibrary = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const collectionIdParam = searchParams.get('collectionId');
  const collectionParam = searchParams.get('collection');

  const {
    userPrompts,
    categories,
    collections,
    addCategory,
    deleteCategory
  } = usePrompts();
  const { showToast } = useToast();
  const { t } = useLanguage();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scopeFilter, setScopeFilter] = useState('all'); // 'all' | 'owned' | 'shared'
  const [sortBy, setSortBy] = useState('updated'); // updated, versions, rating, alphabetical

  // Add Category Modal State
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const clearCollectionFilter = () => {
    searchParams.delete('collectionId');
    searchParams.delete('collection');
    setSearchParams(searchParams);
  };

  const handleAddCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const res = addCategory(newCatName.trim());
    if (res.success) {
      showToast({
        title: 'Category Created!',
        message: `Category "${newCatName.trim()}" is now available.`,
        type: 'success'
      });
      setSelectedCategory(newCatName.trim());
      setNewCatName('');
      setShowAddCategoryModal(false);
    } else {
      showToast({
        title: 'Error',
        message: res.message || 'Category already exists.',
        type: 'error'
      });
    }
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    deleteCategory(categoryToDelete);
    if (selectedCategory.toLowerCase() === categoryToDelete.toLowerCase()) {
      setSelectedCategory('All');
    }
    showToast({
      title: 'Category Deleted',
      message: `Category "${categoryToDelete}" was removed.`,
      type: 'info'
    });
    setCategoryToDelete(null);
  };

  const allCategoriesList = ['All', ...categories];

  // Authoritative collection object resolution
  const activeCollectionObj = collectionIdParam
    ? collections.find(c => c.id === collectionIdParam)
    : (collectionParam
      ? collections.find(c => c.name.toLowerCase() === collectionParam.toLowerCase())
      : null);

  const activeCollectionLabel = activeCollectionObj ? activeCollectionObj.name : (collectionParam || null);

  // Filter and sort prompts
  const filtered = userPrompts.filter((prompt) => {
    if (collectionIdParam) {
      const matchCol = (prompt.collections || []).some(c => c.id === collectionIdParam) || prompt.collectionId === collectionIdParam;
      if (!matchCol) return false;
    } else if (collectionParam) {
      const matchCol = (prompt.collections || []).some(c => c.name.toLowerCase() === collectionParam.toLowerCase()) ||
        (prompt.collection || '').toLowerCase() === collectionParam.toLowerCase();
      if (!matchCol) return false;
    }

    const matchesSearch =
      prompt.title.toLowerCase().includes(search.toLowerCase()) ||
      prompt.description.toLowerCase().includes(search.toLowerCase()) ||
      prompt.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory =
      selectedCategory === 'All' ||
      prompt.category.toLowerCase() === selectedCategory.toLowerCase();

    const matchesScope =
      scopeFilter === 'all' ||
      (scopeFilter === 'owned' && prompt.isOwner !== false) ||
      (scopeFilter === 'shared' && prompt.isOwner === false);

    return matchesSearch && matchesCategory && matchesScope;
  }).sort((a, b) => {
    if (sortBy === 'updated') {
      return (b.updatedAt || '').localeCompare(a.updatedAt || '');
    }
    if (sortBy === 'versions') {
      return (b.versions?.length || 1) - (a.versions?.length || 1);
    }
    if (sortBy === 'rating') {
      const aRated = a.rating !== null && a.rating !== undefined;
      const bRated = b.rating !== null && b.rating !== undefined;
      if (aRated && bRated) {
        return Number(b.rating) - Number(a.rating);
      }
      if (aRated && !bRated) return -1;
      if (!aRated && bRated) return 1;
      return 0;
    }
    if (sortBy === 'alphabetical') {
      return a.title.localeCompare(b.title);
    }
    return 0;
  });

  const pageTitle = activeCollectionLabel
    ? `${activeCollectionLabel.endsWith('Prompts') ? activeCollectionLabel : `${activeCollectionLabel} Prompts`}`
    : 'Prompt Library';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {pageTitle}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {filtered.length} {filtered.length === 1 ? 'Prompt' : 'Prompts'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {activeCollectionLabel
              ? (activeCollectionObj?.description || `Showing private prompts curated under the "${activeCollectionLabel}" collection.`)
              : 'Create, organize, test, and manage your private AI prompts.'}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {(collectionIdParam || collectionParam) && (
            <button
              onClick={clearCollectionFilter}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>All Prompts</span>
            </button>
          )}

          <button
            onClick={() => navigate('/app/create')}
            className="flex items-center justify-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Prompt</span>
          </button>
        </div>
      </div>

      {/* ACTIVE COLLECTION BANNER */}
      {(collectionIdParam || collectionParam) && (
        <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                  Filtered by Collection
                </span>
                <span className="text-xs font-mono font-bold px-2 py-0.2 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300">
                  {activeCollectionLabel || 'Collection'}
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Displaying prompts in this collection. Search, filter, edit, share, and test prompts below.
              </p>
            </div>
          </div>

          <button
            onClick={clearCollectionFilter}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer shadow-sm"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Clear Filter</span>
          </button>
        </div>
      )}

      {/* TOP TOOLBAR: Search + Category Filter + Sort */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3.5 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Scope Segmented Control */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg text-xs font-medium self-start md:self-auto shrink-0 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3 py-1.5 rounded-md transition ${
                scopeFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              All Prompts ({userPrompts.length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('owned')}
              className={`px-3 py-1.5 rounded-md transition ${
                scopeFilter === 'owned'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              My Prompts ({userPrompts.filter(p => p.isOwner !== false).length})
            </button>
            <button
              type="button"
              onClick={() => setScopeFilter('shared')}
              className={`px-3 py-1.5 rounded-md transition ${
                scopeFilter === 'shared'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Shared With Me ({userPrompts.filter(p => p.isOwner === false).length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search prompts by title, description, or #tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-9 pr-9 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                title="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 hidden sm:block" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
            >
              <option value="updated">Sort by: Recently Updated</option>
              <option value="versions">Sort by: Most Versions</option>
              <option value="rating">Sort by: Highest Rated</option>
              <option value="alphabetical">Sort by: Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Category Pills & Add Category Action */}
        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-slate-100 dark:border-slate-700">
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs flex-1 min-w-0 max-w-full">
            <span className="text-slate-500 dark:text-slate-400 font-semibold uppercase text-[10px] mr-1 hidden sm:inline">
              {t('category')}:
            </span>
            {allCategoriesList.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
              const isDefault = ['All', 'Coding', 'Research', 'Marketing', 'Education', 'Engineering'].includes(cat);

              return (
                <div key={cat} className="relative group flex-shrink-0 flex items-center">
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition flex items-center space-x-1 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span>{cat === 'All' ? t('all') : cat}</span>
                  </button>

                  {!isDefault && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryToDelete(cat);
                      }}
                      title={`Delete category "${cat}"`}
                      className="ml-1 p-0.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowAddCategoryModal(true)}
            className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg transition flex items-center space-x-1 flex-shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-3 h-3 text-blue-600" />
            <span>{t('addCategory')}</span>
          </button>
        </div>
      </div>

      {/* PROMPT GRID */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((prompt) => (
            <PromptCard key={prompt.id} prompt={prompt} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center max-w-xl mx-auto space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900">
            <FolderGit2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {collectionParam
                ? `No prompts found in "${collectionParam}"`
                : selectedCategory !== 'All'
                ? `No prompts in category "${selectedCategory}"`
                : search
                ? `No prompts match "${search}"`
                : 'No prompts in your vault yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Create and commit your first prompt template to start building your private AI library.
            </p>
          </div>
          <button
            onClick={() => navigate('/app/create')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Prompt</span>
          </button>
        </div>
      )}

      {/* ADD CATEGORY MODAL */}
      {showAddCategoryModal && (
        <div
          onClick={() => setShowAddCategoryModal(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Add New Category</h4>
              <button
                onClick={() => setShowAddCategoryModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Finance, Architecture, Analytics"
                  className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddCategoryModal(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CATEGORY CONFIRMATION MODAL */}
      {categoryToDelete && (
        <div
          onClick={() => setCategoryToDelete(null)}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl"
          >
            <div className="flex items-center space-x-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Category?</h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete category <strong>"{categoryToDelete}"</strong>? Existing prompts under this category will remain in your vault uncategorized.
            </p>

            <div className="flex items-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCategory}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg shadow-sm transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
