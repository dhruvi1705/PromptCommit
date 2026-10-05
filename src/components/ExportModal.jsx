import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  FileJson,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

export const ExportModal = ({ prompt, isOpen, onClose }) => {
  const { showToast } = useToast();
  const [format, setFormat] = useState('txt'); // 'txt', 'json', 'md'
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [includeVersions, setIncludeVersions] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  if (!isOpen || !prompt) return null;

  const generateExportContent = () => {
    if (format === 'txt') {
      let text = `PROMPT: ${prompt.title}\n`;
      text += `VERSION: ${prompt.version}\n`;
      text += `CATEGORY: ${prompt.category}\n`;
      text += `MODEL: ${prompt.targetModel || 'gemini-3.6-flash'}\n`;
      const canonicalCol = prompt.collections?.[0]?.name || prompt.collection || 'No collection';
      text += `COLLECTION: ${canonicalCol}\n`;
      if (prompt.tags?.length) text += `TAGS: ${prompt.tags.join(', ')}\n`;
      text += `\n------------------ SYSTEM PROMPT / INSTRUCTIONS ------------------\n\n`;
      text += prompt.content || '';

      if (includeMetadata) {
        text += `\n\n------------------ METADATA ------------------\n`;
        text += `Description: ${prompt.description || 'N/A'}\n`;
        text += `Collection: ${canonicalCol}\n`;
        text += `Created: ${prompt.createdAt || 'N/A'}\n`;
        text += `Last Updated: ${prompt.updatedAt || 'N/A'}\n`;
      }

      if (includeVersions && prompt.versions?.length) {
        text += `\n------------------ VERSION HISTORY ------------------\n`;
        prompt.versions.forEach((v) => {
          text += `\n[${v.version}] - ${v.commitMessage || 'Committed'} (${v.date || 'Past'})\n`;
        });
      }

      return text;
    }

    if (format === 'json') {
      const canonicalCols = (prompt.collections || []).map(c => ({ id: c.id, name: c.name }));
      const primaryColName = prompt.collections?.[0]?.name || prompt.collection || null;
      const primaryColId = prompt.collectionId || prompt.collections?.[0]?.id || null;

      const data = {
        title: prompt.title,
        version: prompt.version,
        category: prompt.category,
        collectionId: primaryColId,
        collection: primaryColName,
        collections: canonicalCols,
        targetModel: prompt.targetModel,
        content: prompt.content,
        tags: prompt.tags || []
      };

      if (includeMetadata) {
        data.metadata = {
          description: prompt.description,
          createdAt: prompt.createdAt,
          updatedAt: prompt.updatedAt,
          collectionId: primaryColId,
          collection: primaryColName,
          collections: canonicalCols,
          rating: prompt.rating
        };
      }

      if (includeVersions) {
        data.versions = prompt.versions || [];
      }

      return JSON.stringify(data, null, 2);
    }

    if (format === 'md') {
      const canonicalCol = prompt.collections?.[0]?.name || prompt.collection || 'No collection';
      let md = `# ${prompt.title}\n\n`;
      md += `> **Category:** ${prompt.category} | **Target Model:** ${prompt.targetModel || 'gemini-3.6-flash'} | **Active Version:** \`${prompt.version}\`\n\n`;
      md += `### Description\n${prompt.description || 'No description provided.'}\n\n`;
      md += `### System Prompt / Instructions\n\`\`\`text\n${prompt.content || ''}\n\`\`\`\n\n`;

      if (prompt.tags?.length) {
        md += `### Tags\n${prompt.tags.map((t) => `\`#${t}\``).join(' ')}\n\n`;
      }

      if (includeMetadata) {
        md += `### Metadata Details\n- **Created:** ${prompt.createdAt || 'N/A'}\n- **Updated:** ${prompt.updatedAt || 'N/A'}\n- **Vault Collection:** ${canonicalCol}\n\n`;
      }

      if (includeVersions && prompt.versions?.length) {
        md += `### Commit History\n`;
        prompt.versions.forEach((v) => {
          md += `- **${v.version}** (${v.date || 'Date'}): ${v.commitMessage || 'Update'}\n`;
        });
        md += `\n`;
      }

      return md;
    }

    return prompt.content || '';
  };

  const previewText = generateExportContent();

  const handleCopy = () => {
    navigator.clipboard.writeText(previewText);
    setCopied(true);
    showToast({
      title: 'Export Copied!',
      message: `Exported ${format.toUpperCase()} copied to clipboard.`,
      type: 'info'
    });
    if (copyTimerRef.current) {
      clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([previewText], {
      type: format === 'json' ? 'application/json' : 'text/plain;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = prompt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `${safeTitle}-${prompt.version}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast({
      title: 'Prompt Downloaded!',
      message: `Saved as ${safeTitle}-${prompt.version}.${format}`,
      type: 'success'
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 sm:p-6 max-w-lg w-full space-y-4 shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Export Prompt</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-md">
                "{prompt.title}" ({prompt.version})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Export Modal"
            className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition border border-slate-200 dark:border-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Format Selector Pills */}
        <div className="space-y-1.5 flex-shrink-0">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            Choose Export Format
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => setFormat('txt')}
              className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 cursor-pointer ${
                format === 'txt'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4 flex-shrink-0 text-blue-600" />
              <div>
                <div className="text-xs font-bold">Plain Text</div>
                <div className="text-[10px] text-slate-400">.txt file</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('json')}
              className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 cursor-pointer ${
                format === 'json'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <FileJson className="w-4 h-4 flex-shrink-0 text-blue-600" />
              <div>
                <div className="text-xs font-bold">JSON Data</div>
                <div className="text-[10px] text-slate-400">.json object</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFormat('md')}
              className={`p-2.5 rounded-lg border text-left transition flex items-center space-x-2 cursor-pointer ${
                format === 'md'
                  ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-600 text-blue-700 dark:text-blue-400 shadow-sm'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              <FileCode className="w-4 h-4 flex-shrink-0 text-blue-600" />
              <div>
                <div className="text-xs font-bold">Markdown</div>
                <div className="text-[10px] text-slate-400">.md doc</div>
              </div>
            </button>
          </div>
        </div>

        {/* Export Configuration Options */}
        <div className="flex flex-wrap gap-4 pt-1 flex-shrink-0 text-xs">
          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={includeMetadata}
              onChange={(e) => setIncludeMetadata(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
            />
            <span>Include metadata (Category, Model, Tags, Dates)</span>
          </label>

          <label className="flex items-center space-x-2 text-slate-700 dark:text-slate-300 cursor-pointer font-medium select-none">
            <input
              type="checkbox"
              checked={includeVersions}
              onChange={(e) => setIncludeVersions(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer w-3.5 h-3.5"
            />
            <span>Include version history ({prompt.versions?.length || 1} commits)</span>
          </label>
        </div>

        {/* Live Preview Box */}
        <div className="space-y-1 flex-1 min-h-[120px] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Live Preview</span>
            <span className="font-mono text-[10px]">{(previewText.length / 1024).toFixed(1)} KB</span>
          </div>
          <pre className="flex-1 bg-slate-50 dark:bg-[#111827] text-slate-800 dark:text-slate-200 font-mono text-[11px] p-3 rounded-lg overflow-y-auto border border-slate-200 dark:border-[#374151] leading-relaxed select-all">
            {previewText}
          </pre>
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs rounded-lg transition flex items-center space-x-1.5 cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Content'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .{format.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
