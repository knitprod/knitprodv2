/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Epyllion Knitex Ltd. - Global Application Data Context
 * High-Performance Single Bulk Fetch & Edge-Cached Polling Store
 * 
 * Features:
 * 1. Single Bulk GET on App Mount -> Zero network calls on subsequent tab clicks
 * 2. 15-second silent background polling against edge-cached /api/sheets
 * 3. Optimistic local state updates on user edits for instantaneous UI feedback
 * 4. Guaranteed background write delivery with 'fetch(..., { keepalive: true })'
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OrderPlan, YarnAllocationRecord, LedgerRecord, FactoryFloor } from '../types';
import { INITIAL_FLOORS } from '../data';
import { GasClient } from '../lib/gasClient';

export interface GlobalDataContextType {
  // Datasets
  orderPlans: OrderPlan[];
  yarnAllocations: YarnAllocationRecord[];
  ledger: LedgerRecord[];
  floors: FactoryFloor[];
  
  // Status
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  syncError: string | null;

  // Actions
  refreshAll: (forceRefresh?: boolean) => Promise<void>;
  
  // Order Plans
  saveOrderPlan: (order: OrderPlan) => Promise<{ success: boolean; message?: string }>;
  deleteOrderPlan: (id: string) => Promise<{ success: boolean; message?: string }>;
  bulkSaveOrderPlans: (orders: OrderPlan[], replace?: boolean) => Promise<{ success: boolean; message?: string }>;

  // Yarn Allocations
  saveYarnAllocation: (item: YarnAllocationRecord) => Promise<{ success: boolean; message?: string }>;
  deleteYarnAllocation: (id: string) => Promise<{ success: boolean; message?: string }>;
  bulkSaveYarnAllocations: (items: YarnAllocationRecord[], replace?: boolean) => Promise<{ success: boolean; message?: string }>;

  // Production Ledger
  saveLedgerRecord: (record: LedgerRecord) => Promise<{ success: boolean; message?: string }>;
  deleteLedgerRecord: (id: string) => Promise<{ success: boolean; message?: string }>;
  bulkSaveLedgerRecords: (records: LedgerRecord[], replace?: boolean) => Promise<{ success: boolean; message?: string }>;
}

const GlobalDataContext = createContext<GlobalDataContextType | null>(null);

const POLLING_INTERVAL_MS = 15000; // 15 seconds silent polling

/**
 * Executes a write mutation against /api/sheets with keepalive to prevent tab-close data loss.
 */
async function executeKeepaliveMutation(action: string, data: any): Promise<any> {
  const payload = { action, ...data };
  try {
    const payloadStr = JSON.stringify(payload);
    // Keepalive is capped at 64KB by browser spec; use regular fetch for larger payloads
    const useKeepalive = payloadStr.length < 60000;

    const res = await fetch('/api/sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: payloadStr,
      ...(useKeepalive ? { keepalive: true } : {}),
      signal: AbortSignal.timeout(60000)
    });

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: res.ok, message: text };
    }
  } catch (err: any) {
    console.warn(`[Keepalive Mutation Notice - ${action}]:`, err);
    return { success: false, message: err.message || 'Write mutation network error' };
  }
}

/**
 * Re-computes floor KPI metrics from ledger records.
 */
function recalculateFloorsFromLedger(prevFloors: FactoryFloor[], ledgerRecords: LedgerRecord[]): FactoryFloor[] {
  if (!ledgerRecords || ledgerRecords.length === 0) return prevFloors;

  const latestByFloor: Record<string, LedgerRecord> = {};
  ledgerRecords.forEach(rec => {
    const fName = (rec.floor || '').trim().toUpperCase();
    if (!latestByFloor[fName] || (rec.date && rec.date > (latestByFloor[fName].date || ''))) {
      latestByFloor[fName] = rec;
    }
  });

  return prevFloors.map(floor => {
    const rec = latestByFloor[floor.name.toUpperCase()];
    if (!rec) return floor;

    const prodKg = Number(rec.totalProduction) || 0;
    const targetKg = Number(rec.target) || floor.targetKg;
    const runningMachines = Number(rec.runningMachine) || floor.runningMachines;
    const totalMachines = Number(rec.totalMachines) || floor.totalMachines;
    const idleMachines = Math.max(0, totalMachines - runningMachines);
    const achievementPct = targetKg > 0 ? parseFloat(((prodKg / targetKg) * 100).toFixed(1)) : 0;
    const rejectPct = Number(rec.rejectPct) || 0;

    return {
      ...floor,
      productionKg: prodKg,
      targetKg,
      runningMachines,
      totalMachines,
      idleMachines,
      achievementPct,
      rejectPct,
      lastUpdated: rec.date || 'Synced'
    };
  });
}

function deduplicateWithUniqueIds<T extends { id?: string }>(items: T[], prefix: string): T[] {
  if (!items || !Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.map((item, idx) => {
    let id = item.id;
    if (!id || typeof id !== 'string' || !id.trim() || seen.has(id)) {
      id = id ? `${id}-${idx}` : `${prefix}-${Date.now()}-${idx}`;
    }
    seen.add(id);
    return { ...item, id };
  });
}

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [orderPlans, setOrderPlans] = useState<OrderPlan[]>(() => {
    try {
      const cached = localStorage.getItem('cached_order_plans');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [yarnAllocations, setYarnAllocations] = useState<YarnAllocationRecord[]>(() => {
    try {
      const cached = localStorage.getItem('cached_yarn_allocations');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [ledger, setLedger] = useState<LedgerRecord[]>(() => {
    try {
      const cached = localStorage.getItem('cached_production_ledger');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [floors, setFloors] = useState<FactoryFloor[]>(INITIAL_FLOORS);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isInitialMount = useRef<boolean>(true);
  const lastSettingsSyncRef = useRef<string | null>(null);

  // Keep localStorage automatically in sync with memory state
  useEffect(() => {
    if (ledger && ledger.length > 0) {
      try {
        localStorage.setItem('cached_production_ledger', JSON.stringify(ledger));
      } catch (e) {}
    }
  }, [ledger]);

  useEffect(() => {
    if (orderPlans && orderPlans.length > 0) {
      try {
        localStorage.setItem('cached_order_plans', JSON.stringify(orderPlans));
      } catch (e) {}
    }
  }, [orderPlans]);

  useEffect(() => {
    if (yarnAllocations && yarnAllocations.length > 0) {
      try {
        localStorage.setItem('cached_yarn_allocations', JSON.stringify(yarnAllocations));
      } catch (e) {}
    }
  }, [yarnAllocations]);

  // Helper to persist datasets to localStorage for instant startup
  const persistCache = (orders?: OrderPlan[], yarn?: YarnAllocationRecord[], ledgers?: LedgerRecord[]) => {
    try {
      if (orders && orders.length > 0) localStorage.setItem('cached_order_plans', JSON.stringify(orders));
      if (yarn && yarn.length > 0) localStorage.setItem('cached_yarn_allocations', JSON.stringify(yarn));
      if (ledgers && ledgers.length > 0) localStorage.setItem('cached_production_ledger', JSON.stringify(ledgers));
    } catch (e) {}
  };

  /**
   * Bulk Fetch All Datasets from /api/sheets or GAS in ONE parallel sync window (< 45s).
   */
  const refreshAll = useCallback(async (forceRefresh: boolean = false) => {
    setIsSyncing(true);
    try {
      const url = forceRefresh ? '/api/sheets?action=all&refresh=true' : '/api/sheets?action=all';
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(40000)
      }).catch(() => null);

      let loadedSuccessfully = false;

      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        if (json && json.success && json.data) {
          const remoteOrders = json.data.orderPlans || json.data.orders;
          const remoteYarn = json.data.yarnAllocations || json.data.yarn;
          const remoteLedger = json.data.ledger || json.data.records;
          const remoteFloors = json.data.floors;

          let cleanOrders: OrderPlan[] | undefined;
          let cleanYarn: YarnAllocationRecord[] | undefined;
          let cleanLedger: LedgerRecord[] | undefined;

          if (Array.isArray(remoteOrders) && remoteOrders.length > 0) {
            cleanOrders = deduplicateWithUniqueIds(remoteOrders, 'ord');
            setOrderPlans(cleanOrders);
            loadedSuccessfully = true;
          }
          if (Array.isArray(remoteYarn) && remoteYarn.length > 0) {
            cleanYarn = deduplicateWithUniqueIds(remoteYarn, 'yarn');
            setYarnAllocations(cleanYarn);
            loadedSuccessfully = true;
          }
          if (Array.isArray(remoteLedger) && remoteLedger.length > 0) {
            cleanLedger = deduplicateWithUniqueIds(remoteLedger, 'rec');
            setLedger(cleanLedger);
            setFloors(prev => recalculateFloorsFromLedger(prev, cleanLedger!));
            loadedSuccessfully = true;
          } else if (Array.isArray(remoteFloors) && remoteFloors.length > 0) {
            setFloors(prev =>
              prev.map(f => {
                const rf = remoteFloors.find((r: any) => r.name.toLowerCase() === f.name.toLowerCase() || r.id === f.id);
                return rf ? { ...f, ...rf } : f;
              })
            );
          }

          persistCache(cleanOrders, cleanYarn, cleanLedger);

          if (loadedSuccessfully) {
            setLastSyncedAt(new Date());
            setSyncError(null);
          }
        }
      }

      // Fallback: If bulk didn't populate orders/yarn/ledger, query individual endpoints in parallel
      if (!loadedSuccessfully) {
        const [ordersRes, yarnRes, ledgerRes] = await Promise.allSettled([
          GasClient.fetchOrderPlans(forceRefresh),
          GasClient.fetchYarnAllocations(forceRefresh),
          GasClient.fetchLedgerRecords(forceRefresh)
        ]);

        let cleanOrders: OrderPlan[] | undefined;
        let cleanYarn: YarnAllocationRecord[] | undefined;
        let cleanLedger: LedgerRecord[] | undefined;

        if (ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value) && ordersRes.value.length > 0) {
          cleanOrders = deduplicateWithUniqueIds(ordersRes.value, 'ord');
          setOrderPlans(cleanOrders);
          loadedSuccessfully = true;
        }
        if (yarnRes.status === 'fulfilled' && Array.isArray(yarnRes.value) && yarnRes.value.length > 0) {
          cleanYarn = deduplicateWithUniqueIds(yarnRes.value, 'yarn');
          setYarnAllocations(cleanYarn);
          loadedSuccessfully = true;
        }
        if (ledgerRes.status === 'fulfilled' && Array.isArray(ledgerRes.value) && ledgerRes.value.length > 0) {
          cleanLedger = deduplicateWithUniqueIds(ledgerRes.value, 'rec');
          setLedger(cleanLedger);
          setFloors(prev => recalculateFloorsFromLedger(prev, cleanLedger!));
          loadedSuccessfully = true;
        }

        persistCache(cleanOrders, cleanYarn, cleanLedger);

        if (loadedSuccessfully) {
          setLastSyncedAt(new Date());
          setSyncError(null);
        }
      }
    } catch (err: any) {
      console.warn('[Global Data Bulk Fetch Warning]:', err.message);
    } finally {
      setIsSyncing(false);
      setIsLoading(false);
    }
  }, []);

  // 1. Initial Mount: Execute ONE bulk GET request
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      refreshAll(false);
    }
  }, [refreshAll]);

  // 2. Silent 15-Second Background Polling (Absorbed by Edge CDN)
  useEffect(() => {
    const interval = setInterval(() => {
      // Background silent poll without showing full-screen loaders
      fetch('/api/sheets?action=all', {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(25000)
      })
        .then(res => res.json())
        .then(json => {
          if (json && json.success && json.data) {
            const { orderPlans: rOrders, yarnAllocations: rYarn, ledger: rLedger } = json.data;
            if (Array.isArray(rOrders) && rOrders.length > 0) {
              const cleanOrders = deduplicateWithUniqueIds(rOrders, 'ord');
              setOrderPlans(prev => {
                if (prev.length !== cleanOrders.length || JSON.stringify(prev) !== JSON.stringify(cleanOrders)) {
                  return cleanOrders;
                }
                return prev;
              });
            }
            if (Array.isArray(rYarn) && rYarn.length > 0) {
              const cleanYarn = deduplicateWithUniqueIds(rYarn, 'yarn');
              setYarnAllocations(prev => {
                if (prev.length !== cleanYarn.length || JSON.stringify(prev) !== JSON.stringify(cleanYarn)) {
                  return cleanYarn;
                }
                return prev;
              });
            }
            if (Array.isArray(rLedger) && rLedger.length > 0) {
              const cleanLedger = deduplicateWithUniqueIds(rLedger, 'rec');
              setLedger(prev => {
                if (prev.length !== cleanLedger.length || JSON.stringify(prev) !== JSON.stringify(cleanLedger)) {
                  setFloors(fl => recalculateFloorsFromLedger(fl, cleanLedger));
                  return cleanLedger;
                }
                return prev;
              });
            }
            setLastSyncedAt(new Date());
          }
        })
        .catch(() => {
          // Silent catch for background poll
        });
    }, POLLING_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // 3. Cross-Device Real-time Event Listener
  useEffect(() => {
    const handleSyncEvent = () => refreshAll(true);
    window.addEventListener('gas_data_synced', handleSyncEvent);

    return () => {
      window.removeEventListener('gas_data_synced', handleSyncEvent);
    };
  }, [refreshAll]);

  // ==========================================================
  // OPTIMISTIC MUTATIONS WITH DIRECT GOOGLE SHEETS SYNC
  // ==========================================================

  // --- Order Plans ---
  const saveOrderPlan = async (order: OrderPlan) => {
    // 1. Optimistic local update
    setOrderPlans(prev => {
      const idx = prev.findIndex(o => (o.id && o.id === order.id) || (o.ewo && o.ewo === order.ewo));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = order;
        return next;
      }
      return [order, ...prev];
    });

    // 2. Dispatched with keepalive: true to Google Sheets
    return executeKeepaliveMutation('orders/save', { orderPlans: [order], replace: false });
  };

  const deleteOrderPlan = async (id: string) => {
    setOrderPlans(prev => prev.filter(o => o.id !== id && o.ewo !== id));
    return executeKeepaliveMutation('orders/delete', { id });
  };

  const bulkSaveOrderPlans = async (orders: OrderPlan[], replace: boolean = false) => {
    setOrderPlans(prev => replace ? orders : [...orders, ...prev.filter(p => !orders.some(o => o.id === p.id))]);
    return executeKeepaliveMutation('orders/save', { orderPlans: orders, replace });
  };

  // --- Yarn Allocations ---
  const isMatchingYarn = (a: YarnAllocationRecord, b: YarnAllocationRecord) => {
    if (a.id && b.id && a.id === b.id) return true;
    if (a.allocationNo && b.allocationNo && a.allocationNo === b.allocationNo) return true;
    const aKey = `${a.orderNumber || ''}|${a.fabricShade || ''}|${a.yarnRequired || a.allocatedYarn || ''}|${a.lotNo || ''}`.toLowerCase();
    const bKey = `${b.orderNumber || ''}|${b.fabricShade || ''}|${b.yarnRequired || b.allocatedYarn || ''}|${b.lotNo || ''}`.toLowerCase();
    return aKey !== '|||' && aKey === bKey;
  };

  const saveYarnAllocation = async (item: YarnAllocationRecord) => {
    setYarnAllocations(prev => {
      const idx = prev.findIndex(y => isMatchingYarn(y, item));
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [item, ...prev];
    });

    GasClient.clearYarnCache();
    GasClient.saveServerDb({ yarnAllocations: [item] }).catch(() => {});
    return executeKeepaliveMutation('yarn/save', { yarnAllocations: [item], replace: false });
  };

  const deleteYarnAllocation = async (id: string) => {
    setYarnAllocations(prev => prev.filter(y => y.id !== id));
    GasClient.clearYarnCache();
    GasClient.deleteYarnAllocation(id).catch(err => console.warn('Delete yarn allocation notice:', err));
    return executeKeepaliveMutation('yarn/delete', { id });
  };

  const bulkSaveYarnAllocations = async (items: YarnAllocationRecord[], replace: boolean = false) => {
    setYarnAllocations(prev => replace ? items : [...items, ...prev.filter(p => !items.some(i => i.id === p.id))]);
    GasClient.clearYarnCache();
    GasClient.saveServerDb({ yarnAllocations: items }).catch(() => {});
    return executeKeepaliveMutation('yarn/save', { yarnAllocations: items, replace });
  };

  // --- Production Ledger ---
  const saveLedgerRecord = async (record: LedgerRecord) => {
    setLedger(prev => {
      const idx = prev.findIndex(r => r.id === record.id);
      const next = idx >= 0 ? prev.map((r, i) => i === idx ? record : r) : [record, ...prev];
      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      return next;
    });

    return executeKeepaliveMutation('ledger/save', { ledger: [record], replace: false });
  };

  const deleteLedgerRecord = async (id: string) => {
    setLedger(prev => {
      const next = prev.filter(r => r.id !== id);
      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      return next;
    });

    return executeKeepaliveMutation('ledger/delete', { id });
  };

  const bulkSaveLedgerRecords = async (records: LedgerRecord[], replace: boolean = false) => {
    setLedger(prev => {
      const next = replace ? records : [...records, ...prev.filter(p => !records.some(r => r.id === p.id))];
      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      return next;
    });

    return executeKeepaliveMutation('ledger/save', { ledger: records, replace });
  };

  const value: GlobalDataContextType = {
    orderPlans,
    yarnAllocations,
    ledger,
    floors,
    isLoading,
    isSyncing,
    lastSyncedAt,
    syncError,
    refreshAll,
    saveOrderPlan,
    deleteOrderPlan,
    bulkSaveOrderPlans,
    saveYarnAllocation,
    deleteYarnAllocation,
    bulkSaveYarnAllocations,
    saveLedgerRecord,
    deleteLedgerRecord,
    bulkSaveLedgerRecords
  };

  return (
    <GlobalDataContext.Provider value={value}>
      {children}
    </GlobalDataContext.Provider>
  );
};

/**
 * Hook to consume global application state with zero tab-switching overhead.
 */
export const useGlobalData = () => {
  const context = useContext(GlobalDataContext);
  if (!context) {
    throw new Error('useGlobalData must be used within a GlobalDataProvider');
  }
  return context;
};
