import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Settings2,
  Cpu,
  Sliders,
  FileText,
  FileCode,
  Image as ImageIcon,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Lock,
  Upload,
  Paperclip,
  Trash2,
  Eye,
  FileCheck,
  Globe,
  PlayCircle,
  RotateCcw,
  AlertCircle
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { AIModelSelector } from '../components/AIModelSelector';
import { testService } from '../services/testService';
import { isCapabilitySupported } from '../data/aiProviders';

// Default Sample Binary File Generators
const createSampleImageFile = () => {
  const SAMPLE_PNG_BYTES = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
    0x42, 0x60, 0x82
  ]);
  return new File([SAMPLE_PNG_BYTES], 'Sample_Dashboard_Wireframe.png', { type: 'image/png' });
};

const createSamplePdfFile = () => {
  const SAMPLE_PDF_TEXT = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 120 >> stream
BT
/F1 12 Tf
72 712 Td
(Attention Is All You Need: Research paper on Transformer architecture and Multi-Head Attention mechanisms.) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000260 00000 n 
0000000430 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
510
%%EOF`;
  return new File([SAMPLE_PDF_TEXT], 'Sample_Research_Attention_Mechanism.pdf', { type: 'application/pdf' });
};

export const Playground = () => {
  const { userPrompts, activePrompt, setActivePromptId, logPromptTest } = usePrompts();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [selectedPromptId, setSelectedPromptId] = useState(activePrompt?.id || (userPrompts[0]?.id || ''));
  const currentPromptObj = userPrompts.find(p => p.id === selectedPromptId) || userPrompts[0];

  const [promptText, setPromptText] = useState(currentPromptObj?.content || '');

  // AI Provider & Model selection (Google Gemini, Groq, OpenRouter, Mistral AI)
  const [selectedProvider, setSelectedProvider] = useState('Google Gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);

  // Check if draft was passed from AI Toolkit
  useEffect(() => {
    const draft = sessionStorage.getItem('pc_playground_draft');
    if (draft) {
      setPromptText(draft);
      sessionStorage.removeItem('pc_playground_draft');
    }
  }, []);

  // Multimedia Asset States (Text, Image, PDF, Code)
  const [activeAssetTab, setActiveAssetTab] = useState('Text');
  const [testInput, setTestInput] = useState('');

  // PDF Asset State
  const [pdfFileState, setPdfFileState] = useState(() => ({
    file: createSamplePdfFile(),
    name: 'Sample_Research_Attention_Mechanism.pdf',
    size: '1.4 MB',
    pages: 12,
    isSample: true
  }));

  // Image Asset State
  const [imageFileState, setImageFileState] = useState(() => ({
    file: createSampleImageFile(),
    name: 'Sample_Dashboard_Wireframe.png',
    preview: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
    size: '820 KB',
    isSample: true,
    isObjectUrl: false
  }));

  // Code Asset State
  const [codeLanguage, setCodeLanguage] = useState('JavaScript');
  const [codeSnippet, setCodeSnippet] = useState(`function calculateUserMetrics(orders) {
  return orders.reduce((acc, order) => {
    acc.total += order.amount;
    acc.count += 1;
    return acc;
  }, { total: 0, count: 0 });
}`);

  const [isRunning, setIsRunning] = useState(false);
  const [aiOutput, setAiOutput] = useState('');
  const [outputStats, setOutputStats] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const imageInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const copyTimerRef = useRef(null);
  const copyPromptTimerRef = useRef(null);
  const activeTestControllerRef = useRef(null);
  const testRequestIdRef = useRef(0);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      if (copyPromptTimerRef.current) clearTimeout(copyPromptTimerRef.current);
      if (activeTestControllerRef.current) activeTestControllerRef.current.abort();

      if (imageFileState?.isObjectUrl && imageFileState?.preview) {
        URL.revokeObjectURL(imageFileState.preview);
      }
    };
  }, []);

  // Handle prompt switch
  const handlePromptChange = (pId) => {
    setSelectedPromptId(pId);
    setActivePromptId(pId);
    const p = userPrompts.find(x => x.id === pId);
    if (p) {
      setPromptText(p.content);
      const lower = p.title.toLowerCase();
      if (lower.includes('email') || lower.includes('marketing') || lower.includes('faculty')) {
        setTestInput('User Request: Draft an email to the faculty regarding attendance correction.');
      } else if (lower.includes('bug') || lower.includes('error') || lower.includes('review')) {
        setTestInput('Bug Report: Scroll position remains at bottom after switching pages in React Router.');
      } else if (lower.includes('sql') || lower.includes('database')) {
        setTestInput('Input query: "Find top 5 customers by total spend in 2025 who made more than 3 orders"');
      } else {
        setTestInput(`Test input query for "${p.title}"`);
      }
    }
  };

  // Image Upload Handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imageFileState?.isObjectUrl && imageFileState?.preview) {
        URL.revokeObjectURL(imageFileState.preview);
      }
      const previewUrl = URL.createObjectURL(file);
      setImageFileState({
        file: file,
        name: file.name,
        preview: previewUrl,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        isSample: false,
        isObjectUrl: true
      });
    }
  };

  // PDF Upload Handler
  const handlePdfUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFileState({
        file: file,
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        pages: null,
        isSample: false
      });
    }
  };

  const handleRemoveImage = () => {
    if (imageFileState?.isObjectUrl && imageFileState?.preview) {
      URL.revokeObjectURL(imageFileState.preview);
    }
    setImageFileState(null);
  };

  const handleRemovePdf = () => {
    setPdfFileState(null);
  };

  const handleRunTest = async () => {
    const trimmedPrompt = (promptText || '').trim();
    const trimmedInput = (testInput || '').trim();

    if (!trimmedPrompt && !trimmedInput && activeAssetTab === 'Text') {
      showToast({
        title: 'Input Required',
        message: 'Please enter a prompt or test input before running the test.',
        type: 'warning'
      });
      return;
    }

    if (activeTestControllerRef.current) {
      activeTestControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeTestControllerRef.current = controller;
    const currentRequestId = ++testRequestIdRef.current;

    setIsRunning(true);
    setAiOutput('');
    setOutputStats(null);

    // Formulate payload arguments according to active asset tab
    let inputType = 'text';
    let fileToAttach = null;
    let codeContentToAttach = null;
    let codeLangToAttach = null;

    if (activeAssetTab === 'Image' && imageFileState?.file) {
      inputType = 'image';
      fileToAttach = imageFileState.file;
    } else if (activeAssetTab === 'PDF' && pdfFileState?.file) {
      inputType = 'pdf';
      fileToAttach = pdfFileState.file;
    } else if (activeAssetTab === 'Code' && codeSnippet?.trim()) {
      inputType = 'code';
      codeContentToAttach = codeSnippet.trim();
      codeLangToAttach = codeLanguage;
    }

    try {
      const res = await testService.runTest({
        promptId: selectedPromptId || null,
        promptContent: promptText,
        inputText: testInput,
        provider: selectedProvider,
        model: selectedModel,
        temperature,
        maxTokens,
        inputType,
        file: fileToAttach,
        codeSnippet: codeContentToAttach,
        codeLanguage: codeLangToAttach
      }, { signal: controller.signal });

      if (testRequestIdRef.current !== currentRequestId) return;

      if (res.status === 'success') {
        const estimatedTokens = Math.ceil((res.outputText || '').length / 4);
        setAiOutput(res.outputText);
        setOutputStats({
          model: res.model,
          provider: res.provider,
          latency: `${res.responseTimeMs}ms`,
          tokens: estimatedTokens,
          cost: 'Cost unavailable'
        });
        showToast({
          title: 'Test Completed!',
          message: `Inference returned in ${res.responseTimeMs}ms.`,
          type: 'success'
        });
      } else {
        const isMultimodalErr = res.code === 'MULTIMODAL_NOT_SUPPORTED';
        const notice = `### ⚠️ ${isMultimodalErr ? 'Multimodal Capability Error' : 'AI Provider Status'}: ${res.provider} (${res.model})
${res.errorMessage || 'AI provider is not configured or offline.'}

---

**Execution Diagnostics**:
- **Status**: \`${res.status}\`
- **Error Code**: \`${res.code || 'PROVIDER_ERROR'}\`
- **Measured Roundtrip**: \`${res.responseTimeMs}ms\`
- **Target Model**: \`${res.model}\`
- **Submitted Asset Type**: \`${inputType}\`

*Note: PromptCommit enforces strict capability validation. If a model does not natively support a multimedia type (e.g. image vision), a structured capability status is returned.*`;

        setAiOutput(notice);
        setOutputStats({
          model: res.model,
          provider: res.provider,
          latency: `${res.responseTimeMs}ms`,
          tokens: 0,
          cost: 'Cost unavailable'
        });
        showToast({
          title: isMultimodalErr ? 'Unsupported Input Type' : 'Execution Error',
          message: res.errorMessage || 'AI provider returned an error.',
          type: 'warning'
        });
      }

      if (selectedPromptId) {
        logPromptTest(selectedPromptId, selectedModel, res.responseTimeMs);
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        return;
      }
      if (testRequestIdRef.current !== currentRequestId) return;
      setAiOutput(`### ❌ Error Connecting to Backend\n\n${err.message}`);
      showToast({
        title: 'Backend Error',
        message: err.message,
        type: 'error'
      });
    } finally {
      if (testRequestIdRef.current === currentRequestId) {
        setIsRunning(false);
      }
    }
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(aiOutput);
    setCopied(true);
    showToast({
      title: 'Copied to Clipboard!',
      message: 'AI response payload copied.',
      type: 'info'
    });
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPromptText = () => {
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    showToast({
      title: 'Prompt Instructions Copied!',
      message: 'Copied prompt content to clipboard.',
      type: 'info'
    });
    if (copyPromptTimerRef.current) clearTimeout(copyPromptTimerRef.current);
    copyPromptTimerRef.current = setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleResetPrompt = () => {
    if (currentPromptObj) {
      setPromptText(currentPromptObj.content);
    }
    // Restore default sample files cleanly
    if (imageFileState?.isObjectUrl && imageFileState?.preview) {
      URL.revokeObjectURL(imageFileState.preview);
    }
    setImageFileState({
      file: createSampleImageFile(),
      name: 'Sample_Dashboard_Wireframe.png',
      preview: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
      size: '820 KB',
      isSample: true,
      isObjectUrl: false
    });
    setPdfFileState({
      file: createSamplePdfFile(),
      name: 'Sample_Research_Attention_Mechanism.pdf',
      size: '1.4 MB',
      pages: 12,
      isSample: true
    });
    showToast({
      title: 'Playground Reset',
      message: 'Restored original prompt and multimedia sample assets.',
      type: 'info'
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center flex-wrap gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Prompt Playground & Testing
            </h1>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 whitespace-nowrap">
              Live Test Execution
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Execute, benchmark, and check prompts with <strong>Text, PDF, Photo, and Code</strong> inputs.
          </p>
        </div>

        {/* Selected Prompt Dropdown */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:inline whitespace-nowrap">
            Active Prompt:
          </label>
          <select
            value={selectedPromptId}
            onChange={(e) => handlePromptChange(e.target.value)}
            className="w-full sm:w-auto h-11 bg-white dark:bg-slate-900 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white px-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:outline-none cursor-pointer shadow-sm truncate"
          >
            {userPrompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.version})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TOP CONTROLS BAR: AI Provider & Model Selector */}
      <div className="space-y-2">
        <AIModelSelector
          provider={selectedProvider}
          onProviderChange={setSelectedProvider}
          model={selectedModel}
          onModelChange={setSelectedModel}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          tokens={maxTokens}
          onTokensChange={setMaxTokens}
          status="Ready"
        />
        <div className="flex items-center justify-between text-[11px] text-slate-400 px-2">
          <span>Supports Google Gemini, Groq, OpenRouter, and Mistral AI.</span>
          <span className="font-mono">Engine: {selectedProvider} / {selectedModel}</span>
        </div>
      </div>

      {/* TWO EQUAL LARGE PANELS: Left Editor & Right Response */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: Prompt Editor & MULTIMEDIA Test Assets */}
        <div className="bg-white dark:bg-[#111827]/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 flex flex-col justify-between shadow-card min-h-[520px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Prompt Instructions</span>
              </label>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleCopyPromptText}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md transition"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                </button>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {promptText.length} chars (~{Math.ceil(promptText.length / 4)} est. tokens)
                </span>
              </div>
            </div>

            <textarea
              rows={9}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950/90 text-sm font-mono text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 focus:outline-none transition leading-relaxed"
              placeholder="Enter system prompt instructions..."
            />

            {/* MULTIMEDIA TEST ASSETS SUITE */}
            <div className="pt-3.5 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Attach Test Asset (Multimedia):</span>
                </span>
                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  {[
                    { id: 'Text', label: 'Query', icon: FileText },
                    { id: 'Image', label: 'Image', icon: ImageIcon },
                    { id: 'PDF', label: 'PDF', icon: FileSpreadsheet },
                    { id: 'Code', label: 'Code', icon: FileCode }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeAssetTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveAssetTab(tab.id)}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer ${
                          isActive
                            ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 1. TEXT QUERY INPUT */}
              {activeAssetTab === 'Text' && (
                <div className="space-y-1.5 animate-in fade-in duration-150">
                  <textarea
                    rows={4}
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Optional: enter test input, or leave empty to test the prompt directly."
                    className="w-full bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-200 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none transition leading-relaxed"
                  />
                </div>
              )}

              {/* 2. IMAGE / PHOTO ASSET */}
              {activeAssetTab === 'Image' && (() => {
                const isImgSupported = isCapabilitySupported(selectedProvider, selectedModel, 'image');
                return (
                  <div className="space-y-3 animate-in fade-in duration-150">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {/* Dynamic Provider Capability Status Banner */}
                    <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between border ${
                      isImgSupported
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      <div className="flex items-center space-x-1.5">
                        {isImgSupported ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                        )}
                        <span>{selectedProvider} → {isImgSupported ? 'Image Supported' : 'Image Not Supported'}</span>
                      </div>
                      <span className="font-mono text-[10px] opacity-80">{selectedModel}</span>
                    </div>

                    {imageFileState ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                        <div className="flex items-center space-x-3 min-w-0">
                          <img
                            src={imageFileState.preview}
                            alt="Asset preview"
                            className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-xs flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {imageFileState.name}
                              </span>
                              {imageFileState.isSample ? (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                                  Sample Image
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded">
                                  User Upload
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                              <span>{imageFileState.size}</span>
                              <span>•</span>
                              <span className={isImgSupported ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-amber-600 dark:text-amber-400 font-medium"}>
                                {isImgSupported ? "Vision Ready" : "Image Vision Unsupported"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                          >
                            <Upload className="w-3 h-3" />
                            <span>Replace</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => imageInputRef.current?.click()}
                        className="p-6 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition"
                      >
                        <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Click to upload an image asset
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          Supports PNG, JPG, WebP, GIF (Vision Models)
                        </div>
                      </div>
                    )}

                    <input
                      type="text"
                      value={testInput}
                      onChange={(e) => setTestInput(e.target.value)}
                      placeholder="Optional query on image (e.g. 'Extract UI elements and assess design tokens')..."
                      className="w-full bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-200 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:outline-none transition"
                    />
                  </div>
                );
              })()}


              {/* 3. PDF / DOCUMENT ASSET */}
              {activeAssetTab === 'PDF' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.txt,.doc,.docx"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />

                  {pdfFileState ? (
                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 border border-red-200 dark:border-red-800 flex items-center justify-center flex-shrink-0">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              {pdfFileState.name}
                            </span>
                            {pdfFileState.isSample ? (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded">
                                Sample Document
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 rounded">
                                User Upload
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                            <span>{pdfFileState.size}</span>
                            <span>•</span>
                            <span>{pdfFileState.pages ? `${pdfFileState.pages} Pages` : 'Document Attached'}</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => pdfInputRef.current?.click()}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                        >
                          <Upload className="w-3 h-3" />
                          <span>Replace</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRemovePdf}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => pdfInputRef.current?.click()}
                      className="p-6 bg-slate-50 dark:bg-slate-950 border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition"
                    >
                      <FileSpreadsheet className="w-8 h-8 text-slate-400 mb-2" />
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Click to upload a document / PDF
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Supports PDF, TXT, DOCX
                      </div>
                    </div>
                  )}

                  <input
                    type="text"
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Optional query on document (e.g. 'Summarize technical architecture in 3 points')..."
                    className="w-full bg-slate-50 dark:bg-slate-950 text-xs font-mono text-slate-900 dark:text-slate-200 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 focus:border-blue-600 focus:outline-none transition"
                  />
                </div>
              )}

              {/* 4. CODE SNIPPET ASSET */}
              {activeAssetTab === 'Code' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono px-1">
                    <span>Code Snippet Asset (Attached to inference)</span>
                    <div className="flex items-center space-x-2">
                      <span>Language:</span>
                      <select
                        value={codeLanguage}
                        onChange={(e) => setCodeLanguage(e.target.value)}
                        className="bg-slate-800 text-cyan-400 px-2 py-0.5 rounded border border-slate-700 text-[11px] focus:outline-none"
                      >
                        {['JavaScript', 'Python', 'TypeScript', 'HTML', 'CSS', 'SQL', 'JSON', 'Go', 'Rust', 'Java'].map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <textarea
                    rows={5}
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                    placeholder="Paste code snippet to test with prompt..."
                    className="w-full bg-slate-900 text-xs font-mono text-cyan-300 p-3 rounded-xl border border-slate-700 focus:border-cyan-500 focus:outline-none leading-relaxed"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action Row - Pure Test Execution */}
          <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={handleResetPrompt}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1.5 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Original</span>
            </button>

            <button
              type="button"
              disabled={isRunning || (!promptText?.trim() && !testInput?.trim() && activeAssetTab === 'Text')}
              onClick={handleRunTest}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
              <span>{isRunning ? 'Executing...' : 'Run Test'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Live AI Output Preview */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 flex flex-col justify-between shadow-sm min-h-[500px]">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Live AI Output Preview</span>
              </label>
              {aiOutput && (
                <button
                  type="button"
                  onClick={handleCopyOutput}
                  className="text-xs text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 flex items-center space-x-1 bg-slate-50 dark:bg-slate-700/60 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600 transition cursor-pointer font-medium"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Output'}</span>
                </button>
              )}
            </div>

            {aiOutput ? (
              <div className="bg-slate-50 dark:bg-[#111827] text-slate-900 dark:text-[#F9FAFB] font-mono text-xs p-4 rounded-xl border border-slate-200 dark:border-[#374151] whitespace-pre-wrap max-h-[380px] overflow-y-auto leading-relaxed select-all">
                {aiOutput}
              </div>
            ) : (
              <div className="h-[320px] flex flex-col items-center justify-center text-center p-6 text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <PlayCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-2.5" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Click "Run Test" to generate AI output.
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                  Supports Google Gemini, Groq, OpenRouter, and Mistral AI.
                </p>
              </div>
            )}
          </div>

          {/* Telemetry Output Stats Footer */}
          {outputStats && (
            <div className="pt-3.5 mt-3.5 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Model: <strong className="text-slate-700 dark:text-slate-200">{outputStats.model}</strong></span>
              <span>Latency: <strong className="text-blue-600 dark:text-blue-400 font-mono">{outputStats.latency}</strong></span>
              <span>Tokens: <strong className="text-slate-700 dark:text-slate-200 font-mono">~{outputStats.tokens} (est.)</strong></span>
              <span className="hidden sm:inline text-slate-400 italic">Cost: Not calculated</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
