import React from 'react';
import { UploadCloud, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export interface SyncProgressState {
  isActive: boolean;
  type: 'upload' | 'download' | 'sync';
  title?: string;
  percent: number;
  stage: string;
  current?: number;
  total?: number;
  error?: string | null;
}

interface SyncProgressBarProps {
  progress: SyncProgressState;
  onDismiss?: () => void;
  accentColor?: 'indigo' | 'emerald';
}

export const SyncProgressBar: React.FC<SyncProgressBarProps> = ({
  progress,
  onDismiss,
  accentColor = 'emerald'
}) => {
  if (!progress.isActive && !progress.error) return null;

  const isComplete = progress.percent >= 100;
  const isIndigo = accentColor === 'indigo';

  const barColor = progress.error
    ? 'bg-rose-500'
    : isComplete
    ? 'bg-emerald-500'
    : isIndigo
    ? 'bg-indigo-600'
    : 'bg-emerald-600';

  const iconColor = progress.error
    ? 'text-rose-600 dark:text-rose-400'
    : isComplete
    ? 'text-emerald-600 dark:text-emerald-400'
    : isIndigo
    ? 'text-indigo-600 dark:text-indigo-400'
    : 'text-emerald-600 dark:text-emerald-400';

  const getIcon = () => {
    if (progress.error) return <AlertTriangle className={`w-4 h-4 ${iconColor}`} />;
    if (isComplete) return <CheckCircle2 className={`w-4 h-4 ${iconColor}`} />;
    if (progress.type === 'upload') return <UploadCloud className={`w-4 h-4 ${iconColor} animate-bounce`} />;
    if (progress.type === 'download') return <Download className={`w-4 h-4 ${iconColor} animate-bounce`} />;
    return <RefreshCw className={`w-4 h-4 ${iconColor} animate-spin`} />;
  };

  const defaultTitle =
    progress.type === 'upload'
      ? 'Uploading & Replacing Records'
      : progress.type === 'download'
      ? 'Generating & Downloading Excel'
      : 'Cloud Database Synchronization';

  return (
    <div
      id="sync-progress-banner"
      role="progressbar"
      aria-valuenow={progress.percent}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-md transition-all animate-fade-in"
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
            {getIcon()}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {progress.title || defaultTitle}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {progress.error || progress.stage || 'Processing request...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {progress.total !== undefined && progress.total > 0 && (
            <span className="text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400">
              {(progress.current || 0).toLocaleString()} / {progress.total.toLocaleString()}
            </span>
          )}
          <span
            className={`text-xs font-black font-mono px-2 py-0.5 rounded-md ${
              progress.error
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                : isComplete
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : isIndigo
                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
            }`}
          >
            {Math.min(100, Math.max(0, Math.round(progress.percent)))}%
          </span>

          {(isComplete || progress.error) && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-1 cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ease-out rounded-full ${barColor}`}
          style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
        />
      </div>
    </div>
  );
};
