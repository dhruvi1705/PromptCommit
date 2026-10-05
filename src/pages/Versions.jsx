import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  GitCommit,
  RotateCcw,
  Plus,
  Trash2,
  Lock,
  Copy,
  Check,
  Eye,
  GitCompare,
  Clock,
  User,
  AlertTriangle,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
  Loader2
} from 'lucide-react';
import { usePrompts } from '../context/PromptContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/dateFormatter';
import { AIModelSelector } from '../components/AIModelSelector';
import { promptService } from '../services/promptService';

export const Versions = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const {
    userPrompts,
    activePrompt,
    setActivePromptId,
    addVersion,
    restoreVersion,
    deletePrompt
  } = usePrompts();
  const { showToast } = useToast();

  const selectedPrompt = activePrompt || userPrompts[0];

  // Modals state
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [viewVersionModal, setViewVersionModal] = useState(null);
  const [restoreConfirmModal, setRestoreConfirmModal] = useState(null);
  const [showDeletePromptModal, setShowDeletePromptModal] = useState(false);

  // New Version Form State
  const [versionTag, setVersionTag] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [commitDesc, setCommitDesc] = useState('');
  const [newContent, setNewContent] = useState('');
  const [copiedVer, setCopiedVer] = useState(null);
  const [restoreSuccess, setRestoreSuccess] = useState(null);

  // AI Model Selection & Generation State for Version Flow
  const [selectedProvider, setSelectedProvider] = useState('gemini');
  const [selectedModel, setSelectedModel] = useState('gemini-3.6-flash');
  const [isGenerating, setIsGenerating] = useState(false);
  const activeGenerateControllerRef = useRef(null);
  const generateRequestIdRef = useRef(0);

  const copyTimerRef = useRef(null);

  // Synchronize preselected model when selectedPrompt changes or modal opens
  useEffect(() => {
    if (selectedPrompt) {
      if (selectedPrompt.provider) {
        setSelectedProvider(selectedPrompt.provider);
      } else {
        setSelectedProvider('gemini');
      }
      if (selectedPrompt.target_model || selectedPrompt.model) {
        setSelectedModel(selectedPrompt.target_model || selectedPrompt.model);
      } else {
        setSelectedModel('gemini-3.6-flash');
      }
    }
  }, [selectedPrompt, showNewVersionModal]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      if (activeGenerateControllerRef.current) {
        activeGenerateControllerRef.current.abort();
      }
    };
  }, []);

  if (!selectedPrompt) {
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-10 text-center max-w-lg mx-auto space-y-4 shadow-sm">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-100 dark:border-blue-900">
          <GitBranch className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Prompts in Vault</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Create a prompt to start logging versions and commit history.
        </p>
        <button
          onClick={() => navigate('/app/create')}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
        >
          Create Prompt
        </button>
      </div>
    );
  }

  const versionsList = selectedPrompt.versions && selectedPrompt.versions.length > 0
    ? selectedPrompt.versions
    : [
        {
          version: selectedPrompt.version || 'v1.0',
          commitMessage: 'Initial Baseline Commit',
          description: selectedPrompt.description || 'Initial system prompt structure.',
          content: selectedPrompt.content || '',
          timestamp: selectedPrompt.updatedAt || selectedPrompt.createdAt,
          author: selectedPrompt.ownerName || currentUser?.name || 'Unknown author',
          isCurrent: true
        }
      ];

  const handlePromptChange = (promptId) => {
    setActivePromptId(promptId);
    setRestoreSuccess(null);
  };

  const handleCopyText = (content, label) => {
    navigator.clipboard.writeText(content);
    setCopiedVer(label);
    showToast({
      title: 'Copied to Clipboard!',
      message: `Prompt content for "${label}" copied.`,
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopiedVer(null), 2000);
  };

  const handleGenerateWithAI = async () => {
    if (activeGenerateControllerRef.current) {
      activeGenerateControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeGenerateControllerRef.current = controller;
    const currentReqId = ++generateRequestIdRef.current;

    setIsGenerating(true);

    try {
      const res = await promptService.generatePrompt({
        title: selectedPrompt?.title || 'Prompt Version Iteration',
        description: commitDesc || selectedPrompt?.description || '',
        category: selectedPrompt?.category || 'General',
        provider: selectedProvider,
        model: selectedModel
      }, { signal: controller.signal });

      if (generateRequestIdRef.current !== currentReqId) return;

      if (res && res.status === 'success' && res.prompt) {
        setNewContent(res.prompt);
        showToast({
          title: 'AI Generation Complete',
          message: `Generated version content using ${res.provider || selectedProvider} (${res.model || selectedModel}).`,
          type: 'success'
        });
      } else {
        const errorMsg = res?.errorMessage || res?.error || 'Unable to generate prompt right now. Please try another provider or retry.';
        showToast({
          title: 'AI Generation Notice',
          message: errorMsg,
          type: 'warning'
        });
      }
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return;
      showToast({
        title: 'AI Generation Failed',
        message: err.message || 'Generation request failed. Try selecting another model.',
        type: 'error'
      });
    } finally {
      if (generateRequestIdRef.current === currentReqId) {
        setIsGenerating(false);
      }
    }
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    if (!commitMessage.trim() || !newContent.trim()) {
      showToast({
        title: 'Validation Error',
        message: 'Commit message and prompt content are required.',
        type: 'error'
      });
      return;
    }

    try {
      await addVersion(selectedPrompt.id, {
        versionTag: versionTag.trim() || undefined,
        commitMessage: commitMessage.trim(),
        description: commitDesc.trim() || 'Updated prompt iteration.',
        content: newContent,
        provider: selectedProvider,
        model: selectedModel
      });

      setShowNewVersionModal(false);
      setVersionTag('');
      setCommitMessage('');
      setCommitDesc('');
      setNewContent('');

      showToast({
        title: 'Version Committed!',
        message: `Saved new version commit to "${selectedPrompt.title}".`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Error Saving Version',
        message: err.message || 'Could not save version to database.',
        type: 'error'
      });
    }
  };

  const handleRestoreVersion = async (versionObj) => {
    try {
      await restoreVersion(selectedPrompt.id, versionObj.version || versionObj.id);
      setRestoreConfirmModal(null);
      setRestoreSuccess(`Restored Version ${versionObj.version} ("${versionObj.commitMessage}")`);
      showToast({
        title: 'Version Restored!',
        message: `Prompt active content rolled back to Version ${versionObj.version}.`,
        type: 'success'
      });
    } catch (err) {
      showToast({
        title: 'Error Restoring Version',
        message: err.message || 'Could not rollback version in database.',
        type: 'error'
      });
    }
  };

  const handleDeleteSelectedPrompt = async () => {
    try {
      await deletePrompt(selectedPrompt.id);
      setShowDeletePromptModal(false);
      showToast({
        title: 'Prompt Deleted',
        message: `"${selectedPrompt.title}" was permanently removed.`,
        type: 'info'
      });
      navigate('/app/prompts');
    } catch (err) {
      showToast({
        title: 'Error Deleting Prompt',
        message: err.message || 'Could not delete prompt.',
        type: 'error'
      });
    }
  };

  const handleOpenCompare = (versionToCompare) => {
    setActivePromptId(selectedPrompt.id);
    navigate('/app/compare');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Version History
            </h1>
            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 whitespace-nowrap flex-shrink-0 inline-flex items-center space-x-1">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Git-Inspired Versioning</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Track changes, compare versions, and restore previous versions of your private prompts.
          </p>
        </div>

        <button
          onClick={() => {
            setNewContent(selectedPrompt.content);
            setShowNewVersionModal(true);
          }}
          className="whitespace-nowrap flex-shrink-0 inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 sm:px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition self-start md:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4 flex-shrink-0" />
          <span>Create New Version</span>
        </button>
      </div>

      {/* Success notification */}
      {restoreSuccess && (
        <div className="p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{restoreSuccess}</span>
        </div>
      )}

      {/* PROMPT INFORMATION CARD */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Selected Prompt</span>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedPrompt.id}
              onChange={(e) => handlePromptChange(e.target.value)}
              className="text-sm font-semibold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:border-blue-600 focus:outline-none cursor-pointer max-w-md"
            >
              {userPrompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            {selectedPrompt.description}
          </p>
        </div>

        {/* Badges & Actions Cluster */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0 self-start md:self-center">
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block leading-none mb-1">Current</span>
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 block leading-none">{selectedPrompt.version}</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block leading-none mb-1">Commits</span>
            <span className="text-xs font-mono font-bold text-slate-900 dark:text-white block leading-none">{versionsList.length}</span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block leading-none mb-1">Privacy</span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center space-x-1 leading-none">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Private</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => handleCopyText(selectedPrompt.content || selectedPrompt.description, selectedPrompt.title)}
            title="Copy current prompt text"
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-1.5 text-center flex items-center space-x-1 transition cursor-pointer text-xs font-medium h-9 shadow-sm"
          >
            {copiedVer === selectedPrompt.title ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedVer === selectedPrompt.title ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeletePromptModal(true)}
            title="Delete this prompt"
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg px-3 py-1.5 text-center flex items-center space-x-1 transition cursor-pointer text-xs font-medium h-9 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* GIT COMMIT TIMELINE */}
      <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-[15px] sm:before:left-[23px] before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
        {versionsList.map((ver, idx) => {
          const isCurrent = ver.isCurrent || (idx === 0 && ver.version === selectedPrompt.version);
          return (
            <div key={idx} className="relative group">
              {/* Timeline Node Icon */}
              <div className={`absolute -left-6 sm:-left-8 top-5 w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                isCurrent
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
              }`}>
                <GitCommit className="w-3.5 h-3.5" />
              </div>

              {/* Version Card */}
              <div className={`bg-white dark:bg-slate-800 border rounded-xl p-5 transition-colors shadow-sm ${
                isCurrent
                  ? 'border-blue-200 dark:border-blue-800/80 bg-blue-50/10 dark:bg-blue-950/10'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-lg font-mono font-bold text-slate-900 dark:text-white">
                      Version {ver.version}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        CURRENT (HEAD)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <span className="flex items-center space-x-1">
                      <User className="w-3 h-3" />
                      <span>{ver.author || selectedPrompt?.ownerName || currentUser?.name || 'Unknown author'}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(ver.timestamp)}</span>
                    </span>
                  </div>
                </div>

                {/* Commit Message & Description */}
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {ver.commitMessage}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                  {ver.description}
                </p>

                {/* Diff summary notes snippet if available */}
                {ver.diffNotes && (
                  <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                    {ver.diffNotes}
                  </div>
                )}

                {/* Action Buttons: View, Compare, Restore */}
                <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-mono text-slate-400">
                    Payload: {ver.content?.length || 0} chars
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyText(ver.content, `Version ${ver.version}`)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center space-x-1 transition shadow-sm"
                    >
                      {copiedVer === `Version ${ver.version}` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedVer === `Version ${ver.version}` ? 'Copied' : 'Copy'}</span>
                    </button>

                    <button
                      onClick={() => setViewVersionModal(ver)}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center space-x-1 transition shadow-sm"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Content</span>
                    </button>

                    <button
                      onClick={() => handleOpenCompare(ver.version)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-xs font-medium flex items-center space-x-1 transition"
                    >
                      <GitCompare className="w-3 h-3" />
                      <span>Compare</span>
                    </button>

                    {!isCurrent && (
                      <button
                        onClick={() => setRestoreConfirmModal(ver)}
                        className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium flex items-center space-x-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Create New Version */}
      {showNewVersionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setShowNewVersionModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 sm:p-7 max-w-2xl w-full space-y-4 shadow-xl max-h-[80vh] overflow-y-auto my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <GitBranch className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Create New Version Commit</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Target prompt: {selectedPrompt.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNewVersionModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-600"
              >
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleCreateVersion} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Version Tag (Optional)
                  </label>
                  <input
                    type="text"
                    value={versionTag}
                    onChange={(e) => setVersionTag(e.target.value)}
                    placeholder="e.g. v2.1 (auto if blank)"
                    className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Commit Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="e.g. Added multi-step reasoning constraints"
                    className="w-full h-10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white px-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Change Description
                </label>
                <textarea
                  rows={2}
                  value={commitDesc}
                  onChange={(e) => setCommitDesc(e.target.value)}
                  placeholder="Explain why this change was made and key differences..."
                  className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none"
                />
              </div>

              {/* AI MODEL SELECTOR */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider text-[11px]">
                  AI MODEL FOR GENERATION & VERSION METADATA
                </label>
                <AIModelSelector
                  provider={selectedProvider}
                  onProviderChange={setSelectedProvider}
                  model={selectedModel}
                  onModelChange={setSelectedModel}
                  showParams={false}
                  compact={true}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    New Prompt Content *
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateWithAI}
                    disabled={isGenerating}
                    className="inline-flex items-center space-x-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={7}
                  required
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-slate-200 p-3 rounded-lg border border-slate-300 dark:border-slate-700 focus:border-blue-600 focus:ring-1 focus:ring-blue-600/20 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowNewVersionModal(false)}
                  className="px-3.5 py-1.5 font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition"
                >
                  Commit Version
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: View Version Content */}
      {viewVersionModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
          onClick={() => setViewVersionModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 max-w-2xl w-full shadow-xl max-h-[75vh] flex flex-col my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Version {viewVersionModal.version} Snapshot</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{viewVersionModal.commitMessage}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{formatDateTime(viewVersionModal.timestamp)}</span>
                <button
                  type="button"
                  onClick={() => setViewVersionModal(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition"
                  aria-label="Close Modal"
                >
                  <span className="text-base leading-none">&times;</span>
                </button>
              </div>
            </div>

            {/* Scrollable Code Content Body */}
            <div className="my-3 flex-1 min-h-0 overflow-y-auto max-h-[42vh] bg-slate-50 dark:bg-[#111827] rounded-lg p-3.5 font-mono text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-[#374151] select-all">
              {viewVersionModal.content}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleCopyText(viewVersionModal.content, `Version ${viewVersionModal.version}`)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center space-x-1 transition cursor-pointer"
              >
                {copiedVer === `Version ${viewVersionModal.version}` ? (
                  <Check className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white" />
                )}
                <span>{copiedVer === `Version ${viewVersionModal.version}` ? 'Copied!' : 'Copy Content'}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewVersionModal(null)}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Restore */}
      {restoreConfirmModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRestoreConfirmModal(null)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <RotateCcw className="w-5 h-5" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Restore Version {restoreConfirmModal.version}?</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                This will roll back the active prompt content to the state saved in:
                <strong className="text-slate-900 dark:text-slate-200 block mt-1">"{restoreConfirmModal.commitMessage}"</strong>
              </p>
            </div>

            <div className="flex items-center justify-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setRestoreConfirmModal(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRestoreVersion(restoreConfirmModal)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
              >
                Confirm Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Prompt */}
      {showDeletePromptModal && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeletePromptModal(false)}
        >
          <div
            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-2.5 text-red-600 dark:text-red-400">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">Delete Entire Prompt?</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to permanently delete <strong>"{selectedPrompt.title}"</strong> along with all <strong>{versionsList.length}</strong> commit versions?
            </p>

            <div className="flex items-center space-x-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowDeletePromptModal(false)}
                className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-medium text-xs rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSelectedPrompt}
                className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-lg shadow-sm transition"
              >
                Delete Prompt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
