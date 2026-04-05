'use client';

import React, { createContext, useContext, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  type?: ToastType;
  duration?: number;
}

interface ToastInstance {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => number;
  showSuccess: (message: string, duration?: number) => number;
  showError: (message: string, duration?: number) => number;
  showInfo: (message: string, duration?: number) => number;
  showWarning: (message: string, duration?: number) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircleIcon className="w-5 h-5 text-grade-achieved" />,
  error: <ExclamationCircleIcon className="w-5 h-5 text-grade-notAchieved" />,
  info: <InformationCircleIcon className="w-5 h-5 text-primary" />,
  warning: <ExclamationTriangleIcon className="w-5 h-5 text-grade-excellence" />,
};

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'border-grade-achieved/30 bg-success-50',
  error: 'border-grade-notAchieved/30 bg-error-50',
  info: 'border-primary/30 bg-primary-subtle',
  warning: 'border-grade-excellence/30 bg-warning-50',
};

/**
 * Provides a context and UI for displaying toast notifications.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastInstance[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const type: ToastType = options.type ?? 'info';
      const duration = options.duration ?? 5000;
      const id = ++idRef.current;
      setToasts(prev => [...prev, { id, message, type }]);
      if (duration > 0) {
        const timeout = setTimeout(() => {
          dismiss(id);
        }, duration);
        timers.current.set(id, timeout);
      }
      return id;
    },
    [dismiss]
  );

  const showSuccess = useCallback((message: string, duration?: number) => showToast(message, { type: 'success', duration }), [showToast]);
  const showError = useCallback((message: string, duration?: number) => showToast(message, { type: 'error', duration }), [showToast]);
  const showInfo = useCallback((message: string, duration?: number) => showToast(message, { type: 'info', duration }), [showToast]);
  const showWarning = useCallback((message: string, duration?: number) => showToast(message, { type: 'warning', duration }), [showToast]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach(timeout => clearTimeout(timeout));
      currentTimers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, showSuccess, showError, showInfo, showWarning, dismiss }),
    [dismiss, showError, showInfo, showSuccess, showToast, showWarning]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 flex flex-col items-center gap-3 px-4 sm:inset-x-auto sm:right-4 sm:items-end sm:px-0 z-[1000]">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 border px-4 py-3 shadow-card-hover animate-fade-down ${TYPE_STYLES[toast.type]}`}
            role="status"
            aria-live="polite"
          >
            <div className="mt-0.5">{ICONS[toast.type]}</div>
            <div className="flex-1 text-sm text-text-primary">{toast.message}</div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-text-muted hover:text-text-primary transition-colors"
              aria-label="Close notification"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Retrieve the toast context API for showing and dismissing toasts.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
