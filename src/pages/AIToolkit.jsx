import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wand2,
  Sparkles,
  Zap,
  RefreshCw,
  Languages,
  Gauge,
  HelpCircle,
  ArrowRight,
  Copy,
  Check,
  X,
  Play,
  FileCode,
  ShieldCheck,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Globe,
  BarChart3,
  Tag,
  PlayCircle,
  Cpu
} from 'lucide-react';
import { AI_TOOLKIT_ITEMS } from '../data/mockData';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { AIModelSelector } from '../components/AIModelSelector';
import { testService } from '../services/testService';
import { PROMPT_GENERATOR_SYSTEM_INSTRUCTION } from '../utils/promptPolisher';

export const AIToolkit = () => {
  const { setActivePromptId } = usePrompts();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTool, setActiveTool] = useState(null);
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTimerRef = useRef(null);
  const activeToolkitControllerRef = useRef(null);
  const toolkitRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      if (activeToolkitControllerRef.current) {
        activeToolkitControllerRef.current.abort();
      }
    };
  }, []);

  // AI Provider & Model Settings
  const [aiProvider, setAiProvider] = useState('Google Gemini');
  const [aiModel, setAiModel] = useState('gemini-3.6-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);

  // Specialized Tool Options
  const [translateTargetLang, setTranslateTargetLang] = useState('Spanish');
  const [auditScoreData, setAuditScoreData] = useState(null);
  const [optimizerReportData, setOptimizerReportData] = useState(null);
  const [optimizationMode, setOptimizationMode] = useState('smart'); // 'economy' | 'quality' | 'smart'

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'Sparkles': return Sparkles;
      case 'Zap': return Zap;
      case 'RefreshCw': return RefreshCw;
      case 'Languages': return Languages;
      case 'Gauge': return Gauge;
      case 'HelpCircle': return HelpCircle;
      default: return Wand2;
    }
  };

  const handleOpenTool = (tool) => {
    if (activeToolkitControllerRef.current) {
      activeToolkitControllerRef.current.abort();
    }
    setActiveTool(tool);
    setInputText('');
    setOutputText('');
    setAuditScoreData(null);
    setOptimizerReportData(null);
    setOptimizationMode('smart');
    setIsProcessing(false);
  };

  const handleProcess = async () => {
    if (!inputText.trim()) {
      showToast({
        title: 'Input Required',
        message: 'Please enter a prompt concept or instructions to process.',
        type: 'error'
      });
      return;
    }

    if (activeToolkitControllerRef.current) {
      activeToolkitControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeToolkitControllerRef.current = controller;
    const currentRequestId = ++toolkitRequestIdRef.current;

    setIsProcessing(true);
    setOutputText('');
    setAuditScoreData(null);
    setOptimizerReportData(null);

    // Formulate system prompt for this tool
    let systemInstruction = "You are an AI Prompt Engineering Specialist.";
    if (activeTool.id === 'tool-gen') {
      systemInstruction = PROMPT_GENERATOR_SYSTEM_INSTRUCTION;
    } else if (activeTool.id === 'tool-opt') {
      systemInstruction = `You are a Senior Prompt Optimization Specialist.

The user's prompt may contain rough phrasing, typographical errors, or filler words.
First understand the core intent. Correct spelling and grammar mistakes.
Refactor the provided prompt to remove ambiguity, eliminate filler tokens, and enforce deterministic execution (${optimizationMode} mode) without inventing unrequested requirements.`;
    } else if (activeTool.id === 'tool-rewrite') {
      systemInstruction = `You are an AI Prompt Format Adapter.

First understand the user's intended prompt, correcting any obvious typographical or grammar errors.
Rewrite the input prompt using structured tags, clear negative constraints, and precise schema definitions while preserving exact intent.`;
    } else if (activeTool.id === 'tool-trans') {
      systemInstruction = `You are a Technical Localization Specialist. Translate the provided prompt into ${translateTargetLang} while correcting obvious source typos and preserving nuanced terminology, system variables, and operational constraints.`;
    } else if (activeTool.id === 'tool-score') {
      systemInstruction = `You are an AI Prompt Quality Evaluator. Analyze the provided prompt across 5 dimensions: Clarity, Specificity, Token Economy, Hallucination Guardrails, and Determinism. Output a structured scorecard.`;
    } else if (activeTool.id === 'tool-explain') {
      systemInstruction = `You are an AI Systems Explainer. Deconstruct the architectural design, persona anchoring, and latent constraints of the provided prompt step-by-step.`;
    }

    try {
      const res = await testService.runTest({
        promptContent: systemInstruction,
        inputText: inputText.trim(),
        provider: aiProvider,
        model: aiModel,
        temperature,
        maxTokens
      }, { signal: controller.signal });

      if (toolkitRequestIdRef.current !== currentRequestId) return;

      if (res.status === 'success') {
        setOutputText(res.outputText);
        showToast({
          title: 'Processing Complete',
          message: `${activeTool.title} processed via ${aiModel}.`,
          type: 'success'
        });
      } else {
        const errorMsg = `### ⚠️ AI Provider Status: ${res.provider} (${res.model})
${res.errorMessage || 'AI provider is not configured or offline.'}

---

**Execution Diagnostics**:
- **Tool**: ${activeTool.title}
- **Status**: \`${res.status}\`
- **Available AI Providers**: Google Gemini, Groq, OpenRouter, Mistral AI

*Note: In compliance with PromptCommit standards, outputs are never fabricated. Ensure the selected AI provider API key is configured.*`;
        setOutputText(errorMsg);
        showToast({
          title: res.status === 'unconfigured' ? 'Provider Offline' : 'Error',
          message: res.errorMessage || 'AI provider is not configured.',
          type: 'warning'
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        // Cancelled intentionally - do not set error state
        return;
      }
      if (toolkitRequestIdRef.current !== currentRequestId) return;
      setOutputText(`### ❌ Backend Error\n\n${err.message}`);
      showToast({
        title: 'Backend Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      if (toolkitRequestIdRef.current === currentRequestId) {
        setIsProcessing(false);
      }
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    showToast({
      title: 'Copied to Clipboard!',
      message: 'Generated prompt copied successfully.',
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const handleCheckInPlayground = () => {
    // Navigate to playground with this prompt to test directly
    sessionStorage.setItem('pc_playground_draft', outputText);
    setActiveTool(null);
    navigate('/app/playground');
    showToast({
      title: 'Opening Playground',
      message: 'Generated prompt loaded for live execution.',
      type: 'info'
    });
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              AI Prompt Toolkit
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 whitespace-nowrap flex-shrink-0 inline-flex items-center">
              6 Intelligent Utilities
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Specialized utilities to generate, optimize, adapt, score, and translate prompts across AI providers.
          </p>
        </div>
      </div>

      {/* Global AI Engine Selector */}
      <AIModelSelector
        provider={aiProvider}
        onProviderChange={setAiProvider}
        model={aiModel}
        onModelChange={setAiModel}
        temperature={temperature}
        onTemperatureChange={setTemperature}
        tokens={maxTokens}
        onTokensChange={setMaxTokens}
        status="Ready"
      />

      {/* 6 Attractive Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {AI_TOOLKIT_ITEMS.map((tool) => {
          const Icon = getIcon(tool.icon);
          return (
            <div
              key={tool.id}
              className="bg-white dark:bg-[#111827]/90 hover:bg-slate-50 dark:hover:bg-[#151e32] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-3xl p-6 sm:p-7 flex flex-col justify-between shadow-card transition-all duration-200 group"
            >
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tool.bg} shadow-sm`}>
                    <Icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    {tool.tag}
                  </span>
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  {tool.title}
                </h3>

                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  {tool.description}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={() => handleOpenTool(tool)}
                  className="w-full py-3 bg-slate-50 dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-500/10 text-slate-800 dark:text-slate-200 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-500/30 transition flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                >
                  <span>Open Tool</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Tool Modal */}
      {activeTool && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setActiveTool(null)}
        >
          <div
            className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 max-w-2xl w-full space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTool.bg}`}>
                  {React.createElement(getIcon(activeTool.icon), { className: `w-5 h-5 ${activeTool.color}` })}
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">{activeTool.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Powered by {aiProvider} ({aiModel})</p>
                </div>
              </div>
              <button
                onClick={() => setActiveTool(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* In-Modal AI Engine Selector (Compact & Slim) */}
            <AIModelSelector
              provider={aiProvider}
              onProviderChange={setAiProvider}
              model={aiModel}
              onModelChange={setAiModel}
              temperature={temperature}
              onTemperatureChange={setTemperature}
              tokens={maxTokens}
              onTokensChange={setMaxTokens}
              status="Ready"
              compact={true}
            />

            {/* Input Box */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                {activeTool.id === 'tool-gen' ? 'Prompt Concept / Feature Goal *' : 'Prompt Content to Process *'}
              </label>
              <textarea
                rows={3}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={activeTool.placeholder}
                className="w-full bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:outline-none"
              />

              {/* Specialized Options for Prompt Optimizer */}
              {activeTool.id === 'tool-opt' && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Response Optimization Mode
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setOptimizationMode('economy')}
                      className={`p-3 rounded-xl text-left border transition flex flex-col justify-between cursor-pointer ${optimizationMode === 'economy'
                          ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30 text-amber-900 dark:text-amber-300 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      <div className="text-xs font-extrabold mb-1">⚡ Economy</div>
                      <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">Less Tokens</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Concise & Fast</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptimizationMode('quality')}
                      className={`p-3 rounded-xl text-left border transition flex flex-col justify-between cursor-pointer ${optimizationMode === 'quality'
                          ? 'bg-indigo-500/15 border-indigo-500 ring-2 ring-indigo-500/30 text-indigo-900 dark:text-indigo-300 shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      <div className="text-xs font-extrabold mb-1">💎 Quality</div>
                      <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">More Tokens</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Maximum Detail</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setOptimizationMode('smart')}
                      className={`p-3 rounded-lg text-left border transition flex flex-col justify-between cursor-pointer ${optimizationMode === 'smart'
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-slate-900 dark:text-white shadow-sm'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                      <div className="text-xs font-bold mb-1 text-blue-600 dark:text-blue-400">⭐ Smart Optimize</div>
                      <div className="text-[11px] font-semibold text-slate-900 dark:text-slate-100">Fewer Tokens</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Recommended</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Specialized Options for Translator */}
              {activeTool.id === 'tool-trans' && (
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Target Language
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {['Spanish', 'French', 'German', 'Hindi', 'Japanese'].map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setTranslateTargetLang(lang)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${translateTargetLang === lang
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleProcess}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isProcessing ? 'Processing with AI...' : `Execute ${activeTool.title}`}</span>
              </button>
            </div>

            {/* Optimizer Report Summary */}
            {optimizerReportData && (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Compression & Token Efficiency</span>
                  <span className="text-blue-600 dark:text-blue-400 font-mono">
                    ~{optimizerReportData.optTokens} tokens (-{optimizerReportData.savings}%)
                  </span>
                </div>
              </div>
            )}

            {/* Output Box */}
            {outputText && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Generated Output ({aiModel})
                  </label>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 transition cursor-pointer font-medium"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied to Clipboard' : 'Copy Output'}</span>
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-[#F9FAFB] font-mono text-xs p-3.5 rounded-lg border border-slate-200 dark:border-[#374151] whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed select-all">
                  {outputText}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTool(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Close
              </button>

              {outputText && (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1 cursor-pointer shadow-sm"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Output'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCheckInPlayground}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm flex items-center space-x-1.5 transition cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Check / Test Prompt</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
