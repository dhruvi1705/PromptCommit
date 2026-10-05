import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Save,
  PlaySquare,
  Lock,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Tag,
  FolderPlus,
  Wand2,
  RefreshCw,
  Zap,
  Layers,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Paperclip,
  GitBranch,
  PlusCircle,
  History,
  GitCommit,
  Trash2,
  X,
  RotateCcw
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { AIModelSelector } from '../components/AIModelSelector';
import { AI_PROVIDERS, getProviderByModel } from '../data/aiProviders';
import { promptService } from '../services/promptService';

export const CreatePrompt = () => {
  const { userPrompts, addPrompt, addVersion, collections, categories, activePrompt, setActivePromptId, addCollection } = usePrompts();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Workflow Mode: 'new_prompt' OR 'new_version'
  const [workflowMode, setWorkflowMode] = useState('new_prompt');

  // Selected Target Prompt for 'new_version' mode
  const [targetPromptId, setTargetPromptId] = useState(activePrompt?.id || (userPrompts[0]?.id || ''));
  const selectedTargetPrompt = userPrompts.find(p => p.id === targetPromptId) || userPrompts[0];

  // Form states for New Prompt (v1.0)
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Coding');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [tags, setTags] = useState('');
  const [selectedCollectionId, setSelectedCollectionId] = useState(collections[0]?.id || '');
  const [isCustomCollection, setIsCustomCollection] = useState(false);
  const [customCollectionName, setCustomCollectionName] = useState('');
  
  // AI Provider & Model States
  const [selectedProvider, setSelectedProvider] = useState('Google Gemini');
  const [targetModel, setTargetModel] = useState('gemini-3.6-flash');
  const [content, setContent] = useState('');

  // Form states for New Version commit
  const [commitMessage, setCommitMessage] = useState('');
  const [versionBumpType, setVersionBumpType] = useState('minor'); // 'minor' (v1.1) or 'major' (v2.0)

  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTimerRef = useRef(null);
  const activeGenerateControllerRef = useRef(null);
  const generateRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      if (activeGenerateControllerRef.current) activeGenerateControllerRef.current.abort();
    };
  }, []);

  // Preselect AI model when switching target prompt in version mode
  useEffect(() => {
    if (workflowMode === 'new_version' && selectedTargetPrompt) {
      const pModel = selectedTargetPrompt.targetModel || 'gemini-3.6-flash';
      const pObj = getProviderByModel(pModel);
      setSelectedProvider(pObj?.name || 'Google Gemini');
      setTargetModel(pModel);
    }
  }, [targetPromptId, workflowMode]);

  // Next suggested version tag
  const getNextVersionTag = () => {
    if (!selectedTargetPrompt) return 'v1.1';
    const current = selectedTargetPrompt.version || 'v1.0';
    const num = parseFloat(current.replace('v', '')) || 1.0;
    if (versionBumpType === 'major') {
      return `v${(Math.floor(num) + 1).toFixed(1)}`;
    }
    return `v${(num + 0.1).toFixed(1)}`;
  };

  // Live metrics
  const charCount = content.length;
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const tokenEstimate = Math.ceil(charCount / 4);

  // Quick Multimedia Template Inserter
  const handleInsertTemplate = (type) => {
    if (type === 'Vision') {
      setTitle('Multimodal Vision UI Inspector');
      setDescription('Inspect uploaded UI screenshots or charts and diagnose UX/accessibility flaws.');
      setCategory('Engineering');
      setTags('Vision, UI, OCR, Multimodal');
      setContent(`You are a Senior Product Designer & UI/UX Accessibility Specialist.

Attached Asset: [Photo / Image Wireframe or Dashboard Screenshot]

Instructions:
1. Examine the visual hierarchy, contrast ratios, and alignment in the provided image.
2. Identify any WCAG 2.1 AA accessibility violations.
3. List 3 concrete design improvements with Tailwind CSS utility recommendations.
4. Output structured in clear Markdown sections.`);
    } else if (type === 'PDF') {
      setTitle('Academic PDF Research Synthesizer');
      setDescription('Parse attached research papers and generate methodology tables.');
      setCategory('Research');
      setTags('PDF, Document, Synthesis, Academic');
      setContent(`You are a Lead Academic Researcher and Literature Review Specialist.

Attached Asset: [PDF Document / Research Paper]

Instructions:
1. Extract the core hypothesis and contribution stated in the abstract & introduction.
2. Synthesize the experimental methodology into a structured Markdown comparison table.
3. Highlight dataset size, baseline benchmarks, and percentage improvements.
4. Note any hardware limitations or reproducibility risks mentioned.`);
    } else if (type === 'Code') {
      setTitle('Codebase Refactoring & Bugfix Engine');
      setDescription('Analyze code snippet, identify performance bottlenecks and rewrite clean code.');
      setCategory('Coding');
      setTags('Code, Refactor, Performance, Bugs');
      setContent(`You are a Principal Software Architect specializing in clean code and high performance.

Attached Asset: [Code Snippet / Script]

Instructions:
1. Identify memory leaks, race conditions, or unhandled null payloads.
2. Provide an optimized, production-grade refactoring with defensive checks.
3. Include brief inline comments explaining time complexity (Big-O) improvements.
4. Format output strictly in syntax-highlighted markdown code blocks.`);
    } else if (type === 'Email') {
      setTitle('Formal Academic & Professional Email');
      setDescription('Write a polite, respectful email to professors or managers.');
      setCategory('Marketing');
      setTags('Email, Professional, Formal');
      setContent(`You are a professional communications advisor.

Task:
Draft a polite, respectful email for the user's specific context.

Guidelines:
1. Subject Line: Clear, descriptive with [Course/Project Name] and [Student/Employee Name].
2. Salutation: Formal and respectful (e.g. "Dear Professor [Name],").
3. Body: State the core request or issue directly in the first sentence without unnecessary filler.
4. Tone: Courteous, solution-oriented, and concise.
5. Signoff: Professional closing with full student ID or title.`);
    }
  };

  // Intelligent Prompt Generator function using backend AI API with selected Provider & Model
  const handleGeneratePromptWithAI = async () => {
    setError('');
    const promptRefTitle = workflowMode === 'new_prompt' ? title : selectedTargetPrompt?.title;
    const promptRefDesc = workflowMode === 'new_prompt' ? description : selectedTargetPrompt?.description;

    if (!promptRefTitle?.trim() && !promptRefDesc?.trim()) {
      setError('Please enter a Prompt Title or Description first so AI knows what to generate!');
      return;
    }

    if (activeGenerateControllerRef.current) {
      activeGenerateControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeGenerateControllerRef.current = controller;
    const currentReqId = ++generateRequestIdRef.current;

    setIsGenerating(true);

    try {
      const res = await promptService.generatePrompt({
        title: promptRefTitle || '',
        description: promptRefDesc || '',
        category: category || 'General',
        provider: selectedProvider,
        model: targetModel || 'gemini-3.6-flash'
      }, { signal: controller.signal });

      if (generateRequestIdRef.current !== currentReqId) return;

      if (res && res.status === 'success' && res.prompt) {
        setContent(res.prompt);
        showToast({
          title: 'Prompt Generated!',
          message: `Generated professional instructions using ${res.provider || selectedProvider} (${res.model || targetModel}).`,
          type: 'success'
        });
      } else {
        const errorMsg = res?.errorMessage || 'Unable to generate prompt right now. Please try again.';
        setError(errorMsg);
        showToast({
          title: 'AI Generation Notice',
          message: errorMsg,
          type: 'warning'
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      if (generateRequestIdRef.current !== currentReqId) return;
      const errMsg = err?.message || 'Unable to generate the prompt right now. Please try again.';
      setError(errMsg);
      showToast({
        title: 'Generation Failed',
        message: errMsg,
        type: 'error'
      });
    } finally {
      if (generateRequestIdRef.current === currentReqId) {
        setIsGenerating(false);
      }
    }
  };

  const COLLECTION_DEFAULT_TAGS = {
    coding: ['Code', 'Coding', 'Development'],
    research: ['Research', 'Analysis', 'Academic'],
    marketing: ['Marketing', 'Copywriting', 'Content'],
    'ui design': ['Design', 'UI', 'UX'],
    'ui prompts': ['Design', 'UI', 'UX'],
    engineering: ['Engineering', 'Architecture', 'System'],
    education: ['Education', 'Tutorial', 'Learning'],
    'production agents': ['Production', 'Agents', 'Automation'],
    development: ['Development', 'Code', 'Engineering'],
    general: ['AI', 'General']
  };

  const handleCollectionSelect = (selectedColId) => {
    if (selectedColId === '__custom__') {
      setIsCustomCollection(true);
      setCustomCollectionName('');
    } else {
      setSelectedCollectionId(selectedColId);
      const colObj = collections.find(c => c.id === selectedColId);
      if (colObj?.name) {
        const colKey = colObj.name.toLowerCase().trim();
        const defaultTags = (colObj.defaultTags && colObj.defaultTags.length > 0)
          ? colObj.defaultTags
          : (COLLECTION_DEFAULT_TAGS[colKey] || [colObj.name.trim()]);
        setTags((prev) => {
          const existing = prev ? prev.split(',').map((t) => t.trim()).filter(Boolean) : [];
          const merged = [...existing];
          defaultTags.forEach((dt) => {
            if (!merged.some((t) => t.toLowerCase() === dt.toLowerCase())) {
              merged.push(dt);
            }
          });
          return merged.join(', ');
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;
    setError('');

    if (!content.trim()) {
      setError('Please enter or generate prompt instructions before saving.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (workflowMode === 'new_prompt') {
        if (!title.trim()) {
          setError('Please provide a Prompt Title.');
          setIsSubmitting(false);
          return;
        }

        let finalCollectionId = selectedCollectionId;

        if (isCustomCollection && customCollectionName.trim()) {
          const trimmedName = customCollectionName.trim();
          const exists = collections.find(
            (c) => (c.name || '').toLowerCase() === trimmedName.toLowerCase()
          );
          if (exists) {
            finalCollectionId = exists.id;
          } else if (addCollection) {
            const res = await addCollection({ name: trimmedName });
            if (res?.collection?.id) {
              finalCollectionId = res.collection.id;
            }
          }
        }

        const created = await addPrompt({
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          tags,
          collectionId: finalCollectionId || null,
          targetModel,
          isPrivate: true,
          content: content.trim()
        });

        if (created) {
          setSavedSuccess(true);
          showToast({
            title: 'Prompt Created Successfully!',
            message: `"${title}" (v1.0) saved to your private vault.`,
            type: 'success'
          });
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          redirectTimerRef.current = setTimeout(() => {
            navigate('/app/prompts');
          }, 700);
        }
      } else {
        // MODE B: COMMIT NEW VERSION TO EXISTING PROMPT
        if (!selectedTargetPrompt) {
          setError('Please select an existing target prompt.');
          setIsSubmitting(false);
          return;
        }
        if (!content.trim()) {
          setError('Please provide version prompt content.');
          setIsSubmitting(false);
          return;
        }

        await addVersion(selectedTargetPrompt.id, {
          versionTag: getNextVersionTag(),
          commitMessage: commitMessage.trim() || `Updated version ${getNextVersionTag()}`,
          description: `Iterated version with updated prompt rules and constraints.`,
          content: content.trim(),
          provider: selectedProvider,
          model: targetModel,
          targetModel
        });

        setActivePromptId(selectedTargetPrompt.id);
        setSavedSuccess(true);
        showToast({
          title: 'New Version Committed!',
          message: `Version ${getNextVersionTag()} saved to ${selectedTargetPrompt.title} (${selectedProvider} / ${targetModel}).`,
          type: 'success'
        });
        if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        redirectTimerRef.current = setTimeout(() => {
          navigate('/app/versions');
        }, 700);
      }
    } catch (err) {
      setError(err.message || 'Failed to save prompt.');
      showToast({
        title: 'Error Saving Prompt',
        message: err.message || 'An error occurred while saving to the database.',
        type: 'error'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTestInPlayground = () => {
    if (!content.trim()) {
      setError('Please enter or generate prompt content before testing.');
      return;
    }
    if (workflowMode === 'new_prompt') {
      if (!title.trim()) {
        setError('Please enter a Prompt Title.');
        return;
      }
      const created = addPrompt({
        title,
        description,
        category,
        tags,
        collectionId: selectedCollectionId || null,
        targetModel,
        content
      });
      if (created) navigate('/app/playground');
    } else {
      navigate('/app/playground');
    }
  };

  const handleClearAll = () => {
    setTitle('');
    setDescription('');
    setTags('');
    setContent('');
    setCommitMessage('');
    showToast({
      title: 'Fields Cleared',
      message: 'All form input fields have been reset.',
      type: 'info'
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              {workflowMode === 'new_prompt' ? 'Create New Prompt' : 'Commit New Version'}
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              {workflowMode === 'new_prompt' ? 'Initial v1.0' : `Target: ${getNextVersionTag()}`}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Choose whether to build a brand new prompt from scratch or commit a new version to an existing prompt.
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg transition flex items-center space-x-1 shadow-sm cursor-pointer"
            title="Reset all form fields"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Fields</span>
          </button>

          <button
            type="button"
            onClick={handleTestInPlayground}
            className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium rounded-lg transition flex items-center space-x-1 shadow-sm cursor-pointer"
          >
            <PlaySquare className="w-3.5 h-3.5 text-blue-600" />
            <span>Test in Playground</span>
          </button>

          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{workflowMode === 'new_prompt' ? 'Save Prompt (v1.0)' : `Commit Version (${getNextVersionTag()})`}</span>
          </button>
        </div>
      </div>

      {/* WORKFLOW MODE SELECTOR: Create New Prompt vs Commit New Version */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 shadow-sm">
        <button
          type="button"
          onClick={() => setWorkflowMode('new_prompt')}
          className={`p-3.5 rounded-lg text-left transition flex items-center space-x-3 cursor-pointer ${
            workflowMode === 'new_prompt'
              ? 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-slate-900 dark:text-white shadow-sm'
              : 'border border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold ${
            workflowMode === 'new_prompt'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
          }`}>
            <PlusCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold flex items-center space-x-1.5">
              <span>Create Brand New Prompt</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded">v1.0</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Start a new prompt with its own title, category, and private repository
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            if (userPrompts.length === 0) {
              setError('You do not have any prompts in your vault yet. Create your first prompt first!');
              return;
            }
            setWorkflowMode('new_version');
          }}
          className={`p-4 rounded-xl text-left transition flex items-center space-x-3.5 ${
            workflowMode === 'new_version'
              ? 'bg-indigo-50 dark:bg-indigo-500/15 border-2 border-indigo-500 text-slate-900 dark:text-white shadow-sm'
              : 'border border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
            workflowMode === 'new_version'
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
          }`}>
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center space-x-2">
              <span>Commit New Version to Existing Prompt</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded">Git Commit</span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select an existing prompt and branch a new version (e.g. v1.1, v2.0)
            </div>
          </div>
        </button>
      </div>

      {/* QUICK MULTIMEDIA TEMPLATE PRESETS (Only shown when creating brand new prompt) */}
      {workflowMode === 'new_prompt' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Quick Starters:</span>
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleInsertTemplate('Vision')}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Vision / Photo Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertTemplate('PDF')}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-rose-500" />
              <span>PDF Document Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertTemplate('Code')}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-500" />
              <span>Code Refactoring</span>
            </button>
            <button
              type="button"
              onClick={() => handleInsertTemplate('Email')}
              className="px-2.5 py-1 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center space-x-1 transition cursor-pointer border border-slate-200 dark:border-slate-600 shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>Formal Email</span>
            </button>
          </div>
        </div>
      )}

      {/* Success Notification Banner */}
      {savedSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>
            {workflowMode === 'new_prompt'
              ? 'New Prompt created successfully! Redirecting...'
              : 'New version committed to Git history! Redirecting to Version History...'}
          </span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm font-semibold flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TWO-COLUMN FORM LAYOUT */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {workflowMode === 'new_prompt' ? (
            /* MODE 1: CREATE BRAND NEW PROMPT METADATA */
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm transition-colors">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                  <FileCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>1. New Prompt Details</span>
                </h2>
              </div>

              {/* Prompt Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Prompt Title / Name *</span>
                  {title && (
                    <button
                      type="button"
                      onClick={() => setTitle('')}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-medium flex items-center space-x-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Multimodal Vision UI Inspector"
                    className="w-full h-10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                  />
                  {title && (
                    <button
                      type="button"
                      onClick={() => setTitle('')}
                      title="Clear Title"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Description / Problem Statement</span>
                  {description && (
                    <button
                      type="button"
                      onClick={() => setDescription('')}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-medium flex items-center space-x-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </label>
                <div className="relative">
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Inspect attached screenshots and extract UI components"
                    className="w-full bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 p-2.5 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                  />
                  {description && (
                    <button
                      type="button"
                      onClick={() => setDescription('')}
                      title="Clear Description"
                      className="absolute right-2.5 top-2.5 p-1 text-slate-400 hover:text-red-500 rounded transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* AI Auto-Generate Prompt Assistant Card */}
              <div className="p-3.5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 rounded-xl space-y-2.5 shadow-sm">
                <div className="flex items-center justify-between text-xs text-blue-900 dark:text-blue-200 font-medium">
                  <span className="flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Generate instructions from idea?</span>
                  </span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 bg-blue-100/80 dark:bg-blue-900/60 px-1.5 py-0.5 rounded">
                    AI Auto-Draft
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleGeneratePromptWithAI}
                  disabled={isGenerating}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                      <span>Generating Prompt Instructions...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-blue-100" />
                      <span>Auto-Generate Prompt with AI</span>
                    </>
                  )}
                </button>
              </div>

              {/* Category & Collection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isCustomCategory;
                        setIsCustomCategory(nextState);
                        if (nextState) {
                          setCustomCategoryName('');
                        } else {
                          setCategory(categories[0] || 'Coding');
                        }
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex-shrink-0 cursor-pointer ml-1"
                    >
                      <span>{isCustomCategory ? 'Existing' : '+ Custom'}</span>
                    </button>
                  </div>

                  {isCustomCategory ? (
                    <input
                      type="text"
                      required
                      value={customCategoryName}
                      onChange={(e) => {
                        setCustomCategoryName(e.target.value);
                        setCategory(e.target.value);
                      }}
                      placeholder="e.g. Prompt Eng, Security..."
                      className="w-full h-10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                    />
                  ) : (
                    <select
                      value={category}
                      onChange={(e) => {
                        if (e.target.value === '__custom__') {
                          setIsCustomCategory(true);
                          setCustomCategoryName('');
                        } else {
                          setCategory(e.target.value);
                        }
                      }}
                      className="w-full h-10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__">+ Custom Category...</option>
                    </select>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between h-5 mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider truncate">
                      Collection
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const nextState = !isCustomCollection;
                        setIsCustomCollection(nextState);
                        if (nextState) {
                          setCustomCollectionName('');
                        } else {
                          setSelectedCollectionId(collections[0]?.id || '');
                        }
                      }}
                      className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex-shrink-0 cursor-pointer ml-1"
                    >
                      <span>{isCustomCollection ? 'Existing' : '+ Custom'}</span>
                    </button>
                  </div>

                  {isCustomCollection ? (
                    <input
                      type="text"
                      required
                      value={customCollectionName}
                      onChange={(e) => setCustomCollectionName(e.target.value)}
                      placeholder="e.g. Production Prompts..."
                      className="w-full h-10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                    />
                  ) : (
                    <select
                      value={selectedCollectionId}
                      onChange={(e) => handleCollectionSelect(e.target.value)}
                      className="w-full h-10 bg-white dark:bg-slate-900 text-xs font-medium text-slate-900 dark:text-slate-100 px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:outline-none cursor-pointer"
                    >
                      <option value="">No Collection</option>
                      {collections.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                      <option value="__custom__">+ Custom Collection...</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Target AI Model Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Target AI Model & Provider</span>
                  <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {targetModel}
                  </span>
                </label>
                <AIModelSelector
                  provider={selectedProvider}
                  onProviderChange={setSelectedProvider}
                  model={targetModel}
                  onModelChange={setTargetModel}
                  showParams={false}
                  compact={true}
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Tags</span>
                  {tags && (
                    <button
                      type="button"
                      onClick={() => setTags('')}
                      className="text-[11px] text-slate-400 hover:text-red-500 font-medium flex items-center space-x-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="debugging, bugfix, react"
                    className="w-full h-10 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition"
                  />
                  {tags && (
                    <button
                      type="button"
                      onClick={() => setTags('')}
                      title="Clear Tags"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-red-500 rounded transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* MODE 2: COMMIT NEW VERSION TO EXISTING PROMPT */
            <div className="bg-white dark:bg-[#111827]/90 border border-indigo-200 dark:border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-card transition-colors ring-1 ring-indigo-500/20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center space-x-2">
                  <GitBranch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>1. Git Version Commit Target</span>
                </h2>
              </div>

              {/* Target Prompt Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Select Existing Prompt from Vault *
                </label>
                <select
                  value={targetPromptId}
                  onChange={(e) => setTargetPromptId(e.target.value)}
                  className="w-full h-12 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white px-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  {userPrompts.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.title} (Current: {p.version})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Active Version and Next Suggested Version */}
              <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Current HEAD</span>
                  <strong className="text-sm font-mono text-slate-800 dark:text-slate-200">
                    {selectedTargetPrompt?.version || 'v1.0'}
                  </strong>
                </div>
                <div>
                  <span className="text-[11px] text-indigo-600 dark:text-indigo-400 block font-medium">New Version Target</span>
                  <strong className="text-sm font-mono text-indigo-600 dark:text-indigo-400">
                    {getNextVersionTag()}
                  </strong>
                </div>
              </div>

              {/* Version Bump Type (Minor vs Major) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Version Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVersionBumpType('minor')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      versionBumpType === 'minor'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>Minor Iteration</span>
                    <span className="text-[10px] opacity-80">(e.g. v1.1)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVersionBumpType('major')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                      versionBumpType === 'major'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>Major Release</span>
                    <span className="text-[10px] opacity-80">(e.g. v2.0)</span>
                  </button>
                </div>
              </div>

              {/* AI MODEL SELECTOR FOR VERSION CREATION */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>AI Model for Version Generation ({getNextVersionTag()})</span>
                  <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                    {targetModel}
                  </span>
                </label>
                <AIModelSelector
                  provider={selectedProvider}
                  onProviderChange={setSelectedProvider}
                  model={targetModel}
                  onModelChange={setTargetModel}
                  showParams={false}
                  compact={true}
                />
              </div>

              {/* Git Commit Message */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span className="flex items-center space-x-1">
                    <GitCommit className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Commit Message / Change Note *</span>
                  </span>
                  {commitMessage && (
                    <button
                      type="button"
                      onClick={() => setCommitMessage('')}
                      className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold flex items-center space-x-0.5"
                    >
                      <X className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="e.g. Added error handling and few-shot examples"
                    className="w-full h-11 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 pl-4 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition"
                  />
                  {commitMessage && (
                    <button
                      type="button"
                      onClick={() => setCommitMessage('')}
                      title="Clear Commit Message"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-rose-500 rounded-lg transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Auto Enhance Version Button */}
              <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl">
                <button
                  type="button"
                  onClick={handleGeneratePromptWithAI}
                  disabled={isGenerating}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow transition flex items-center justify-center space-x-2"
                >
                  {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isGenerating ? 'Generating Version Instructions...' : `✨ AI Optimize Prompt Instructions for ${getNextVersionTag()}`}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Prompt Content Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white dark:bg-[#111827]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-card space-y-3 transition-colors">
            <div>
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider block">
                    {workflowMode === 'new_prompt' ? '2. Prompt Instructions (v1.0) *' : `2. Edited Instructions for (${getNextVersionTag()}) *`}
                  </label>
                  {content && (
                    <button
                      type="button"
                      onClick={() => setContent('')}
                      className="text-xs text-slate-400 hover:text-rose-500 font-semibold flex items-center space-x-1 transition cursor-pointer"
                      title="Clear Instructions"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    {workflowMode === 'new_prompt'
                      ? 'Type prompt instructions manually, or click ✨ Generate with AI.'
                      : `Edit instructions manually or click ✨ Generate with AI to enhance for ${getNextVersionTag()}.`}
                  </p>

                  <div className="flex items-center space-x-2 flex-shrink-0 self-start sm:self-auto">
                    {workflowMode === 'new_version' && selectedTargetPrompt && !content && (
                      <button
                        type="button"
                        onClick={() => setContent(selectedTargetPrompt.content || '')}
                        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-lg transition flex items-center space-x-1 cursor-pointer"
                        title="Load previous version instructions"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Load {selectedTargetPrompt.version || 'v1.0'}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleGeneratePromptWithAI}
                      disabled={isGenerating}
                      className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black font-extrabold rounded-lg text-xs flex items-center space-x-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-black" />}
                      <span>{isGenerating ? 'Generating...' : '✨ Generate with AI'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <textarea
                rows={12}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Type your prompt instructions here manually...\n\nOr click "✨ Generate with AI" to automatically draft instructions from your Title and Description.`}
                className="w-full bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 p-3.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition leading-relaxed"
              />
            </div>

            {/* Live Counters & Bottom Action Buttons */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 font-mono">
                <span>Chars: <strong className="text-slate-800 dark:text-slate-200">{charCount}</strong></span>
                <span>Words: <strong className="text-slate-800 dark:text-slate-200">{wordCount}</strong></span>
                <span>Est. Tokens: <strong className="text-blue-600 dark:text-blue-400">~{tokenEstimate}</strong></span>
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setContent('')}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-sm"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{workflowMode === 'new_prompt' ? 'Save Prompt (v1.0)' : `Commit Version (${getNextVersionTag()})`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
