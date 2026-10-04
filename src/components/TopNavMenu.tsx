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
  PlusCircle,
  ClipboardList,
  Target,
  Layers,
  CalendarCheck,
  Building2,
  FileSpreadsheet,
  ShieldCheck,
  Database,
  Activity,
  Boxes
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
        ['Team Leader OTD Status', 'Buyerwise OTD Status', 'Orderwise OTD Status', 'Order Plan & Status', 'Plan Order Followup', 'Knitting Status', 'Running Orders', 'Textile Close By PMC', 'Grey Stock Summary'].includes(tabName) &&
        (currentUser.allowedTabs.includes('Plan Order Followup') || currentUser.allowedTabs.includes('Order Plan & Status') || currentUser.allowedTabs.includes('Order OTD Status') || currentUser.allowedTabs.includes('Team Leader OTD Status') || currentUser.allowedTabs.includes('Knitting Status') || currentUser.allowedTabs.includes('Running Orders') || currentUser.allowedTabs.includes('Textile Close By PMC') || currentUser.allowedTabs.includes('Grey Stock Summary'))
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

  const orderOtdItems = [
    { name: 'Team Leader OTD Status', icon: Users, label: 'Team Leader OTD Status' },
    { name: 'Buyerwise OTD Status', icon: Building2, label: 'Buyerwise OTD Status' },
    { name: 'Orderwise OTD Status', icon: FileSpreadsheet, label: 'Orderwise OTD Status' },
  ];

  const knittingStatusItems = [
    { name: 'Running Orders', icon: Activity, label: 'Running Orders' },
    { name: 'Textile Close By PMC', icon: ShieldCheck, label: 'Textile Close By PMC' },
    { name: 'Grey Stock Summary', icon: Boxes, label: 'Grey Stock Summary' },
  ];

  const adminPanelItems = [
    { name: 'User Management', icon: Users, label: 'User Management' },
    { name: 'Database Connection', icon: Database, label: 'Database Connection' },
    { name: 'Settings', icon: Settings, label: 'System Settings' },
  ];

  const isProductionAllowed = productionItems.some(i => isTabAllowed(i.name));
  const isOrderOtdAllowed = orderOtdItems.some(i => isTabAllowed(i.name));
  const isKnittingStatusAllowed = knittingStatusItems.some(i => isTabAllowed(i.name));
  const isYarnAllocationAllowed = isTabAllowed('Yarn Allocation');
  const isAdminPanelAllowed = adminPanelItems.some(i => isTabAllowed(i.name));

  const isProductionActive = productionItems.some(i => i.name === currentPage);
  const isOrderOtdActive = orderOtdItems.some(i => i.name === currentPage) || currentPage === 'Order OTD Status' || currentPage === 'Plan Order Followup';
  const isKnittingStatusActive = knittingStatusItems.some(i => i.name === currentPage) || currentPage === 'Knitting Status';
  const isYarnAllocationActive = currentPage === 'Yarn Allocation';
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

      {/* 3. Order OTD Status Dropdown */}
      {isOrderOtdAllowed && (
        <div className="relative">
          <button
            onClick={() => toggleDropdown('orderOtd')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              isOrderOtdActive
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                : openDropdown === 'orderOtd'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="topnav-group-order-otd"
          >
            <ClipboardList className={`h-4 w-4 ${isOrderOtdActive ? 'text-white' : 'text-indigo-500'}`} />
            <span>Order OTD Status</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === 'orderOtd' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'orderOtd' && (
            <div className="absolute left-0 mt-1.5 w-60 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-xl z-50 animate-fade-in space-y-1">
              {orderOtdItems.map((sub) => {
                if (!isTabAllowed(sub.name)) return null;
                const Icon = sub.icon;
                const isActive = currentPage === sub.name || (currentPage === 'Order OTD Status' && sub.name === 'Team Leader OTD Status') || (currentPage === 'Plan Order Followup' && sub.name === 'Team Leader OTD Status');
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

      {/* 4. Knitting Status Dropdown */}
      {isKnittingStatusAllowed && (
        <div className="relative">
          <button
            onClick={() => toggleDropdown('knittingStatus')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              isKnittingStatusActive
                ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
                : openDropdown === 'knittingStatus'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="topnav-group-knitting-status"
          >
            <Activity className={`h-4 w-4 ${isKnittingStatusActive ? 'text-white' : 'text-indigo-500'}`} />
            <span>Knitting Status</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openDropdown === 'knittingStatus' ? 'rotate-180' : ''}`} />
          </button>

          {openDropdown === 'knittingStatus' && (
            <div className="absolute left-0 mt-1.5 w-60 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-2 shadow-xl z-50 animate-fade-in space-y-1">
              {knittingStatusItems.map((sub) => {
                if (!isTabAllowed(sub.name)) return null;
                const Icon = sub.icon;
                const isActive = currentPage === sub.name || (sub.name === 'Running Orders' && currentPage === 'Knitting Status');
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

      {/* 5. Yarn Allocation Direct Item */}
      {isYarnAllocationAllowed && (
        <button
          onClick={() => {
            onNavigate('Yarn Allocation');
            setOpenDropdown(null);
          }}
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-extrabold transition-all cursor-pointer ${
            isYarnAllocationActive
              ? 'bg-blue-600 text-white shadow-xs shadow-blue-500/30'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="topnav-yarn-allocation"
        >
          <Layers className={`h-4 w-4 ${isYarnAllocationActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
          <span>Yarn Allocation</span>
        </button>
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
