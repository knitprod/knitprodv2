/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Home, 
  ClipboardCopy, 
  LayoutGrid, 
  TrendingUp, 
  FileText, 
  Users, 
  Settings, 
  X, 
  LogOut,
  Sun,
  Moon,
  Table,
  Info,
  ShieldAlert,
  Factory,
  ClipboardList,
  Target,
  Layers,
  CalendarCheck,
  Building2,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Database,
  Loader2
} from 'lucide-react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import WelcomeBanner from './components/WelcomeBanner';
import FactoryFloors from './components/FactoryFloors';
import DashboardCharts from './components/DashboardCharts';
import RightPanel from './components/RightPanel';
import FloorDashboardView from './components/FloorDashboardView';
import ReportsView from './components/ReportsView';
import UserManagementView, { UserRecord, INITIAL_USERS } from './components/UserManagementView';
import LoginView from './components/LoginView';
import PreLoginWelcomePage from './components/PreLoginWelcomePage';
import SettingsView from './components/SettingsView';
import DatabaseConnectionView from './components/DatabaseConnectionView';
import AdminPanelView from './components/AdminPanelView';
import ProductionLedgerView from './components/ProductionLedgerView';
import PlanOrderFollowupView from './components/PlanOrderFollowupView';
import YarnAllocationView from './components/YarnAllocationView';
import DashboardFilterToolbar, { FilterState } from './components/DashboardFilterToolbar';
import DashboardUnitwiseCards from './components/DashboardUnitwiseCards';
import FloatingKPIAndFilterHUD from './components/FloatingKPIAndFilterHUD';
import { useGlobalData } from './context/GlobalDataContext';
import { GasClient } from './lib/gasClient';
import { SupabaseSync } from './lib/supabaseClient';
import { getTargetKgForUnit, getTotalMachinesForUnit, saveUnitConfigs, getUnitConfigs } from './lib/unitStore';
import { calculateLedgerEfficiency, calculateLedgerCapacityUtilization, calculateEffectiveDays, isSubContactRecord } from './lib/productionMetrics';
import { saveBuyers } from './lib/buyerStore';

import { FactoryFloor, ProductionEntry, ActivityLog } from './types';
import { INITIAL_FLOORS, INITIAL_KPIS, INITIAL_ACTIVITY_LOGS } from './data';

// Define rich starting production logs for the Reports spreadsheet on load
const INITIAL_ENTRIES: ProductionEntry[] = [
  {
    id: 'ent-1',
    floorId: 'ekl',
    timestamp: '21:24',
    machineId: 'M-01',
    operatorName: 'Akil Zaman',
    shift: 'C',
    yarnType: '30s Cotton Combed',
    fabricType: 'Single Jersey',
    productionKg: 180.0,
    rejectKg: 1.5,
    remarks: 'Stitch length verified.',
  },
  {
    id: 'ent-2',
    floorId: 'efl',
    timestamp: '21:05',
    machineId: 'M-05',
    operatorName: 'Nasrin Akhter',
    shift: 'C',
    yarnType: '34s Cotton Combed',
    fabricType: '1x1 Rib',
    productionKg: 175.4,
    rejectKg: 2.1,
    remarks: 'Grey scale test passed.',
  },
  {
    id: 'ent-3',
    floorId: 'efl-2',
    timestamp: '20:45',
    machineId: 'M-03',
    operatorName: 'Kamal Hossain',
    shift: 'B',
    yarnType: '40s Cotton Combed',
    fabricType: 'Interlock',
    productionKg: 190.2,
    rejectKg: 3.5,
    remarks: 'Yarn tension stabilized.',
  },
  {
    id: 'ent-4',
    floorId: 'auto-stripe',
    timestamp: '20:10',
    machineId: 'M-07',
    operatorName: 'Rashedul Bari',
    shift: 'B',
    yarnType: '50D Lycra',
    fabricType: 'Fleece',
    productionKg: 210.0,
    rejectKg: 1.2,
    remarks: 'Stripe alignment ok.',
  },
  {
    id: 'ent-5',
    floorId: 'efl-ext',
    timestamp: '19:30',
    machineId: 'M-02',
    operatorName: 'Taslima Begum',
    shift: 'B',
    yarnType: '30s Grey Melange',
    fabricType: 'Pique',
    productionKg: 145.0,
    rejectKg: 4.8,
    remarks: 'Awaiting motor calibration.',
  },
];

const getRelativeDateString = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ensureUniqueIds = <T extends { id: string }>(items: T[], prefix: string): T[] => {
  const seen = new Set<string>();
  let modified = false;
  const result = items.map((item, idx) => {
    let uniqueId = item.id || `${prefix}-${Date.now()}-${idx}`;
    if (seen.has(uniqueId)) {
      uniqueId = `${uniqueId}-${idx}-${Math.floor(Math.random() * 1000)}`;
      modified = true;
      seen.add(uniqueId);
      return { ...item, id: uniqueId };
    }
    seen.add(uniqueId);
    if (!item.id) {
      modified = true;
      return { ...item, id: uniqueId };
    }
    return item;
  });
  return modified ? result : items;
};

export default function App() {
  const [inactivityNotice, setInactivityNotice] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserRecord | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Automatic Authentication state restoration on startup and page refresh
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        let targetUid: string | null = null;

        // Check secure server session
        try {
          const res = await fetch('/api/auth/session', { credentials: 'same-origin' });
          if (res.ok) {
            const data = await res.json();
            if (data.authenticated && data.uid) {
              targetUid = data.uid;
            }
          }
        } catch (e) {
          // Network fallback
        }

        if (targetUid) {
          // Fetch live user roster from Supabase / Server DB
          const liveUsers = await SupabaseSync.fetchUsers();
          const cleanUid = targetUid.trim().toUpperCase();
          let matchedUser = liveUsers?.find(
            (u: any) => u.uid && u.uid.toString().trim().toUpperCase() === cleanUid
          );

          // Fallback to initial roster
          if (!matchedUser) {
            matchedUser = INITIAL_USERS.find(
              (u) => u.uid.toUpperCase() === cleanUid
            );
          }

          if (matchedUser) {
            if (matchedUser.status === 'Inactive') {
              await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
              if (isMounted) {
                setCurrentUser(null);
                GasClient.setActiveUser(null);
                setInactivityNotice('Your account has been deactivated. Please contact an administrator.');
                setAuthLoading(false);
              }
              return;
            }

            const safeUser = { ...matchedUser };
            delete safeUser.password;

            if (isMounted) {
              setCurrentUser(safeUser);
              GasClient.setActiveUser(safeUser);
              setAuthLoading(false);
            }
            return;
          }
        }

        // No active session
        if (isMounted) {
          setCurrentUser(null);
          GasClient.setActiveUser(null);
          setAuthLoading(false);
        }
      } catch (err) {
        console.warn('Error during authentication state restoration:', err);
        if (isMounted) {
          setCurrentUser(null);
          GasClient.setActiveUser(null);
          setAuthLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync active user with GasClient whenever state changes in React memory
  useEffect(() => {
    GasClient.setActiveUser(currentUser);
  }, [currentUser]);

  // 30-Minute Inactivity Auto-Logout Tracking (in React memory)
  useEffect(() => {
    if (!currentUser) return;

    lastActivityRef.current = Date.now();

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const checkInactivity = () => {
      const now = Date.now();
      const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes = 1,800,000 ms

      if (now - lastActivityRef.current >= INACTIVITY_LIMIT_MS) {
        // Trigger security auto-logout
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        setCurrentUser(null);
        GasClient.setActiveUser(null);
        setCurrentPage('Dashboard');
        setShowLogoutConfirm(false);
        setInactivityNotice(
          'You were automatically logged out due to 30 minutes of inactivity for system security.'
        );
      }
    };

    // Global user activity listeners (optimized to prevent main-thread lag)
    const activityEvents = ['mousedown', 'keydown', 'touchstart', 'click'];
    activityEvents.forEach((evt) => {
      window.addEventListener(evt, updateActivity, { passive: true });
    });

    // Check inactivity every 5 seconds
    const intervalId = setInterval(checkInactivity, 5000);

    // Immediate check when user switches back to tab
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkInactivity();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      activityEvents.forEach((evt) => {
        window.removeEventListener(evt, updateActivity);
      });
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [currentUser]);

  const [currentPage, setCurrentPage] = useState<string>(() => {
    try {
      const savedPage = sessionStorage.getItem('active_current_page') || localStorage.getItem('active_current_page');
      if (savedPage) return savedPage;
    } catch (e) {}
    return 'Dashboard';
  });

  useEffect(() => {
    try {
      if (currentPage) {
        sessionStorage.setItem('active_current_page', currentPage);
        localStorage.setItem('active_current_page', currentPage);
      }
    } catch (e) {}
  }, [currentPage]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Dark mode state in React memory
  const [isDark, setIsDark] = useState<boolean>(false);

  // Apply dark class to document root for Tailwind class-based dark mode
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Redirect to first allowed tab if current page is hidden by allowedTabs configuration
  useEffect(() => {
    if (currentUser && currentUser.userType !== 'Admin' && currentUser.allowedTabs && currentUser.allowedTabs.length > 0) {
      const isAllowed = currentUser.allowedTabs.includes(currentPage);

      if (!isAllowed) {
        const firstAllowed = currentUser.allowedTabs[0] || 'Dashboard';
        setCurrentPage(firstAllowed);
      }
    }
  }, [currentPage, currentUser]);

  const handleToggleDark = () => {
    setIsDark((prev) => !prev);
  };

  // Core Application Database States
  const [floors, setFloors] = useState<FactoryFloor[]>(() => {
    return INITIAL_FLOORS.map((floor) => {
      const targetKg = getTargetKgForUnit(floor.name, floor.targetKg);
      const totalMachines = getTotalMachinesForUnit(floor.name, floor.totalMachines);
      const runningMachines = Math.min(floor.runningMachines, totalMachines);
      const idleMachines = Math.max(0, totalMachines - runningMachines);
      const achievementPct = targetKg > 0 ? parseFloat(((floor.productionKg / targetKg) * 100).toFixed(1)) : 0;
      
      return {
        ...floor,
        targetKg,
        totalMachines,
        runningMachines,
        idleMachines,
        achievementPct
      };
    });
  });

  const [productionEntries, setProductionEntriesRaw] = useState<ProductionEntry[]>(INITIAL_ENTRIES);
  const [activityLogs, setActivityLogsRaw] = useState<ActivityLog[]>(INITIAL_ACTIVITY_LOGS);

  const setProductionEntries = (value: ProductionEntry[] | ((prev: ProductionEntry[]) => ProductionEntry[])) => {
    setProductionEntriesRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return ensureUniqueIds(next, 'ent');
    });
  };

  const setActivityLogs = (value: ActivityLog[] | ((prev: ActivityLog[]) => ActivityLog[])) => {
    setActivityLogsRaw((prev) => {
      const next = typeof value === 'function' ? value(prev) : value;
      return ensureUniqueIds(next, 'log');
    });
  };

  const [gasSyncError, setGasSyncError] = useState<string | null>(null);
  const [syncBannerMessage, setSyncBannerMessage] = useState<string | null>(null);
  const [isFirestoreQuotaExceeded, setIsFirestoreQuotaExceeded] = useState<boolean>(false);
  const [dismissQuotaBanner, setDismissQuotaBanner] = useState<boolean>(false);

  // Google Apps Script real-time sync loader (Background fetch)
  const loadLiveGasData = async (forceRefresh: boolean = false) => {
    if (GasClient.getDatabaseMode() !== 'gas') return;
    
    try {
      // Execute fetches concurrently in parallel for maximum sync speed
      const [dashboardRes, productionRes, activityRes] = await Promise.all([
        GasClient.fetchDashboard({ unit: 'all' }, forceRefresh).catch(err => { console.warn("Dashboard fetch failed:", err); return null; }),
        GasClient.fetchProductionList({}, forceRefresh).catch(err => { console.warn("Production list fetch failed:", err); return null; }),
        GasClient.fetchActivityLogs(30, forceRefresh).catch(err => { console.warn("Activity logs fetch failed:", err); return null; })
      ]);

      if (dashboardRes && Array.isArray(dashboardRes.floors)) {
        // Map GAS floor calculations to factory floor states
        const gasFloors = dashboardRes.floors;
        setFloors((prevFloors) =>
          prevFloors.map((floor) => {
            const gasFloor = gasFloors.find((f: any) => f.name.toLowerCase() === floor.name.toLowerCase() || f.id === floor.id);
            if (gasFloor) {
              return {
                ...floor,
                productionKg: gasFloor.productionKg || 0,
                targetKg: gasFloor.targetKg || floor.targetKg,
                totalMachines: gasFloor.totalMachines || floor.totalMachines,
                runningMachines: gasFloor.runningMachines || floor.runningMachines,
                idleMachines: (gasFloor.totalMachines || floor.totalMachines) - (gasFloor.runningMachines || floor.runningMachines),
                achievementPct: gasFloor.achievementPct || 0,
                rejectPct: gasFloor.rejectPct || 0,
                lastUpdated: 'Synced live'
              };
            }
            return floor;
          })
        );
      }

      if (productionRes && Array.isArray(productionRes)) {
        setProductionEntries(productionRes);
      }

      if (activityRes && Array.isArray(activityRes)) {
        setActivityLogs(activityRes);
      }
      setGasSyncError(null);
      // Notify all components that live Google Sheets sync is complete
      window.dispatchEvent(new Event('gas_data_synced'));
    } catch (err: any) {
      console.error("Failed to fetch live GAS REST API data in background:", err);
      setGasSyncError(err.message || String(err));
      throw err;
    }
  };

  const handleManualSync = async () => {
    GasClient.setSyncing(true);
    try {
      // 1. Pull live data from Google Sheet & update local React states
      await loadLiveGasData(true);
      // 2. Dispatch global sync event so mounted views re-fetch live sheets data
      window.dispatchEvent(new Event('gas_data_synced'));

      setSyncBannerMessage("Successfully pulled & synchronized live data from Google Sheet!");
      setTimeout(() => setSyncBannerMessage(null), 4500);
    } catch (err: any) {
      console.error("Manual sync error:", err);
      setSyncBannerMessage("Sync notice: " + (err.message || "Failed to fetch from Google Sheet"));
      setTimeout(() => setSyncBannerMessage(null), 5000);
    } finally {
      GasClient.setSyncing(false);
    }
  };

  // Fetch central server database configuration (GAS URL, DB mode & Supabase) on app startup
  useEffect(() => {
    // 1. Sync Supabase config from Server to keep connection sticky
    SupabaseSync.syncRemoteConfig().catch(() => {});

    // 2. Sync GAS and fetch live data
    GasClient.fetchServerConfig().then((config) => {
      if (config && config.databaseMode === 'gas') {
        loadLiveGasData();
      }
    }).catch((err) => {
      console.warn("Central config fetch notice:", err);
    });

    const handleUnitConfigUpdate = (e: Event) => {
      const customEv = e as CustomEvent<any[]>;
      const configs = customEv.detail || getUnitConfigs();
      setFloors((prevFloors) =>
        prevFloors.map((floor) => {
          const targetKg = getTargetKgForUnit(floor.name, floor.targetKg);
          const totalMachines = getTotalMachinesForUnit(floor.name, floor.totalMachines);
          const runningMachines = Math.min(floor.runningMachines, totalMachines);
          const idleMachines = Math.max(0, totalMachines - runningMachines);
          const achievementPct = targetKg > 0 ? parseFloat(((floor.productionKg / targetKg) * 100).toFixed(1)) : 0;
          return {
            ...floor,
            targetKg,
            totalMachines,
            runningMachines,
            idleMachines,
            achievementPct
          };
        })
      );
    };
    window.addEventListener('unit_configs_updated', handleUnitConfigUpdate);

    return () => {
      window.removeEventListener('unit_configs_updated', handleUnitConfigUpdate);
    };
  }, []);

  // Automatically collapse sidebar on small/tablet devices
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize(); // trigger initial layout sizing
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dashboard filtering state
  const [filterState, setFilterState] = useState<FilterState>(() => {
    return {
      unit: 'all',
      dateMode: 'range',
      singleDate: '',
      dateFrom: '',
      dateTo: '',
      month: '',
      year: 'all'
    };
  });
  const [dashboardLoading, setDashboardLoading] = useState<boolean>(false);

  // Helper for seeded random comparisons
  const getSeededValue = (combined: string, multiplier: number, offset: number) => {
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      hash = combined.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(Math.sin(hash) * multiplier) + offset;
  };

  const globalData = useGlobalData();
  const globalLedger = globalData?.ledger || [];

  // Compute live cumulative KPIs dynamically based on current filters and state
  const kpis = useMemo(() => {
    const { unit = 'all', dateMode = 'range' } = filterState;

    if (globalLedger.length > 0) {
      let filteredRows = [...globalLedger];
      
      // Date filter
      if (filterState.dateFrom && filterState.dateTo) {
        filteredRows = filteredRows.filter(r => r.date >= filterState.dateFrom && r.date <= filterState.dateTo);
      } else if (filterState.dateFrom) {
        filteredRows = filteredRows.filter(r => r.date >= filterState.dateFrom);
      } else if (filterState.dateTo) {
        filteredRows = filteredRows.filter(r => r.date <= filterState.dateTo);
      } else if (filterState.dateMode === 'single' && filterState.singleDate) {
        filteredRows = filteredRows.filter(r => r.date === filterState.singleDate);
      } else if (filterState.year && filterState.year !== 'all') {
        filteredRows = filteredRows.filter(r => r.date && r.date.startsWith(filterState.year));
      } else if (filterState.dateMode === 'month' && filterState.month) {
        filteredRows = filteredRows.filter(r => r.date && r.date.startsWith(filterState.month));
      }

      // Unit filter
      const activeUnit = filterState.unit || 'all';
      if (activeUnit !== 'all') {
        if (activeUnit === 'In-House' || activeUnit === 'in-house') {
          filteredRows = filteredRows.filter(r => !isSubContactRecord(r));
        } else if (activeUnit === 'Sub-Contact' || activeUnit === 'sub-contact') {
          filteredRows = filteredRows.filter(r => isSubContactRecord(r));
        } else {
          filteredRows = filteredRows.filter(r => 
            (r.floor && r.floor.trim().toLowerCase() === activeUnit.trim().toLowerCase()) ||
            (r.unit && r.unit.trim().toLowerCase() === activeUnit.trim().toLowerCase())
          );
        }
      }

      if (filteredRows.length > 0) {
        const ihRows = filteredRows.filter(r => !isSubContactRecord(r));
        const scRows = filteredRows.filter(r => isSubContactRecord(r));

        const inHouseTarget = ihRows.reduce((sum, r) => sum + (r.target != null && Number(r.target) > 0 ? Number(r.target) : (Number(r.targetBulk) || 0)), 0);
        const subContactTarget = scRows.reduce((sum, r) => sum + (r.target != null && Number(r.target) > 0 ? Number(r.target) : (Number(r.targetBulk) || 0)), 0);
        const totalTarget = inHouseTarget + subContactTarget;

        const inHouseTotalProd = ihRows.reduce((sum, r) => sum + (r.totalProduction != null && Number(r.totalProduction) > 0 ? Number(r.totalProduction) : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0))), 0);
        const subContactTotalProd = scRows.reduce((sum, r) => sum + (r.totalProduction != null && Number(r.totalProduction) > 0 ? Number(r.totalProduction) : (Number(r.bulkProd || 0) + Number(r.sampleProd || 0))), 0);
        const totalProd = inHouseTotalProd + subContactTotalProd;

        const achievement = totalTarget > 0 ? parseFloat(((totalProd / totalTarget) * 100).toFixed(1)) : 0;

        const effectiveDays = calculateEffectiveDays(filteredRows, filterState);
        const efficiency = calculateLedgerEfficiency(ihRows, scRows, activeUnit);
        const capacity = calculateLedgerCapacityUtilization(ihRows, activeUnit, effectiveDays);

        let totalMachines = 0;
        if (activeUnit !== 'all' && !activeUnit.toLowerCase().includes('in-house')) {
          totalMachines = getTotalMachinesForUnit(activeUnit, 66);
        } else {
          const distinctFloors = Array.from(new Set(ihRows.map(r => r.floor).filter(Boolean))) as string[];
          if (distinctFloors.length > 0) {
            totalMachines = distinctFloors.reduce((sum: number, f: string) => sum + getTotalMachinesForUnit(f, 45), 0);
          } else {
            const inHouseConfigs = getUnitConfigs().filter(u => !u.unitName.toLowerCase().includes('sub'));
            totalMachines = inHouseConfigs.reduce((sum, u) => sum + Number(u.totalMachine || 0), 0) || 261;
          }
        }

        const inHouseRunning = ihRows.reduce((sum, r) => sum + Number(r.runningMachine || 0), 0);
        const dateCount = Math.max(1, new Set(ihRows.map(r => r.date).filter(Boolean)).size);
        const avgRunning = Math.round(inHouseRunning / dateCount);

        return [
          {
            id: 'target',
            label: 'Target',
            value: totalTarget.toLocaleString(),
            unit: 'Kg',
            description: 'Planned for the period',
            change: 'From Ledger',
            isPositive: true,
            color: 'blue' as const,
            iconName: 'Target'
          },
          {
            id: 'production',
            label: 'Production',
            value: totalProd.toLocaleString(),
            unit: 'Kg',
            description: 'Actual knitted output',
            change: 'From Ledger',
            isPositive: true,
            color: 'green' as const,
            iconName: 'Layers'
          },
          {
            id: 'achievement',
            label: 'Achievement %',
            value: `${achievement}%`,
            description: 'Plan achievement rate',
            change: `${achievement >= 85 ? 'On Target' : 'Needs Focus'}`,
            isPositive: achievement >= 85,
            color: 'green' as const,
            iconName: 'TrendingUp'
          },
          {
            id: 'machine_status',
            label: 'Machine Status',
            value: `${avgRunning} / ${totalMachines}`,
            description: 'Active circular knitting frames',
            change: `${Math.max(0, totalMachines - avgRunning)} idle`,
            isPositive: true,
            color: 'blue' as const,
            iconName: 'Cpu'
          },
          {
            id: 'capacity',
            label: 'Capacity Utilization',
            value: `${capacity.toFixed(1)}%`,
            description: 'Capacity quota utilization',
            change: capacity >= 85 ? 'Optimal' : 'Normal',
            isPositive: capacity >= 60,
            color: 'orange' as const,
            iconName: 'Activity'
          },
          {
            id: 'efficiency',
            label: 'Efficiency %',
            value: `${efficiency.toFixed(1)}%`,
            description: 'Operating efficiency ratio',
            change: efficiency >= 85 ? 'Optimal' : 'Standard',
            isPositive: efficiency >= 75,
            color: 'orange' as const,
            iconName: 'Percent'
          }
        ];
      }
    }
    
    // Determine fallback base values if ledger empty
    let baseTarget = 25000;
    let baseProd = 24150;
    let running = 45;
    let total = 48;
    let capacity = 93.8;
    let efficiency = 94.2;

    if (unit === 'EKL') {
      baseTarget = 25000; baseProd = 24150; running = 45; total = 48; capacity = 93.8; efficiency = 94.2;
    } else if (unit === 'EFL') {
      baseTarget = 20000; baseProd = 19400; running = 38; total = 40; capacity = 95.0; efficiency = 95.1;
    } else if (unit === 'EFL-2') {
      baseTarget = 18000; baseProd = 15120; running = 29; total = 35; capacity = 82.8; efficiency = 82.8;
    } else if (unit === 'Auto Stripe') {
      baseTarget = 12000; baseProd = 11520; running = 18; total = 20; capacity = 90.0; efficiency = 92.5;
    } else if (unit === 'EFL-Extension') {
      baseTarget = 15000; baseProd = 10800; running = 17; total = 25; capacity = 68.0; efficiency = 69.4;
    } else if (unit === 'ESL-Extension') {
      baseTarget = 10000; baseProd = 9550; running = 14; total = 16; capacity = 87.5; efficiency = 91.8;
    } else if (unit === 'Sub-Contact') {
      baseTarget = 8000; baseProd = 7420; running = 12; total = 14; capacity = 85.7; efficiency = 90.2;
    } else {
      baseTarget = 108000; baseProd = 100540; running = 202; total = 218; capacity = 87.5; efficiency = 88.5;
    }

    // Determine deterministic fluctuation based on selected date
    let dateStr = filterState.singleDate;
    if (dateMode === 'range') dateStr = `${filterState.dateFrom}_${filterState.dateTo}`;
    else if (dateMode === 'month') dateStr = filterState.month;
    else if (dateMode === 'year') dateStr = filterState.year;

    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const randomFactor = Math.abs(Math.sin(hash)) * 0.15 + 0.9; // range 0.9 to 1.05
    const multiplier = parseFloat(randomFactor.toFixed(3));

    // Scale targets and productions based on period size
    let periodScale = 1.0;
    if (dateMode === 'range') {
      const d1 = new Date(filterState.dateFrom);
      const d2 = new Date(filterState.dateTo);
      const diff = Math.max(1, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      periodScale = diff;
    } else if (dateMode === 'month') {
      periodScale = 30.0;
    } else if (dateMode === 'year') {
      periodScale = 365.0;
    }

    const finalTarget = Math.round(baseTarget * multiplier * periodScale);
    const finalProd = Math.round(baseProd * multiplier * periodScale);
    const finalAchievement = finalTarget > 0 ? parseFloat(((finalProd / finalTarget) * 100).toFixed(1)) : 0;
    
    // Comparison labels based on selected Date Mode
    let compLabel = 'vs yesterday';
    if (dateMode === 'range') compLabel = 'vs prev period';
    else if (dateMode === 'month') compLabel = 'vs prev month';
    else if (dateMode === 'year') compLabel = 'vs prev year';

    const compValueVal = (getSeededValue(dateStr + '_comp', 4, 1) * (hash % 2 === 0 ? 1 : -1)).toFixed(1);
    const compSign = parseFloat(compValueVal) >= 0 ? '+' : '';

    return [
      {
        id: 'target',
        label: 'Target',
        value: finalTarget.toLocaleString(),
        unit: 'Kg',
        description: 'Planned for the period',
        change: `${compSign}${compValueVal}% ${compLabel}`,
        isPositive: parseFloat(compValueVal) >= 0,
        color: 'blue' as const,
        iconName: 'Target'
      },
      {
        id: 'production',
        label: 'Production',
        value: finalProd.toLocaleString(),
        unit: 'Kg',
        description: 'Actual knitted output',
        change: `${compSign}${(parseFloat(compValueVal) * 0.9).toFixed(1)}% ${compLabel}`,
        isPositive: parseFloat(compValueVal) >= 0,
        color: 'green' as const,
        iconName: 'Layers'
      },
      {
        id: 'achievement',
        label: 'Achievement %',
        value: `${finalAchievement}%`,
        description: 'Plan achievement rate',
        change: `${compSign}${(parseFloat(compValueVal) * 0.5).toFixed(1)}% ${compLabel}`,
        isPositive: parseFloat(compValueVal) >= 0,
        color: 'green' as const,
        iconName: 'TrendingUp'
      },
      {
        id: 'machine_status',
        label: 'Machine Status',
        value: `${running} / ${total}`,
        description: 'Active circular knitting frames',
        change: 'Uptime stable',
        isPositive: true,
        color: 'blue' as const,
        iconName: 'Cpu'
      },
      {
        id: 'capacity',
        label: 'Capacity Utilization',
        value: `${(capacity * (multiplier > 1 ? 1 : multiplier)).toFixed(1)}%`,
        description: 'Cylinder allocation quota',
        change: 'Optimal utilization',
        isPositive: true,
        color: 'orange' as const,
        iconName: 'Activity'
      },
      {
        id: 'efficiency',
        label: 'Efficiency %',
        value: `${(efficiency * (multiplier > 1 ? 1 : multiplier)).toFixed(1)}%`,
        description: 'Average operating ratio',
        change: 'Normal operating rate',
        isPositive: true,
        color: 'orange' as const,
        iconName: 'Percent'
      }
    ];
  }, [filterState, globalLedger]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setDashboardLoading(true);
    setTimeout(() => {
      setFilterState(newFilters);
      setDashboardLoading(false);
    }, 600);
  };

  const handleResetFilters = () => {
    setDashboardLoading(true);
    setTimeout(() => {
      setFilterState({
        unit: 'all',
        dateMode: 'range',
        singleDate: '',
        dateFrom: '',
        dateTo: '',
        month: '',
        year: 'all'
      });
      setDashboardLoading(false);
    }, 400);
  };

  // Handler: Drill down floor filter via sidebar click or notification click
  const handleSelectFloor = (floorId: string | null) => {
    setSelectedFloorId(floorId);
    setCurrentPage('Floor Dashboard');
  };

  // Handler: Record new fabric roll submission (Optimistic local update + background sync)
  const handleAddProductionEntry = async (newEntry: Omit<ProductionEntry, 'id' | 'timestamp'>) => {
    const now = new Date();
    const timestamp = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const newId = `ent-${Date.now()}`;

    const completedEntry: ProductionEntry = {
      ...newEntry,
      id: newId,
      timestamp,
    };

    // 1. Immediately update local state so UI updates with 0ms latency
    setProductionEntries((prev) => [completedEntry, ...prev]);

    // Update target floor statistics locally
    setFloors((prevFloors) =>
      prevFloors.map((floor) => {
        if (floor.id === newEntry.floorId) {
          const newProd = floor.productionKg + newEntry.productionKg;
          return {
            ...floor,
            productionKg: newProd,
            achievementPct: Math.min(100, Math.round((newProd / (floor.targetKg || 1)) * 100)),
            lastUpdated: 'Just now'
          };
        }
        return floor;
      })
    );

    // 2. Add Activity Log locally
    const newLog: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp,
      floorId: newEntry.floorId,
      type: 'production',
      message: `${newEntry.operatorName} logged ${newEntry.productionKg} Kg of ${newEntry.fabricType} on Machine ${newEntry.machineId}.`,
      status: newEntry.rejectKg > 4.0 ? 'warning' : 'success'
    };
    setActivityLogs((prev) => [newLog, ...prev]);

    // 3. Save to server DB
    GasClient.saveServerDb({ 
      productionEntries: [completedEntry],
      activityLogs: [newLog]
    }).catch((err) => {
      console.warn('saveServerDb error:', err);
    });
  };

  // Handler: Authenticated User Logout
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const executeLogout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      sessionStorage.removeItem('active_current_page');
      localStorage.removeItem('active_current_page');
    } catch (e) {}
    setCurrentUser(null);
    GasClient.setActiveUser(null);
    setCurrentPage('Dashboard');
    setShowLogoutConfirm(false);
    setInactivityNotice(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0B132B] px-4 transition-colors duration-300">
        <div className="flex flex-col items-center space-y-4 max-w-sm text-center">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#0F4C81] to-[#1D2D50] shadow-xl flex items-center justify-center border border-white/20">
            <Factory className="h-7 w-7 text-sky-300 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight uppercase">
              Epyllion Knitting Performance
            </h2>
            <p className="text-xs font-semibold text-slate-500 dark:text-sky-300 flex items-center justify-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0F4C81] dark:text-sky-400" />
              Verifying secure authentication session...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <PreLoginWelcomePage 
        inactivityNotice={inactivityNotice}
        onLoginSuccess={(user) => {
          // Strip plain password before storing session in memory for enterprise security
          const safeUser = { ...user };
          delete safeUser.password;
          setCurrentUser(safeUser);
          GasClient.setActiveUser(safeUser);
          setInactivityNotice(null);
          try {
            const saved = sessionStorage.getItem('active_current_page') || localStorage.getItem('active_current_page');
            if (saved) {
              setCurrentPage(saved);
            }
          } catch (e) {}
        }} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50 dark:bg-slate-950 font-sans text-gray-900 dark:text-slate-100 antialiased transition-colors duration-200 w-full max-w-full overflow-x-clip">
      {/* 1. Primary Header */}
      <Header 
        notifications={activityLogs} 
        onNotificationClick={handleSelectFloor} 
        onNavigate={setCurrentPage} 
        currentPage={currentPage}
        onLogout={handleLogout}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        isDark={isDark}
        onToggleDark={handleToggleDark}
        currentUser={currentUser}
        onManualSync={handleManualSync}
      />

      {/* Sync Status Banner Notification */}
      {syncBannerMessage && (
        <div className="fixed top-18 right-6 z-50 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 px-4 py-3 text-xs font-bold text-blue-800 dark:text-blue-300 shadow-xl flex items-center gap-3 animate-fade-in">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
          </span>
          <span>{syncBannerMessage}</span>
        </div>
      )}

      {/* Responsive Mobile Drawer Navigation Menu */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Menu Drawer */}
          <div className="fixed top-0 bottom-0 left-0 z-[60] flex w-72 flex-col justify-between border-r border-blue-950/40 bg-[#0A192F] text-white p-4 shadow-2xl animate-slide-right md:hidden overflow-y-auto scrollbar-none">
            <div className="space-y-6 flex-1">
              <div className="flex items-center gap-3 border-b border-blue-900/40 pb-4 pt-4">
                {/* User Avatar */}
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-sm font-black text-white shadow-sm ring-2 ring-blue-500/25">
                  {currentUser?.userName
                    ? currentUser.userName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'KM'
                  }
                  <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[#0A192F] bg-emerald-500" />
                </div>
                
                {/* User Details */}
                <div className="flex-1 min-w-0">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-blue-400">Enterprise Navigation</span>
                  <span className="block text-xs font-bold text-blue-100 truncate">
                    {currentUser?.userName || 'Md. Raihan Hossain Antu'}
                  </span>
                  <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                    {currentUser?.designation || 'Sr. Production Manager'} ({currentUser?.uid || 'EKL001'})
                  </span>
                </div>
                
                {/* Actions: Theme Toggle & Close Menu */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleToggleDark}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-900/30 hover:text-white transition-colors cursor-pointer"
                    aria-label="Toggle Dark/Light Mode"
                    title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
                  >
                    {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-300" />}
                  </button>
                  <button 
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-900/30 hover:text-white transition-colors cursor-pointer"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <nav className="space-y-2">
                {/* Helper permission checker */}
                {(() => {
                  const isTabAllowed = (tabName: string) => {
                    if (currentUser?.userType === 'Admin') return true;
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

                  return (
                    <>
                      {/* Dashboard */}
                      {isTabAllowed('Dashboard') && (
                        <button
                          onClick={() => {
                            setCurrentPage('Dashboard');
                            setMobileMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-2.5 text-left text-sm font-bold transition-all duration-150 cursor-pointer ${
                            currentPage === 'Dashboard' 
                              ? 'bg-[#0F4C81] text-white shadow-md ring-1 ring-blue-400/20' 
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Home className="h-5 w-5 text-blue-400 shrink-0" />
                          <span>Dashboard</span>
                        </button>
                      )}

                      {/* Production Update Group */}
                      {['Production Ledger', 'Floor Dashboard', 'Management Dashboard', 'Reports'].some(isTabAllowed) && (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-black uppercase text-blue-400 tracking-wider">
                            <Factory className="h-4 w-4 shrink-0" />
                            <span>Production Update</span>
                          </div>
                          <div className="pl-4 space-y-1 border-l-2 border-blue-900/50 ml-4">
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
                                  onClick={() => {
                                    setCurrentPage(sub.name);
                                    setMobileMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                                    isActive 
                                      ? 'bg-blue-600/30 text-white font-bold border border-blue-500/30' 
                                      : 'text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                                  <span>{sub.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Plan Order Followup Group */}
                      {['Plan Order Followup', 'Team Leader OTD Status', 'Buyerwise OTD Status', 'Orderwise OTD Status', 'Buyer Plan vs Actual', 'Yarn Allocation', 'Delivery Schedule'].some(isTabAllowed) && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-black uppercase text-indigo-400 tracking-wider">
                            <ClipboardList className="h-4 w-4 shrink-0" />
                            <span>Plan Order Followup</span>
                          </div>
                          <div className="pl-4 space-y-1 border-l-2 border-indigo-900/50 ml-4">
                            {/* Order Plan & Status Sub-Menu Group */}
                            {isTabAllowed('Plan Order Followup') && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 px-2 py-1 text-xs font-bold text-slate-200">
                                  <ClipboardList className="h-3.5 w-3.5 text-indigo-400" />
                                  <span>Order Plan & Status</span>
                                </div>
                                <div className="pl-3 ml-2 border-l border-indigo-500/40 space-y-0.5">
                                  {[
                                    { name: 'Team Leader OTD Status', icon: Users, label: '1. Team Leader OTD Status' },
                                    { name: 'Buyerwise OTD Status', icon: Building2, label: '2. Buyerwise OTD Status' },
                                    { name: 'Orderwise OTD Status', icon: FileSpreadsheet, label: '3. Orderwise OTD Status' },
                                  ].map((sub) => {
                                    const Icon = sub.icon;
                                    const isActive = currentPage === sub.name;
                                    return (
                                      <button
                                        key={sub.name}
                                        onClick={() => {
                                          setCurrentPage(sub.name);
                                          setMobileMenuOpen(false);
                                        }}
                                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition-all cursor-pointer ${
                                          isActive 
                                            ? 'bg-indigo-600/40 text-white font-bold border border-indigo-500/40' 
                                            : 'text-slate-300 hover:bg-white/10'
                                        }`}
                                      >
                                        <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                                        <span>{sub.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Other Items */}
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
                                    setCurrentPage(sub.name);
                                    setMobileMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                                    isActive 
                                      ? 'bg-indigo-600/30 text-white font-bold border border-indigo-500/30' 
                                      : 'text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                                  <span>{sub.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Admin Panel Group */}
                      {['User Management', 'Database Connection', 'Settings'].some(isTabAllowed) && (
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center gap-2 px-4 py-1.5 text-xs font-black uppercase text-blue-400 tracking-wider">
                            <ShieldCheck className="h-4 w-4 shrink-0" />
                            <span>Admin Panel</span>
                          </div>
                          <div className="pl-4 space-y-1 border-l-2 border-blue-900/50 ml-4">
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
                                  onClick={() => {
                                    setCurrentPage(sub.name);
                                    setMobileMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-xs font-semibold transition-all cursor-pointer ${
                                    isActive 
                                      ? 'bg-blue-600/30 text-white font-bold border border-blue-500/30' 
                                      : 'text-slate-300 hover:bg-white/10'
                                  }`}
                                >
                                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                                  <span>{sub.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </nav>
            </div>

            {/* Logout on mobile menu drawer */}
            <div className="border-t border-blue-900/40 pt-4 pb-2 mt-6 shrink-0">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-sm font-bold text-red-400 transition-all hover:bg-red-950/40 hover:text-red-300 cursor-pointer"
                id="mobile-nav-logout"
              >
                <LogOut className="h-5 w-5 shrink-0 text-red-400" />
                <span className="truncate tracking-wide">Logout Account</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* 2. Main Layout Container */}
      <div className="flex pt-14 md:pt-[94px] w-full max-w-full overflow-x-clip">
        {/* Main Workspace Frame */}
        <main 
          className="flex-1 min-w-0 max-w-full min-h-[calc(100vh-6rem)] p-2 sm:p-4 md:p-4 pt-1 sm:pt-1 md:pt-1 transition-all duration-300 ease-in-out"
        >
          <div className="w-full space-y-5 min-w-0">
            
            {/* Page View Switcher */}
            {currentPage === 'Dashboard' && (
              <div className="space-y-6 animate-fade-in">
                {/* Floating KPI & Filter Matrix HUD (Floats when scrolled down past Filter Panel) */}
                <FloatingKPIAndFilterHUD
                  floors={floors}
                  filterState={filterState}
                  onApplyFilters={handleApplyFilters}
                  onResetFilters={handleResetFilters}
                  targetAnchorId="dashboard-filter-toolbar"
                />

                {/* Large Welcome banner */}
                <WelcomeBanner 
                  floors={floors} 
                  filterState={filterState} 
                  onFilterChange={handleApplyFilters} 
                  onResetFilter={handleResetFilters}
                  onNavigate={setCurrentPage} 
                />

                {/* ERP-grade Filter Toolbar */}
                <DashboardFilterToolbar 
                  filterState={filterState}
                  onApplyFilters={handleApplyFilters}
                  onResetFilters={handleResetFilters}
                  defaultUnit={filterState.unit}
                  defaultDate={filterState.singleDate}
                />

                {/* 3 Unitwise Overview Analytics Cards: Production Unitwise, Efficiency %, Capacity Utilization % */}
                <DashboardUnitwiseCards filterState={filterState} />

                {/* Floor indicators & Activity feed */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 space-y-6">
                    <FactoryFloors 
                      floors={floors} 
                      selectedFloorId={selectedFloorId} 
                      onSelectFloor={handleSelectFloor} 
                    />
                    
                    {/* Integrated dashboard graphs */}
                    <DashboardCharts 
                      filterUnit={filterState.unit}
                      filterDateMode={filterState.dateMode}
                      filterSingleDate={filterState.singleDate}
                      filterDateFrom={filterState.dateFrom}
                      filterDateTo={filterState.dateTo}
                      filterMonth={filterState.month}
                      filterYear={filterState.year}
                      isLoading={dashboardLoading}
                    />

                    {/* Dynamic Summary Panel */}
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/20 dark:border-blue-900/30 dark:bg-blue-950/10 p-5 shadow-xs" id="dashboard-summary-panel">
                      <h3 className="font-sans text-xs font-black uppercase tracking-wider text-[#0F4C81] dark:text-blue-400 flex items-center gap-1.5 mb-3">
                        <Info className="h-4 w-4" />
                        <span>Unit Summary & Directives Panel</span>
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold text-gray-700 dark:text-slate-300">
                        <div className="space-y-1.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase">Yield Status</span>
                          <p>
                            {filterState.unit} has completed <strong className="text-emerald-600 font-bold">{kpis[2].value}</strong> of its target plan during this period. Yield curve remains consistent with target profiles.
                          </p>
                        </div>
                        <div className="space-y-1.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase">Quality Assessment</span>
                          <p>
                            Scrap rate is steady at <strong className="text-red-500 font-bold">1.4%</strong>. Active alerts count is normal. Tension adjustment on machine sets recommended.
                          </p>
                        </div>
                        <div className="space-y-1.5 p-3 rounded-xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
                          <span className="block text-[10px] font-bold text-gray-400 uppercase">Directives & Roster</span>
                          <p>
                            Shift supervisors must audit Lycra feeds every 4 hours. Ensure rigger speed for next-set changes remains under 45 minutes.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-1">
                    <RightPanel 
                      activityLogs={activityLogs} 
                      onNotificationClick={handleSelectFloor} 
                    />
                  </div>
                </div>
              </div>
            )}



            {currentPage === 'Production Ledger' && (
              <div className="animate-fade-in">
                <ProductionLedgerView currentUser={currentUser} />
              </div>
            )}

            {currentPage === 'Floor Dashboard' && (
              <div className="animate-fade-in">
                <FloorDashboardView
                  floors={floors}
                  selectedFloorId={selectedFloorId}
                  onSelectFloor={(floorId) => {
                    setSelectedFloorId(floorId);
                    const mapping: Record<string, string> = {
                      'ekl': 'EKL',
                      'efl': 'EFL',
                      'efl-2': 'EFL-2',
                      'auto-stripe': 'Auto Stripe',
                      'efl-ext': 'EFL-Extension',
                      'esl-ext': 'ESL-Extension',
                      'sub-contact': 'Sub-Contact'
                    };
                    if (floorId && mapping[floorId]) {
                      setFilterState(prev => ({ ...prev, unit: mapping[floorId] }));
                    }
                  }}
                  filterState={filterState}
                  isLoading={dashboardLoading}
                />
              </div>
            )}

            {currentPage === 'Management Dashboard' && (
              <div className="space-y-6 animate-fade-in">
                <div className="border-b border-gray-100 pb-3">
                  <h2 className="font-sans text-xl font-black tracking-tight text-gray-900">
                    Executive Control Center
                  </h2>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    High-level aggregate target projections
                  </p>
                </div>
                <DashboardCharts 
                  filterUnit={filterState.unit}
                  filterDateMode={filterState.dateMode}
                  filterSingleDate={filterState.singleDate}
                  filterDateFrom={filterState.dateFrom}
                  filterDateTo={filterState.dateTo}
                  filterMonth={filterState.month}
                  filterYear={filterState.year}
                  isLoading={dashboardLoading}
                />
              </div>
            )}

            {currentPage === 'Reports' && (
              <div className="animate-fade-in">
                <ReportsView floors={floors} productionEntries={productionEntries} />
              </div>
            )}

            {(
              currentPage === 'Plan Order Followup' ||
              currentPage === 'Team Leader OTD Status' ||
              currentPage === 'Buyerwise OTD Status' ||
              currentPage === 'Orderwise OTD Status' ||
              currentPage === 'Buyer Plan vs Actual' ||
              currentPage === 'Delivery Schedule'
            ) && (
              <div className="animate-fade-in">
                <PlanOrderFollowupView 
                  currentUser={currentUser}
                  initialSubTab={
                    currentPage === 'Team Leader OTD Status' ? 'team_leader' :
                    currentPage === 'Buyerwise OTD Status' || currentPage === 'Buyer Plan vs Actual' ? 'buyer' :
                    currentPage === 'Orderwise OTD Status' ? 'summary' :
                    currentPage === 'Delivery Schedule' ? 'delivery' : 'team_leader'
                  } 
                />
              </div>
            )}

            {currentPage === 'Yarn Allocation' && (
              <div className="animate-fade-in">
                <YarnAllocationView currentUser={currentUser} />
              </div>
            )}

            {(currentPage === 'Admin Panel' || currentPage === 'User Management' || currentPage === 'Database Connection' || currentPage === 'Settings') && (
              <div className="animate-fade-in">
                <AdminPanelView 
                  currentUser={currentUser}
                  initialTab={
                    currentPage === 'Database Connection' ? 'database-connection' :
                    currentPage === 'Settings' ? 'settings' : 'user-management'
                  }
                />
              </div>
            )}

            {/* 3. Corporate Footer */}
            <footer className="mt-12 border-t border-gray-100 py-6 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
              <div className="flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-0">
                <span>© {new Date().getFullYear()} Epyllion Knitex Ltd.</span>
                <span>Knitting Performance System • Version 1.0</span>
                <span className="text-blue-600/80">Designed for Production Management</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
      {/* Logout Confirmation Modal Overlay */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" 
            onClick={() => setShowLogoutConfirm(false)}
          />
          <div className="relative w-full max-w-md transform rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 transition-all animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/45 text-red-600 dark:text-red-400">
                <LogOut className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-sans text-base font-black tracking-tight text-gray-900 dark:text-white uppercase">
                  Log Out Confirmation
                </h3>
                <p className="text-xs font-semibold text-gray-400 dark:text-slate-400 leading-normal">
                  Are you sure you want to exit the Epyllion Knitting Performance System? This will terminate your active directory session.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-xs font-bold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all cursor-pointer uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeLogout}
                  className="rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs font-black text-white transition-all shadow-md active:scale-98 cursor-pointer uppercase tracking-wider"
                >
                  Yes, Log Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
