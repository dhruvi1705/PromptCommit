import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  FolderPlus,
  Plus,
  ArrowRight,
  Trash2,
  FolderLock,
  Code2,
  Cpu,
  Search,
  Sparkles,
  BookOpen,
  Briefcase,
  Layers,
  Lock,
  X,
  AlertTriangle
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';

export const Collections = () => {
  const navigate = useNavigate();
  const { collections, userPrompts, addCollection, deleteCollection } = usePrompts();
  const { showToast } = useToast();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [collectionToDelete, setCollectionToDelete] = useState(null);
  const [colName, setColName] = useState('');
  const [colDesc, setColDesc] = useState('');
  const [colIcon, setColIcon] = useState('FolderKanban');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCollections = collections.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCollectionIcon = (iconName) => {
    switch (iconName) {
      case 'Code2': return Code2;
      case 'Cpu': return Cpu;
      case 'BookOpen': return BookOpen;
      case 'Briefcase': return Briefcase;
      case 'Sparkles': return Sparkles;
      case 'FolderLock': return FolderLock;
      default: return FolderKanban;
    }
  };

  const handleOpenCollection = (col) => {
    navigate(`/app/prompts?collectionId=${encodeURIComponent(col.id)}`);
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    if (!colName.trim()) return;

    const res = await addCollection({
      name: colName.trim(),
      description: colDesc.trim() || 'Curated collection of private prompts.',
      icon: colIcon
    });

    if (res.success) {
      showToast({
        title: 'Collection Created!',
        message: `Collection "${colName.trim()}" is ready.`,
        type: 'success'
      });
      setShowCreateModal(false);
      setColName('');
      setColDesc('');
      setColIcon('FolderKanban');
    } else {
      showToast({
        title: 'Error',
        message: res.message || 'Collection could not be created.',
        type: 'error'
      });
    }
  };

  const confirmDeleteCollection = async () => {
    if (!collectionToDelete) return;
    await deleteCollection(collectionToDelete.id);
    showToast({
      title: 'Collection Deleted',
      message: `Collection "${collectionToDelete.name}" was removed.`,
      type: 'info'
    });
    setCollectionToDelete(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              My Collections
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {collections.length} Folders
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize related private prompts into curated thematic workspaces.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search collections..."
              className="h-9 w-44 sm:w-56 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white pl-8 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center space-x-1.5 px-4 h-9 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Collection</span>
          </button>
        </div>
      </div>

      {/* Collections Grid */}
      {filteredCollections.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8">
          <FolderKanban className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No collections found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {searchQuery ? `No collections match "${searchQuery}"` : 'Create your first custom collection folder.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCollections.map((col) => {
            const Icon = getCollectionIcon(col.icon);
            const promptCount = col.promptCount !== undefined ? col.promptCount : (
              userPrompts.filter(p => (p.collections || []).some(c => c.id === col.id)).length
            );

            return (
              <div
                key={col.id}
                onClick={() => handleOpenCollection(col)}
                className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-sm transition-all duration-150 group cursor-pointer"
              >
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-105">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {promptCount} {promptCount === 1 ? 'Prompt' : 'Prompts'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {col.name}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                    {col.description}
                  </p>
                </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center font-medium">
                  <Lock className="w-3 h-3 text-slate-400 mr-1" /> Private Vault
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCollectionToDelete(col);
                    }}
                    title="Delete Collection"
                    className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCollection(col);
                    }}
                    className="px-3 py-1.5 bg-white dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1 cursor-pointer shadow-sm"
                  >
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-md w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">New Collection</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Group your private prompts</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollection} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Collection Name *
                </label>
                <input
                  type="text"
                  required
                  value={colName}
                  onChange={(e) => setColName(e.target.value)}
                  placeholder="e.g. Production Agents, SEO Tools, SQL Helpers"
                  className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={colDesc}
                  onChange={(e) => setColDesc(e.target.value)}
                  placeholder="What prompts belong in this collection?"
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Folder Icon
                </label>
                <select
                  value={colIcon}
                  onChange={(e) => setColIcon(e.target.value)}
                  className="w-full h-10 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="FolderKanban">📁 Standard Folder</option>
                  <option value="Code2">💻 Code & Engineering</option>
                  <option value="Cpu">🤖 AI & LLM Systems</option>
                  <option value="Sparkles">✨ Creative & Copy</option>
                  <option value="BookOpen">📖 Research & Knowledge</option>
                  <option value="Briefcase">💼 Business & Marketing</option>
                  <option value="FolderLock">🔒 Classified & Security</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
                >
                  Create Collection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Collection Modal */}
      {collectionToDelete && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setCollectionToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2.5 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Collection?</h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <strong>"{collectionToDelete.name}"</strong>? The collection folder will be deleted, but your prompts will remain safe in your vault.
            </p>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setCollectionToDelete(null)}
                className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteCollection}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
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
