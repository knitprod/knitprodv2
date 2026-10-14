-- =========================================================================
-- EPYLLION KNITEX ERP: GREY YARN STOCK SUPABASE CLOUD TABLE & REAL-TIME
-- =========================================================================
-- This SQL script creates and configures the `public.grey_yarn_stock` table
-- in your Supabase project with EXACT column mappings corresponding to the
-- uploaded enterprise file headers:
--
-- File Header              | Database Column      | Type
-- -------------------------------------------------------------
-- Completion Date          | completion_date      | TEXT
-- Buyer                    | buyer                | TEXT
-- Status                   | status               | TEXT (DEFAULT 'Running')
-- Allocated Order WA       | allocated_order_wa   | TEXT
-- Physical Count           | physical_count       | TEXT
-- Physical Lot             | physical_lot         | TEXT
-- Spinner                  | spinner              | TEXT
-- Booking QTY              | booking_qty          | NUMERIC (DEFAULT 0)
-- Yarn Required            | yarn_required        | NUMERIC (DEFAULT 0)
-- Net Received             | net_received         | NUMERIC (DEFAULT 0)
-- Total Issued             | total_issued         | NUMERIC (DEFAULT 0)
-- Excess Issued            | excess_issued        | NUMERIC (DEFAULT 0)
-- Total Stock QTY          | total_stock_qty      | NUMERIC (DEFAULT 0)
-- Issue Balance            | issue_balance        | NUMERIC (DEFAULT 0)
--
-- Plus standard system aliases & columns:
-- order_no, buyer_name, physical_yarn_count, physical_yarn_lot,
-- total_received, issued_balance, remarks, raw_data, created_at, updated_at
-- =========================================================================

-- 1. Create the Master Grey Yarn Stock Table
CREATE TABLE IF NOT EXISTS public.grey_yarn_stock (
  id TEXT PRIMARY KEY,
  completion_date TEXT,
  buyer TEXT,
  buyer_name TEXT,
  status TEXT DEFAULT 'Running',
  allocated_order_wa TEXT,
  order_no TEXT,
  physical_count TEXT,
  physical_yarn_count TEXT,
  physical_lot TEXT,
  physical_yarn_lot TEXT,
  spinner TEXT,
  booking_qty NUMERIC DEFAULT 0,
  yarn_required NUMERIC DEFAULT 0,
  net_received NUMERIC DEFAULT 0,
  total_received NUMERIC DEFAULT 0,
  total_issued NUMERIC DEFAULT 0,
  excess_issued NUMERIC DEFAULT 0,
  total_stock_qty NUMERIC DEFAULT 0,
  issue_balance NUMERIC DEFAULT 0,
  issued_balance NUMERIC DEFAULT 0,
  remarks TEXT,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Safe idempotent column additions for schema migrations
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS completion_date TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS buyer TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS buyer_name TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Running';
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS allocated_order_wa TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS order_no TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_count TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_yarn_count TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_lot TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS physical_yarn_lot TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS spinner TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS booking_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS yarn_required NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS net_received NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_received NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_issued NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS excess_issued NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS total_stock_qty NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS issue_balance NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS issued_balance NUMERIC DEFAULT 0;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.grey_yarn_stock ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_grey_yarn_allocated_order_wa ON public.grey_yarn_stock(allocated_order_wa);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_order_no ON public.grey_yarn_stock(order_no);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_buyer ON public.grey_yarn_stock(buyer);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_buyer_name ON public.grey_yarn_stock(buyer_name);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_status ON public.grey_yarn_stock(status);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_completion_date ON public.grey_yarn_stock(completion_date);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_spinner ON public.grey_yarn_stock(spinner);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_physical_count ON public.grey_yarn_stock(physical_count);
CREATE INDEX IF NOT EXISTS idx_grey_yarn_physical_lot ON public.grey_yarn_stock(physical_lot);

-- 4. Row Level Security (RLS)
ALTER TABLE public.grey_yarn_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public full access to grey_yarn_stock" ON public.grey_yarn_stock;
CREATE POLICY "Allow public full access to grey_yarn_stock" ON public.grey_yarn_stock FOR ALL USING (true) WITH CHECK (true);

-- 5. Real-Time WebSocket Replication
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'grey_yarn_stock'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.grey_yarn_stock;
  END IF;
EXCEPTION WHEN OTHERS THEN 
  NULL;
END $$;
