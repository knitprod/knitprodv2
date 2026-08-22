/**
 * Supabase PostgreSQL Database Schema
 * Epyllion Knitex ERP Production & Management System
 * 
 * Instructions:
 * 1. Open your project on supabase.com
 * 2. Click "SQL Editor" in the left menu
 * 3. Paste this script and click "Run"
 */

export const SUPABASE_SCHEMA_SQL = `-- =========================================================
-- EPYLLION KNITEX ERP - SUPABASE DATABASE SCHEMA SETUP
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

-- Row Level Security (RLS) Configuration
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon client API key
CREATE POLICY "Allow public full access to users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public full access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- Insert Default Admin User
INSERT INTO public.users (id, uid, user_name, user_type, designation, department, permission, status, password)
VALUES ('USR-001', 'EKL001', 'Md. Raihan', 'Admin', 'Factory Manager', 'Knitting Operations', 'All', 'Active', 'Password@2026')
ON CONFLICT (uid) DO NOTHING;
`;
