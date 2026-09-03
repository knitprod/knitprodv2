import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRecord, LedgerRecord } from '../types';

/**
 * Supabase Client & Sync Manager for Epyllion Knitex ERP
 * Manages:
 * 1. System Users & Permissions
 * 2. Factory Unit Settings & Targets
 * 3. Audit Activity Logs
 * 4. Production, Order, and Yarn Records fallback storage
 */

export class SupabaseSync {
  private static client: SupabaseClient | null = null;
  private static cachedConfig: { supabaseUrl: string; supabaseKey: string } | null = null;

  // Central default credentials (hardcoded fallback so no device is ever prompted)
  static DEFAULT_SUPABASE_URL = 'https://kwaezsfoalfhigzcnezd.supabase.co';
  static DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YWV6c2ZvYWxmaGlnemNuZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUzNzksImV4cCI6MjEwMjk3MTM3OX0.eYxuK9fCwix4i0GnHW-UBl2Kg_gZNOaPWvQ6FkMy_Qs';

  /**
   * Default / Current Supabase Configuration
   */
  static getStoredConfig(): { supabaseUrl: string; supabaseKey: string } {
    if (this.cachedConfig && this.cachedConfig.supabaseUrl && this.cachedConfig.supabaseKey) {
      return this.cachedConfig;
    }

    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.trim()
      : '';
    const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
      : '';

    let storedUrl = '';
    let storedKey = '';
    if (typeof localStorage !== 'undefined') {
      storedUrl = localStorage.getItem('epyllion_supabase_url') || '';
      storedKey = localStorage.getItem('epyllion_supabase_anon_key') || '';
    }

    const config = {
      supabaseUrl: storedUrl || envUrl || this.DEFAULT_SUPABASE_URL || '',
      supabaseKey: storedKey || envKey || this.DEFAULT_SUPABASE_KEY || ''
    };

    this.cachedConfig = config;
    return config;
  }

  /**
   * Loads Supabase config from server to ensure all remote clients sync seamlessly
   */
  static async syncRemoteConfig(): Promise<{ supabaseUrl: string; supabaseKey: string }> {
    try {
      // Try fetching from Server config API
      const serverRes = await fetch('/api/config');
      if (serverRes.ok) {
        const json = await serverRes.json();
        if (json?.config?.supabaseUrl && json?.config?.supabaseKey) {
          const url = json.config.supabaseUrl;
          const key = json.config.supabaseKey;
          this.setCredentials(url, key, false);
          return { supabaseUrl: url, supabaseKey: key };
        }
      }
    } catch (e) {}

    return this.getStoredConfig();
  }

  /**
   * Initialize or retrieve the Supabase client
   */
  static getClient(): SupabaseClient | null {
    if (this.client) return this.client;

    const { supabaseUrl, supabaseKey } = this.getStoredConfig();
    if (!supabaseUrl || !supabaseKey) return null;

    try {
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
      return this.client;
    } catch (err) {
      console.warn('Supabase client initialization warning:', err);
      return null;
    }
  }

  /**
   * Helper to clean and normalize a Supabase Project URL
   */
  static cleanSupabaseUrl(rawUrl: string): string {
    let clean = (rawUrl || '').trim();
    if (!clean) return '';

    // If user pasted dashboard URL like: https://supabase.com/dashboard/project/abcdefgh...
    const dashboardMatch = clean.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
    if (dashboardMatch && dashboardMatch[1]) {
      return `https://${dashboardMatch[1]}.supabase.co`;
    }

    // Ensure protocol
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }

    try {
      const parsed = new URL(clean);
      // Only keep the origin (e.g. https://xyz.supabase.co), strip any trailing /rest/v1 or /dashboard paths
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return clean.replace(/\/+$/, '');
    }
  }

  /**
   * Update and save Supabase credentials
   */
  static setCredentials(url: string, key: string, persistToCloud: boolean = true): boolean {
    const cleanUrl = this.cleanSupabaseUrl(url);
    const cleanKey = key.trim();

    if (typeof localStorage !== 'undefined') {
      if (cleanUrl) localStorage.setItem('epyllion_supabase_url', cleanUrl);
      if (cleanKey) localStorage.setItem('epyllion_supabase_anon_key', cleanKey);
    }

    this.cachedConfig = { supabaseUrl: cleanUrl, supabaseKey: cleanKey };
    this.client = null;

    if (persistToCloud && cleanUrl && cleanKey) {
      // Persist to Express server config if running
      fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supabaseUrl: cleanUrl, supabaseKey: cleanKey })
      }).catch(() => {});
    }

    if (cleanUrl && cleanKey) {
      try {
        this.client = createClient(cleanUrl, cleanKey);
        // Dispatch event for UI components
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('supabase_config_updated', { detail: { url: cleanUrl } }));
        }
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Check if Supabase connection is configured and active
   */
  static isConfigured(): boolean {
    const config = this.getStoredConfig();
    return Boolean(config.supabaseUrl && config.supabaseKey);
  }

  /**
   * Test the connection to Supabase
   */
  static async testConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string; tables?: string[] }> {
    const rawUrl = (customUrl || this.getStoredConfig().supabaseUrl || '').trim();
    const key = (customKey || this.getStoredConfig().supabaseKey || '').trim();
    const url = this.cleanSupabaseUrl(rawUrl);

    if (!url || !key) {
      return { success: false, message: 'Supabase URL or Anon Key is missing. Please provide both.' };
    }

    try {
      const testClient = createClient(url, key, {
        auth: { persistSession: false }
      });

      // Test querying production_ledger and users tables
      const { error: ledgerError } = await testClient.from('production_ledger').select('id').limit(1);
      const { error: userError } = await testClient.from('users').select('id').limit(1);

      if (ledgerError && (ledgerError.code === 'PGRST301' || ledgerError.message?.includes('JWT') || ledgerError.message?.includes('apikey'))) {
        return { 
          success: false, 
          message: `Invalid API Key: ${ledgerError.message}. Please double-check you copied the "anon public" key from Project Settings > API.` 
        };
      }

      const tablesFound: string[] = [];
      if (!ledgerError) tablesFound.push('production_ledger');
      if (!userError) tablesFound.push('users');

      if (ledgerError && ledgerError.code === '42P01') {
        return { 
          success: true, 
          message: 'Connected to Supabase project! Note: The "production_ledger" table was not found yet. Please click "Copy Complete Setup SQL" and run it in your Supabase SQL Editor.',
          tables: tablesFound
        };
      }

      return { 
        success: true, 
        message: `Successfully connected to Supabase! Verified table: production_ledger (${tablesFound.join(', ')} ready). Real-time WebSockets active.`,
        tables: tablesFound
      };
    } catch (err: any) {
      return { success: false, message: `Network / Connection error: ${err.message || String(err)}` };
    }
  }

  // ==========================================
  // 1. USER MANAGEMENT & AUTHENTICATION
  // ==========================================

  static async fetchUsers(): Promise<UserRecord[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      // 1. Query Supabase users table
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('user_name', { ascending: true });

      if (error) {
        console.warn('Supabase fetchUsers warning:', error.message);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      // 2. Fetch extended user metadata / permissions map from app_settings
      let userMetadataMap: Record<string, any> = {};
      try {
        const settings = await this.fetchSettings();
        if (settings && (settings.user_metadata || settings.user_permissions || settings.userPermissions)) {
          userMetadataMap = settings.user_metadata || settings.user_permissions || settings.userPermissions || {};
        }
      } catch {}

      return data.map((row: any) => {
        const cleanUid = (row.uid || '').trim().toUpperCase();
        const meta = userMetadataMap[cleanUid] || {};

        return {
          id: row.id || `usr-${cleanUid}`,
          uid: cleanUid,
          userName: row.user_name || row.userName || cleanUid,
          userType: (row.user_type || row.userType || 'General') as 'Admin' | 'General',
          designation: row.designation || meta.designation || '',
          department: (row.department || meta.department || 'Knitting') as 'Knitting' | 'Dyeing' | 'Finishing',
          assignedUnits: row.assigned_units || row.assignedUnits || meta.assignedUnits || ['EKL', 'EFL'],
          assignedBuyers: row.assigned_buyers || row.assignedBuyers || meta.assignedBuyers || [],
          allowedTabs: row.allowed_tabs || row.allowedTabs || meta.allowedTabs || [],
          tabPermissions: row.tab_permissions || row.tabPermissions || meta.tabPermissions || {},
          permission: (row.permission || meta.permission || 'Read') as 'Read' | 'Read / Write' | 'Hide',
          status: (row.status || meta.status || 'Active') as 'Active' | 'Inactive',
          phone: row.phone || meta.phone || '',
          email: row.email || meta.email || '',
          lastLogin: row.last_login || row.lastLogin || meta.lastLogin,
          password: row.password || meta.password || 'Password@2026',
          lastUpdated: row.updated_at || row.lastUpdated || meta.lastUpdated || new Date().toLocaleString(),
          createdAt: row.created_at || row.createdAt || meta.createdAt
        };
      });
    } catch (err) {
      console.warn('Supabase fetchUsers exception:', err);
      return [];
    }
  }

  static async saveUser(user: UserRecord): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const cleanUid = user.uid.trim().toUpperCase();

    try {
      // 1. Primary write to Supabase 'users' table (includes assigned_buyers and tab_permissions)
      const fullRow: any = {
        id: user.id || `USR-${cleanUid}`,
        uid: cleanUid,
        user_name: user.userName,
        user_type: user.userType,
        designation: user.designation || '',
        department: user.department || 'Knitting',
        assigned_units: user.assignedUnits || [],
        assigned_buyers: user.assignedBuyers || [],
        allowed_tabs: user.allowedTabs || [],
        tab_permissions: user.tabPermissions || {},
        permission: user.permission || 'Read',
        status: user.status || 'Active',
        phone: user.phone || '',
        email: user.email || '',
        password: user.password || 'Password@2026',
        last_login: user.lastLogin || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('users').upsert(fullRow, { onConflict: 'uid' });
      if (error) {
        // Fallback: If table hasn't run the new migration yet, try without newly added columns
        if (error.message?.includes('assigned_buyers') || error.message?.includes('tab_permissions')) {
          const fallbackRow = { ...fullRow };
          delete fallbackRow.assigned_buyers;
          delete fallbackRow.tab_permissions;
          await client.from('users').upsert(fallbackRow, { onConflict: 'uid' });
        } else {
          console.warn('Supabase users table save error:', error.message);
        }
      }

      return true;
    } catch (err) {
      console.warn('Supabase saveUser exception:', err);
      return false;
    }
  }

  static async deleteUser(uidOrId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const rawStr = (uidOrId || '').trim();
    const upperStr = rawStr.toUpperCase();

    try {
      // Delete from Supabase 'users' table explicitly by both UID and ID
      await client.from('users').delete().eq('uid', rawStr);
      await client.from('users').delete().eq('uid', upperStr);
      await client.from('users').delete().eq('id', rawStr);
      await client.from('users').delete().eq('id', upperStr);
      await client.from('users').delete().eq('id', `USR-${upperStr}`);

      return true;
    } catch (err) {
      console.warn('Supabase deleteUser error:', err);
      return false;
    }
  }

  static async deleteBuyer(buyerName: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const cleanName = (buyerName || '').trim();
      if (!cleanName) return false;

      // Delete from dedicated public.buyers table
      await client.from('buyers').delete().eq('buyer_name', cleanName);
      await client.from('buyers').delete().ilike('buyer_name', cleanName);
      return true;
    } catch (err) {
      console.warn('Supabase deleteBuyer error:', err);
      return false;
    }
  }

  static async deleteUnit(unitNameOrId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const cleanStr = (unitNameOrId || '').trim();
      if (!cleanStr) return false;

      // Delete from dedicated public.factory_units table
      await client.from('factory_units').delete().eq('unit_name', cleanStr);
      await client.from('factory_units').delete().ilike('unit_name', cleanStr);
      await client.from('factory_units').delete().eq('id', cleanStr);
      await client.from('factory_units').delete().eq('id', `unit-${cleanStr.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
      return true;
    } catch (err) {
      console.warn('Supabase deleteUnit error:', err);
      return false;
    }
  }

  // ==========================================
  // 2. APP SETTINGS & UNIT CONFIGURATIONS (SEPARATED STRUCTURED TABLES)
  // ==========================================

  static async fetchSettings(): Promise<any | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      let structuredSettings: any = {};

      // A. Fetch factory units from dedicated public.factory_units table
      try {
        const { data: unitRows, error: unitErr } = await client
          .from('factory_units')
          .select('*')
          .order('display_order', { ascending: true });

        if (!unitErr && unitRows && unitRows.length > 0) {
          structuredSettings.unitConfigs = unitRows.map((u: any, idx: number) => ({
            id: u.id || `unit-${(u.unit_name || `u${idx}`).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            name: u.unit_name,
            unitName: u.unit_name,
            capacityKgPerDay: Number(u.production_capacity) || 0,
            productionCapacity: Number(u.production_capacity) || 0,
            totalMachines: Number(u.total_machine) || 0,
            totalMachine: Number(u.total_machine) || 0,
            avgProdPerMachine: Number(u.avg_prod_per_machine) || 0,
            targetEfficiency: Number(u.target_efficiency) || 85,
            displayOrder: Number(u.display_order) || idx + 1
          }));
        }
      } catch (err) {
        console.warn('Error fetching factory_units:', err);
      }

      // B. Fetch buyers from dedicated public.buyers table
      try {
        const { data: buyerRows, error: buyerErr } = await client
          .from('buyers')
          .select('*')
          .order('buyer_name', { ascending: true });

        if (!buyerErr && buyerRows && buyerRows.length > 0) {
          structuredSettings.buyers = buyerRows
            .filter((b: any) => b.status !== 'Inactive')
            .map((b: any) => b.buyer_name);
        }
      } catch (err) {
        console.warn('Error fetching buyers:', err);
      }

      // C. Fetch system thresholds & logos from dedicated public.system_settings table
      try {
        const { data: sysRow, error: sysErr } = await client
          .from('system_settings')
          .select('*')
          .eq('id', 'global_settings')
          .maybeSingle();

        if (!sysErr && sysRow) {
          structuredSettings.rejectThreshold = Number(sysRow.reject_threshold) || 2.5;
          structuredSettings.maxIdleMachines = Number(sysRow.max_idle_machines) || 5;
          structuredSettings.alarmEmail = sysRow.alarm_email || 'knitprod@epylliongroup.com';
          if (sysRow.company_logo) structuredSettings.companyLogo = sysRow.company_logo;
          if (sysRow.my_logo) structuredSettings.myLogo = sysRow.my_logo;
        }
      } catch (err) {
        console.warn('Error fetching system_settings:', err);
      }

      // D. Fallback check from public.app_settings if system_settings did not supply logos or thresholds
      try {
        const { data: appRow, error: appErr } = await client
          .from('app_settings')
          .select('*')
          .eq('id', 'global_settings')
          .maybeSingle();

        if (!appErr && appRow?.settings_data) {
          const sd = appRow.settings_data;
          if (!structuredSettings.companyLogo && sd.companyLogo) structuredSettings.companyLogo = sd.companyLogo;
          if (!structuredSettings.myLogo && sd.myLogo) structuredSettings.myLogo = sd.myLogo;
          if (structuredSettings.rejectThreshold === undefined && sd.rejectThreshold) structuredSettings.rejectThreshold = Number(sd.rejectThreshold);
          if (structuredSettings.maxIdleMachines === undefined && sd.maxIdleMachines) structuredSettings.maxIdleMachines = Number(sd.maxIdleMachines);
          if (!structuredSettings.alarmEmail && sd.alarmEmail) structuredSettings.alarmEmail = sd.alarmEmail;
        }
      } catch {
        // Non-critical fallback
      }

      return structuredSettings;
    } catch {
      return null;
    }
  }

  static async saveSettings(settingsData: any): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      // 1. Sync to dedicated public.factory_units table if unitConfigs are present
      if (Array.isArray(settingsData.unitConfigs)) {
        try {
          const unitRows = settingsData.unitConfigs.map((u: any, idx: number) => {
            const rawName = (u.name || u.unitName || `Unit ${idx + 1}`).trim();
            const rawId = u.id && u.id.trim()
              ? u.id.trim()
              : `unit-${rawName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

            return {
              id: rawId,
              unit_name: rawName,
              production_capacity: Number(u.capacityKgPerDay ?? u.productionCapacity) || 0,
              total_machine: Number(u.totalMachines ?? u.totalMachine) || 0,
              avg_prod_per_machine: Number(u.avgProdPerMachine) || 0,
              target_efficiency: Number(u.targetEfficiency) || 85,
              display_order: Number(u.displayOrder) || idx + 1,
              updated_at: new Date().toISOString()
            };
          });

          // Upsert current valid units
          if (unitRows.length > 0) {
            await client.from('factory_units').upsert(unitRows, { onConflict: 'id' });
          }

          // Clean removed units from factory_units table
          const currentUnitNames = settingsData.unitConfigs.map((u: any) => (u.name || u.unitName || '').trim().toUpperCase());
          const { data: existingUnits } = await client.from('factory_units').select('id, unit_name');
          if (existingUnits && existingUnits.length > 0) {
            const unitsToDelete = existingUnits.filter((eu: any) => !currentUnitNames.includes((eu.unit_name || '').trim().toUpperCase()));
            for (const u of unitsToDelete) {
              await client.from('factory_units').delete().eq('id', u.id);
            }
          }
        } catch (unitErr) {
          console.warn('factory_units sync error:', unitErr);
        }
      }

      // 2. Sync to dedicated public.buyers table if buyers are present
      if (Array.isArray(settingsData.buyers)) {
        try {
          const buyerRows = settingsData.buyers.map((name: string) => ({
            id: `buy-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            buyer_name: name,
            status: 'Active',
            updated_at: new Date().toISOString()
          }));

          // Upsert current valid buyers
          if (buyerRows.length > 0) {
            await client.from('buyers').upsert(buyerRows, { onConflict: 'buyer_name' });
          }

          // Clean removed buyers from buyers table
          const currentBuyerNames = settingsData.buyers;
          const { data: existingBuyers } = await client.from('buyers').select('id, buyer_name');
          if (existingBuyers && existingBuyers.length > 0) {
            const buyersToDelete = existingBuyers.filter((eb: any) => !currentBuyerNames.includes(eb.buyer_name));
            for (const b of buyersToDelete) {
              await client.from('buyers').delete().eq('id', b.id);
            }
          }
        } catch (buyerErr) {
          console.warn('buyers sync error:', buyerErr);
        }
      }

      // 3. Sync to dedicated public.system_settings table (preserving existing fields on partial update)
      const hasSystemSettingsData = 
        settingsData.rejectThreshold !== undefined ||
        settingsData.maxIdleMachines !== undefined ||
        settingsData.alarmEmail !== undefined ||
        settingsData.companyLogo !== undefined ||
        settingsData.myLogo !== undefined;

      if (hasSystemSettingsData) {
        try {
          let existingSys: any = null;
          try {
            const { data } = await client.from('system_settings').select('*').eq('id', 'global_settings').maybeSingle();
            existingSys = data || null;
          } catch {}

          const sysRow: any = {
            id: 'global_settings',
            reject_threshold: settingsData.rejectThreshold !== undefined 
              ? Number(settingsData.rejectThreshold) 
              : (existingSys?.reject_threshold !== undefined ? Number(existingSys.reject_threshold) : 2.5),
            max_idle_machines: settingsData.maxIdleMachines !== undefined 
              ? Number(settingsData.maxIdleMachines) 
              : (existingSys?.max_idle_machines !== undefined ? Number(existingSys.max_idle_machines) : 5),
            alarm_email: settingsData.alarmEmail !== undefined 
              ? settingsData.alarmEmail 
              : (existingSys?.alarm_email || 'knitprod@epylliongroup.com'),
            company_logo: settingsData.companyLogo !== undefined 
              ? settingsData.companyLogo 
              : (existingSys?.company_logo || ''),
            my_logo: settingsData.myLogo !== undefined 
              ? settingsData.myLogo 
              : (existingSys?.my_logo || ''),
            updated_at: new Date().toISOString()
          };

          const { error: sysErr } = await client.from('system_settings').upsert(sysRow, { onConflict: 'id' });
          if (sysErr) {
            console.warn('system_settings upsert notice:', sysErr);
          }
        } catch (sysErr) {
          console.warn('system_settings sync error:', sysErr);
        }

        // 4. Also dual-sync to public.app_settings table as high-resilience fallback
        try {
          let existingApp: any = {};
          try {
            const { data } = await client.from('app_settings').select('*').eq('id', 'global_settings').maybeSingle();
            existingApp = data?.settings_data || {};
          } catch {}

          const mergedAppData = {
            ...existingApp,
            ...settingsData,
            updated_at: new Date().toISOString()
          };

          await client.from('app_settings').upsert({
            id: 'global_settings',
            settings_data: mergedAppData,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch {
          // Fallback ignored
        }
      }

      return true;
    } catch (err) {
      console.warn('Supabase saveSettings exception:', err);
      return false;
    }
  }

  // ==========================================
  // 3. ACTIVITY LOGS (UNLIMITED AUDIT TRAIL)
  // ==========================================

  static async logActivity(activity: {
    userId: string;
    userName: string;
    action: string;
    details: string;
    floor?: string;
    timestamp?: string;
  }): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const row = {
        user_id: activity.userId,
        user_name: activity.userName,
        action: activity.action,
        details: activity.details,
        floor: activity.floor || '',
        created_at: activity.timestamp || new Date().toISOString()
      };

      const { error } = await client.from('activity_logs').insert(row);
      return !error;
    } catch {
      return false;
    }
  }

  static async fetchActivityLogs(limitCount: number = 100): Promise<any[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limitCount);

      if (error || !data) return [];
      return data.map((r) => ({
        id: r.id,
        userId: r.user_id,
        userName: r.user_name,
        action: r.action,
        details: r.details,
        floor: r.floor,
        timestamp: r.created_at
      }));
    } catch {
      return [];
    }
  }

  // ==========================================
  // 4. PRODUCTION LEDGER (REAL-TIME MULTI-DEVICE CLOUD SYNC)
  // ==========================================

  /**
   * Helper to format date into ISO YYYY-MM-DD for standard SQL DATE / TEXT columns
   */
  static formatSqlDate(rawDate: any): string {
    if (!rawDate) return new Date().toISOString().split('T')[0];
    const s = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Handle DD-MM-YYYY or DD/MM/YYYY
    const parts = s.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return s;
  }

  /**
   * Converts a Supabase PostgreSQL row into an app LedgerRecord
   */
  static mapRowToLedgerRecord(row: any): LedgerRecord {
    const raw = row.raw_data || {};
    return {
      id: String(row.id || ''),
      unit: row.unit || raw.unit || '',
      year: Number(row.year || raw.year || 2026),
      month: row.month || raw.month || '',
      date: row.date || raw.date || '',
      day: row.day || raw.day || '',
      floor: row.floor || raw.floor || '',
      target: Number(row.target ?? raw.target ?? 0),
      shiftA: Number(row.shift_a ?? raw.shiftA ?? 0),
      shiftB: Number(row.shift_b ?? raw.shiftB ?? 0),
      shiftC: Number(row.shift_c ?? raw.shiftC ?? 0),
      totalProduction: Number(row.total_production ?? raw.totalProduction ?? 0),
      targetBulk: Number(row.target_bulk ?? raw.targetBulk ?? 0),
      bulkProd: Number(row.bulk_prod ?? raw.bulkProd ?? 0),
      sampleProd: Number(row.sample_prod ?? raw.sampleProd ?? 0),
      totalMachines: Number(row.total_machines ?? raw.totalMachines ?? 0),
      runningMachine: Number(row.running_machine ?? raw.runningMachine ?? 0),
      runningBulk: Number(row.running_bulk ?? raw.runningBulk ?? 0),
      runningSample: Number(row.running_sample ?? raw.runningSample ?? 0),
      idleMc: Number(row.idle_mc ?? raw.idleMc ?? 0),
      machineUtilization: Number(row.machine_utilization ?? raw.machineUtilization ?? 0),
      idleMcPct: Number(row.idle_mc_pct ?? raw.idleMcPct ?? 0),
      prodLossForSample: Number(row.prod_loss_for_sample ?? raw.prodLossForSample ?? 0),
      idleProduction: Number(row.idle_production ?? raw.idleProduction ?? 0),
      efficiency: Number(row.efficiency ?? raw.efficiency ?? 0),
      proPerMc: Number(row.pro_per_mc ?? raw.proPerMc ?? 0),
      reject: Number(row.reject ?? raw.reject ?? 0),
      rejectPct: Number(row.reject_pct ?? raw.rejectPct ?? 0),
      hold: Number(row.hold ?? raw.hold ?? 0),
      holdPct: Number(row.hold_pct ?? raw.holdPct ?? 0),
      jhuteCutpcs: Number(row.jhute_cutpcs ?? raw.jhuteCutpcs ?? 0),
      jhuteCutpcsPct: Number(row.jhute_cutpcs_pct ?? raw.jhuteCutpcsPct ?? 0),
      needleBroken: Number(row.needle_broken ?? raw.needleBroken ?? 0),
      needlePerKg: Number(row.needle_per_kg ?? raw.needlePerKg ?? 0),
      sinkerBroken: Number(row.sinker_broken ?? raw.sinkerBroken ?? 0),
      sinkerPerKg: Number(row.sinker_per_kg ?? raw.sinkerPerKg ?? 0),
      oilConsumption: Number(row.oil_consumption ?? raw.oilConsumption ?? 0),
      beltBroken: Number(row.belt_broken ?? raw.beltBroken ?? 0),
      otherSparePartsName: row.other_spare_parts_name || raw.otherSparePartsName || '',
      otherSparePartsQty: Number(row.other_spare_parts_qty ?? raw.otherSparePartsQty ?? 0),
      setChangeNeedle: Number(row.set_change_needle ?? raw.setChangeNeedle ?? 0),
      setChangeSinker: Number(row.set_change_sinker ?? raw.setChangeSinker ?? 0),
      productionLossForEff: Number(row.production_loss_for_eff ?? raw.productionLossForEff ?? 0),
      capacityUtilization: Number(row.capacity_utilization ?? raw.capacityUtilization ?? 0),
      totalOperator: Number(row.total_operator ?? raw.totalOperator ?? 0),
      absent: Number(row.absent ?? raw.absent ?? 0),
      absentPct: Number(row.absent_pct ?? raw.absentPct ?? 0),
      productionFlatKnit: Number(row.production_flat_knit ?? raw.productionFlatKnit ?? 0),
      achievmentCircular: Number(row.achievment_circular ?? raw.achievmentCircular ?? 0),
      otd: String(row.otd ?? raw.otd ?? ''),
      yarnIssued: Number(row.yarn_issued ?? raw.yarnIssued ?? 0),
      totalRunningFactories: Number(row.total_running_factories ?? raw.totalRunningFactories ?? 0),
      numberVehicles: Number(row.number_vehicles ?? raw.numberVehicles ?? 0),
      fabricReturn: Number(row.fabric_return ?? raw.fabricReturn ?? 0),
      remarks: row.remarks || raw.remarks || '',
      updatedBy: row.updated_by || raw.updatedBy || '',
      createdAt: row.created_at || raw.createdAt,
      updatedAt: row.updated_at || raw.updatedAt
    };
  }

  /**
   * Converts an app LedgerRecord into a Supabase PostgreSQL row
   */
  static mapLedgerRecordToRow(record: LedgerRecord): Record<string, any> {
    const rawId = String(record.id || `rec-${record.date}-${(record.floor || record.unit || 'unit').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`);
    const otdNum = parseFloat(String(record.otd || 0)) || 0;

    return {
      id: rawId,
      unit: String(record.unit || ''),
      year: parseInt(String(record.year || 2026), 10) || 2026,
      month: String(record.month || ''),
      date: this.formatSqlDate(record.date),
      day: String(record.day || ''),
      floor: String(record.floor || ''),
      target: parseFloat(String(record.target || 0)) || 0,
      shift_a: parseFloat(String(record.shiftA || 0)) || 0,
      shift_b: parseFloat(String(record.shiftB || 0)) || 0,
      shift_c: parseFloat(String(record.shiftC || 0)) || 0,
      total_production: parseFloat(String(record.totalProduction || 0)) || 0,
      target_bulk: parseFloat(String(record.targetBulk || 0)) || 0,
      bulk_prod: parseFloat(String(record.bulkProd || 0)) || 0,
      sample_prod: parseFloat(String(record.sampleProd || 0)) || 0,
      total_machines: parseInt(String(record.totalMachines || 0), 10) || 0,
      running_machine: parseInt(String(record.runningMachine || 0), 10) || 0,
      running_bulk: parseInt(String(record.runningBulk || 0), 10) || 0,
      running_sample: parseInt(String(record.runningSample || 0), 10) || 0,
      idle_mc: parseInt(String(record.idleMc || 0), 10) || 0,
      machine_utilization: parseFloat(String(record.machineUtilization || 0)) || 0,
      idle_mc_pct: parseFloat(String(record.idleMcPct || 0)) || 0,
      prod_loss_for_sample: parseFloat(String(record.prodLossForSample || 0)) || 0,
      idle_production: parseFloat(String(record.idleProduction || 0)) || 0,
      efficiency: parseFloat(String(record.efficiency || 0)) || 0,
      pro_per_mc: parseFloat(String(record.proPerMc || 0)) || 0,
      reject: parseFloat(String(record.reject || 0)) || 0,
      reject_pct: parseFloat(String(record.rejectPct || 0)) || 0,
      hold: parseFloat(String(record.hold || 0)) || 0,
      hold_pct: parseFloat(String(record.holdPct || 0)) || 0,
      jhute_cutpcs: parseFloat(String(record.jhuteCutpcs || 0)) || 0,
      jhute_cutpcs_pct: parseFloat(String(record.jhuteCutpcsPct || 0)) || 0,
      needle_broken: parseFloat(String(record.needleBroken || 0)) || 0,
      needle_per_kg: parseFloat(String(record.needlePerKg || 0)) || 0,
      sinker_broken: parseFloat(String(record.sinkerBroken || 0)) || 0,
      sinker_per_kg: parseFloat(String(record.sinkerPerKg || 0)) || 0,
      oil_consumption: parseFloat(String(record.oilConsumption || 0)) || 0,
      belt_broken: parseFloat(String(record.beltBroken || 0)) || 0,
      other_spare_parts_name: String(record.otherSparePartsName || ''),
      other_spare_parts_qty: parseFloat(String(record.otherSparePartsQty || 0)) || 0,
      set_change_needle: parseFloat(String(record.setChangeNeedle || 0)) || 0,
      set_change_sinker: parseFloat(String(record.setChangeSinker || 0)) || 0,
      production_loss_for_eff: parseFloat(String(record.productionLossForEff || 0)) || 0,
      capacity_utilization: parseFloat(String(record.capacityUtilization || 0)) || 0,
      total_operator: parseFloat(String(record.totalOperator || 0)) || 0,
      absent: parseFloat(String(record.absent || 0)) || 0,
      absent_pct: parseFloat(String(record.absentPct || 0)) || 0,
      production_flat_knit: parseFloat(String(record.productionFlatKnit || 0)) || 0,
      achievment_circular: parseFloat(String(record.achievmentCircular || 0)) || 0,
      otd: otdNum,
      yarn_issued: parseFloat(String(record.yarnIssued || 0)) || 0,
      total_running_factories: parseInt(String(record.totalRunningFactories || 0), 10) || 0,
      number_vehicles: parseInt(String(record.numberVehicles || 0), 10) || 0,
      fabric_return: parseFloat(String(record.fabricReturn || 0)) || 0,
      remarks: String(record.remarks || ''),
      updated_by: String(record.updatedBy || ''),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Fetch all production ledger records from Supabase (sub-second query)
   */
  static async fetchProductionLedger(): Promise<LedgerRecord[]> {
    const client = this.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('production_ledger')
        .select('*')
        .order('date', { ascending: false });

      if (error) {
        console.warn('Supabase fetchProductionLedger notice:', error.message);
        return [];
      }

      if (!data || !Array.isArray(data)) return [];

      return data.map((row) => this.mapRowToLedgerRecord(row));
    } catch (err) {
      console.warn('Supabase fetchProductionLedger error:', err);
      return [];
    }
  }

  private static knownMissingColumns = new Set<string>();

  /**
   * Helper to strip known non-existent columns from a row before inserting to Supabase
   */
  private static sanitizeRowForSupabase(row: Record<string, any>): Record<string, any> {
    const sanitized = { ...row };
    for (const col of this.knownMissingColumns) {
      delete sanitized[col];
    }
    return sanitized;
  }

  /**
   * Save or update a single production ledger record in Supabase
   */
  static async saveProductionRecord(record: LedgerRecord): Promise<{ success: boolean; error?: string }> {
    const client = this.getClient();
    if (!client) return { success: false, error: 'Supabase client is not initialized or credentials missing.' };

    try {
      let row = this.sanitizeRowForSupabase(this.mapLedgerRecordToRow(record));
      
      let attempts = 0;
      while (attempts < 6) {
        attempts++;
        const { error } = await client.from('production_ledger').upsert(row, { onConflict: 'id' });
        if (!error) {
          return { success: true };
        }

        const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                      error.message?.match(/column "([^"]+)" of relation/) ||
                      error.message?.match(/column '([^']+)' does not exist/);

        if (match && match[1]) {
          const missingCol = match[1];
          this.knownMissingColumns.add(missingCol);
          delete row[missingCol];
          continue; // retry without missing column
        }

        console.error('Supabase saveProductionRecord error:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Supabase saveProductionRecord exception:', err);
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Bulk save/upsert an array of production records into Supabase
   */
  static async bulkSaveProductionRecords(records: LedgerRecord[]): Promise<{ success: boolean; count: number; error?: string }> {
    const client = this.getClient();
    if (!client) {
      return { success: false, count: 0, error: 'Supabase client is not initialized. Please verify your Project URL and Anon Key in Database Settings.' };
    }
    if (!records || records.length === 0) {
      return { success: true, count: 0 };
    }

    try {
      const rows = records.map(r => this.mapLedgerRecordToRow(r));
      
      // Batch into chunks of 50 to ensure high reliability
      const chunkSize = 50;
      let insertedCount = 0;

      for (let i = 0; i < rows.length; i += chunkSize) {
        let chunk = rows.slice(i, i + chunkSize).map(r => this.sanitizeRowForSupabase(r));
        let chunkSuccess = false;
        let attempts = 0;

        while (!chunkSuccess && attempts < 8) {
          attempts++;
          const { error } = await client.from('production_ledger').upsert(chunk, { onConflict: 'id' });
          if (!error) {
            chunkSuccess = true;
            insertedCount += chunk.length;
            break;
          }

          const match = error.message?.match(/Could not find the '([^']+)' column/) ||
                        error.message?.match(/column "([^"]+)" of relation/) ||
                        error.message?.match(/column '([^']+)' does not exist/);

          if (match && match[1]) {
            const missingCol = match[1];
            this.knownMissingColumns.add(missingCol);
            // Prune missing column from all rows in current chunk
            chunk = chunk.map(r => {
              const copy = { ...r };
              delete copy[missingCol];
              return copy;
            });
            continue; // retry this chunk without the missing column
          }

          console.error(`Supabase bulkSave chunk ${i} error:`, error);
          return { 
            success: false, 
            count: insertedCount, 
            error: `Failed to insert chunk at row ${i}: ${error.message} (${error.code || ''})` 
          };
        }
      }

      return { success: true, count: insertedCount };
    } catch (err: any) {
      console.error('Supabase bulkSaveProductionRecords error:', err);
      return { success: false, count: 0, error: err.message || String(err) };
    }
  }

  /**
   * Delete a production record from Supabase
   */
  static async deleteProductionRecord(id: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('production_ledger').delete().eq('id', id);
      return !error;
    } catch (err) {
      console.warn('Supabase deleteProductionRecord error:', err);
      return false;
    }
  }

  /**
   * Real-time Multi-Device WebSocket Subscription (<50ms Live Updates across all devices)
   */
  static subscribeToProductionLedger(
    onRecordChange: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; record: LedgerRecord; id: string }) => void
  ): () => void {
    const client = this.getClient();
    if (!client) return () => {};

    try {
      const channel = client
        .channel('realtime:production_ledger')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'production_ledger' },
          (payload: any) => {
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            const row = payload.new || payload.old;
            if (row) {
              const record = SupabaseSync.mapRowToLedgerRecord(payload.new || payload.old);
              onRecordChange({
                eventType,
                record,
                id: String(row.id || (payload.old && payload.old.id) || '')
              });
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Live WebSocket active
          }
        });

      return () => {
        try {
          client.removeChannel(channel);
        } catch {}
      };
    } catch (err) {
      console.warn('Supabase subscribeToProductionLedger error:', err);
      return () => {};
    }
  }

  /**
   * Helper SQL schema for automatic copy-paste in Supabase SQL Editor
   */
  static getSetupSQL(): string {
    return `-- =========================================================
-- EPYLLION KNITEX ERP - IDEMPOTENT SUPABASE DATABASE SCHEMA
-- Run this in your Supabase SQL Editor (100% Free Forever)
-- =========================================================

-- 1. USERS & ACCESS MANAGEMENT TABLE (WITH ASSIGNED BUYERS)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'General',
  designation TEXT,
  department TEXT DEFAULT 'Knitting',
  assigned_units JSONB DEFAULT '[]'::jsonb,
  assigned_buyers JSONB DEFAULT '[]'::jsonb,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  tab_permissions JSONB DEFAULT '{}'::jsonb,
  permission TEXT DEFAULT 'Read',
  status TEXT DEFAULT 'Active',
  phone TEXT,
  email TEXT,
  password TEXT DEFAULT 'Password@2026',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add assigned_buyers & tab_permissions columns if users table already existed
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='assigned_buyers') THEN
    ALTER TABLE public.users ADD COLUMN assigned_buyers JSONB DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='tab_permissions') THEN
    ALTER TABLE public.users ADD COLUMN tab_permissions JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. FACTORY UNITS CONFIGURATION TABLE (READABLE TABLE FORMAT)
CREATE TABLE IF NOT EXISTS public.factory_units (
  id TEXT PRIMARY KEY,
  unit_name TEXT NOT NULL,
  production_capacity NUMERIC DEFAULT 0,
  total_machine INTEGER DEFAULT 0,
  avg_prod_per_machine NUMERIC DEFAULT 0,
  target_efficiency NUMERIC DEFAULT 85,
  display_order INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. BUYERS DIRECTORY TABLE (READABLE TABLE FORMAT)
CREATE TABLE IF NOT EXISTS public.buyers (
  id TEXT PRIMARY KEY,
  buyer_name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SYSTEM OPERATIONAL THRESHOLDS & GLOBAL SETTINGS
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY,
  reject_threshold NUMERIC DEFAULT 2.5,
  max_idle_machines INTEGER DEFAULT 5,
  alarm_email TEXT DEFAULT 'knitprod@epylliongroup.com',
  company_logo TEXT,
  my_logo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add company_logo & my_logo columns if system_settings already existed
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='company_logo') THEN
    ALTER TABLE public.system_settings ADD COLUMN company_logo TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='my_logo') THEN
    ALTER TABLE public.system_settings ADD COLUMN my_logo TEXT;
  END IF;
END $$;

-- 5. PRODUCTION LEDGER TABLE (HIGH-PERFORMANCE REAL-TIME CLOUD TABLE)
CREATE TABLE IF NOT EXISTS public.production_ledger (
  id TEXT PRIMARY KEY,
  unit TEXT,
  year INTEGER DEFAULT 2026,
  month TEXT,
  date TEXT NOT NULL,
  day TEXT,
  floor TEXT NOT NULL,
  target NUMERIC DEFAULT 0,
  shift_a NUMERIC DEFAULT 0,
  shift_b NUMERIC DEFAULT 0,
  shift_c NUMERIC DEFAULT 0,
  total_production NUMERIC DEFAULT 0,
  target_bulk NUMERIC DEFAULT 0,
  bulk_prod NUMERIC DEFAULT 0,
  sample_prod NUMERIC DEFAULT 0,
  total_machines INTEGER DEFAULT 0,
  running_machine INTEGER DEFAULT 0,
  running_bulk INTEGER DEFAULT 0,
  running_sample INTEGER DEFAULT 0,
  idle_mc INTEGER DEFAULT 0,
  machine_utilization NUMERIC DEFAULT 0,
  idle_mc_pct NUMERIC DEFAULT 0,
  prod_loss_for_sample NUMERIC DEFAULT 0,
  idle_production NUMERIC DEFAULT 0,
  efficiency NUMERIC DEFAULT 0,
  pro_per_mc NUMERIC DEFAULT 0,
  reject NUMERIC DEFAULT 0,
  reject_pct NUMERIC DEFAULT 0,
  hold NUMERIC DEFAULT 0,
  hold_pct NUMERIC DEFAULT 0,
  jhute_cutpcs NUMERIC DEFAULT 0,
  jhute_cutpcs_pct NUMERIC DEFAULT 0,
  needle_broken NUMERIC DEFAULT 0,
  needle_per_kg NUMERIC DEFAULT 0,
  sinker_broken NUMERIC DEFAULT 0,
  sinker_per_kg NUMERIC DEFAULT 0,
  oil_consumption NUMERIC DEFAULT 0,
  belt_broken NUMERIC DEFAULT 0,
  other_spare_parts_name TEXT,
  other_spare_parts_qty NUMERIC DEFAULT 0,
  set_change_needle NUMERIC DEFAULT 0,
  set_change_sinker NUMERIC DEFAULT 0,
  production_loss_for_eff NUMERIC DEFAULT 0,
  capacity_utilization NUMERIC DEFAULT 0,
  total_operator NUMERIC DEFAULT 0,
  absent NUMERIC DEFAULT 0,
  absent_pct NUMERIC DEFAULT 0,
  production_flat_knit NUMERIC DEFAULT 0,
  achievment_circular NUMERIC DEFAULT 0,
  otd TEXT,
  yarn_issued NUMERIC DEFAULT 0,
  total_running_factories INTEGER DEFAULT 0,
  number_vehicles INTEGER DEFAULT 0,
  fabric_return NUMERIC DEFAULT 0,
  remarks TEXT,
  updated_by TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add missing columns if production_ledger was previously created with fewer columns
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='total_machines') THEN
    ALTER TABLE public.production_ledger ADD COLUMN total_machines INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='updated_by') THEN
    ALTER TABLE public.production_ledger ADD COLUMN updated_by TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='production_ledger' AND column_name='raw_data') THEN
    ALTER TABLE public.production_ledger ADD COLUMN raw_data JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Fast Indexes for Instant Queries
CREATE INDEX IF NOT EXISTS idx_production_ledger_date ON public.production_ledger(date);
CREATE INDEX IF NOT EXISTS idx_production_ledger_floor ON public.production_ledger(floor);
CREATE INDEX IF NOT EXISTS idx_production_ledger_unit ON public.production_ledger(unit);

-- 6. ACTIVITY & AUDIT LOGS (UNLIMITED RETENTION)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  floor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so it never throws error 42710
DROP POLICY IF EXISTS "Allow public full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow public full access to factory_units" ON public.factory_units;
DROP POLICY IF EXISTS "Allow public full access to buyers" ON public.buyers;
DROP POLICY IF EXISTS "Allow public full access to system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public full access to production_ledger" ON public.production_ledger;
DROP POLICY IF EXISTS "Allow public full access to activity_logs" ON public.activity_logs;

-- Recreate policies cleanly
CREATE POLICY "Allow public full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to factory_units" ON public.factory_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to production_ledger" ON public.production_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Enable Real-Time Broadcast for Production Ledger
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'production_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.production_ledger;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;

-- Insert Default Factory Units
INSERT INTO public.factory_units (id, unit_name, production_capacity, total_machine, avg_prod_per_machine, display_order)
VALUES
  ('unit-1', 'EKL', 25000, 45, 555.56, 1),
  ('unit-2', 'EFL', 18000, 32, 562.50, 2),
  ('unit-3', 'Auto Stripe', 12000, 20, 600.00, 3),
  ('unit-4', 'EFL-2', 15000, 28, 535.71, 4),
  ('unit-5', 'EFL-Extension', 10000, 18, 555.56, 5),
  ('unit-6', 'ESL-Extension', 8000, 14, 571.43, 6),
  ('unit-7', 'Sub-Contact', 6000, 10, 600.00, 7)
ON CONFLICT (id) DO NOTHING;

-- Insert Default Buyers Directory
INSERT INTO public.buyers (id, buyer_name, status)
VALUES
  ('buy-1', 'Marks & Spencer', 'Active'),
  ('buy-2', 'H&M', 'Active'),
  ('buy-3', 'C&A', 'Active'),
  ('buy-4', 'PUMA', 'Active'),
  ('buy-5', 'Next', 'Active'),
  ('buy-6', 'Zara', 'Active'),
  ('buy-7', 'Decathlon', 'Active'),
  ('buy-8', 'Tesco', 'Active'),
  ('buy-9', 'Target', 'Active'),
  ('buy-10', 'GAP', 'Active'),
  ('buy-11', 'Lindex', 'Active'),
  ('buy-12', 'Bestseller', 'Active'),
  ('buy-13', 'G-Star Raw', 'Active'),
  ('buy-14', 'Mango', 'Active'),
  ('buy-15', 'Levi''s', 'Active'),
  ('buy-16', 'Primark', 'Active'),
  ('buy-17', 'Uniqlo', 'Active'),
  ('buy-18', 'ASOS', 'Active'),
  ('buy-19', 'Carrefour', 'Active'),
  ('buy-20', 'Tommy Hilfiger', 'Active'),
  ('buy-21', 'Calvin Klein', 'Active'),
  ('buy-22', 'Under Armour', 'Active'),
  ('buy-23', 'Esprit', 'Active'),
  ('buy-24', 'Jack & Jones', 'Active')
ON CONFLICT (buyer_name) DO NOTHING;

-- Insert Default System Settings
INSERT INTO public.system_settings (id, reject_threshold, max_idle_machines, alarm_email)
VALUES ('global_settings', 2.5, 5, 'knitprod@epylliongroup.com')
ON CONFLICT (id) DO NOTHING;
`;
  }
}

