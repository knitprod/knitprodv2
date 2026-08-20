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
        console.warn('Firestore production entries snapshot error:', error);
      });
    } catch (err) {
      console.warn('subscribeToProductionEntries init error:', err);
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
        console.warn('Firestore ledger records snapshot error:', error);
      });
    } catch (err) {
      console.warn('subscribeToLedgerRecords init error:', err);
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
        console.warn('Firestore order plans snapshot error:', error);
      });
    } catch (err) {
      console.warn('subscribeToOrderPlans init error:', err);
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

          // If Firestore is empty on initial run, fetch from server persistent DB and seed Firestore
          try {
            const serverRes = await fetch('/api/db');
            if (serverRes.ok) {
              const serverJson = await serverRes.json();
              if (serverJson && Array.isArray(serverJson.yarnAllocations) && serverJson.yarnAllocations.length > 0) {
                callback(serverJson.yarnAllocations);
                // Seed Firestore in the background
                FirestoreSyncService.batchSaveYarnAllocations(serverJson.yarnAllocations, false).catch(() => {});
              }
            }
          } catch (e) {}
        } catch (err) {
          console.warn('loadAllChunks error in subscribeToYarnAllocations:', err);
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
        console.warn('Firestore yarn store metadata snapshot warning:', error);
      });
    } catch (err) {
      console.warn('subscribeToYarnAllocations init error:', err);
      return () => {};
    }
  }

  /**
   * Subscribe to Activity Logs in Firestore with Realtime listener
   */
  static subscribeToActivityLogs(callback: (logs: ActivityLog[]) => void) {
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
      console.warn('Firestore activity logs snapshot error:', error);
    });
  }

  /**
   * Save / Update Activity Log in Firebase Firestore
   */
  static async saveActivityLog(log: ActivityLog): Promise<void> {
    const docId = log.id || `act-${Date.now()}`;
    const docRef = doc(db, COLLECTIONS.ACTIVITY_LOGS, docId);
    const nowIso = new Date().toISOString();

    await setDoc(docRef, {
      ...log,
      id: docId,
      timestamp: log.timestamp || nowIso,
      createdAt: nowIso
    }, { merge: true });
  }

  /**
   * Seed Initial Activity Logs into Firestore if collection is empty
   */
  static async seedInitialActivityLogsIfEmpty(initialLogs: ActivityLog[]): Promise<void> {
    try {
      const colRef = collection(db, COLLECTIONS.ACTIVITY_LOGS);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty && initialLogs.length > 0) {
        console.log('Seeding initial activity logs into Firebase Firestore...');
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
        console.log('Firebase Firestore activity logs initial seeding complete.');
      }
    } catch (err) {
      console.warn('Initial activity logs seed check skipped:', err);
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
        console.warn('Firestore conflicts snapshot error:', error);
      });
    } catch (err) {
      return () => {};
    }
  }

  /**
   * Subscribe to System Users in Firestore with Realtime listener
   */
  static subscribeToUsers(callback: (users: any[]) => void) {
    const colRef = collection(db, COLLECTIONS.USERS);
    return onSnapshot(colRef, (snapshot) => {
      const usersList: any[] = [];
      snapshot.forEach((docSnap) => {
        usersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(usersList);
    }, (error) => {
      console.warn('Firestore users snapshot error:', error);
    });
  }

  /**
   * Fetch all System Users from Firestore directly
   */
  static async fetchUsers(): Promise<any[]> {
    try {
      const colRef = collection(db, COLLECTIONS.USERS);
      const snapshot = await getDocs(colRef);
      const usersList: any[] = [];
      snapshot.forEach((docSnap) => {
        usersList.push({ id: docSnap.id, ...docSnap.data() });
      });
      return usersList;
    } catch (err) {
      console.error('Failed to fetch users from Firestore:', err);
      return [];
    }
  }

  /**
   * Save / Update User document directly in Firebase Firestore
   */
  static async saveUser(user: any): Promise<void> {
    const docId = (user.uid || user.id || '').toString().trim().toUpperCase();
    if (!docId) return;

    const docRef = doc(db, COLLECTIONS.USERS, docId);
    const nowIso = new Date().toISOString();

    await setDoc(docRef, {
      ...user,
      id: docId,
      uid: docId,
      updatedAt: nowIso
    }, { merge: true });
  }

  /**
   * Delete User document directly from Firebase Firestore
   */
  static async deleteUser(uidOrId: string): Promise<void> {
    if (!uidOrId) return;
    const docId = uidOrId.toString().trim().toUpperCase();
    const docRef = doc(db, COLLECTIONS.USERS, docId);
    await deleteDoc(docRef);
  }

  /**
   * Seed Initial System Users into Firestore if collection is empty
   */
  static async seedInitialUsersIfEmpty(initialUsers: any[]): Promise<void> {
    try {
      const colRef = collection(db, COLLECTIONS.USERS);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty && initialUsers.length > 0) {
        console.log('Seeding initial system users into Firebase Firestore...');
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
        console.log('Firebase Firestore users initial seeding complete.');
      }
    } catch (err) {
      console.warn('Initial users seed check skipped:', err);
    }
  }

  /**
   * Subscribe to Global System Settings in Firestore (doc: config)
   */
  static subscribeToSettings(callback: (settings: Record<string, any>) => void) {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      }
    }, (error) => {
      console.warn('Firestore settings snapshot listener error:', error);
    });
  }

  /**
   * Fetch System Settings from Firestore
   */
  static async fetchSettings(): Promise<Record<string, any>> {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.warn('Failed to fetch settings from Firestore:', err);
    }
    return {};
  }

  /**
   * Save / Update System Settings in Firebase Firestore
   */
  static async saveSettings(settingsMap: Record<string, any>): Promise<void> {
    const docRef = doc(db, COLLECTIONS.SETTINGS, 'config');
    const nowIso = new Date().toISOString();
    await setDoc(docRef, {
      ...settingsMap,
      updatedAt: nowIso
    }, { merge: true });
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

      // 1. Pull Ledger Records from Google Sheets & write to Firestore in batch chunks
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
      console.error('reconcileSheetsAndFirestore error:', err);
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
    try {
      const docId = entry.id || `entry-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.PRODUCTION_ENTRIES, docId);
      await setDoc(docRef, { ...entry, id: docId, operatorName: operatorName || 'Operator', updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('saveProductionEntry firestore notice:', e);
    }
  }

  static async saveOrderPlan(plan: OrderPlan): Promise<void> {
    try {
      const docId = plan.id || `plan-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.ORDER_PLANS, docId);
      await setDoc(docRef, { ...plan, id: docId, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('saveOrderPlan firestore notice:', e);
    }
  }

  static async deleteOrderPlan(planId: string): Promise<void> {
    try {
      if (!planId) return;
      const docRef = doc(db, COLLECTIONS.ORDER_PLANS, planId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('deleteOrderPlan firestore notice:', e);
    }
  }

  static async saveLedgerRecord(record: LedgerRecord, operatorName?: string): Promise<void> {
    try {
      const docId = record.id || `ledger-${Date.now()}`;
      const docRef = doc(db, COLLECTIONS.LEDGER_RECORDS, docId);
      await setDoc(docRef, { ...record, id: docId, operatorName: operatorName || 'Manager', updatedAt: new Date().toISOString() }, { merge: true });
    } catch (e) {
      console.warn('saveLedgerRecord firestore notice:', e);
    }
  }

  static async batchSaveLedgerRecords(records: LedgerRecord[], operatorName?: string): Promise<void> {
    try {
      if (!records || records.length === 0) return;
      const CHUNK_SIZE = 300;
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
    } catch (e) {
      console.warn('batchSaveLedgerRecords firestore notice:', e);
    }
  }

  static async deleteLedgerRecord(recordId: string): Promise<void> {
    try {
      if (!recordId) return;
      const docRef = doc(db, COLLECTIONS.LEDGER_RECORDS, recordId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('deleteLedgerRecord firestore notice:', e);
    }
  }

  static async saveYarnAllocation(item: YarnAllocationRecord): Promise<void> {
    try {
      const docId = sanitizeDocId(item.id || `yarn-${item.orderNumber}-${item.fabricShade}-${item.yarnRequired || ''}-${item.lotNo || ''}`, 'yarn');
      const docRef = doc(db, COLLECTIONS.YARN_ALLOCATIONS, docId);
      await setDoc(docRef, {
        ...item,
        id: item.id || docId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Signal update on store meta
      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      await setDoc(metaDocRef, {
        updatedAt: new Date().toISOString(),
        version: Date.now(),
        lastAction: 'single_update'
      }, { merge: true });
    } catch (e) {
      console.warn('saveYarnAllocation firestore notice:', e);
    }
  }

  static async batchSaveYarnAllocations(items: YarnAllocationRecord[], replace: boolean = false): Promise<void> {
    try {
      if (!items || items.length === 0) return;

      const CHUNK_SIZE = 500;
      const chunkCount = Math.ceil(items.length / CHUNK_SIZE);

      // Write chunk documents to YARN_STORE
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

      // If replacing, delete extra obsolete chunks
      if (replace) {
        try {
          const storeCol = collection(db, COLLECTIONS.YARN_STORE);
          const currentDocs = await getDocs(storeCol);
          currentDocs.forEach(d => {
            if (d.id.startsWith('chunk_')) {
              const idx = parseInt(d.id.replace('chunk_', ''), 10);
              if (idx >= chunkCount) {
                deleteDoc(d.ref).catch(() => {});
              }
            }
          });
        } catch (delErr) {}
      }

      // Update meta doc to notify all devices in real time
      const metaDocRef = doc(db, COLLECTIONS.YARN_STORE, 'meta');
      await setDoc(metaDocRef, {
        updatedAt: new Date().toISOString(),
        version: Date.now(),
        totalRecords: items.length,
        chunkCount: chunkCount
      });

      // Also persist to server local DB
      try {
        await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yarnAllocations: items })
        });
      } catch (e) {}

    } catch (e) {
      console.warn('batchSaveYarnAllocations firestore notice:', e);
    }
  }

  static async deleteYarnAllocation(id: string): Promise<void> {
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
    } catch (e) {
      console.warn('deleteYarnAllocation firestore notice:', e);
    }
  }

  static async fetchYarnAllocations(): Promise<YarnAllocationRecord[]> {
    try {
      // 1. Fetch from chunked store
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

      // 2. Fetch from individual docs
      const colRef = collection(db, COLLECTIONS.YARN_ALLOCATIONS);
      const snapshot = await getDocs(colRef);
      const list: YarnAllocationRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as YarnAllocationRecord);
      });
      if (list.length > 0) return list;

      // 3. Fallback to server DB
      const serverRes = await fetch('/api/db');
      if (serverRes.ok) {
        const serverJson = await serverRes.json();
        if (serverJson && Array.isArray(serverJson.yarnAllocations) && serverJson.yarnAllocations.length > 0) {
          return serverJson.yarnAllocations;
        }
      }
      return [];
    } catch (err) {
      console.warn('fetchYarnAllocations from firestore notice:', err);
      return [];
    }
  }

  static async batchSaveOrderPlans(plans: OrderPlan[], replace: boolean = false): Promise<void> {
    try {
      if (!plans || plans.length === 0) return;

      if (replace) {
        try {
          const colRef = collection(db, COLLECTIONS.ORDER_PLANS);
          const oldDocsSnap = await getDocs(colRef);
          if (!oldDocsSnap.empty) {
            const deleteBatch = writeBatch(db);
            let count = 0;
            for (const d of oldDocsSnap.docs) {
              deleteBatch.delete(d.ref);
              count++;
              if (count >= 400) {
                await deleteBatch.commit();
                count = 0;
              }
            }
            if (count > 0) {
              await deleteBatch.commit();
            }
          }
        } catch (delErr) {
          console.warn('Order plans replace cleanup notice:', delErr);
        }
      }

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
    } catch (e) {
      console.warn('batchSaveOrderPlans firestore notice:', e);
    }
  }

  static async fetchOrderPlans(): Promise<OrderPlan[]> {
    try {
      const colRef = collection(db, COLLECTIONS.ORDER_PLANS);
      const snapshot = await getDocs(colRef);
      const list: OrderPlan[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderPlan);
      });
      return list;
    } catch (err) {
      console.warn('fetchOrderPlans from firestore notice:', err);
      return [];
    }
  }

  static async fetchLedgerRecords(): Promise<LedgerRecord[]> {
    try {
      const colRef = collection(db, COLLECTIONS.LEDGER_RECORDS);
      const snapshot = await getDocs(colRef);
      const list: LedgerRecord[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as LedgerRecord);
      });
      return list;
    } catch (err) {
      console.warn('fetchLedgerRecords from firestore notice:', err);
      return [];
    }
  }

  /**
   * Fetch global App Configuration directly from Firestore (doc: settings/app_config)
   */
  static async fetchAppConfigFromFirestore(): Promise<{ gasWebAppUrl?: string; databaseMode?: 'gas' | 'mock' } | null> {
    try {
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
    } catch (e) {
      console.warn('Failed to fetch app_config from Firestore:', e);
    }
    return null;
  }

  /**
   * Subscribe to global App Configuration changes in Firestore (GAS Web App URL & DB mode)
   * This enables instantaneous real-time synchronization across ALL connected devices.
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
        console.warn('App config Firestore listener notice:', err);
      });
    } catch (e) {
      console.warn('Failed to subscribe to app_config in Firestore:', e);
      return () => {};
    }
  }

  /**
   * Persists global App Configuration to Firestore so every device updates in real time.
   */
  static async saveAppConfigToFirestore(gasWebAppUrl: string, databaseMode: 'gas' | 'mock'): Promise<void> {
    try {
      const docRef = doc(db, COLLECTIONS.SETTINGS, 'app_config');
      await setDoc(docRef, {
        gasWebAppUrl: gasWebAppUrl.trim(),
        databaseMode,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      console.warn('Failed to save app_config to Firestore:', e);
    }
  }
}
