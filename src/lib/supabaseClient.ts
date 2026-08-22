import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserRecord } from '../types';
import { FirestoreSyncService } from './firestoreSync';

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

  /**
   * Default / Current Supabase Configuration
   */
  static getStoredConfig(): { supabaseUrl: string; supabaseKey: string } {
    if (this.cachedConfig) return this.cachedConfig;

    const envUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL
      ? import.meta.env.VITE_SUPABASE_URL.trim()
      : '';
    const envKey = typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY
      ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim()
      : '';

    let localUrl = '';
    let localKey = '';
    if (typeof localStorage !== 'undefined') {
      localUrl = localStorage.getItem('supabase_url') || '';
      localKey = localStorage.getItem('supabase_anon_key') || '';
    }

    const config = {
      supabaseUrl: localUrl || envUrl || '',
      supabaseKey: localKey || envKey || ''
    };

    this.cachedConfig = config;
    return config;
  }

  /**
   * Loads Supabase config from Firestore or server to ensure Vercel and all remote clients sync seamlessly
   */
  static async syncRemoteConfig(): Promise<{ supabaseUrl: string; supabaseKey: string }> {
    try {
      // 1. Try fetching from Firestore app_config
      const firestoreConfig = await FirestoreSyncService.fetchAppConfigFromFirestore();
      if (firestoreConfig && (firestoreConfig as any).supabaseUrl && (firestoreConfig as any).supabaseKey) {
        const url = (firestoreConfig as any).supabaseUrl;
        const key = (firestoreConfig as any).supabaseKey;
        this.setCredentials(url, key, false);
        return { supabaseUrl: url, supabaseKey: key };
      }
    } catch (e) {}

    try {
      // 2. Try fetching from Server config API
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
      localStorage.setItem('supabase_url', cleanUrl);
      localStorage.setItem('supabase_anon_key', cleanKey);
    }

    this.cachedConfig = { supabaseUrl: cleanUrl, supabaseKey: cleanKey };
    this.client = null;

    if (persistToCloud && cleanUrl && cleanKey) {
      // 1. Persist to Firestore app_config so all devices/deployments like Vercel load it automatically
      FirestoreSyncService.saveSupabaseConfigToFirestore(cleanUrl, cleanKey).catch(() => {});

      // 2. Persist to Express server config if running
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
      const { data, error } = await client
        .from('users')
        .select('*')
        .order('user_name', { ascending: true });

      if (error) {
        console.warn('Supabase fetchUsers warning:', error.message);
        return [];
      }

      if (!data) return [];

      return data.map((row: any) => ({
        id: row.id,
        uid: row.uid,
        userName: row.user_name || row.userName,
        userType: row.user_type || row.userType,
        designation: row.designation || '',
        department: row.department || '',
        assignedUnits: row.assigned_units || row.assignedUnits || [],
        allowedTabs: row.allowed_tabs || row.allowedTabs || [],
        permission: row.permission || 'Read',
        status: row.status || 'Active',
        phone: row.phone || '',
        email: row.email || '',
        lastLogin: row.last_login || row.lastLogin,
        password: row.password || 'Password@2026',
        createdAt: row.created_at || row.createdAt
      }));
    } catch (err) {
      console.warn('Supabase fetchUsers exception:', err);
      return [];
    }
  }

  static async saveUser(user: UserRecord): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const row = {
        id: user.id || `USR-${Date.now()}`,
        uid: user.uid.trim().toUpperCase(),
        user_name: user.userName,
        user_type: user.userType,
        designation: user.designation || '',
        department: user.department || '',
        assigned_units: user.assignedUnits || [],
        allowed_tabs: user.allowedTabs || [],
        permission: user.permission || 'Read',
        status: user.status || 'Active',
        phone: user.phone || '',
        email: user.email || '',
        password: user.password || 'Password@2026',
        last_login: user.lastLogin || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('users').upsert(row, { onConflict: 'uid' });
      if (error) {
        console.warn('Supabase saveUser error:', error.message);
        return false;
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

    try {
      const { error } = await client.from('users').delete().eq('uid', uid.trim().toUpperCase());
      return !error;
    } catch {
      return false;
    }
  }

  // ==========================================
  // 2. APP SETTINGS & UNIT CONFIGURATIONS
  // ==========================================

  static async fetchSettings(): Promise<any | null> {
    const client = this.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('app_settings')
        .select('*')
        .eq('id', 'global_settings')
        .single();

      if (error || !data) return null;
      return data.settings_data || data;
    } catch {
      return null;
    }
  }

  static async saveSettings(settingsData: any): Promise<boolean> {
    const client = this.getClient();
    if (!client) return false;

    try {
      const row = {
        id: 'global_settings',
        settings_data: settingsData,
        updated_at: new Date().toISOString()
      };

      const { error } = await client.from('app_settings').upsert(row, { onConflict: 'id' });
      return !error;
    } catch {
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

-- 1. USERS & ACCESS MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  uid TEXT UNIQUE NOT NULL,
  user_name TEXT NOT NULL,
  user_type TEXT NOT NULL DEFAULT 'Viewer',
  designation TEXT,
  department TEXT,
  assigned_units JSONB DEFAULT '[]'::jsonb,
  allowed_tabs JSONB DEFAULT '[]'::jsonb,
  permission TEXT DEFAULT 'Read',
  status TEXT DEFAULT 'Active',
  phone TEXT,
  email TEXT,
  password TEXT DEFAULT 'Password@2026',
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. APP SETTINGS & FACTORY UNIT CONFIGURATIONS
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY,
  settings_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ACTIVITY & AUDIT LOGS (UNLIMITED RETENTION)
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
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first so it never throws error 42710
DROP POLICY IF EXISTS "Allow public full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow public full access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public full access to activity_logs" ON public.activity_logs;

-- Recreate policies cleanly
CREATE POLICY "Allow public full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Insert Default Admin User
INSERT INTO public.users (id, uid, user_name, user_type, designation, department, permission, status, password)
VALUES ('USR-001', 'EKL001', 'Md. Raihan', 'Admin', 'Factory Manager', 'Knitting Operations', 'All', 'Active', 'Password@2026')
ON CONFLICT (uid) DO NOTHING;
`;
  }
}
