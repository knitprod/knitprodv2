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
import { generateInitialLedger } from '../components/ProductionLedgerView';
import { normalizeDateKey, normalizeFloorKey } from '../lib/userPermissions';

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
  deleteLedgerRecord: (id: string, recordInfo?: { date?: string; floor?: string }) => Promise<{ success: boolean; message?: string }>;
  bulkSaveLedgerRecords: (records: LedgerRecord[], replace?: boolean) => Promise<{ success: boolean; message?: string }>;
}

const GlobalDataContext = createContext<GlobalDataContextType | null>(null);

const POLLING_INTERVAL_MS = 12000; // 12 seconds responsive background polling (paused when tab hidden)

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

function sanitizeLedgerRecords(records: LedgerRecord[]): LedgerRecord[] {
  if (!records || !Array.isArray(records)) return [];
  return records
    .filter((r: LedgerRecord) => r.id !== 'rec-2026-08-11-extension')
    .map((r: LedgerRecord) => {
      if (r.id === 'rec-2026-08-26-efl-extension-1787807712863' || (r.date === '2026-08-26' && (r.floor === 'EFL-Extension' || r.unit === 'EFL-Extension'))) {
        return {
          ...r,
          target: 2160,
          targetBulk: 2160,
          idleProduction: 900,
          efficiency: 134.91
        };
      }
      return r;
    });
}

function deduplicateLedgerRecords(records: LedgerRecord[]): LedgerRecord[] {
  if (!records || !Array.isArray(records)) return [];
  const map = new Map<string, LedgerRecord>();
  records.forEach((r, idx) => {
    if (!r) return;
    const dateKey = normalizeDateKey(r.date);
    const floorKey = normalizeFloorKey(r.floor || r.unit || '');
    const compositeKey = (dateKey && floorKey) ? `${dateKey}_${floorKey}` : (r.id || `rec-idx-${idx}`);
    
    // Merge / keep the most complete record
    const existing = map.get(compositeKey);
    if (!existing) {
      map.set(compositeKey, r);
    } else {
      // Prioritize the entry with non-empty production/target or newer update
      const existingProd = Number(existing.totalProduction) || Number(existing.bulkProd) || 0;
      const currentProd = Number(r.totalProduction) || Number(r.bulkProd) || 0;
      if (currentProd >= existingProd) {
        map.set(compositeKey, { ...existing, ...r });
      } else {
        map.set(compositeKey, { ...r, ...existing });
      }
    }
  });
  return Array.from(map.values());
}

function deduplicateWithUniqueIds<T extends { id?: string }>(items: T[], prefix: string): T[] {
  if (!items || !Array.isArray(items)) return [];
  const seen = new Set<string>();
  const results: T[] = [];
  items.forEach((item, idx) => {
    let id = item.id;
    if (!id || typeof id !== 'string' || !id.trim()) {
      id = `${prefix}-${Date.now()}-${idx}`;
    }
    if (!seen.has(id)) {
      seen.add(id);
      results.push({ ...item, id });
    }
  });
  return results;
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
        if (Array.isArray(parsed) && parsed.length > 0) {
          const sanitized = parsed.map((r: LedgerRecord) => {
            if (r.id === 'rec-2026-08-26-efl-extension-1787807712863' && (r.targetBulk === 7200 || r.target === 3541)) {
              return {
                ...r,
                target: 2160,
                targetBulk: 2160,
                idleProduction: 900,
                efficiency: 134.91
              };
            }
            return r;
          });
          return deduplicateLedgerRecords(sanitized);
        }
      }
    } catch (e) {}
    return generateInitialLedger();
  });

  const [floors, setFloors] = useState<FactoryFloor[]>(INITIAL_FLOORS);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const isInitialMount = useRef<boolean>(true);
  const lastSettingsSyncRef = useRef<string | null>(null);

  // Deletion blacklist sets in memory to prevent background polling or stale edge CDN caches from resurrecting deleted records
  const deletedLedgerIdsRef = useRef<Set<string>>(new Set());
  const deletedLedgerCompositeKeysRef = useRef<Set<string>>(new Set());
  const deletedOrderIdsRef = useRef<Set<string>>(new Set());
  const deletedYarnIdsRef = useRef<Set<string>>(new Set());

  // Track recently mutated ledger record keys with timestamp to protect optimistic updates from stale polling responses
  const pendingLedgerMutationsRef = useRef<Map<string, { record: LedgerRecord; timestamp: number }>>(new Map());
  const lastMutationTimeRef = useRef<number>(0);

  // Filter out any locally deleted records
  const filterDeletedLedger = useCallback((records: LedgerRecord[]): LedgerRecord[] => {
    if (!Array.isArray(records)) return [];
    return records.filter(r => {
      if (!r) return false;
      if (r.id && deletedLedgerIdsRef.current.has(r.id)) return false;
      const dKey = normalizeDateKey(r.date);
      const fKey = normalizeFloorKey(r.floor || r.unit || '');
      if (dKey && fKey && deletedLedgerCompositeKeysRef.current.has(`${dKey}_${fKey}`)) return false;
      return true;
    });
  }, []);

  const filterDeletedOrders = useCallback((orders: OrderPlan[]): OrderPlan[] => {
    if (!Array.isArray(orders)) return [];
    return orders.filter(o => {
      if (!o) return false;
      if (o.id && deletedOrderIdsRef.current.has(o.id)) return false;
      if (o.ewo && deletedOrderIdsRef.current.has(o.ewo)) return false;
      return true;
    });
  }, []);

  const filterDeletedYarn = useCallback((yarn: YarnAllocationRecord[]): YarnAllocationRecord[] => {
    if (!Array.isArray(yarn)) return [];
    return yarn.filter(y => {
      if (!y) return false;
      if (y.id && deletedYarnIdsRef.current.has(y.id)) return false;
      return true;
    });
  }, []);

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
            cleanOrders = filterDeletedOrders(deduplicateWithUniqueIds(remoteOrders, 'ord'));
            setOrderPlans(cleanOrders);
            loadedSuccessfully = true;
          }
          if (Array.isArray(remoteYarn) && remoteYarn.length > 0) {
            cleanYarn = filterDeletedYarn(deduplicateWithUniqueIds(remoteYarn, 'yarn'));
            setYarnAllocations(cleanYarn);
            loadedSuccessfully = true;
          }
          if (Array.isArray(remoteLedger) && remoteLedger.length > 0) {
            cleanLedger = filterDeletedLedger(sanitizeLedgerRecords(deduplicateLedgerRecords(remoteLedger)));
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
          cleanOrders = filterDeletedOrders(deduplicateWithUniqueIds(ordersRes.value, 'ord'));
          setOrderPlans(cleanOrders);
          loadedSuccessfully = true;
        }
        if (yarnRes.status === 'fulfilled' && Array.isArray(yarnRes.value) && yarnRes.value.length > 0) {
          cleanYarn = filterDeletedYarn(deduplicateWithUniqueIds(yarnRes.value, 'yarn'));
          setYarnAllocations(cleanYarn);
          loadedSuccessfully = true;
        }
        if (ledgerRes.status === 'fulfilled' && Array.isArray(ledgerRes.value) && ledgerRes.value.length > 0) {
          cleanLedger = filterDeletedLedger(sanitizeLedgerRecords(deduplicateLedgerRecords(ledgerRes.value)));
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
  }, [filterDeletedLedger, filterDeletedOrders, filterDeletedYarn]);

  // 1. Initial Mount: Execute ONE bulk GET request
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      refreshAll(false);
    }
  }, [refreshAll]);

  // 2. Intelligent Background Polling (Only runs when tab is active/visible)
  useEffect(() => {
    let isFetching = false;

    const performSilentPoll = async () => {
      // Never make background requests if user is not on this tab
      if (typeof document !== 'undefined' && document.hidden) return;
      if (isFetching) return;

      isFetching = true;
      try {
        const res = await fetch('/api/sheets?action=all', {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(20000)
        });

        if (!res.ok) return;

        const json = await res.json();
        if (json && json.success && json.data) {
          const { orderPlans: rOrders, yarnAllocations: rYarn, ledger: rLedger } = json.data;
          if (Array.isArray(rOrders) && rOrders.length > 0) {
            const cleanOrders = filterDeletedOrders(deduplicateWithUniqueIds(rOrders, 'ord'));
            setOrderPlans(prev => {
              if (prev.length !== cleanOrders.length || JSON.stringify(prev) !== JSON.stringify(cleanOrders)) {
                try {
                  localStorage.setItem('cached_order_plans', JSON.stringify(cleanOrders));
                } catch (e) {}
                return cleanOrders;
              }
              return prev;
            });
          }
          if (Array.isArray(rYarn) && rYarn.length > 0) {
            const cleanYarn = filterDeletedYarn(deduplicateWithUniqueIds(rYarn, 'yarn'));
            setYarnAllocations(prev => {
              if (prev.length !== cleanYarn.length || JSON.stringify(prev) !== JSON.stringify(cleanYarn)) {
                try {
                  localStorage.setItem('cached_yarn_allocations', JSON.stringify(cleanYarn));
                } catch (e) {}
                return cleanYarn;
              }
              return prev;
            });
          }
          if (Array.isArray(rLedger) && rLedger.length > 0) {
            let cleanLedger = filterDeletedLedger(sanitizeLedgerRecords(deduplicateLedgerRecords(rLedger)));

            // Re-apply any recent local mutations (< 45s old) that may not have completed propagation to Google Sheets
            const now = Date.now();
            const recentMutations: LedgerRecord[] = [];
            pendingLedgerMutationsRef.current.forEach((val, key) => {
              if (now - val.timestamp < 45000) {
                recentMutations.push(val.record);
              } else {
                pendingLedgerMutationsRef.current.delete(key);
              }
            });

            if (recentMutations.length > 0) {
              const ledgerMap = new Map<string, LedgerRecord>();
              cleanLedger.forEach(r => {
                const dKey = normalizeDateKey(r.date);
                const fKey = normalizeFloorKey(r.floor || r.unit || '');
                const k = (dKey && fKey) ? `${dKey}_${fKey}` : (r.id || '');
                if (k) ledgerMap.set(k, r);
              });

              // Overlay recent mutations so they are never reverted
              recentMutations.forEach(m => {
                const dKey = normalizeDateKey(m.date);
                const fKey = normalizeFloorKey(m.floor || m.unit || '');
                const k = (dKey && fKey) ? `${dKey}_${fKey}` : (m.id || '');
                if (k) {
                  ledgerMap.set(k, m);
                } else {
                  cleanLedger.unshift(m);
                }
              });

              cleanLedger = Array.from(ledgerMap.values());
            }

            setLedger(prev => {
              if (prev.length !== cleanLedger.length || JSON.stringify(prev) !== JSON.stringify(cleanLedger)) {
                setFloors(fl => recalculateFloorsFromLedger(fl, cleanLedger));
                try {
                  localStorage.setItem('cached_production_ledger', JSON.stringify(cleanLedger));
                } catch (e) {}
                return cleanLedger;
              }
              return prev;
            });
          }
          setLastSyncedAt(new Date());
        }
      } catch {
        // Silent catch for background poll
      } finally {
        isFetching = false;
      }
    };

    const interval = setInterval(performSilentPoll, POLLING_INTERVAL_MS);

    // Instant refresh when user returns to the tab after being away
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        performSilentPoll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [filterDeletedLedger, filterDeletedOrders, filterDeletedYarn]);

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
    if (order.id) deletedOrderIdsRef.current.delete(order.id);
    if (order.ewo) deletedOrderIdsRef.current.delete(order.ewo);

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
    if (id) deletedOrderIdsRef.current.add(id);
    setOrderPlans(prev => {
      const next = prev.filter(o => o.id !== id && o.ewo !== id);
      try {
        localStorage.setItem('cached_order_plans', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    return executeKeepaliveMutation('orders/delete', { id });
  };

  const bulkSaveOrderPlans = async (orders: OrderPlan[], replace: boolean = false) => {
    orders.forEach(o => {
      if (o.id) deletedOrderIdsRef.current.delete(o.id);
      if (o.ewo) deletedOrderIdsRef.current.delete(o.ewo);
    });
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
    if (item.id) deletedYarnIdsRef.current.delete(item.id);
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
    if (id) deletedYarnIdsRef.current.add(id);
    setYarnAllocations(prev => {
      const next = prev.filter(y => y.id !== id);
      try {
        localStorage.setItem('cached_yarn_allocations', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    GasClient.clearYarnCache();
    GasClient.deleteYarnAllocation(id).catch(err => console.warn('Delete yarn allocation notice:', err));
    return executeKeepaliveMutation('yarn/delete', { id });
  };

  const bulkSaveYarnAllocations = async (items: YarnAllocationRecord[], replace: boolean = false) => {
    items.forEach(y => {
      if (y.id) deletedYarnIdsRef.current.delete(y.id);
    });
    setYarnAllocations(prev => replace ? items : [...items, ...prev.filter(p => !items.some(i => i.id === p.id))]);
    GasClient.clearYarnCache();
    GasClient.saveServerDb({ yarnAllocations: items }).catch(() => {});
    return executeKeepaliveMutation('yarn/save', { yarnAllocations: items, replace });
  };

  // --- Production Ledger ---
  const saveLedgerRecord = async (record: LedgerRecord) => {
    if (record.id) deletedLedgerIdsRef.current.delete(record.id);
    const dKey = normalizeDateKey(record.date);
    const fKey = normalizeFloorKey(record.floor || record.unit || '');
    if (dKey && fKey) deletedLedgerCompositeKeysRef.current.delete(`${dKey}_${fKey}`);

    // Register into pending mutations tracking so background polling cannot overwrite this update
    const mutKey = (dKey && fKey) ? `${dKey}_${fKey}` : (record.id || `mut-${Date.now()}`);
    pendingLedgerMutationsRef.current.set(mutKey, { record, timestamp: Date.now() });
    lastMutationTimeRef.current = Date.now();

    setLedger(prev => {
      // Find matching record by ID first, or by identical Date + Floor to prevent duplicate rows
      const targetDateKey = normalizeDateKey(record.date);
      const targetFloorKey = normalizeFloorKey(record.floor || record.unit || '');
      
      const idx = prev.findIndex(r => {
        if (r.id === record.id) return true;
        return normalizeDateKey(r.date) === targetDateKey && normalizeFloorKey(r.floor || r.unit || '') === targetFloorKey;
      });

      const next = idx >= 0 ? prev.map((r, i) => i === idx ? record : r) : [record, ...prev];
      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      try {
        localStorage.setItem('cached_production_ledger', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    return executeKeepaliveMutation('ledger/save', { ledger: [record], replace: false });
  };

  const deleteLedgerRecord = async (id: string, recordInfo?: { date?: string; floor?: string }) => {
    if (id) {
      deletedLedgerIdsRef.current.add(id);
      pendingLedgerMutationsRef.current.delete(id);
    }
    if (recordInfo?.date && recordInfo?.floor) {
      const dKey = normalizeDateKey(recordInfo.date);
      const fKey = normalizeFloorKey(recordInfo.floor);
      if (dKey && fKey) {
        deletedLedgerCompositeKeysRef.current.add(`${dKey}_${fKey}`);
        pendingLedgerMutationsRef.current.delete(`${dKey}_${fKey}`);
      }
    }

    setLedger(prev => {
      const targetRecord = prev.find(r => r.id === id);
      if (targetRecord) {
        const dKey = normalizeDateKey(targetRecord.date);
        const fKey = normalizeFloorKey(targetRecord.floor || targetRecord.unit || '');
        if (dKey && fKey) {
          deletedLedgerCompositeKeysRef.current.add(`${dKey}_${fKey}`);
          pendingLedgerMutationsRef.current.delete(`${dKey}_${fKey}`);
        }
      }

      const next = prev.filter(r => {
        if (r.id === id) return false;
        if (recordInfo?.date && recordInfo?.floor) {
          if (normalizeDateKey(r.date) === normalizeDateKey(recordInfo.date) &&
              normalizeFloorKey(r.floor || r.unit || '') === normalizeFloorKey(recordInfo.floor)) {
            return false;
          }
        }
        return true;
      });

      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      try {
        localStorage.setItem('cached_production_ledger', JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    GasClient.deleteLedgerEntry(id).catch(() => {});
    return executeKeepaliveMutation('ledger/delete', { id, date: recordInfo?.date, floor: recordInfo?.floor });
  };

  const bulkSaveLedgerRecords = async (records: LedgerRecord[], replace: boolean = false) => {
    const now = Date.now();
    records.forEach(r => {
      if (r.id) deletedLedgerIdsRef.current.delete(r.id);
      const dKey = normalizeDateKey(r.date);
      const fKey = normalizeFloorKey(r.floor || r.unit || '');
      if (dKey && fKey) {
        deletedLedgerCompositeKeysRef.current.delete(`${dKey}_${fKey}`);
        pendingLedgerMutationsRef.current.set(`${dKey}_${fKey}`, { record: r, timestamp: now });
      }
    });
    lastMutationTimeRef.current = now;

    setLedger(prev => {
      if (replace) {
        setFloors(fl => recalculateFloorsFromLedger(fl, records));
        try {
          localStorage.setItem('cached_production_ledger', JSON.stringify(records));
        } catch (e) {}
        return records;
      }
      // Merge records by Date + Floor key to avoid duplicate entries
      const recordMap = new Map<string, LedgerRecord>();
      // Seed with existing records
      prev.forEach(r => {
        const key = `${normalizeDateKey(r.date)}_${normalizeFloorKey(r.floor || r.unit || '')}`;
        recordMap.set(key, r);
      });
      // Upsert new incoming records
      records.forEach(r => {
        const key = `${normalizeDateKey(r.date)}_${normalizeFloorKey(r.floor || r.unit || '')}`;
        recordMap.set(key, r);
      });

      const next = Array.from(recordMap.values());
      setFloors(fl => recalculateFloorsFromLedger(fl, next));
      try {
        localStorage.setItem('cached_production_ledger', JSON.stringify(next));
      } catch (e) {}
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
