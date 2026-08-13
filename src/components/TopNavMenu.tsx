/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, 
  LayoutGrid, 
  TrendingUp, 
  FileText, 
  Users, 
  Settings, 
  ChevronDown,
  ChevronUp,
  Factory,
  Table,
  ClipboardList,
  Target,
  Layers,
  CalendarCheck,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  Database
} from 'lucide-react';
import { UserRecord } from './UserManagementView';

interface TopNavMenuProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  currentUser?: UserRecord | null;
}

export default function TopNavMenu({ currentPage, onNavigate, currentUser }: TopNavMenuProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [orderPlanSubOpen, setOrderPlanSubOpen] = useState<boolean>(true);
  const navRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper permission checker
  const isTabAllowed = (tabName: string) => {
    if (currentUser?.userType === 'Admin') {
      return true;
    }
    if (currentUser?.allowedTabs && currentUser.allowedTabs.length > 0) {
      if (currentUser.allowedTabs.includes(tabName)) return true;
      if (
        ['Team Leader OTD Status', 'Buyerwise OTD Status', 'Orderwise OTD Status', 'Order Plan & Status', 'Plan Order Followup'].includes(tabName) &&
        (currentUser.allowedTabs.includes('Plan Order Followup') || currentUser.allowedTabs.includes('Order Plan & Status'))
      ) {
        return true;
      }
      return false;
    }
    if (tabName === 'User Management' || tabName === 'Database Connection' || tabName === 'Admin Panel') {
      return false;
    }
    return true;
  };

  const productionItems = [
    { name: 'Production Ledger', icon: Table, label: 'Production Ledger' },
    { name: 'Floor Dashboard', icon: LayoutGrid, label: 'Floor Dashboard' },
    { name: 'Management Dashboard', icon: TrendingUp, label: 'Management Dashboard' },
    { name: 'Reports', icon: FileText, label: 'Reports' },
  ];

  const planOrderItems = [
    { name: 'Plan Order Followup', icon: ClipboardList, label: 'Order Plan & Status' },
    { name: 'Team Leader OTD Status', icon: Users, label: 'Team Leader OTD Status' },
    { name: 'Buyerwise OTD Status', icon: Building2, label: 'Buyerwise OTD Status' },
    { name: 'Orderwise OTD Status', icon: FileSpreadsheet, label: 'Orderwise OTD Status' },
    { name: 'Buyer Plan vs Actual', icon: Target, label: 'Buyer Plan vs Actual' },
    { name: 'Yarn Allocation', icon: Layers, label: 'Yarn Allocation' },
    { name: 'Delivery Schedule', icon: CalendarCheck, label: 'Delivery Schedule' },
  ];

  const adminPanelItems = [
    { name: 'User Management', icon: Users, label: 'User Management' },
    { name: 'Database Connection', icon: Database, label: 'Database Connection' },
    { name: 'Settings', icon: Settings, label: 'System Settings' },
  ];

  const isProductionAllowed = productionItems.some(i => isTabAllowed(i.name));
  const isPlanOrderAllowed = planOrderItems.some(i => isTabAllowed(i.name));
  const isAdminPanelAllowed = adminPanelItems.some(i => isTabAllowed(i.name));

  const isProductionActive = productionItems.some(i => i.name === currentPage);
  const isPlanOrderActive = planOrderItems.some(i => i.name === currentPage);
  const isAdminPanelActive = adminPanelItems.some(i => i.name === currentPage);

  const toggleDropdown = (name: string) => {
    setOpenDropdown(prev => (prev === name ? null : name));
  };

  return (
    <nav ref={navRef} className="hidden md:flex items-center gap-1.5 sm:gap-2">
      {/* 1. Dashboard */}
      {isTabAllowed('Dashboard') && (
        <button
          onClick={() => {
            onNavigate('Dashboard');
            setOpenDropdown(null);
          }}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            currentPage === 'Dashboard'
              ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="topnav-dashboard"
        >
          <Home className={`h-4 w-4 ${currentPage === 'Dashboard' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Dashboard</span>
        </button>
      )}

      {/* 2. Production Update Dropdown */}
      {isProductionAllowed && (
        <div className="relative">
          <button
            onClick={() => toggleDropdown('production')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              isProductionActive
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                : openDropdown === 'production'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="topnav-group-production"
          >
            <Factory className={`h-4 w-4 ${isProductionActive ? 'text-white' : 'text-blue-500'}`} />
            <span>Production Update</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === 'production' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'production' && (
            <div className="absolute left-0 mt-1.5 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-xl z-50 animate-fade-in space-y-1">
              {productionItems.map((sub) => {
                if (!isTabAllowed(sub.name)) return null;
                const Icon = sub.icon;
                const isActive = currentPage === sub.name;
                return (
                  <button
                    key={sub.name}
                    onClick={() => {
                      onNavigate(sub.name);
                      setOpenDropdown(null);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. Plan Order Followup Dropdown */}
      {isPlanOrderAllowed && (
        <div className="relative">
          <button
            onClick={() => toggleDropdown('planOrder')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              isPlanOrderActive
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                : openDropdown === 'planOrder'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="topnav-group-planorder"
          >
            <ClipboardList className={`h-4 w-4 ${isPlanOrderActive ? 'text-white' : 'text-indigo-500'}`} />
            <span>Plan Order Followup</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === 'planOrder' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'planOrder' && (
            <div className="absolute left-0 mt-1.5 w-60 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-xl z-50 animate-fade-in space-y-1">
              {/* Order Plan & Status Header and Sub-menu */}
              {isTabAllowed('Plan Order Followup') && (
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setOrderPlanSubOpen(!orderPlanSubOpen)}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 shrink-0 text-indigo-500" />
                      <span className="font-black uppercase tracking-wider text-[11px]">Order Plan & Status</span>
                    </div>
                    <span className="p-0.5 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all">
                      {orderPlanSubOpen ? (
                        <ChevronUp className="h-3.5 w-3.5 text-indigo-500" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
                      )}
                    </span>
                  </button>
                  
                  {orderPlanSubOpen && (
                    <div className="pl-3 ml-2 border-l-2 border-indigo-100 dark:border-indigo-900/60 space-y-0.5">
                      {[
                        { name: 'Team Leader OTD Status', icon: Users, label: '1. Team Leader OTD Status' },
                        { name: 'Buyerwise OTD Status', icon: Building2, label: '2. Buyerwise OTD Status' },
                        { name: 'Orderwise OTD Status', icon: FileSpreadsheet, label: '3. Orderwise OTD Status' },
                      ].map((sub) => {
                        const Icon = sub.icon;
                        const isActive = currentPage === sub.name || (currentPage === 'Plan Order Followup' && sub.name === 'Team Leader OTD Status');
                        return (
                          <button
                            key={sub.name}
                            onClick={() => {
                              onNavigate(sub.name);
                              setOpenDropdown(null);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold'
                                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                            }`}
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

              {/* Other Plan Order Followup Items */}
              {[
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
                    onClick={() => {
                      onNavigate(sub.name);
                      setOpenDropdown(null);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 4. Admin Panel Dropdown */}
      {isAdminPanelAllowed && (
        <div className="relative">
          <button
            onClick={() => toggleDropdown('admin')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              isAdminPanelActive
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                : openDropdown === 'admin'
                ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="topnav-group-admin"
          >
            <ShieldCheck className={`h-4 w-4 ${isAdminPanelActive ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
            <span>Admin Panel</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === 'admin' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'admin' && (
            <div className="absolute left-0 mt-1.5 w-56 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-xl z-50 animate-fade-in space-y-1">
              {adminPanelItems.map((sub) => {
                if (!isTabAllowed(sub.name)) return null;
                const Icon = sub.icon;
                const isActive = currentPage === sub.name;
                return (
                  <button
                    key={sub.name}
                    onClick={() => {
                      onNavigate(sub.name);
                      setOpenDropdown(null);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-extrabold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">{sub.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
