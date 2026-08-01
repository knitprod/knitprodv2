/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Users, Database, Settings, ShieldCheck, ChevronDown, ChevronRight, Sliders, CheckCircle2 } from 'lucide-react';
import UserManagementView, { UserRecord } from './UserManagementView';
import DatabaseConnectionView from './DatabaseConnectionView';
import SettingsView from './SettingsView';

interface AdminPanelViewProps {
  currentUser?: UserRecord | null;
  initialTab?: 'user-management' | 'database-connection' | 'settings';
  onSuccessNotice?: (msg: string) => void;
}

export default function AdminPanelView({ currentUser, initialTab = 'user-management', onSuccessNotice }: AdminPanelViewProps) {
  const [activeTab, setActiveTab] = useState<'user-management' | 'database-connection' | 'settings'>(initialTab);
  const [isAdminPanelExpanded, setIsAdminPanelExpanded] = useState(true);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleNotice = (msg: string) => {
    setNoticeMessage(msg);
    if (onSuccessNotice) onSuccessNotice(msg);
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Admin Panel Expandable/Collapsible Control Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden transition-all">
        <div 
          onClick={() => setIsAdminPanelExpanded(!isAdminPanelExpanded)}
          className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white cursor-pointer select-none"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 shadow-inner">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black tracking-tight uppercase">
                  System Admin Panel
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-[10px] font-bold uppercase tracking-wider">
                  Restricted Access
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Manage User Credentials, Database Connections, and Operational Capacity Targets
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-slate-300 hover:text-white">
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
              {isAdminPanelExpanded ? 'Collapse Panel' : 'Expand Panel'}
            </span>
            <div className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              {isAdminPanelExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </div>
          </div>
        </div>

        {/* Expandable Tabs & Sub-Navigation */}
        {isAdminPanelExpanded && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-2 sm:p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setActiveTab('user-management')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'user-management'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('database-connection')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'database-connection'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                <Database className="h-4 w-4" />
                <span>Database Connection</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>System Settings</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {noticeMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2 shadow-2xs animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Render Sub View based on activeTab */}
      <div className="transition-all animate-fade-in">
        {activeTab === 'user-management' && (
          <UserManagementView currentUser={currentUser} />
        )}

        {activeTab === 'database-connection' && (
          <DatabaseConnectionView onSuccessNotice={handleNotice} />
        )}

        {activeTab === 'settings' && (
          <SettingsView />
        )}
      </div>
    </div>
  );
}
