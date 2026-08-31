import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRecord } from '../types';

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

    if (typeof localStorage !== 'undefined') {
      // Clean up legacy plain keys from localStorage if present
      if (localStorage.getItem('supabase_url') || localStorage.getItem('supabase_anon_key')) {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_anon_key');
      }
    }

    const config = {
      supabaseUrl: envUrl || this.DEFAULT_SUPABASE_URL || '',
      supabaseKey: envKey || this.DEFAULT_SUPABASE_KEY || ''
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
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_anon_key');
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

      // Test querying users table
      const { data, error } = await testClient.from('users').select('id, uid').limit(1);
      if (error) {
        if (error.code === '42P01') {
          return { 
            success: false, 
            message: 'Connected to Supabase project, but the tables (users, app_settings, activity_logs) are missing. Please run the SQL schema in your Supabase SQL Editor.' 
          };
        }
        if (error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('apikey')) {
          return { 
            success: false, 
            message: `Invalid API Key: ${error.message}. Please double-check you copied the "anon public" key from Project Settings > API.` 
          };
        }
        return { success: false, message: `Database query error: ${error.message} (${error.code || ''})` };
      }

      return { 
        success: true, 
        message: 'Successfully connected to Supabase! The users table and permissions are verified.',
        tables: ['users', 'app_settings', 'activity_logs']
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

      // 2. Also save extended metadata (tabPermissions & assignedBuyers) into app_settings for backup compatibility
      try {
        const currentSettings = (await this.fetchSettings()) || {};
        const userMeta = currentSettings.user_metadata || currentSettings.user_permissions || {};
        userMeta[cleanUid] = {
          tabPermissions: user.tabPermissions || {},
          assignedBuyers: user.assignedBuyers || [],
          allowedTabs: user.allowedTabs || [],
          assignedUnits: user.assignedUnits || [],
          permission: user.permission || 'Read',
          userType: user.userType,
          designation: user.designation || '',
          department: user.department || 'Knitting',
          status: user.status || 'Active',
          lastUpdated: user.lastUpdated || new Date().toISOString()
        };

        await this.saveSettings({
          ...currentSettings,
          user_metadata: userMeta
        });
      } catch (metaErr) {
        console.warn('Supabase user metadata sync notice:', metaErr);
      }

      return true;
    } catch (err) {
      console.warn('Supabase saveUser exception:', err);
      return false;
    }
  }

  static async deleteUser(uid: string): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    const cleanUid = uid.trim().toUpperCase();

    try {
      const { error } = await client.from('users').delete().eq('uid', cleanUid);
      
      // Also clean from app_settings user_metadata
      try {
        const currentSettings = (await this.fetchSettings()) || {};
        if (currentSettings.user_metadata && currentSettings.user_metadata[cleanUid]) {
          delete currentSettings.user_metadata[cleanUid];
          await this.saveSettings(currentSettings);
        }
      } catch {}

      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 2. APP SETTINGS & UNIT CONFIGURATIONS (STRUCTURED TABLES + FALLBACK)
  // ==========================================

  static async fetchSettings(): Promise<any | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      let structuredSettings: any = {};
      let hasStructuredData = false;

      // A. Try fetching factory units from dedicated public.factory_units table
      try {
        const { data: unitRows, error: unitErr } = await client
          .from('factory_units')
          .select('*')
          .order('display_order', { ascending: true });

        if (!unitErr && unitRows && unitRows.length > 0) {
          structuredSettings.unitConfigs = unitRows.map((u: any) => ({
            name: u.unit_name,
            capacityKgPerDay: Number(u.production_capacity) || 0,
            totalMachines: Number(u.total_machine) || 0,
            avgProdPerMachine: Number(u.avg_prod_per_machine) || 0,
            targetEfficiency: Number(u.target_efficiency) || 85
          }));
          hasStructuredData = true;
        }
      } catch {}

      // B. Try fetching buyers from dedicated public.buyers table
      try {
        const { data: buyerRows, error: buyerErr } = await client
          .from('buyers')
          .select('*')
          .order('buyer_name', { ascending: true });

        if (!buyerErr && buyerRows && buyerRows.length > 0) {
          structuredSettings.buyers = buyerRows
            .filter((b: any) => b.status !== 'Inactive')
            .map((b: any) => b.buyer_name);
          hasStructuredData = true;
        }
      } catch {}

      // C. Try fetching system thresholds from dedicated public.system_settings table
      try {
        const { data: sysRow, error: sysErr } = await client
          .from('system_settings')
          .select('*')
          .eq('id', 'global_settings')
          .single();

        if (!sysErr && sysRow) {
          structuredSettings.rejectThreshold = Number(sysRow.reject_threshold) || 2.5;
          structuredSettings.maxIdleMachines = Number(sysRow.max_idle_machines) || 5;
          structuredSettings.alarmEmail = sysRow.alarm_email || 'knitprod@epylliongroup.com';
          if (sysRow.company_logo) structuredSettings.companyLogo = sysRow.company_logo;
          if (sysRow.my_logo) structuredSettings.myLogo = sysRow.my_logo;
          hasStructuredData = true;
        }
      } catch {}

      // D. Fetch from app_settings compatibility table
      const { data: appData } = await client
        .from('app_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      const jsonbData = appData?.settings_data || {};

      // Merge structured table data with JSONB data (structured tables take precedence if present)
      return {
        ...jsonbData,
        ...structuredSettings
      };
    } catch {
      return null;
    }
  }

  static async saveSettings(settingsData: any): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      // Merge with existing remote settings to prevent accidental overwriting
      const existing = (await this.fetchSettings()) || {};
      const mergedData = {
        ...existing,
        ...settingsData
      };

      // 1. Sync to dedicated public.factory_units table if unitConfigs are present
      if (Array.isArray(settingsData.unitConfigs) && settingsData.unitConfigs.length > 0) {
        try {
          const unitRows = settingsData.unitConfigs.map((u: any, idx: number) => ({
            id: `unit-${(u.name || `u${idx}`).toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            unit_name: u.name,
            production_capacity: Number(u.capacityKgPerDay) || 0,
            total_machine: Number(u.totalMachines) || 0,
            avg_prod_per_machine: Number(u.avgProdPerMachine) || 0,
            target_efficiency: Number(u.targetEfficiency) || 85,
            display_order: idx + 1,
            updated_at: new Date().toISOString()
          }));

          await client.from('factory_units').upsert(unitRows, { onConflict: 'id' });
        } catch (unitErr) {
          // Silent catch if table does not exist yet before SQL migration
        }
      }

      // 2. Sync to dedicated public.buyers table if buyers are present
      if (Array.isArray(settingsData.buyers) && settingsData.buyers.length > 0) {
        try {
          const buyerRows = settingsData.buyers.map((name: string, idx: number) => ({
            id: `buy-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
            buyer_name: name,
            status: 'Active',
            updated_at: new Date().toISOString()
          }));

          await client.from('buyers').upsert(buyerRows, { onConflict: 'buyer_name' });
        } catch (buyerErr) {
          // Silent catch if table does not exist yet before SQL migration
        }
      }

      // 3. Sync to dedicated public.system_settings table if thresholds/logos are present
      try {
        const sysRow: any = {
          id: 'global_settings',
          reject_threshold: mergedData.rejectThreshold !== undefined ? Number(mergedData.rejectThreshold) : 2.5,
          max_idle_machines: mergedData.maxIdleMachines !== undefined ? Number(mergedData.maxIdleMachines) : 5,
          alarm_email: mergedData.alarmEmail || 'knitprod@epylliongroup.com',
          company_logo: mergedData.companyLogo || '',
          my_logo: mergedData.myLogo || '',
          updated_at: new Date().toISOString()
        };

        await client.from('system_settings').upsert(sysRow, { onConflict: 'id' });
      } catch (sysErr) {
        // Silent catch if table does not exist yet
      }

      // 4. Save to app_settings compatibility table (Guaranteed backward compatibility)
      const row = {
        id: 'global_settings',
        settings_data: mergedData,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('app_settings').upsert(row, { onConflict: 'id' });
      if (error) {
        console.warn('Supabase app_settings upsert error:', error.message);
        return false;
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

-- 5. APP SETTINGS COMPATIBILITY TABLE (JSONB BACKWARD COMPATIBILITY)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  settings_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so it never throws error 42710
DROP POLICY IF EXISTS "Allow public full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow public full access to factory_units" ON public.factory_units;
DROP POLICY IF EXISTS "Allow public full access to buyers" ON public.buyers;
DROP POLICY IF EXISTS "Allow public full access to system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public full access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public full access to activity_logs" ON public.activity_logs;

-- Recreate policies cleanly
CREATE POLICY "Allow public full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to factory_units" ON public.factory_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

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
