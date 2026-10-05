import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, ArrowLeft, Home, Compass } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const NotFound = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col justify-between font-sans antialiased transition-colors duration-200">
      {/* Top Bar */}
      <header className="px-6 py-4 border-b border-slate-200 dark:border-[#374151] bg-white/80 dark:bg-[#1F2937]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to={isAuthenticated ? '/app' : '/'} className="flex items-center space-x-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-sm group-hover:bg-blue-700 transition">
              <Layers className="w-4 h-4" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-[#F9FAFB] tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
              PromptCommit
            </span>
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Go Back</span>
          </button>
        </div>
      </header>

      {/* Main 404 Content */}
      <main className="flex-1 flex items-center justify-center p-6 my-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 shadow-inner">
            <Compass className="w-10 h-10 animate-pulse" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono font-bold tracking-widest text-blue-600 dark:text-blue-400 uppercase">
              Error 404
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Page Not Found
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The requested prompt branch or route does not exist or has been moved to another location.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={() => navigate(isAuthenticated ? '/app' : '/')}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition cursor-pointer"
            >
              <Home className="w-4 h-4" />
              <span>{isAuthenticated ? 'Back to Dashboard' : 'Back to Home'}</span>
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-white dark:bg-[#1F2937] hover:bg-slate-100 dark:hover:bg-[#293241] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#374151] font-medium text-xs rounded-lg shadow-xs transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous Page</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 border-t border-slate-200 dark:border-[#374151] text-center text-xs text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} PromptCommit. Private AI Prompt Testing Platform.
      </footer>
    </div>
  );
};
