import React from 'react';
import { Cpu } from 'lucide-react';
import { AI_PROVIDERS, getProviderByName } from '../data/aiProviders';

export const AIModelSelector = ({
  provider = 'Google Gemini',
  onProviderChange,
  model = 'gemini-3.6-flash',
  onModelChange,
  temperature = 0.7,
  onTemperatureChange,
  tokens = 1024,
  onTokensChange,
  status = 'Ready',
  showParams = true,
  compact = false,
  className = ''
}) => {
  const currentProviderObj = getProviderByName(provider);

  const handleProviderSelect = (newProviderName) => {
    onProviderChange?.(newProviderName);
    const pObj = getProviderByName(newProviderName);
    if (pObj && pObj.models.length > 0) {
      onModelChange?.(pObj.models[0]);
    }
  };

  if (compact) {
    return (
      <div className={`flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 shadow-sm w-full max-w-full min-w-0 ${className}`}>
        {/* Left: Provider & Model */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Provider:</span>
          <select
            value={provider}
            onChange={(e) => handleProviderSelect(e.target.value)}
            className="h-7 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-800 dark:text-slate-200 px-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>

          <select
            value={model}
            onChange={(e) => onModelChange?.(e.target.value)}
            className="h-7 bg-white dark:bg-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 px-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none cursor-pointer font-mono"
          >
            {currentProviderObj.models.map((m) => (
              <option key={m} value={m}>
                {currentProviderObj.modelLabels?.[m] || m}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Temp, Tokens & Status in single line */}
        {showParams && (
          <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
            <div className="flex items-center space-x-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Temp:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={temperature}
                onChange={(e) => onTemperatureChange?.(parseFloat(e.target.value))}
                className="w-14 accent-blue-600 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded"
              />
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-[10px] w-6 text-right">
                {temperature}
              </span>
            </div>

            <div className="flex items-center space-x-1">
              <span className="font-semibold text-slate-500 dark:text-slate-400">Tokens:</span>
              <input
                type="number"
                min="128"
                max="8192"
                step="128"
                value={tokens}
                onChange={(e) => onTokensChange?.(parseInt(e.target.value, 10) || 1024)}
                className="w-16 min-w-[56px] h-7 bg-white dark:bg-slate-800 text-[11px] font-mono font-semibold text-slate-800 dark:text-slate-200 px-2 rounded-md border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            <div className="hidden sm:flex items-center space-x-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ready</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Standard Slim Layout
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 shadow-sm w-full max-w-full min-w-0 ${className}`}>
      {/* Left: Provider & Model Dropdowns */}
      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
        {/* Provider Dropdown */}
        <div className="flex items-center space-x-1.5">
          <span className="font-semibold text-slate-500 dark:text-slate-400">Provider:</span>
          <select
            value={provider}
            onChange={(e) => handleProviderSelect(e.target.value)}
            className="h-8 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Model Dropdown */}
        <div className="flex items-center space-x-1.5">
          <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center flex-shrink-0">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <select
            value={model}
            onChange={(e) => onModelChange?.(e.target.value)}
            className="h-8 bg-slate-50 dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 px-2.5 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none cursor-pointer font-mono"
          >
            {currentProviderObj.models.map((m) => (
              <option key={m} value={m}>
                {currentProviderObj.modelLabels?.[m] || m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right: Temp Slider, Tokens input, Status indicator */}
      {showParams && (
        <div className="flex items-center space-x-3.5 flex-wrap gap-y-1">
          {/* Temperature Slider */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Temp:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => onTemperatureChange?.(parseFloat(e.target.value))}
              className="w-16 accent-blue-600 cursor-pointer h-1 bg-slate-200 dark:bg-slate-700 rounded"
            />
            <span className="font-mono font-semibold text-blue-600 dark:text-blue-400 text-xs w-6 text-right">
              {temperature}
            </span>
          </div>

          {/* Tokens Input (Generous width with spinner disabled so digits never clip) */}
          <div className="flex items-center space-x-1.5">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Tokens:</span>
            <input
              type="number"
              min="128"
              max="8192"
              step="128"
              value={tokens}
              onChange={(e) => onTokensChange?.(parseInt(e.target.value, 10) || 1024)}
              className="w-20 min-w-[64px] h-8 bg-slate-50 dark:bg-slate-900 text-xs font-mono font-semibold text-slate-800 dark:text-slate-200 px-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:border-blue-600 focus:outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>

          {/* Status Badge */}
          <div className="flex items-center space-x-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Ready</span>
          </div>
        </div>
      )}
    </div>
  );
};
