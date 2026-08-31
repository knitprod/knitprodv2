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

-- Row Level Security (RLS) Configuration
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow public access for anon client API key
DROP POLICY IF EXISTS "Allow public full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow public full access to factory_units" ON public.factory_units;
DROP POLICY IF EXISTS "Allow public full access to buyers" ON public.buyers;
DROP POLICY IF EXISTS "Allow public full access to system_settings" ON public.system_settings;
DROP POLICY IF EXISTS "Allow public full access to app_settings" ON public.app_settings;
DROP POLICY IF EXISTS "Allow public full access to activity_logs" ON public.activity_logs;

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

