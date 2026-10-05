import React, { useState, useEffect } from 'react';
import {
  Edit3,
  Save,
  X,
  Tag,
  FolderPlus,
  Layers,
  Cpu,
  FileCode,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { AI_PROVIDERS } from '../data/aiProviders';

export const EditPromptModal = ({ prompt, isOpen, onClose }) => {
  const { updatePrompt, categories, collections, addCollection } = usePrompts();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Coding');
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [isCustomCollection, setIsCustomCollection] = useState(false);
  const [customCollectionName, setCustomCollectionName] = useState('');
  const [targetModel, setTargetModel] = useState('gemini-3.6-flash');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title || '');
      setDescription(prompt.description || '');
      setCategory(prompt.category || 'Coding');
      const initialColId = prompt.collectionId || (prompt.collections && prompt.collections[0]?.id) || '';
      setSelectedCollectionId(initialColId);
      setIsCustomCollection(false);
      setCustomCollectionName('');
      setTargetModel(prompt.targetModel || 'gemini-3.6-flash');
      setTags((prompt.tags || []).join(', '));
      setContent(prompt.content || '');
      setError('');
    }
  }, [prompt, isOpen]);

  if (!isOpen || !prompt) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Prompt Title is required.');
      return;
    }
    if (!content.trim()) {
      setError('Prompt Instructions / Content cannot be empty.');
      return;
    }

    const tagArray = tags
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    let finalCollectionId = selectedCollectionId;

    if (isCustomCollection && customCollectionName.trim()) {
      const trimmedName = customCollectionName.trim();
      const existing = collections.find(
        (c) => (c.name || '').toLowerCase() === trimmedName.toLowerCase()
      );
      if (existing) {
        finalCollectionId = existing.id;
      } else if (addCollection) {
        const res = await addCollection({ name: trimmedName });
        if (res?.collection?.id) {
          finalCollectionId = res.collection.id;
        }
      }
    }

    try {
      await updatePrompt(prompt.id, {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        collectionId: finalCollectionId || null,
        targetModel,
        tags: tagArray.length > 0 ? tagArray : ['AI', category],
        content: content.trim()
      });

      showToast({
        title: 'Prompt Updated!',
        message: `"${title.trim()}" has been saved.`,
        type: 'success'
      });

      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update prompt.');
    }
  };

  const charCount = content.length;
  const tokenEstimate = Math.ceil(charCount / 4);

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Prompt</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Modify configuration and instructions</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Edit Modal"
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Prompt Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. SQL Query Generator"
              className="w-full h-11 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white px-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this prompt accomplish?"
              className="w-full bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white p-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none transition"
            />
          </div>

          {/* 3-Column: Category, Collection, Target AI Model */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Collection
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isCustomCollection;
                    setIsCustomCollection(next);
                    if (next) {
                      setCustomCollectionName('');
                    } else {
                      setSelectedCollectionId(prompt.collectionId || (prompt.collections && prompt.collections[0]?.id) || '');
                    }
                  }}
                  className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline font-semibold cursor-pointer"
                >
                  {isCustomCollection ? 'Existing' : '+ Custom'}
                </button>
              </div>
              {isCustomCollection ? (
                <input
                  type="text"
                  value={customCollectionName}
                  onChange={(e) => setCustomCollectionName(e.target.value)}
                  placeholder="e.g. Production Prompts..."
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none"
                />
              ) : (
                <select
                  value={selectedCollectionId}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomCollection(true);
                      setCustomCollectionName('');
                    } else {
                      setSelectedCollectionId(e.target.value);
                    }
                  }}
                  className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none cursor-pointer"
                >
                  <option value="">No Collection</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                  <option value="__custom__">+ Custom Collection...</option>
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Target AI Model
              </label>
              <select
                value={targetModel}
                onChange={(e) => setTargetModel(e.target.value)}
                className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-3 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none cursor-pointer"
              >
                {AI_PROVIDERS.map((p) => (
                  <optgroup key={p.id} label={p.name}>
                    {p.models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. SQL, Postgres, Database, Optimization"
              className="w-full h-10 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-white px-3.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none transition"
            />
          </div>

          {/* Prompt Instructions Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Prompt Instructions / System Prompt *
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {charCount} chars • ~{tokenEstimate} tokens
              </span>
            </div>
            <textarea
              rows={8}
              required
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (error) setError('');
              }}
              placeholder="Write or edit prompt instructions..."
              className="w-full bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-[#F9FAFB] font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-[#374151] focus:border-blue-600 focus:outline-none leading-relaxed transition"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
