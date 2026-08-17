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
import { ProductionEntry, LedgerRecord, ActivityLog, SyncConflictLog, OrderPlan } from '../types';

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

// Firestore Collection Names
const COLLECTIONS = {
  PRODUCTION_ENTRIES: 'production_entries',
  LEDGER_RECORDS: 'ledger_records',
  USERS: 'users',
  ORDER_PLANS: 'order_plans',
  YARN_ALLOCATIONS: 'yarn_allocations',
  SETTINGS: 'settings',
  ACTIVITY_LOGS: 'activity_logs',
  SYNC_CONFLICTS: 'sync_conflicts',
};

export class FirestoreSyncService {
  private static isSyncing = false;

  /**
   * Subscribe to Production Entries - Disconnected (Local Offline Mode)
   */
  static subscribeToProductionEntries(callback: (entries: ProductionEntry[]) => void) {
    return () => {};
  }

  /**
   * Subscribe to Ledger Records - Disconnected (Local Offline Mode)
   */
  static subscribeToLedgerRecords(callback: (records: LedgerRecord[]) => void) {
    return () => {};
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
   * Subscribe to Sync Conflicts - Disconnected (Local Offline Mode)
   */
  static subscribeToConflicts(callback: (conflicts: SyncConflictLog[]) => void) {
    return () => {};
  }

  /**
   * Subscribe to Order Plans - Disconnected (Local Offline Mode)
   */
  static subscribeToOrderPlans(callback: (plans: OrderPlan[]) => void) {
    return () => {};
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

      // 1. Pull Production Entries from Google Sheets & write to Firestore
      try {
        const prodEntries = await GasClient.fetchProductionList({}, true);
        if (prodEntries && prodEntries.length > 0) {
          for (const entry of prodEntries) {
            await this.saveProductionEntry(entry);
            totalSynced++;
          }
        }
      } catch (e) {
        console.warn('Reconcile production entries notice:', e);
      }

      // 2. Pull Ledger Records from Google Sheets & write to Firestore
      try {
        const ledgerRecords = await GasClient.fetchLedgerList(true);
        if (ledgerRecords && ledgerRecords.length > 0) {
          for (const rec of ledgerRecords) {
            await this.saveLedgerRecord(rec);
            totalSynced++;
          }
        }
      } catch (e) {
        console.warn('Reconcile ledger records notice:', e);
      }

      return {
        syncedCount: totalSynced,
        conflictsCount: 0,
        message: `Successfully pulled & synchronized ${totalSynced} production & ledger records from Google Sheet.`
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
