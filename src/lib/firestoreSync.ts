/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { GasClient } from './gasClient';
import { SupabaseSync } from './supabaseClient';
import { ProductionEntry, LedgerRecord, ActivityLog, SyncConflictLog, OrderPlan, YarnAllocationRecord } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentUser = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function sanitizeDocId(rawId: string | number | undefined | null, prefix: string): string {
  if (!rawId) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  }
  const clean = String(rawId).trim().replace(/[/\\#?%]/g, '_');
  return clean || `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

// Firestore Collection Names
const COLLECTIONS = {
  PRODUCTION_ENTRIES: 'production_entries',
  LEDGER_RECORDS: 'ledger_records',
  USERS: 'users',
  ORDER_PLANS: 'order_plans',
  YARN_ALLOCATIONS: 'yarn_allocations',
  YARN_STORE: 'yarn_allocations_store',
  SETTINGS: 'settings',
  ACTIVITY_LOGS: 'activity_logs',
  SYNC_CONFLICTS: 'sync_conflicts',
};

export class FirestoreSyncService {
  private static isSyncing = false;
  private static isQuotaExceededState = false;
  private static quotaMessage = '';
  private static quotaListeners: Array<(exceeded: boolean, message: string) => void> = [];

  /**
   * Check if an error is a Firestore Quota limit exceeded error
   */
  static isQuotaError(err: any): boolean {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : (err.message || String(err));
    const code = err.code || '';
    return (
      code === 'resource-exhausted' ||
      msg.includes('Quota limit exceeded') ||
      msg.includes('Quota exceeded') ||
      msg.includes('Free daily write units') ||
      msg.includes('resource-exhausted')
    );
  }

  /**
   * Set and broadcast Quota Exceeded state
   */
  static setQuotaExceeded(exceeded: boolean, message?: string) {
    FirestoreSyncService.isQuotaExceededState = exceeded;
    if (message) FirestoreSyncService.quotaMessage = message;
    FirestoreSyncService.quotaListeners.forEach(cb => {
      try {
        cb(exceeded, FirestoreSyncService.quotaMessage);
      } catch (e) {}
    });
  }

  /**
   * Check if Firestore Quota is currently exceeded
   */
  static getIsQuotaExceeded(): boolean {
    return FirestoreSyncService.isQuotaExceededState;
  }

  static isQuotaExceeded(): boolean {
    return FirestoreSyncService.isQuotaExceededState;
  }

  static getQuotaMessage(): string {
    return FirestoreSyncService.quotaMessage;
  }

  /**
   * Subscribe to Quota status changes
   */
  static subscribeToQuotaStatus(callback: (exceeded: boolean, message: string) => void) {
    FirestoreSyncService.quotaListeners.push(callback);
    callback(FirestoreSyncService.isQuotaExceededState, FirestoreSyncService.quotaMessage);
    return () => {
      FirestoreSyncService.quotaListeners = FirestoreSyncService.quotaListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Subscribe to Production Entries with Realtime onSnapshot listener
   */
  static subscribeToProductionEntries(callback: (entries: ProductionEntry[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.PRODUCTION_ENTRIES);
      return onSnapshot(colRef, (snapshot) => {
        const entries: ProductionEntry[] = [];
        snapshot.forEach((docSnap) => {
          entries.push({ id: docSnap.id, ...docSnap.data() } as ProductionEntry);
        });
        callback(entries);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore production entries snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Subscribe to Ledger Records with Realtime onSnapshot listener
   */
  static subscribeToLedgerRecords(callback: (records: LedgerRecord[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.LEDGER_RECORDS);
      return onSnapshot(colRef, (snapshot) => {
        const records: LedgerRecord[] = [];
        snapshot.forEach((docSnap) => {
          records.push({ id: docSnap.id, ...docSnap.data() } as LedgerRecord);
        });
        callback(records);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore ledger records snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Subscribe to Order Plans with Realtime onSnapshot listener
   */
  static subscribeToOrderPlans(callback: (plans: OrderPlan[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.ORDER_PLANS);
      return onSnapshot(colRef, (snapshot) => {
        const plans: OrderPlan[] = [];
        snapshot.forEach((docSnap) => {
          plans.push({ id: docSnap.id, ...docSnap.data() } as OrderPlan);
        });
        callback(plans);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore order plans snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Subscribe to Yarn Allocations with Realtime onSnapshot listener from Firebase Firestore
   */
  static subscribeToYarnAllocations(callback: (allocations: YarnAllocationRecord[]) => void) {
    try {
      // 1. Listen to real-time metadata doc on yarn_allocations_store
      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      
      const loadAllChunks = async () => {
        if (FirestoreSyncService.isQuotaExceededState) return;
        try {
          const storeCol = collection(db, COLLECTIONS.YARN_STORE);
          const chunkDocs = await getDocs(storeCol);
          const allYarn: YarnAllocationRecord[] = [];
          
          chunkDocs.forEach((d) => {
            if (d.id.startsWith('chunk_')) {
              const data = d.data();
              if (data && Array.isArray(data.items)) {
                allYarn.push(...data.items);
              }
            }
          });

          if (allYarn.length > 0) {
            callback(allYarn);
            return;
          }

          // Check individual docs collection as fallback
          const colRef = collection(db, COLLECTIONS.YARN_ALLOCATIONS);
          const snap = await getDocs(colRef);
          if (!snap.empty) {
            const list: YarnAllocationRecord[] = [];
            snap.forEach(ds => list.push({ id: ds.id, ...ds.data() } as YarnAllocationRecord));
            if (list.length > 0) {
              callback(list);
              return;
            }
          }

          // If Firestore is empty or unpopulated, fetch from server persistent DB
          try {
            const serverRes = await fetch('/api/db');
            if (serverRes.ok) {
              const serverJson = await serverRes.json();
              if (serverJson && Array.isArray(serverJson.yarnAllocations) && serverJson.yarnAllocations.length > 0) {
                callback(serverJson.yarnAllocations);
              }
            }
          } catch (e) {}
        } catch (err) {
          if (FirestoreSyncService.isQuotaError(err)) {
            FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
          } else {
            console.warn('loadAllChunks notice in subscribeToYarnAllocations:', err);
          }
        }
      };

      // Initial immediate fetch
      loadAllChunks();

      // Realtime listener on meta doc
      return onSnapshot(metaDocRef, (metaSnap) => {
        if (metaSnap.exists()) {
          loadAllChunks();
        }
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore yarn store metadata snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Subscribe to Activity Logs in Firestore with Realtime listener
   */
  static subscribeToActivityLogs(callback: (logs: ActivityLog[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.ACTIVITY_LOGS);
      return onSnapshot(colRef, (snapshot) => {
        const logsList: ActivityLog[] = [];
        snapshot.forEach((docSnap) => {
          logsList.push({ id: docSnap.id, ...docSnap.data() } as ActivityLog);
        });
        // Sort newest first
        logsList.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        callback(logsList);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore activity logs snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Save / Update Activity Log in Supabase & Firebase Firestore
   */
  static async saveActivityLog(log: ActivityLog): Promise<void> {
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.logActivity({
        userId: log.id || 'SYS',
        userName: log.floorId || 'Floor Event',
        action: log.type || 'Activity',
        details: log.message || '',
        floor: log.floorId || '',
        timestamp: log.timestamp
      }).catch((e) => console.warn('Supabase logActivity notice:', e));
    }

    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docId = log.id || `act-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.ACTIVITY_LOGS, docId);
      const nowIso = new Date().toISOString();

      await setDoc(docRef, {
        ...log,
        id: docId,
        timestamp: log.timestamp || nowIso,
        createdAt: nowIso
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      } else {
        console.warn('saveActivityLog notice:', err);
      }
    }
  }

  /**
   * Seed Initial Activity Logs into Firestore if collection is empty
   */
  static async seedInitialActivityLogsIfEmpty(initialLogs: ActivityLog[]): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const colRef = collection(db, COLLECTIONS.ACTIVITY_LOGS);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty && initialLogs.length > 0) {
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();
        initialLogs.forEach((log) => {
          const docId = log.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const docRef = doc(db, COLLECTIONS.ACTIVITY_LOGS, docId);
          batch.set(docRef, {
            ...log,
            id: docId,
            timestamp: log.timestamp || nowIso,
            createdAt: nowIso
          });
        });
        await batch.commit();
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      } else {
        console.warn('Initial activity logs seed check skipped:', err);
      }
    }
  }

  /**
   * Subscribe to Sync Conflicts in Firestore
   */
  static subscribeToConflicts(callback: (conflicts: SyncConflictLog[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.SYNC_CONFLICTS);
      return onSnapshot(colRef, (snapshot) => {
        const list: SyncConflictLog[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SyncConflictLog);
        });
        callback(list);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore conflicts snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Subscribe to System Users in Firestore with Realtime listener
   */
  static subscribeToUsers(callback: (users: any[]) => void) {
    try {
      const colRef = collection(db, COLLECTIONS.USERS);
      return onSnapshot(colRef, (snapshot) => {
        const usersList: any[] = [];
        snapshot.forEach((docSnap) => {
          usersList.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(usersList);
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore users snapshot notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Fetch all System Users from Supabase / Firestore directly (with safe timeout & server DB fallback)
   */
  static async fetchUsers(): Promise<any[]> {
    // 1. Try Supabase first if configured
    if (SupabaseSync.isConfigured()) {
      try {
        const supabaseUsers = await SupabaseSync.fetchUsers();
        if (supabaseUsers && supabaseUsers.length > 0) {
          return supabaseUsers;
        }
      } catch (e) {
        console.warn('Supabase fetchUsers notice:', e);
      }
    }

    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const colRef = collection(db, COLLECTIONS.USERS);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Firestore fetchUsers timeout')), 1000)
        );
        const snapshot: any = await Promise.race([getDocs(colRef), timeoutPromise]);
        const usersList: any[] = [];
        snapshot.forEach((docSnap: any) => {
          usersList.push({ id: docSnap.id, ...docSnap.data() });
        });
        if (usersList.length > 0) return usersList;
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }

    // Fallback to server DB
    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const json = await res.json();
        const serverUsers = json?.db?.users || json?.users;
        if (serverUsers && Array.isArray(serverUsers) && serverUsers.length > 0) {
          return serverUsers;
        }
      }
    } catch (e) {}

    return [];
  }

  /**
   * Save / Update User document directly in Supabase and Firebase Firestore
   */
  static async saveUser(user: any): Promise<void> {
    const docId = (user.uid || user.id || '').toString().trim().toUpperCase();
    if (!docId) return;

    // 1. Save to Supabase if configured
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.saveUser(user).catch((e) => console.warn('Supabase saveUser notice:', e));
    }

    // Save to server DB as reliable fallback
    try {
      const currentUsers = await FirestoreSyncService.fetchUsers();
      const idx = currentUsers.findIndex(u => (u.uid || u.id || '').toString().toUpperCase() === docId);
      if (idx >= 0) {
        currentUsers[idx] = { ...currentUsers[idx], ...user };
      } else {
        currentUsers.push({ ...user, uid: docId });
      }
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: currentUsers })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      const docRef = doc(db, COLLECTIONS.USERS, docId);
      const nowIso = new Date().toISOString();

      await setDoc(docRef, {
        ...user,
        id: docId,
        uid: docId,
        updatedAt: nowIso
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  /**
   * Delete User document directly from Supabase and Firebase Firestore
   */
  static async deleteUser(uidOrId: string): Promise<void> {
    if (!uidOrId) return;
    const docId = uidOrId.toString().trim().toUpperCase();

    // 1. Delete from Supabase if configured
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.deleteUser(docId).catch((e) => console.warn('Supabase deleteUser notice:', e));
    }

    try {
      const currentUsers = await FirestoreSyncService.fetchUsers();
      const updated = currentUsers.filter(u => (u.uid || u.id || '').toString().toUpperCase() !== docId);
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: updated })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      const docRef = doc(db, COLLECTIONS.USERS, docId);
      await deleteDoc(docRef);
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  /**
   * Seed Initial System Users into Supabase & Firestore if collection is empty
   */
  static async seedInitialUsersIfEmpty(initialUsers: any[]): Promise<void> {
    if (SupabaseSync.isConfigured()) {
      try {
        const existing = await SupabaseSync.fetchUsers();
        if (!existing || existing.length === 0) {
          for (const u of initialUsers) {
            await SupabaseSync.saveUser(u);
          }
        }
      } catch (e) {
        console.warn('Supabase seedUsers notice:', e);
      }
    }

    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const colRef = collection(db, COLLECTIONS.USERS);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty && initialUsers.length > 0) {
        const batch = writeBatch(db);
        const nowIso = new Date().toISOString();
        initialUsers.forEach((usr) => {
          const docId = (usr.uid || usr.id).toString().trim().toUpperCase();
          const docRef = doc(db, COLLECTIONS.USERS, docId);
          batch.set(docRef, {
            ...usr,
            id: docId,
            uid: docId,
            createdAt: nowIso,
            updatedAt: nowIso
          });
        });
        await batch.commit();
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      } else {
        console.warn('Initial users seed check skipped:', err);
      }
    }
  }

  /**
   * Subscribe to Global System Settings in Firestore (doc: config)
   */
  static subscribeToSettings(callback: (settings: Record<string, any>) => void) {
    // Also fetch initial from Supabase if configured
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.fetchSettings().then((s) => {
        if (s) callback(s);
      }).catch(() => {});
    }

    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          callback(docSnap.data());
        }
      }, (error) => {
        if (FirestoreSyncService.isQuotaError(error)) {
          FirestoreSyncService.setQuotaExceeded(true, error.message);
        } else {
          console.warn('Firestore settings snapshot listener notice:', error);
        }
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Fetch System Settings from Supabase / Firestore
   */
  static async fetchSettings(): Promise<Record<string, any>> {
    if (SupabaseSync.isConfigured()) {
      try {
        const s = await SupabaseSync.fetchSettings();
        if (s && Object.keys(s).length > 0) return s;
      } catch (e) {
        console.warn('Supabase fetchSettings notice:', e);
      }
    }

    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data();
        }
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }

    try {
      const res = await fetch('/api/db');
      if (res.ok) {
        const json = await res.json();
        if (json && json.settings) return json.settings;
      }
    } catch (e) {}

    return {};
  }

  /**
   * Save / Update System Settings in Supabase & Firebase Firestore
   */
  static async saveSettings(settingsMap: Record<string, any>): Promise<void> {
    if (SupabaseSync.isConfigured()) {
      SupabaseSync.saveSettings(settingsMap).catch((e) => console.warn('Supabase saveSettings notice:', e));
    }

    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: settingsMap, ...settingsMap })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
      const nowIso = new Date().toISOString();
      await setDoc(docRef, {
        ...settingsMap,
        updatedAt: nowIso
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  /**
   * TWO-WAY GATEWAY RECONCILIATION: Pull Google Sheets manual edits & sync into Firestore & Web
   */
  static async reconcileSheetsAndFirestore(): Promise<{
    syncedCount: number;
    conflictsCount: number;
    message: string;
  }> {
    try {
      if (GasClient.getDatabaseMode() !== 'gas') {
        return { syncedCount: 0, conflictsCount: 0, message: 'System is operating in offline standalone local mode.' };
      }

      let totalSynced = 0;

      // 1. Pull Ledger Records from Google Sheets & write to local DB
      try {
        const ledgerRecords = await GasClient.fetchLedgerList(true);
        if (ledgerRecords && ledgerRecords.length > 0) {
          await this.batchSaveLedgerRecords(ledgerRecords, 'Sheet Sync');
          totalSynced += ledgerRecords.length;
        }
      } catch (e) {
        console.warn('Reconcile ledger records notice:', e);
      }

      return {
        syncedCount: totalSynced,
        conflictsCount: 0,
        message: `Successfully synchronized ${totalSynced} records from Google Sheets.`
      };
    } catch (err: any) {
      return {
        syncedCount: 0,
        conflictsCount: 1,
        message: err.message || 'Synchronization encountered an error.'
      };
    }
  }

  /**
   * Seed Initial Mock Data - Offline Standalone Mode
   */
  static async seedInitialDataIfEmpty(initialEntries: ProductionEntry[], initialLogs: ActivityLog[], initialLedger?: LedgerRecord[]) {
    return;
  }

  /**
   * Helper persistence methods for Production Entries, Order Plans, and Ledger Records
   */
  static async saveProductionEntry(entry: ProductionEntry, operatorName?: string): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docId = entry.id || `entry-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.PRODUCTION_ENTRIES, docId);
      await setDoc(docRef, { ...entry, id: docId, operatorName: operatorName || 'Operator', updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async saveOrderPlan(plan: OrderPlan): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docId = plan.id || `plan-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.ORDER_PLANS, docId);
      await setDoc(docRef, { ...plan, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async deleteOrderPlan(planId: string): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      if (!planId) return;
      const docRef = doc(db, COLLECTIONS.ORDER_PLANS, planId);
      await deleteDoc(docRef);
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async saveLedgerRecord(record: LedgerRecord, operatorName?: string): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docId = record.id || `ledger-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.LEDGER_RECORDS, docId);
      await setDoc(docRef, { ...record, id: docId, operatorName: operatorName || 'Manager', updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async batchSaveLedgerRecords(records: LedgerRecord[], operatorName?: string): Promise<void> {
    // Always persist to server DB
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledgerRecords: records })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      if (!records || records.length === 0) return;
      const CHUNK_SIZE = 250;
      for (let i = 0; i < records.length; i += CHUNK_SIZE) {
        const chunk = records.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(rec => {
          const docId = rec.id || `ledger-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const docRef = doc(db, COLLECTIONS.LEDGER_RECORDS, docId);
          batch.set(docRef, {
            ...rec,
            id: docId,
            operatorName: operatorName || 'Manager',
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async deleteLedgerRecord(recordId: string): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      if (!recordId) return;
      const docRef = doc(db, COLLECTIONS.LEDGER_RECORDS, recordId);
      await deleteDoc(docRef);
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async saveYarnAllocation(item: YarnAllocationRecord): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docId = sanitizeDocId(item.id || `yarn-${item.orderNumber}-${item.fabricShade}-${item.yarnRequired || ''}-${item.lotNo || ''}`, 'yarn');
      const docRef = doc(db, COLLECTIONS.YARN_ALLOCATIONS, docId);
      await setDoc(docRef, {
        ...item,
        id: item.id || docId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      await setDoc(metaDocRef, {
        updatedAt: new Date().toISOString(),
        version: Date.now(),
        lastAction: 'single_update'
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async batchSaveYarnAllocations(items: YarnAllocationRecord[], replace: boolean = false): Promise<void> {
    // Always persist to server local DB
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yarnAllocations: items })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      if (!items || items.length === 0) return;

      const CHUNK_SIZE = 500;
      const chunkCount = Math.ceil(items.length / CHUNK_SIZE);

      for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE);
        const chunkItems = items.slice(i, i + CHUNK_SIZE);
        const chunkDocRef = doc(db, COLLECTIONS.YARN_STORE, `chunk_${chunkIndex}`);
        await setDoc(chunkDocRef, {
          chunkIndex,
          items: chunkItems,
          updatedAt: new Date().toISOString()
        });
      }

      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      await setDoc(metaDocRef, {
        updatedAt: new Date().toISOString(),
        version: Date.now(),
        totalRecords: items.length,
        chunkCount: chunkCount
      });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async deleteYarnAllocation(id: string): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      if (!id) return;
      const docId = sanitizeDocId(id, 'yarn');
      const docRef = doc(db, COLLECTIONS.YARN_ALLOCATIONS, docId);
      await deleteDoc(docRef);

      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      await setDoc(metaDocRef, {
        updatedAt: new Date().toISOString(),
        version: Date.now(),
        lastAction: 'delete'
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async fetchYarnAllocations(): Promise<YarnAllocationRecord[]> {
    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const storeCol = collection(db, COLLECTIONS.YARN_STORE);
        const chunkDocs = await getDocs(storeCol);
        const allYarn: YarnAllocationRecord[] = [];
        
        chunkDocs.forEach((d) => {
          if (d.id.startsWith('chunk_')) {
            const data = d.data();
            if (data && Array.isArray(data.items)) {
              allYarn.push(...data.items);
            }
          }
        });

        if (allYarn.length > 0) {
          return allYarn;
        }

        const colRef = collection(db, COLLECTIONS.YARN_ALLOCATIONS);
        const snapshot = await getDocs(colRef);
        const list: YarnAllocationRecord[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as YarnAllocationRecord);
        });
        if (list.length > 0) return list;
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }

    try {
      const serverRes = await fetch('/api/db');
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson && Array.isArray(serverJson.yarnAllocations) && serverJson.yarnAllocations.length > 0) {
          return serverJson.yarnAllocations;
        }
      }
    } catch (e) {}
    return [];
  }

  static async batchSaveOrderPlans(plans: OrderPlan[], replace: boolean = false): Promise<void> {
    try {
      await fetch('/api/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderPlans: plans })
      });
    } catch (e) {}

    if (FirestoreSyncService.isQuotaExceededState) return;

    try {
      if (!plans || plans.length === 0) return;

      const CHUNK_SIZE = 250;
      for (let i = 0; i < plans.length; i += CHUNK_SIZE) {
        const chunk = plans.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(plan => {
          const docId = sanitizeDocId(plan.id || plan.ewo, 'plan');
          const docRef = doc(db, COLLECTIONS.ORDER_PLANS, docId);
          batch.set(docRef, {
            ...plan,
            id: plan.id || docId,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        });
        await batch.commit();
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }

  static async fetchOrderPlans(): Promise<OrderPlan[]> {
    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const colRef = collection(db, COLLECTIONS.ORDER_PLANS);
        const snapshot = await getDocs(colRef);
        const list: OrderPlan[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as OrderPlan);
        });
        if (list.length > 0) return list;
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }

    try {
      const serverRes = await fetch('/api/db');
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson && Array.isArray(serverJson.orderPlans) && serverJson.orderPlans.length > 0) {
          return serverJson.orderPlans;
        }
      }
    } catch (e) {}

    return [];
  }

  static async fetchLedgerRecords(): Promise<LedgerRecord[]> {
    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const colRef = collection(db, COLLECTIONS.LEDGER_RECORDS);
        const snapshot = await getDocs(colRef);
        const list: LedgerRecord[] = [];
        snapshot.forEach(docSnap => {
          list.push({ id: docSnap.id, ...docSnap.data() } as LedgerRecord);
        });
        if (list.length > 0) return list;
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }

    try {
      const serverRes = await fetch('/api/db');
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson && Array.isArray(serverJson.ledgerRecords) && serverJson.ledgerRecords.length > 0) {
          return serverJson.ledgerRecords;
        }
      }
    } catch (e) {}

    return [];
  }

  /**
   * Fetch global App Configuration directly from Firestore (doc: settings/app_config)
   */
  static async fetchAppConfigFromFirestore(): Promise<{ gasWebAppUrl?: string; databaseMode?: 'gas' | 'mock' } | null> {
    try {
      if (!FirestoreSyncService.isQuotaExceededState) {
        const docRef = doc(db, COLLECTIONS.SETTINGS, 'app_config');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            return {
              gasWebAppUrl: data.gasWebAppUrl,
              databaseMode: data.databaseMode
            };
          }
        }
      }
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
    return null;
  }

  /**
   * Subscribe to global App Configuration changes in Firestore (GAS Web App URL & DB mode)
   */
  static subscribeToAppConfig(callback: (config: { gasWebAppUrl?: string; databaseMode?: 'gas' | 'mock' }) => void) {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'app_config');
      return onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && (data.gasWebAppUrl || data.databaseMode)) {
            callback({
              gasWebAppUrl: data.gasWebAppUrl,
              databaseMode: data.databaseMode,
            });
          }
        }
      }, (err) => {
        if (FirestoreSyncService.isQuotaError(err)) {
          FirestoreSyncService.setQuotaExceeded(true, err.message);
        } else {
          console.warn('App config Firestore listener notice:', err);
        }
      });
    } catch (e) {
      if (FirestoreSyncService.isQuotaError(e)) {
        FirestoreSyncService.setQuotaExceeded(true, (e as any)?.message);
      }
      return () => {};
    }
  }

  /**
   * Persists global App Configuration to Firestore so every device updates in real time.
   */
  static async saveAppConfigToFirestore(gasWebAppUrl: string, databaseMode: 'gas' | 'mock'): Promise<void> {
    if (FirestoreSyncService.isQuotaExceededState) return;
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'app_config');
      await setDoc(docRef, {
        gasWebAppUrl: gasWebAppUrl.trim(),
        databaseMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      if (FirestoreSyncService.isQuotaError(err)) {
        FirestoreSyncService.setQuotaExceeded(true, (err as any)?.message);
      }
    }
  }
}
