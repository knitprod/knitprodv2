/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error in UI component tree:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 p-6">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="h-7 w-7" />
            </div>
            
            <div className="space-y-1">
              <h2 className="text-xl font-bold tracking-tight text-white">Application Refresh Required</h2>
              <p className="text-xs text-slate-400">
                A component experienced a temporary rendering glitch. Click below to reload the knitting dashboard.
              </p>
            </div>

            {this.state.error && (
              <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-red-400 text-left overflow-x-auto max-h-28">
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-500/20"
            >
              <RefreshCw className="h-4 w-4" />
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
