import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  CheckCircle2,
  Info,
  AlertTriangle,
  XCircle,
  X,
  Sparkles,
  GitBranch,
  Star,
  Copy
} from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const removeToast = useCallback((id) => {
    if (timersRef.current.has(id)) {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({
    title,
    message,
    type = 'success', // 'success' | 'info' | 'warning' | 'error'
    duration = 3500,
    icon: CustomIcon
  }) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, title, message, type, CustomIcon };

    setToasts((prev) => [...prev.slice(-3), newToast]); // keep max 4 toasts

    if (duration > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, duration);
      timersRef.current.set(id, timer);
    }
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const addToast = useCallback((messageOrObj, type = 'success', title = '') => {
    if (typeof messageOrObj === 'object' && messageOrObj !== null) {
      showToast(messageOrObj);
    } else {
      const displayTitle = title || (
        type === 'error' ? 'Error' :
        type === 'info' ? 'Information' :
        type === 'warning' ? 'Notice' :
        'Success'
      );
      showToast({
        title: displayTitle,
        message: String(messageOrObj || ''),
        type: type || 'success'
      });
    }
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, addToast, removeToast }}>
      {children}

      {/* Floating Popup Toast Container */}
      <div className="fixed bottom-6 right-6 z-[10000] flex flex-col space-y-3 pointer-events-none max-w-sm w-full px-4 sm:px-0">
        {toasts.map((toast) => {
          let bgClass = 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white';
          let iconElement = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
          let barClass = 'bg-emerald-500';

          if (toast.type === 'info') {
            iconElement = <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />;
            barClass = 'bg-indigo-500';
          } else if (toast.type === 'warning') {
            iconElement = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
            barClass = 'bg-amber-500';
          } else if (toast.type === 'error') {
            iconElement = <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
            barClass = 'bg-rose-500';
          }

          if (toast.CustomIcon) {
            iconElement = <toast.CustomIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto border rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all duration-300 transform animate-in slide-in-from-bottom-5 fade-in ${bgClass}`}
            >
              <div className="flex items-start justify-between space-x-3">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5 flex-shrink-0">{iconElement}</div>
                  <div>
                    {toast.title && (
                      <h4 className="text-xs font-extrabold tracking-tight">
                        {toast.title}
                      </h4>
                    )}
                    {toast.message && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {toast.message}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeToast(toast.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition -mr-1 -mt-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Progress bar line */}
              <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className={`h-full ${barClass} animate-shrink`} style={{ animationDuration: '3.5s' }} />
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
