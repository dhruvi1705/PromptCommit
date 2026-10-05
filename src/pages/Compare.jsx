import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitCompare,
  TrendingUp,
  Sparkles,
  Layers,
  Check,
  Copy,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Plus,
  RefreshCw,
  Zap,
  ArrowRight,
  ShieldCheck,
  BarChart2,
  FileCode,
  Info
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { promptService } from '../services/promptService';
import { AIModelSelector } from '../components/AIModelSelector';
import { AI_PROVIDERS } from '../data/aiProviders';

export const Compare = () => {
  const navigate = useNavigate();
  const { userPrompts, activePrompt, setActivePromptId } = usePrompts();
  const { showToast } = useToast();

  const selectedPrompt = activePrompt || userPrompts[0];

  // Comparison Modes: 'versions' (Compare 2 versions of same prompt) vs 'prompts' (Compare 2 different prompts)
  const [compareMode, setCompareMode] = useState('versions');

  // AI Provider Selection
  const [aiProvider, setAiProvider] = useState('Google Gemini');
  const [aiModel, setAiModel] = useState('gemini-3.6-flash');

  // Mode: Versions of the same prompt
  const rawVersions = selectedPrompt?.versions && selectedPrompt.versions.length > 0
    ? selectedPrompt.versions
    : [{
        version: selectedPrompt?.version || 'v1.0',
        commitMessage: 'Initial Baseline Commit',
        description: selectedPrompt?.description || 'Baseline system prompt.',
        content: selectedPrompt?.content || '',
        timestamp: selectedPrompt?.updatedAt || selectedPrompt?.createdAt
      }];

  const hasMultipleVersions = rawVersions.length >= 2;

  // Set default versions: Variant A = earliest/previous, Variant B = latest/current
  const [versionA, setVersionA] = useState('');
  const [versionB, setVersionB] = useState('');

  // Mode: 2 different prompts
  const [promptAId, setPromptAId] = useState(userPrompts[0]?.id || '');
  const [promptBId, setPromptBId] = useState(userPrompts[1]?.id || userPrompts[0]?.id || '');

  // Active Objects
  const [copiedPanel, setCopiedPanel] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  // In-memory cache for comparison analyses: key = `provider:model:hash(contentA):hash(contentB)`
  const analysisCache = useRef({});
  const activeCompareControllerRef = useRef(null);
  const compareRequestIdRef = useRef(0);
  const copyTimerRef = useRef(null);

  // Clean up timers and in-flight comparisons on unmount
  useEffect(() => {
    return () => {
      if (activeCompareControllerRef.current) {
        activeCompareControllerRef.current.abort();
      }
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  // Initialize and reset selected versions when selectedPrompt changes
  useEffect(() => {
    if (selectedPrompt && selectedPrompt.versions && selectedPrompt.versions.length >= 2) {
      const vers = selectedPrompt.versions;
      // Variant A: earliest (last in desc array), Variant B: latest (first in desc array)
      setVersionA(vers[vers.length - 1].version);
      setVersionB(vers[0].version);
    } else if (selectedPrompt?.versions && selectedPrompt.versions.length === 1) {
      setVersionA(selectedPrompt.versions[0].version);
      setVersionB(selectedPrompt.versions[0].version);
    } else if (selectedPrompt) {
      setVersionA(selectedPrompt.version || 'v1.0');
      setVersionB(selectedPrompt.version || 'v1.0');
    }
  }, [selectedPrompt?.id]);

  // Determine active objects being compared
  const objA = compareMode === 'versions'
    ? (rawVersions.find(v => v.version === versionA) || rawVersions[rawVersions.length - 1])
    : userPrompts.find(p => p.id === promptAId);

  const objB = compareMode === 'versions'
    ? (rawVersions.find(v => v.version === versionB) || rawVersions[0])
    : userPrompts.find(p => p.id === promptBId);

  const promptAObj = userPrompts.find(p => p.id === promptAId);
  const promptBObj = userPrompts.find(p => p.id === promptBId);

  const contentA = (objA?.content || '').trim();
  const contentB = (objB?.content || '').trim();
  const isExactSame = contentA === contentB && contentA.length > 0;

  // Simple string hash helper for analysis cache
  const getComparisonKey = (textA, textB, prov, mod) => {
    const s = `${prov}:${mod}:${textA}::${textB}`;
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return `comp_${hash}`;
  };

  // Perform dynamic AI evaluation and comparison with race-condition & stale-request defense
  const runComparisonAnalysis = async (forceRefresh = false) => {
    if (compareMode === 'versions' && !hasMultipleVersions) {
      setAnalysisResult(null);
      return;
    }

    if (!contentA || !contentB) {
      setAnalysisResult(null);
      return;
    }

    const cacheKey = getComparisonKey(contentA, contentB, aiProvider, aiModel);

    if (!forceRefresh && analysisCache.current[cacheKey]) {
      setAnalysisResult(analysisCache.current[cacheKey]);
      setAnalysisError(null);
      return;
    }

    // Abort previous in-flight comparison
    if (activeCompareControllerRef.current) {
      activeCompareControllerRef.current.abort();
    }

    const controller = new AbortController();
    activeCompareControllerRef.current = controller;
    const currentRequestId = ++compareRequestIdRef.current;

    setIsAnalyzing(true);
    setAnalysisError(null);

    const titleA = compareMode === 'versions' ? `Version ${objA?.version || 'A'}` : (promptAObj?.title || 'Prompt A');
    const titleB = compareMode === 'versions' ? `Version ${objB?.version || 'B'}` : (promptBObj?.title || 'Prompt B');

    try {
      const res = await promptService.comparePrompts({
        promptAContent: contentA,
        promptBContent: contentB,
        promptATitle: titleA,
        promptBTitle: titleB,
        provider: aiProvider,
        model: aiModel
      }, { signal: controller.signal });

      // Apply response ONLY if this is still the active, latest request
      if (currentRequestId === compareRequestIdRef.current && !controller.signal.aborted) {
        if (res && res.status === 'success') {
          setAnalysisResult(res);
          analysisCache.current[cacheKey] = res;
          setAnalysisError(null);
        } else {
          const errorMsg = res?.errorMessage || 'Unable to analyze these prompt versions right now. Please try again.';
          setAnalysisError(errorMsg);
          setAnalysisResult(null);
        }
      }
    } catch (err) {
      // If request was cancelled / superseded, ignore quietly
      if (err.name === 'AbortError' || currentRequestId !== compareRequestIdRef.current) {
        return;
      }
      const errorMsg = err?.message || 'Unable to analyze these prompt versions right now. Please try again.';
      setAnalysisError(errorMsg);
      setAnalysisResult(null);
    } finally {
      // Only reset loading state if this is the active request
      if (currentRequestId === compareRequestIdRef.current) {
        setIsAnalyzing(false);
        activeCompareControllerRef.current = null;
      }
    }
  };

  // Trigger analysis when items or AI model changes
  useEffect(() => {
    if (contentA && contentB) {
      if (compareMode === 'versions' && !hasMultipleVersions) {
        setAnalysisResult(null);
        return;
      }
      runComparisonAnalysis();
    } else {
      setAnalysisResult(null);
    }
  }, [contentA, contentB, compareMode, aiProvider, aiModel, hasMultipleVersions]);

  const handleCopyVariant = (text, label) => {
    navigator.clipboard.writeText(text || '');
    setCopiedPanel(label);
    showToast({
      title: 'Copied!',
      message: `${label} content copied to clipboard.`,
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopiedPanel(null);
      copyTimerRef.current = null;
    }, 2000);
  };

  // Get color for score metric
  const getScoreColor = (score) => {
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800';
    if (score >= 75) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800';
    return 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800';
  };

  const getMetricBarWidth = (score) => `${Math.max(5, Math.min(100, score || 0))}%`;

  if (!selectedPrompt) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center max-w-lg mx-auto space-y-4 shadow-sm">
        <GitCompare className="w-10 h-10 text-slate-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Prompts in Workspace</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Create a prompt first to compare its version iterations.</p>
        <button
          onClick={() => navigate('/app/create')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer"
        >
          Create Your First Prompt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Prompt Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center flex-wrap gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Prompt Comparison & Benchmarking
            </h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap">
              Dynamic AI Evaluation
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Compare two prompt iterations side-by-side with real AI scoring across Clarity, Specificity, Completeness, Structure, and Efficiency.
          </p>
        </div>

        {/* COMPARISON MODE TOGGLE */}
        <div className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm self-start lg:self-auto max-w-full overflow-x-auto">
          <button
            type="button"
            onClick={() => setCompareMode('versions')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
              compareMode === 'versions'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Version Comparison</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (userPrompts.length < 2) {
                showToast({
                  title: 'Multiple Prompts Needed',
                  message: 'Prompt comparison requires at least 2 distinct prompts in your vault.',
                  type: 'warning'
                });
                navigate('/app/create');
              } else {
                setCompareMode('prompts');
              }
            }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center space-x-1.5 ${
              compareMode === 'prompts'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Compare 2 Prompts</span>
          </button>
        </div>
      </div>

      {/* TARGET PROMPT & AI ENGINE BAR */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
        {/* Left selector */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {compareMode === 'versions' ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase w-full">
              <span className="whitespace-nowrap flex items-center space-x-1">
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Prompt:</span>
              </span>
              <select
                value={selectedPrompt.id}
                onChange={(e) => setActivePromptId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer w-full text-xs truncate"
              >
                {userPrompts.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.versions?.length || 1} {p.versions?.length === 1 ? 'version' : 'versions'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>Cross-Prompt Independent Evaluation Mode</span>
            </div>
          )}
        </div>

        {/* Right: AI Engine Selector for dynamic benchmark */}
        <div className="lg:col-span-6">
          <AIModelSelector
            provider={aiProvider}
            onProviderChange={setAiProvider}
            model={aiModel}
            onModelChange={setAiModel}
            showParams={false}
            compact={true}
          />
        </div>
      </div>

      {/* CASE 1: PROMPT WITH ONLY ONE VERSION (Empty/Informational State) */}
      {compareMode === 'versions' && !hasMultipleVersions ? (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
            <GitBranch className="w-7 h-7" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              Version comparison requires at least two versions.
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-lg mx-auto leading-relaxed">
              This prompt (<strong className="text-slate-900 dark:text-white">{selectedPrompt.title}</strong>) currently has only one version (<code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 rounded font-mono text-xs">{selectedPrompt.version || 'v1.0'}</code>).
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-w-md mx-auto text-left space-y-2.5">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
              Create another version to compare dynamic improvements in:
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Clarity Score</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Completeness Score</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Specificity Score</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Structure Score</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Efficiency Score</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Check className="w-3.5 h-3.5 text-blue-600" />
                <span>Overall Quality Index</span>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => {
                setActivePromptId(selectedPrompt.id);
                navigate('/app/create');
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Version for this Prompt</span>
            </button>
            <button
              onClick={() => navigate('/app/prompts')}
              className="w-full sm:w-auto px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            >
              Back to Prompts Vault
            </button>
          </div>
        </div>
      ) : (
        /* CASE 2: PROMPT WITH MULTIPLE VERSIONS OR 2 PROMPTS COMPARISON */
        <div className="space-y-6">
          {/* TOP CONTROLS & RE-ANALYZE BAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-xl shadow-sm">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>
                {compareMode === 'versions'
                  ? `Comparing 2 iterations of "${selectedPrompt.title}"`
                  : `Comparing "${promptAObj?.title || 'Prompt A'}" vs "${promptBObj?.title || 'Prompt B'}"`}
              </span>
            </div>

            <div className="flex items-center space-x-2.5">
              <button
                type="button"
                onClick={() => runComparisonAnalysis(true)}
                disabled={isAnalyzing}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span>{isAnalyzing ? 'Analyzing with AI...' : 'Re-Run AI Benchmark'}</span>
              </button>
            </div>
          </div>

          {/* Loading Indicator Banner */}
          {isAnalyzing && (
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-semibold flex items-center space-x-3 shadow-sm animate-pulse">
              <RefreshCw className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
              <span>Analyzing prompt versions with {aiProvider} ({aiModel}) across Clarity, Specificity, Structure, Completeness, and Efficiency...</span>
            </div>
          )}

          {/* Error Banner */}
          {analysisError && !isAnalyzing && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center space-x-3 shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <span>{analysisError}</span>
            </div>
          )}

          {/* Identical content notice */}
          {isExactSame && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium flex items-center space-x-2">
              <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <span>Both Variant A and Variant B currently have identical prompt content. Metrics reflect complete parity.</span>
            </div>
          )}

          {/* SIDE-BY-SIDE COMPARISON PANELS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* LEFT: Variant A */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header & Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">Variant A</span>
                    <span className="text-base font-mono font-bold text-slate-900 dark:text-white truncate block">
                      {compareMode === 'versions' ? `Version ${objA?.version || 'v1.0'}` : promptAObj?.title}
                    </span>
                  </div>

                  {compareMode === 'versions' ? (
                    <select
                      value={versionA}
                      onChange={(e) => setVersionA(e.target.value)}
                      className="h-9 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer self-start sm:self-auto"
                    >
                      {rawVersions.map(v => (
                        <option key={v.version} value={v.version}>Version {v.version}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={promptAId}
                      onChange={(e) => setPromptAId(e.target.value)}
                      className="h-9 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer max-w-full sm:max-w-[200px] self-start sm:self-auto"
                    >
                      {userPrompts.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Score & Commit Info */}
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <div className="text-xs min-w-0 pr-2">
                    <span className="text-slate-500 dark:text-slate-400 block text-[11px]">
                      {compareMode === 'versions' ? 'Commit Note' : 'Prompt Category'}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {compareMode === 'versions' ? (objA?.commitMessage || 'Baseline iteration') : (promptAObj?.category || 'General')}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Overall Score</span>
                    {analysisResult?.versionA?.overall !== undefined ? (
                      <span className={`text-sm font-mono font-extrabold px-2.5 py-0.5 rounded border inline-block ${getScoreColor(analysisResult.versionA.overall)}`}>
                        {analysisResult.versionA.overall}/100
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">Evaluating...</span>
                    )}
                  </div>
                </div>

                {/* Detailed 5-Metric Breakdown */}
                {analysisResult?.versionA && (
                  <div className="space-y-2.5 p-3.5 bg-slate-50/70 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700/80 text-xs">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Dynamic Content Metrics
                    </span>

                    {/* Metric Rows */}
                    {[
                      { label: 'Clarity', val: analysisResult.versionA.clarity },
                      { label: 'Specificity', val: analysisResult.versionA.specificity },
                      { label: 'Completeness', val: analysisResult.versionA.completeness },
                      { label: 'Structure', val: analysisResult.versionA.structure },
                      { label: 'Efficiency', val: analysisResult.versionA.efficiency }
                    ].map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">{m.label}</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{m.val}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-slate-600 dark:bg-slate-400 rounded-full transition-all duration-300"
                            style={{ width: getMetricBarWidth(m.val) }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Key Strengths & Weaknesses */}
                    {analysisResult.versionA.strengths?.length > 0 && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-1">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase block">Strengths:</span>
                        <ul className="list-disc list-inside text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5">
                          {analysisResult.versionA.strengths.slice(0, 2).map((s, idx) => (
                            <li key={idx} className="truncate">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Actual Prompt Content Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Actual Content ({compareMode === 'versions' ? `Version ${objA?.version || 'v1.0'}` : promptAObj?.title})
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopyVariant(contentA, 'Variant A')}
                      className="text-xs text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 transition cursor-pointer"
                    >
                      {copiedPanel === 'Variant A' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedPanel === 'Variant A' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg font-mono text-xs text-slate-800 dark:text-slate-200 max-h-56 overflow-y-auto leading-relaxed border border-slate-200 dark:border-slate-700 whitespace-pre-wrap select-all">
                    {contentA || 'No prompt instructions found.'}
                  </div>
                </div>
              </div>

              {/* Token and Metrics Footer */}
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span>Payload: {contentA.length} chars • ~{Math.ceil(contentA.length / 4)} tokens</span>
                <span className="text-[10px] text-slate-400">Evaluated via {aiModel}</span>
              </div>
            </div>

            {/* RIGHT: Variant B */}
            <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800/80 rounded-xl p-5 space-y-4 shadow-sm flex flex-col justify-between">
              <div className="space-y-4">
                {/* Header & Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-700">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider block">Variant B</span>
                    <span className="text-base font-mono font-bold text-slate-900 dark:text-white truncate block">
                      {compareMode === 'versions' ? `Version ${objB?.version || 'v1.0'}` : promptBObj?.title}
                    </span>
                  </div>

                  {compareMode === 'versions' ? (
                    <select
                      value={versionB}
                      onChange={(e) => setVersionB(e.target.value)}
                      className="h-9 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-blue-600 dark:text-blue-400 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer self-start sm:self-auto"
                    >
                      {rawVersions.map(v => (
                        <option key={v.version} value={v.version}>Version {v.version}</option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={promptBId}
                      onChange={(e) => setPromptBId(e.target.value)}
                      className="h-9 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-blue-600 dark:text-blue-400 px-3 rounded-lg border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer max-w-full sm:max-w-[200px] self-start sm:self-auto"
                    >
                      {userPrompts.map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Score & Commit Info */}
                <div className="flex items-center justify-between bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-xs min-w-0 pr-2">
                    <span className="text-blue-700 dark:text-blue-400 font-semibold block text-[11px]">
                      {compareMode === 'versions' ? 'Commit Note' : 'Prompt Category'}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate block">
                      {compareMode === 'versions' ? (objB?.commitMessage || 'Target iteration') : (promptBObj?.category || 'General')}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">Overall Score</span>
                    {analysisResult?.versionB?.overall !== undefined ? (
                      <span className={`text-sm font-mono font-extrabold px-2.5 py-0.5 rounded border inline-block ${getScoreColor(analysisResult.versionB.overall)}`}>
                        {analysisResult.versionB.overall}/100
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">Evaluating...</span>
                    )}
                  </div>
                </div>

                {/* Detailed 5-Metric Breakdown */}
                {analysisResult?.versionB && (
                  <div className="space-y-2.5 p-3.5 bg-blue-50/40 dark:bg-blue-950/20 rounded-lg border border-blue-200/60 dark:border-blue-800/60 text-xs">
                    <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">
                      Dynamic Content Metrics
                    </span>

                    {/* Metric Rows */}
                    {[
                      { label: 'Clarity', val: analysisResult.versionB.clarity },
                      { label: 'Specificity', val: analysisResult.versionB.specificity },
                      { label: 'Completeness', val: analysisResult.versionB.completeness },
                      { label: 'Structure', val: analysisResult.versionB.structure },
                      { label: 'Efficiency', val: analysisResult.versionB.efficiency }
                    ].map((m) => (
                      <div key={m.label} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{m.label}</span>
                          <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{m.val}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-300"
                            style={{ width: getMetricBarWidth(m.val) }}
                          />
                        </div>
                      </div>
                    ))}

                    {/* Key Strengths & Weaknesses */}
                    {analysisResult.versionB.strengths?.length > 0 && (
                      <div className="pt-2 border-t border-blue-200/60 dark:border-blue-800/60 space-y-1">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase block">Strengths:</span>
                        <ul className="list-disc list-inside text-[11px] text-slate-700 dark:text-slate-300 space-y-0.5">
                          {analysisResult.versionB.strengths.slice(0, 2).map((s, idx) => (
                            <li key={idx} className="truncate">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Actual Prompt Content Preview */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Actual Content ({compareMode === 'versions' ? `Version ${objB?.version || 'v1.0'}` : promptBObj?.title})
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopyVariant(contentB, 'Variant B')}
                      className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-800 flex items-center space-x-1 px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 transition cursor-pointer"
                    >
                      {copiedPanel === 'Variant B' ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedPanel === 'Variant B' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg font-mono text-xs text-slate-800 dark:text-slate-200 max-h-56 overflow-y-auto leading-relaxed border border-slate-200 dark:border-slate-700 whitespace-pre-wrap select-all">
                    {contentB || 'No prompt instructions found.'}
                  </div>
                </div>
              </div>

              {/* Token and Metrics Footer */}
              <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span>Payload: {contentB.length} chars • ~{Math.ceil(contentB.length / 4)} tokens</span>
                <span className="text-[10px] text-slate-400">Evaluated via {aiModel}</span>
              </div>
            </div>
          </div>

          {/* DYNAMIC COMPARISON SUMMARY & RECOMMENDATION */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">AI Benchmark & Evaluation Summary</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Objective content-grounded metrics derived via {aiProvider}</p>
              </div>
            </div>

            {/* Analytical Summary Paragraph */}
            {analysisResult?.comparison?.summary ? (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700">
                {analysisResult.comparison.summary}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                {isAnalyzing ? 'Evaluating differences and formulating analytical summary...' : 'Select versions to view dynamic analytical comparison.'}
              </p>
            )}

            {/* Delta Highlights: Improvements & Regressions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-bold uppercase">
                  Improvements (Variant B vs A)
                </span>
                {analysisResult?.comparison?.improvements?.length > 0 ? (
                  <ul className="text-emerald-600 dark:text-emerald-400 font-semibold space-y-0.5">
                    {analysisResult.comparison.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{imp}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400 text-[11px]">No major advantages detected</span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-bold uppercase">
                  Regressions / Trade-offs
                </span>
                {analysisResult?.comparison?.regressions?.length > 0 ? (
                  <ul className="text-rose-600 dark:text-rose-400 font-semibold space-y-0.5">
                    {analysisResult.comparison.regressions.map((reg, idx) => (
                      <li key={idx} className="flex items-center space-x-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{reg}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>None detected (Safe)</span>
                  </span>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1">
                <span className="text-slate-500 dark:text-slate-400 block text-[11px] font-bold uppercase">
                  Recommended Action
                </span>
                <span className="text-slate-900 dark:text-white font-bold block">
                  {analysisResult?.versionB?.overall > (analysisResult?.versionA?.overall || 0)
                    ? `Deploy ${compareMode === 'versions' ? `Version ${objB?.version || 'B'}` : 'Variant B'} (Superior score)`
                    : isExactSame
                    ? 'Identical prompt instructions'
                    : `Keep ${compareMode === 'versions' ? `Version ${objA?.version || 'A'}` : 'Variant A'} as baseline`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
