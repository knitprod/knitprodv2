/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Home, 
  LayoutGrid, 
  TrendingUp, 
  FileText, 
  Users, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Factory,
  Table,
  ClipboardList,
  Target,
  Layers,
  CalendarCheck,
  ShieldCheck,
  Database
} from 'lucide-react';
import { UserRecord } from './UserManagementView';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  onLogout: () => void;
  currentUser?: UserRecord | null;
}

export default function Sidebar({ 
  currentPage, 
  onNavigate, 
  collapsed, 
  setCollapsed,
  onLogout,
  currentUser
}: SidebarProps) {

  // Group expand/collapse states
  const [productionUpdateOpen, setProductionUpdateOpen] = useState(true);
  const [planOrderOpen, setPlanOrderOpen] = useState(true);
  const [adminPanelOpen, setAdminPanelOpen] = useState(true);

  // Auto expand group if active page is inside it
  const productionItems = ['Production Ledger', 'Floor Dashboard', 'Management Dashboard', 'Reports'];
  const planOrderItems = ['Plan Order Followup', 'Buyer Plan vs Actual', 'Yarn Allocation', 'Delivery Schedule'];
  const adminPanelItems = ['Admin Panel', 'User Management', 'Database Connection', 'Settings'];

  useEffect(() => {
    if (productionItems.includes(currentPage)) {
      setProductionUpdateOpen(true);
    }
    if (planOrderItems.includes(currentPage)) {
      setPlanOrderOpen(true);
    }
    if (adminPanelItems.includes(currentPage)) {
      setAdminPanelOpen(true);
    }
  }, [currentPage]);

  // Helper permission checker
  const isTabAllowed = (tabName: string) => {
    // Admin user is ALWAYS allowed all tabs!
    if (currentUser?.userType === 'Admin') {
      return true;
    }
    if (currentUser?.allowedTabs && currentUser.allowedTabs.length > 0) {
      return currentUser.allowedTabs.includes(tabName);
    }
    if (tabName === 'User Management' || tabName === 'Database Connection' || tabName === 'Admin Panel') {
      return false;
    }
    return true;
  };

  const isProductionGroupVisible = productionItems.some(item => isTabAllowed(item));
  const isPlanOrderGroupVisible = planOrderItems.some(item => isTabAllowed(item));
  const isAdminGroupVisible = adminPanelItems.some(item => isTabAllowed(item));

  return (
    <aside 
      className={`fixed inset-y-16 left-0 z-30 hidden md:flex flex-col justify-between border-r border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Navigation Links */}
      <div className="flex-1 min-h-0 py-4 overflow-y-auto scrollbar-none">
        {/* Toggle Expand / Collapse button on sidebar top corner */}
        <div className="hidden justify-end px-3 pb-3 md:flex">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-800 text-gray-400 dark:text-slate-400 shadow-xs transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 cursor-pointer"
            aria-label={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            id="sidebar-toggle-btn"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation Menu List */}
        <nav className="space-y-2 px-3">
          {/* 1. Dashboard */}
          {isTabAllowed('Dashboard') && (
            <button
              onClick={() => onNavigate('Dashboard')}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all duration-150 cursor-pointer ${
                currentPage === 'Dashboard' 
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-xs shadow-blue-500/5' 
                  : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:text-gray-900 dark:hover:text-white'
              }`}
              title={collapsed ? "Dashboard" : undefined}
              id="sidebar-nav-dashboard"
            >
              <Home className={`h-5 w-5 shrink-0 ${currentPage === 'Dashboard' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-slate-500'}`} />
              {!collapsed && <span className="truncate tracking-wide">Dashboard</span>}
              {!collapsed && currentPage === 'Dashboard' && (
                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </button>
          )}

          {/* 2. "Production Update" Expand & Collapse Group */}
          {isProductionGroupVisible && (
            <div className="space-y-1">
              <button
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setProductionUpdateOpen(true);
                  } else {
                    setProductionUpdateOpen(!productionUpdateOpen);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  productionItems.includes(currentPage)
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
                title={collapsed ? "Production Update" : undefined}
                id="sidebar-group-production-update"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Factory className="h-4 w-4 shrink-0 text-blue-500" />
                  {!collapsed && <span className="truncate">Production Update</span>}
                </div>
                {!collapsed && (
                  <span className="text-gray-400">
                    {productionUpdateOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                )}
              </button>

              {/* Sub-items list */}
              {(!collapsed && productionUpdateOpen) && (
                <div className="ml-3 pl-2.5 border-l-2 border-slate-100 dark:border-slate-800 space-y-1 pt-0.5">
                  {[
                    { name: 'Production Ledger', icon: Table, label: 'Production Ledger' },
                    { name: 'Floor Dashboard', icon: LayoutGrid, label: 'Floor Dashboard' },
                    { name: 'Management Dashboard', icon: TrendingUp, label: 'Management Dashboard' },
                    { name: 'Reports', icon: FileText, label: 'Reports' },
                  ].map((sub) => {
                    if (!isTabAllowed(sub.name)) return null;
                    const Icon = sub.icon;
                    const isActive = currentPage === sub.name;
                    return (
                      <button
                        key={sub.name}
                        onClick={() => onNavigate(sub.name)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. "Plan Order Followup" Expand & Collapse Group */}
          {isPlanOrderGroupVisible && (
            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setPlanOrderOpen(true);
                  } else {
                    setPlanOrderOpen(!planOrderOpen);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  planOrderItems.includes(currentPage)
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
                title={collapsed ? "Plan Order Followup" : undefined}
                id="sidebar-group-plan-order-followup"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ClipboardList className="h-4 w-4 shrink-0 text-indigo-500" />
                  {!collapsed && <span className="truncate">Plan Order Followup</span>}
                </div>
                {!collapsed && (
                  <span className="text-gray-400">
                    {planOrderOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                )}
              </button>

              {/* Sub-items list */}
              {(!collapsed && planOrderOpen) && (
                <div className="ml-3 pl-2.5 border-l-2 border-slate-100 dark:border-slate-800 space-y-1 pt-0.5">
                  {[
                    { name: 'Plan Order Followup', icon: ClipboardList, label: 'Order Plan & Status' },
                    { name: 'Buyer Plan vs Actual', icon: Target, label: 'Buyer Plan vs Actual' },
                    { name: 'Yarn Allocation', icon: Layers, label: 'Yarn Allocation' },
                    { name: 'Delivery Schedule', icon: CalendarCheck, label: 'Delivery Schedule' },
                  ].map((sub) => {
                    if (!isTabAllowed(sub.name)) return null;
                    const Icon = sub.icon;
                    const isActive = currentPage === sub.name;
                    return (
                      <button
                        key={sub.name}
                        onClick={() => onNavigate(sub.name)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. "Admin Panel" Expand & Collapse Group */}
          {isAdminGroupVisible && (
            <div className="space-y-1 pt-1">
              <button
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setAdminPanelOpen(true);
                  } else {
                    setAdminPanelOpen(!adminPanelOpen);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  adminPanelItems.includes(currentPage)
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50/40 dark:bg-blue-950/20'
                    : 'text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800/50 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
                title={collapsed ? "Admin Panel" : undefined}
                id="sidebar-group-admin-panel"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                  {!collapsed && <span className="truncate">Admin Panel</span>}
                </div>
                {!collapsed && (
                  <span className="text-gray-400">
                    {adminPanelOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                )}
              </button>

              {/* Sub-items list */}
              {(!collapsed && adminPanelOpen) && (
                <div className="ml-3 pl-2.5 border-l-2 border-slate-100 dark:border-slate-800 space-y-1 pt-0.5">
                  {[
                    { name: 'User Management', icon: Users, label: 'User Management' },
                    { name: 'Database Connection', icon: Database, label: 'Database Connection' },
                    { name: 'Settings', icon: Settings, label: 'System Settings' },
                  ].map((sub) => {
                    if (!isTabAllowed(sub.name)) return null;
                    const Icon = sub.icon;
                    const isActive = currentPage === sub.name;
                    return (
                      <button
                        key={sub.name}
                        onClick={() => onNavigate(sub.name)}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                          isActive 
                            ? 'bg-blue-50/80 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold' 
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Footer / Logout Button */}
      <div className="border-t border-gray-100 dark:border-slate-800 p-3">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-500 dark:text-red-400 transition-all hover:bg-red-50/70 dark:hover:bg-red-950/20 hover:text-red-600 dark:hover:text-red-300 cursor-pointer"
          title={collapsed ? "Logout" : undefined}
          id="sidebar-logout-btn"
        >
          <LogOut className="h-5 w-5 shrink-0 text-red-400 dark:text-red-400" />
          {!collapsed && (
            <span className="truncate tracking-wide">Logout</span>
          )}
        </button>
      </div>
    </aside>
  );
}
