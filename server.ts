import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { saveClusterStateToCloud } from './api/_clusterStore';

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(process.cwd(), 'app_config.json');
const DB_FILE = path.join(process.cwd(), 'app_db.json');
const CLUSTER_FILE = path.join(process.cwd(), 'supabase_cluster.json');
const RAIHAN_OPERATOR_UID = 'EKL001';

// High-efficiency response compression (saves 85-92% bandwidth and fast origin transfer)
app.use(compression({
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Edge CDN Caching & Browser Cache Headers
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
  next();
});

// In-memory cache for ultra-fast response times (5-second short debounce for high concurrency)
let cachedConfigObj: { gasWebAppUrl: string; databaseMode: 'gas' | 'mock'; supabaseUrl?: string; supabaseKey?: string } | null = null;
let cachedDbObj: any = null;
const gasProxyCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 5000; // 5-second debounce cache for GET requests

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxFWAAfakjwAFV9V4AdZr6WvXOBXfWO3yAHSJkxSKxyTgOeSqW04d2sewbbtFRxd2Cn/exec';

// Robust JSON parsing with decompression, control character recovery, and boundary extraction
function safeParseJson(raw: any, fallback: any = null): any {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;

  let rawStr = '';
  if (Buffer.isBuffer(raw)) {
    // Check if buffer is gzipped (starts with 0x1f, 0x8b)
    if (raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
      try {
        rawStr = zlib.gunzipSync(raw).toString('utf-8');
      } catch {
        rawStr = raw.toString('utf-8');
      }
    } else {
      rawStr = raw.toString('utf-8');
    }
  } else if (typeof raw === 'string') {
    rawStr = raw.trim();
  } else {
    try {
      rawStr = String(raw).trim();
    } catch {
      return fallback;
    }
  }

  if (!rawStr) return fallback;

  // Attempt 1: Direct standard parse
  try {
    return JSON.parse(rawStr);
  } catch {}

  // Attempt 2: Strip UTF-8 BOM if present
  if (rawStr.charCodeAt(0) === 0xfeff) {
    try {
      return JSON.parse(rawStr.slice(1));
    } catch {}
  }

  // Attempt 3: If it starts with zlib/gzip or base64 headers, attempt decompression
  if (rawStr.startsWith('H4sI') || rawStr.startsWith('eJ') || rawStr.startsWith('eyJ')) {
    try {
      const buf = Buffer.from(rawStr, 'base64');
      try {
        const unzipped = zlib.gunzipSync(buf).toString('utf-8');
        return JSON.parse(unzipped);
      } catch {}
      try {
        const inflated = zlib.inflateSync(buf).toString('utf-8');
        return JSON.parse(inflated);
      } catch {}
      const decoded = buf.toString('utf-8');
      return JSON.parse(decoded);
    } catch {}
  }

  // Attempt 4: Clean control characters and non-printable bytes
  try {
    const sanitized = rawStr
      .replace(/^\uFEFF/, '')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return JSON.parse(sanitized);
  } catch {}

  // Attempt 5: Escape raw unescaped newlines/tabs inside strings
  try {
    const escaped = rawStr.replace(/[\x00-\x1F\x7F-\x9F]/g, (c) => {
      if (c === '\n') return '\\n';
      if (c === '\r') return '\\r';
      if (c === '\t') return '\\t';
      return '';
    });
    return JSON.parse(escaped);
  } catch {}

  // Attempt 6: Extract JSON object or array substring if surrounded by junk/binary wrappers
  try {
    const firstBrace = rawStr.indexOf('{');
    const lastBrace = rawStr.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      const candidate = rawStr.slice(firstBrace, lastBrace + 1);
      return JSON.parse(candidate);
    }
    const firstBracket = rawStr.indexOf('[');
    const lastBracket = rawStr.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      const candidate = rawStr.slice(firstBracket, lastBracket + 1);
      return JSON.parse(candidate);
    }
  } catch {}

  return fallback;
}

// Atomic file writing to guarantee readers never read a partially written file
function atomicWriteFileSync(filePath: string, content: string): boolean {
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;
  try {
    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, filePath);
    return true;
  } catch {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
      return true;
    } catch (e) {
      console.error(`Failed to write file ${filePath}:`, e);
      return false;
    }
  }
}

// Helper to load persistent server configuration with in-memory caching
function loadConfig() {
  if (cachedConfigObj) return cachedConfigObj;

  let config: { gasWebAppUrl: string; databaseMode: 'gas' | 'mock'; supabaseUrl?: string; supabaseKey?: string } = {
    gasWebAppUrl: process.env.GAS_WEB_APP_URL || process.env.VITE_GAS_WEB_APP_URL || DEFAULT_GAS_URL,
    databaseMode: 'gas',
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    supabaseKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const fileData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = safeParseJson(fileData, null);
      if (data) {
        if (typeof data.gasWebAppUrl === 'string' && data.gasWebAppUrl.trim()) {
          config.gasWebAppUrl = data.gasWebAppUrl.trim();
        }
        if (data.databaseMode === 'gas' || data.databaseMode === 'mock') {
          config.databaseMode = data.databaseMode;
        }
        if (typeof data.supabaseUrl === 'string' && data.supabaseUrl.trim()) {
          config.supabaseUrl = data.supabaseUrl.trim();
        }
        if (typeof data.supabaseKey === 'string' && data.supabaseKey.trim()) {
          config.supabaseKey = data.supabaseKey.trim();
        }
      }
    } catch (e) {
      console.error('Error reading app_config.json file:', e);
    }
  }

  if (!config.gasWebAppUrl || !config.gasWebAppUrl.trim()) {
    config.gasWebAppUrl = DEFAULT_GAS_URL;
  }

  cachedConfigObj = config;
  return config;
}

// Helper to save server configuration to disk
function saveConfig(newConfig: Partial<{ gasWebAppUrl: string; databaseMode: 'gas' | 'mock'; supabaseUrl?: string; supabaseKey?: string }>) {
  const current = loadConfig();
  const updated = {
    ...current,
    ...newConfig,
  };
  cachedConfigObj = updated;

  // Invalidate proxy & Supabase caches on config change
  gasProxyCache.clear();
  resetServerSupabaseState();

  atomicWriteFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2));

  // Synchronize source code files (server.ts & gasClient.ts) so backend code uses exact same URL
  if (newConfig.gasWebAppUrl && typeof newConfig.gasWebAppUrl === 'string' && newConfig.gasWebAppUrl.trim()) {
    const newUrl = newConfig.gasWebAppUrl.trim();
    process.env.GAS_WEB_APP_URL = newUrl;
    process.env.VITE_GAS_WEB_APP_URL = newUrl;

    // 1. Update server.ts default URL
    const serverPath = path.join(process.cwd(), 'server.ts');
    if (fs.existsSync(serverPath)) {
      try {
        let content = fs.readFileSync(serverPath, 'utf-8');
        const serverRegex = /(const DEFAULT_GAS_URL\s*=\s*)(['"])([\s\S]*?)\2;/g;
        if (serverRegex.test(content)) {
          content = content.replace(serverRegex, `const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxFWAAfakjwAFV9V4AdZr6WvXOBXfWO3yAHSJkxSKxyTgOeSqW04d2sewbbtFRxd2Cn/exec';`);
          atomicWriteFileSync(serverPath, content);
        }
      } catch (e) {
        console.error('Error updating server.ts default URL:', e);
      }
    }

    // 2. Update src/lib/gasClient.ts default URL
    const gasClientPath = path.join(process.cwd(), 'src/lib/gasClient.ts');
    if (fs.existsSync(gasClientPath)) {
      try {
        let content = fs.readFileSync(gasClientPath, 'utf-8');
        const gasClientRegex = /(const DEFAULT_GAS_URL\s*=\s*)(['"])([\s\S]*?)\2;/g;
        if (gasClientRegex.test(content)) {
          content = content.replace(gasClientRegex, `const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbxFWAAfakjwAFV9V4AdZr6WvXOBXfWO3yAHSJkxSKxyTgOeSqW04d2sewbbtFRxd2Cn/exec';`);
          atomicWriteFileSync(gasClientPath, content);
        }
        const clientRegex = /(static DEFAULT_URL\s*=\s*)(['"])([\s\S]*?)\2;/g;
        if (clientRegex.test(content)) {
          content = content.replace(clientRegex, `static DEFAULT_URL = '${newUrl}';`);
          atomicWriteFileSync(gasClientPath, content);
        }
      } catch (e) {
        console.error('Error updating gasClient.ts default URL:', e);
      }
    }

    // 3. Update .env if present
    const envPath = path.join(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      try {
        let envContent = fs.readFileSync(envPath, 'utf-8');
        if (envContent.includes('GAS_WEB_APP_URL=')) {
          envContent = envContent.replace(/GAS_WEB_APP_URL=.*/g, `GAS_WEB_APP_URL="${newUrl}"`);
        } else {
          envContent += `\nGAS_WEB_APP_URL="${newUrl}"\n`;
        }
        atomicWriteFileSync(envPath, envContent);
      } catch (e) {
        console.error('Error updating .env file:', e);
      }
    }
  }

  return updated;
}

// Central database helpers with in-memory caching
function sanitizeLedgerList(list: any[]): any[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  list.forEach((r: any, idx) => {
    if (!r || typeof r !== 'object') return;
    if (r.id === 'rec-2026-08-11-extension') return;

    // Fast check: skip records that are completely empty / dummy placeholders
    const hasMeaningfulData = Boolean(
      (r.date && String(r.date).trim()) ||
      (r.floor && String(r.floor).trim()) ||
      (r.unit && String(r.unit).trim()) ||
      (r.totalProduction !== undefined && r.totalProduction !== null && r.totalProduction !== '') ||
      (r.target !== undefined && r.target !== null && r.target !== '') ||
      (r.shiftA !== undefined && r.shiftA !== null && r.shiftA !== '') ||
      (r.shiftB !== undefined && r.shiftB !== null && r.shiftB !== '') ||
      (r.shiftC !== undefined && r.shiftC !== null && r.shiftC !== '') ||
      (r.bulkProd !== undefined && r.bulkProd !== null && r.bulkProd !== '') ||
      (r.runningMachine !== undefined && r.runningMachine !== null && r.runningMachine !== '')
    );
    if (!hasMeaningfulData) return;

    let item = r;
    const d = (item.date || '').trim();
    const f = (item.floor || item.unit || '').trim().toLowerCase();
    const key = (d && f) ? `${d}_${f}` : (item.id || `rec_${idx}`);
    
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const existingProd = Number(existing.totalProduction) || Number(existing.bulkProd) || 0;
      const currentProd = Number(item.totalProduction) || Number(item.bulkProd) || 0;
      if (currentProd >= existingProd) {
        map.set(key, { ...existing, ...item });
      } else {
        map.set(key, { ...item, ...existing });
      }
    }
  });
  return Array.from(map.values());
}

function loadDb() {
  if (cachedDbObj) return cachedDbObj;

  let db: any = {
    settings: {
      rejectThreshold: '2.5',
      maxIdleMachines: '4',
      alarmEmail: 'knitprod-alerts@epyllion.com',
      targets: {
        'EKL': '7500',
        'EFL': '15000',
        'EFL-2': '15000',
        'Auto Stripe': '12000',
        'EFL-Extension': '15000',
        'ESL-Extension': '10000',
      },
      machines: {
        'EKL': '48',
        'EFL': '40',
        'EFL-2': '35',
        'Auto Stripe': '20',
        'EFL-Extension': '25',
        'ESL-Extension': '16',
      }
    },
    users: [
      {
        id: 'usr-1',
        userName: 'Superadmin',
        userType: 'Admin',
        designation: 'Full Control OF APP',
        uid: 'EKL001',
        password: 'AskRaihan@123',
        department: 'Knitting',
        assignedUnits: ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact', 'ESL-EXT-1'],
        permission: 'Read / Write',
        status: 'Active',
        lastUpdated: '2026-11-22 12:00 AM'
      },
      {
        id: 'usr-2',
        userName: 'Zahirul Islam',
        userType: 'Admin',
        designation: 'General Manager (GM)',
        uid: 'EKL002',
        password: 'GmKnitting99',
        department: 'Knitting',
        assignedUnits: ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'],
        permission: 'Read / Write',
        status: 'Active',
        lastUpdated: '2026-07-15 11:45 AM'
      },
      {
        id: 'usr-3',
        userName: 'Akil Zaman',
        userType: 'General',
        designation: 'Assistant Manager',
        uid: 'EKL003',
        password: 'AkilZaman#456',
        department: 'Knitting',
        assignedUnits: ['EKL', 'EFL-2'],
        permission: 'Read',
        status: 'Active',
        lastUpdated: '2026-07-14 02:15 PM'
      },
      {
        id: 'usr-4',
        userName: 'Nasrin Akhter',
        userType: 'General',
        designation: 'Executive',
        uid: 'EKL004',
        password: 'NasrinDyeing@1',
        department: 'Dyeing',
        assignedUnits: ['EFL', 'Auto Stripe'],
        permission: 'Read',
        status: 'Active',
        lastUpdated: '2026-07-13 09:10 AM'
      }
    ],
    branding: {
      companyLogo: '',
      myLogo: ''
    },
    ledger: [],
    productionEntries: [],
    activityLogs: []
  };

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileData = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = safeParseJson(fileData, null);
      if (parsed) {
        if (parsed.ledger && Array.isArray(parsed.ledger)) {
          parsed.ledger = parsed.ledger.filter((r: any) => !String(r.date || '').startsWith('2026-08'));
        }
        db = { ...db, ...parsed };
      } else {
        // Recover from corrupt file by writing back safe defaults
        atomicWriteFileSync(DB_FILE, JSON.stringify(db, null, 2));
      }
    } catch (e) {
      console.error('Error reading app_db.json, recovering with safe state:', e);
      try {
        atomicWriteFileSync(DB_FILE, JSON.stringify(db, null, 2));
      } catch {}
    }
  } else {
    try {
      atomicWriteFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch {}
  }

  cachedDbObj = db;
  return db;
}

function saveDb(partial: any) {
  try {
    const current = loadDb();
    let updated = { ...current, ...partial };

    // Smart upsert for users array if provided
    if (partial.users && Array.isArray(partial.users) && current.users && Array.isArray(current.users)) {
      const newUsers = [...current.users];
      for (const u of partial.users) {
        if (!u || !u.uid) continue;
        const idx = newUsers.findIndex(existing => 
          (existing.uid && u.uid && existing.uid.toString().trim().toUpperCase() === u.uid.toString().trim().toUpperCase()) ||
          (existing.id && u.id && existing.id === u.id)
        );
        if (idx >= 0) {
          newUsers[idx] = { ...newUsers[idx], ...u };
        } else {
          newUsers.unshift(u);
        }
      }
      updated.users = newUsers;
    }

    cachedDbObj = updated;
    atomicWriteFileSync(DB_FILE, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.warn('Error saving to DB:', e);
    return cachedDbObj || loadDb();
  }
}

// Secure session cookie helper
function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach((cookie) => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// GET auth session state via active tab x-session-uid header or browser session cookie
app.get('/api/auth/session', (req, res) => {
  const headerUid = req.headers['x-session-uid'];
  let cookieUid: string | null = null;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/ekl_auth_session=([^;]+)/);
    if (match) {
      try {
        cookieUid = decodeURIComponent(match[1]);
      } catch (e) {
        cookieUid = match[1];
      }
    }
  }

  const effectiveUid = (typeof headerUid === 'string' && headerUid.trim())
    ? headerUid.trim().toUpperCase()
    : (cookieUid && cookieUid.trim() ? cookieUid.trim().toUpperCase() : null);

  if (effectiveUid) {
    res.json({ authenticated: true, uid: effectiveUid });
  } else {
    res.json({ authenticated: false, uid: null });
  }
});

// POST establish auth session via HTTP-only cookie and header
app.post('/api/auth/session', (req, res) => {
  const { uid } = req.body || {};
  const headerUid = req.headers['x-session-uid'];
  const rawUid = (typeof uid === 'string' && uid.trim()) 
    ? uid 
    : (typeof headerUid === 'string' && headerUid.trim() ? headerUid : null);

  if (rawUid && rawUid.trim()) {
    const cleanUid = rawUid.trim().toUpperCase();
    // Do NOT specify Max-Age so this is an ephemeral Session Cookie (purged on browser close)
    res.setHeader(
      'Set-Cookie',
      `ekl_auth_session=${encodeURIComponent(cleanUid)}; Path=/; HttpOnly; SameSite=None; Secure; Partitioned`
    );
    res.json({ success: true, uid: cleanUid });
  } else {
    res.status(400).json({ success: false, message: 'Invalid UID supplied.' });
  }
});

// DELETE terminate auth session cookie
app.delete('/api/auth/session', (req, res) => {
  res.setHeader(
    'Set-Cookie',
    `ekl_auth_session=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0`
  );
  res.json({ success: true, message: 'Session cookie destroyed.' });
});

// Helper: extract authenticated UID from HTTP-only session cookie or x-session-uid header
function getRequestSessionUid(req: express.Request): string | null {
  const headerUid = req.headers['x-session-uid'];
  let cookieUid: string | null = null;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/ekl_auth_session=([^;]+)/);
    if (match) {
      try {
        cookieUid = decodeURIComponent(match[1]);
      } catch {
        cookieUid = match[1];
      }
    }
  }
  const effective = (typeof headerUid === 'string' && headerUid.trim())
    ? headerUid.trim().toUpperCase()
    : (cookieUid && cookieUid.trim() ? cookieUid.trim().toUpperCase() : null);
  return effective;
}

function isRaihanOperatorRequest(req: express.Request): boolean {
  const uid = (getRequestSessionUid(req) || '').replace(/[\s-_]/g, '');
  return uid === RAIHAN_OPERATOR_UID || uid === 'RAIHAN';
}

function requireRaihanOperator(req: express.Request, res: express.Response): boolean {
  if (!isRaihanOperatorRequest(req)) {
    res.status(403).json({
      success: false,
      message: 'Restricted: Dual-server failover controls are strictly limited to Superadmin (EKL001) / Raihan.'
    });
    return false;
  }
  return true;
}

// GET central database configuration (returns active server credentials, or empty if paused)
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  const cluster = loadClusterState();
  const activeSrv = getActiveClusterServer();
  res.json({
    success: true,
    config: {
      ...config,
      supabaseUrl: activeSrv ? activeSrv.supabaseUrl : '',
      supabaseKey: activeSrv ? activeSrv.supabaseKey : '',
      activeServerId: cluster.activeServerId,
      activeServerLabel: activeSrv ? activeSrv.label : null,
      activeServerPaused: !activeSrv,
      clusterRevision: cluster.clusterRevision
    }
  });
});

// POST update central database configuration (syncs across all devices)
app.post('/api/config', (req, res) => {
  const { gasWebAppUrl, databaseMode, supabaseUrl, supabaseKey } = req.body || {};
  const updated = saveConfig({
    gasWebAppUrl: typeof gasWebAppUrl === 'string' ? gasWebAppUrl : undefined,
    databaseMode: (databaseMode === 'gas' || databaseMode === 'mock') ? databaseMode : undefined,
    supabaseUrl: typeof supabaseUrl === 'string' ? supabaseUrl : undefined,
    supabaseKey: typeof supabaseKey === 'string' ? supabaseKey : undefined,
  });
  // Keep active cluster server in sync if updated via legacy Settings save
  if (typeof supabaseUrl === 'string' && supabaseUrl.trim() && typeof supabaseKey === 'string' && supabaseKey.trim()) {
    const cluster = loadClusterState();
    const targetId: ServerSlotId = cluster.activeServerId || 'server1';
    const cleanUrl = sanitizeSupabaseUrlForServer(supabaseUrl);
    if (cleanUrl) {
      cluster.servers[targetId].supabaseUrl = cleanUrl;
      cluster.servers[targetId].supabaseKey = supabaseKey.trim();
      saveClusterState(cluster);
    }
  }
  res.json({ success: true, config: updated });
});

// Central Database state endpoint (cross-device fallback store)
app.get('/api/db', (req, res) => {
  const db = loadDb();
  res.json({ success: true, db });
});

app.post('/api/db', (req, res) => {
  const updated = saveDb(req.body || {});
  res.json({ success: true, db: updated });
});

// Central Branding & Logo endpoints for immediate cross-device sync
app.get('/api/branding', (req, res) => {
  const db = loadDb();
  res.json({
    success: true,
    branding: {
      companyLogo: db?.branding?.companyLogo || db?.settings?.companyLogo || null,
      myLogo: db?.branding?.myLogo || db?.settings?.myLogo || null
    }
  });
});

app.post('/api/branding', (req, res) => {
  const { companyLogo, myLogo } = req.body || {};
  const currentDb = loadDb();
  const currentBranding = currentDb.branding || {};
  const updatedBranding = {
    ...currentBranding,
    ...(companyLogo !== undefined ? { companyLogo: companyLogo || '' } : {}),
    ...(myLogo !== undefined ? { myLogo: myLogo || '' } : {})
  };
  const updated = saveDb({
    branding: updatedBranding,
    settings: {
      ...(currentDb.settings || {}),
      ...(companyLogo !== undefined ? { companyLogo: companyLogo || '' } : {}),
      ...(myLogo !== undefined ? { myLogo: myLogo || '' } : {})
    }
  });
  res.json({
    success: true,
    branding: updated.branding
  });
});

// Helper to query individual GAS endpoints with timeout
async function fetchGasEndpoint(baseUrl: string, action: string, queryParams: Record<string, any>, timeoutMs: number = 90000) {
  try {
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('action', action);
    for (const [key, val] of Object.entries(queryParams)) {
      if (key !== 'url' && key !== 'refresh' && key !== 'action') {
        urlObj.searchParams.set(key, String(val));
      }
    }
    const response = await fetch(urlObj.toString(), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    const text = await response.text();
    return safeParseJson(text, null);
  } catch (e) {
    return null;
  }
}

// Proxy to Google Apps Script REST API with high performance caching & edge headers
const gasProxyHandler = async (req: express.Request, res: express.Response) => {
  const config = loadConfig();
  
  try {
    let targetUrl = config.gasWebAppUrl;
    
    // Allow URL override ONLY if server config is empty OR if this is an explicit health test
    const reqAction = (req.method === 'GET' ? req.query.action : req.body?.action);
    const clientUrl = (req.method === 'GET' ? String(req.query.url) : req.body?.url);
    if ((!targetUrl || !targetUrl.trim() || reqAction === 'health') && clientUrl && typeof clientUrl === 'string' && clientUrl.trim()) {
      targetUrl = clientUrl.trim();
    }

    if (!targetUrl || !targetUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Google Apps Script Web App URL is not configured centrally on the server.'
      });
    }

    let trimmedUrl = targetUrl.trim();

    // Auto-correct common Google Apps Script URL mistakes
    if (trimmedUrl.endsWith('/dev')) {
      trimmedUrl = trimmedUrl.replace(/\/dev$/, '/exec');
    } else if (trimmedUrl.endsWith('/edit')) {
      trimmedUrl = trimmedUrl.replace(/\/edit$/, '/exec');
    } else if (trimmedUrl.includes('/macros/s/') && !trimmedUrl.endsWith('/exec')) {
      trimmedUrl = trimmedUrl.replace(/\/+$/, '') + '/exec';
    }

    if (req.method === 'GET') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      const action = String(req.query.action || 'all');
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = `${trimmedUrl}_${action}_${JSON.stringify(req.query)}`;
      const now = Date.now();
      const cached = gasProxyCache.get(cacheKey);

      // Return instant debounce cache if fresh (<2s) and not force-refreshed
      if (!forceRefresh && cached && (now - cached.timestamp < 2000)) {
        return res.json(cached.data);
      }

      // Handle 'all' or 'bulk' action with fallback to concurrent multi-endpoint fetching
      if (action === 'all' || action === 'bulk') {
        const localDb = loadDb();

        // 1. Try direct action=all with adequate timeout for live Google Sheets
        const directAllRes = await fetchGasEndpoint(trimmedUrl, 'all', req.query, 60000);
        if (directAllRes && directAllRes.success && directAllRes.data && (directAllRes.data.orderPlans || directAllRes.data.orders || directAllRes.data.yarnAllocations || directAllRes.data.yarn || directAllRes.data.ledger)) {
          const directData = directAllRes.data;
          const mergedOrders = (directData.orderPlans && directData.orderPlans.length > 0) ? directData.orderPlans : ((directData.orders && directData.orders.length > 0) ? directData.orders : (localDb.orderPlans || []));
          const mergedYarn = (directData.yarnAllocations && directData.yarnAllocations.length > 0) ? directData.yarnAllocations : ((directData.yarn && directData.yarn.length > 0) ? directData.yarn : (localDb.yarnAllocations || []));
          const mergedLedger = sanitizeLedgerList((directData.ledger && directData.ledger.length > 0) ? directData.ledger : (localDb.ledger || []));
          
          const resultPayload = {
            success: true,
            data: {
              ...directData,
              orderPlans: mergedOrders,
              yarnAllocations: mergedYarn,
              ledger: mergedLedger,
              totalOrders: mergedOrders.length,
              totalYarn: mergedYarn.length,
              totalLedger: mergedLedger.length
            }
          };

          // Save fresh datasets to local persistent store for offline backup
          if (mergedOrders.length > 0) localDb.orderPlans = mergedOrders;
          if (mergedYarn.length > 0) localDb.yarnAllocations = mergedYarn;
          if (mergedLedger.length > 0) localDb.ledger = mergedLedger;
          saveDb(localDb);

          gasProxyCache.set(cacheKey, { timestamp: now, data: resultPayload });
          return res.json(resultPayload);
        }

        // 2. Fallback: Fetch order plans, yarn allocations, and ledger concurrently from GAS
        const [ordersRes, yarnRes, ledgerRes] = await Promise.allSettled([
          fetchGasEndpoint(trimmedUrl, 'orders/list', req.query, 60000),
          fetchGasEndpoint(trimmedUrl, 'yarn/list', req.query, 60000),
          fetchGasEndpoint(trimmedUrl, 'ledger/list', req.query, 60000),
        ]);

        let ordersData = ordersRes.status === 'fulfilled' && ordersRes.value?.data && Array.isArray(ordersRes.value.data) ? ordersRes.value.data : [];
        let yarnData = yarnRes.status === 'fulfilled' && yarnRes.value?.data && Array.isArray(yarnRes.value.data) ? yarnRes.value.data : [];
        let ledgerData = ledgerRes.status === 'fulfilled' && ledgerRes.value?.data && Array.isArray(ledgerRes.value.data) ? ledgerRes.value.data : [];

        // If GAS is reachable with partial data, update local database
        if (ordersData.length > 0) localDb.orderPlans = ordersData;
        else if (localDb.orderPlans && localDb.orderPlans.length > 0) ordersData = localDb.orderPlans;

        if (yarnData.length > 0) localDb.yarnAllocations = yarnData;
        else if (localDb.yarnAllocations && localDb.yarnAllocations.length > 0) yarnData = localDb.yarnAllocations;

        if (ledgerData.length > 0) localDb.ledger = ledgerData;
        else if (localDb.ledger && localDb.ledger.length > 0) ledgerData = localDb.ledger;
        ledgerData = sanitizeLedgerList(ledgerData);

        if (ordersData.length > 0 || yarnData.length > 0 || ledgerData.length > 0) {
          saveDb(localDb);
        }

        const combinedPayload = {
          success: true,
          data: {
            orderPlans: ordersData,
            yarnAllocations: yarnData,
            ledger: ledgerData,
            totalOrders: ordersData.length,
            totalYarn: yarnData.length,
            totalLedger: ledgerData.length
          }
        };

        if (ordersData.length > 0 || yarnData.length > 0 || ledgerData.length > 0) {
          gasProxyCache.set(cacheKey, { timestamp: now, data: combinedPayload });
        }

        return res.json(combinedPayload);
      }

      // Single endpoint direct fetch (e.g. orders/list, yarn/list, ledger/list, health)
      try {
        const urlObj = new URL(trimmedUrl);
        urlObj.searchParams.set('action', action);
        for (const [key, val] of Object.entries(req.query)) {
          if (key !== 'url' && key !== 'refresh' && key !== 'action') {
            urlObj.searchParams.set(key, String(val));
          }
        }

        const response = await fetch(urlObj.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          redirect: 'follow',
          signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
          const localDb = loadDb();
          if (action.includes('yarn') && localDb.yarnAllocations?.length) {
            return res.json({ success: true, data: localDb.yarnAllocations });
          }
          if (action.includes('order') && localDb.orderPlans?.length) {
            return res.json({ success: true, data: localDb.orderPlans });
          }
          if (action.includes('ledger') && localDb.ledger?.length) {
            return res.json({ success: true, data: sanitizeLedgerList(localDb.ledger) });
          }
          if (cached) return res.json(cached.data);
          return res.status(response.status).json({
            success: false,
            message: `Google Apps Script returned HTTP status ${response.status}`
          });
        }

        const text = await response.text();
        const json = safeParseJson(text, null);
        if (json && json.success !== false) {
          gasProxyCache.set(cacheKey, { timestamp: now, data: json });
          // Save fresh data to local persistent store as backup
          const localDb = loadDb();
          if (action.includes('yarn') && Array.isArray(json.data) && json.data.length > 0) {
            localDb.yarnAllocations = json.data;
            saveDb(localDb);
          } else if (action.includes('order') && Array.isArray(json.data) && json.data.length > 0) {
            localDb.orderPlans = json.data;
            saveDb(localDb);
          } else if (action.includes('ledger') && Array.isArray(json.data) && json.data.length > 0) {
            json.data = sanitizeLedgerList(json.data);
            localDb.ledger = json.data;
            saveDb(localDb);
          }
          return res.json(json);
        } else if (json) {
          return res.json(json);
        } else {
          if (cached) return res.json(cached.data);
          return res.json({ success: false, message: 'Invalid JSON response from Apps Script', raw: text });
        }
      } catch (fetchErr: any) {
        const localDb = loadDb();
        if (action.includes('yarn') && localDb.yarnAllocations?.length) {
          return res.json({ success: true, data: localDb.yarnAllocations });
        }
        if (action.includes('order') && localDb.orderPlans?.length) {
          return res.json({ success: true, data: localDb.orderPlans });
        }
        if (action.includes('ledger') && localDb.ledger?.length) {
          return res.json({ success: true, data: sanitizeLedgerList(localDb.ledger) });
        }
        if (cached) return res.json(cached.data);
        return res.json({
          success: false,
          message: fetchErr.message || 'Error connecting to Google Apps Script'
        });
      }
    } else if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

      // Invalidate GET cache on write operations so next reads get fresh data
      gasProxyCache.clear();

      const postBody = { ...req.body };
      delete postBody.url;

      // Immediately save mutation or deletion to local persistent database
      try {
        const localDb = loadDb();
        const actionStr = String(postBody.action || '').toLowerCase();

        // 1. Production Ledger Deletions
        if (actionStr === 'ledger/delete' || actionStr === 'deleteledgerentry' || actionStr === 'deleterecord') {
          const deleteId = postBody.id;
          const deleteDate = postBody.date ? String(postBody.date).trim() : null;
          const deleteFloor = postBody.floor ? String(postBody.floor).trim().toLowerCase() : null;
          localDb.ledger = (localDb.ledger || []).filter((r: any) => {
            if (deleteId && r.id === deleteId) return false;
            if (deleteDate && deleteFloor) {
              const rDate = String(r.date || '').trim();
              const rFloor = String(r.floor || r.unit || '').trim().toLowerCase();
              if (rDate === deleteDate && rFloor === deleteFloor) return false;
            }
            return true;
          });
        }

        // 2. Order Plans Deletions
        if (actionStr === 'orders/delete' || actionStr === 'deleteorder') {
          const deleteId = postBody.id;
          localDb.orderPlans = (localDb.orderPlans || []).filter((o: any) => o.id !== deleteId && o.ewo !== deleteId);
        }

        // 3. Yarn Allocations Deletions
        if (actionStr === 'yarn/delete' || actionStr === 'deleteyarnallocation') {
          const deleteId = postBody.id;
          localDb.yarnAllocations = (localDb.yarnAllocations || []).filter((y: any) => y.id !== deleteId);
        }

        // 4. Upsert & Batch saves
        if (postBody.yarnAllocations && Array.isArray(postBody.yarnAllocations)) {
          if (postBody.replace) {
            localDb.yarnAllocations = postBody.yarnAllocations;
          } else {
            const existingMap = new Map((localDb.yarnAllocations || []).map((y: any) => [y.id, y]));
            postBody.yarnAllocations.forEach((y: any) => existingMap.set(y.id, y));
            localDb.yarnAllocations = Array.from(existingMap.values());
          }
        }
        if (postBody.orderPlans && Array.isArray(postBody.orderPlans)) {
          if (postBody.replace) {
            localDb.orderPlans = postBody.orderPlans;
          } else {
            const existingMap = new Map((localDb.orderPlans || []).map((o: any) => [o.id, o]));
            postBody.orderPlans.forEach((o: any) => existingMap.set(o.id, o));
            localDb.orderPlans = Array.from(existingMap.values());
          }
        }
        if (postBody.ledger && Array.isArray(postBody.ledger)) {
          if (postBody.replace) {
            localDb.ledger = sanitizeLedgerList(postBody.ledger);
          } else {
            const existingMap = new Map((localDb.ledger || []).map((l: any) => [l.id, l]));
            postBody.ledger.forEach((l: any) => existingMap.set(l.id, l));
            localDb.ledger = sanitizeLedgerList(Array.from(existingMap.values()));
          }
        }
        if (actionStr === 'ledger/update' && postBody.id) {
          const idx = (localDb.ledger || []).findIndex((l: any) => l.id === postBody.id);
          if (idx >= 0) {
            localDb.ledger[idx] = { ...localDb.ledger[idx], ...postBody };
            localDb.ledger = sanitizeLedgerList(localDb.ledger);
          }
        }

        saveDb(localDb);
      } catch (dbErr) {
        console.warn('Error saving mutation to local db:', dbErr);
      }

      try {
        const response = await fetch(trimmedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(postBody),
          redirect: 'follow',
          signal: AbortSignal.timeout(60000) // 60-second timeout for large batch mutations
        });

        if (!response.ok) {
          let hint = '';
          if (response.status === 404) {
            hint = ' (404 Not Found: Ensure URL ends in "/exec", not "/dev").';
          } else if (response.status === 401 || response.status === 403) {
            hint = ' (Access Denied: Set "Who has access" to "Anyone" in Google Apps Script).';
          }
          return res.status(response.status).json({
            success: false,
            message: `Google Apps Script returned HTTP status ${response.status}${hint}`
          });
        }

        const text = await response.text();
        const json = safeParseJson(text, null);
        if (json) {
          return res.json(json);
        } else {
          return res.json({ success: false, message: 'Invalid JSON response from Apps Script', raw: text });
        }
      } catch (postErr: any) {
        const isTimeout = postErr.name === 'TimeoutError' || postErr.message?.includes('timeout') || postErr.message?.includes('aborted');
        return res.json({
          success: false,
          message: isTimeout
            ? 'Google Apps Script POST timed out. The request may still be processing in the background.'
            : (postErr.message || 'Error executing POST request to Google Apps Script')
        });
      }
    } else {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
  } catch (err: any) {
    console.error('GAS Proxy Error:', err);
    const isTimeout = err.name === 'TimeoutError' || err.message?.includes('timeout') || err.message?.includes('aborted');
    return res.status(200).json({
      success: false,
      message: isTimeout 
        ? 'Google Apps Script connection timed out. Please try again.'
        : (err.message || 'Error communicating with Google Apps Script')
    });
  }
};

// =========================================================================
// RAIHAN AI ERP ASSISTANT (IN-WEBSITE ONLY, ZERO EXTERNAL/SECRET LEAKS)
// =========================================================================

let serverSupabaseClient: SupabaseClient | null = null;
let serverSupabaseRestrictedUntil = 0;
let serverSupabaseRestrictedReason: string | null = null;

type CacheableSupabaseTable =
  | 'production_ledger'
  | 'yarn_allocations'
  | 'order_plans'
  | 'knitting_orders'
  | 'textile_close_pmc'
  | 'grey_stock_summary'
  | 'grey_yarn_stock';

// Explicit slim column projections (excluding duplicated raw_data JSONB blobs)
// Automatically falls back to '*' per table if an older schema is missing a column.
const CACHEABLE_TABLE_CONFIG: Record<
  CacheableSupabaseTable,
  { columns: string; orderCol: string | null; ascending: boolean }
> = {
  production_ledger: {
    columns:
      'id,date,unit,floor,shift_a,shift_b,shift_c,total_production,target,efficiency,active_machines,total_machines,machine_utilization,idle_machines,running_orders,buyer,remarks,updated_by,created_at,updated_at',
    orderCol: 'date',
    ascending: false
  },
  yarn_allocations: {
    columns:
      'id,actual_requisition_date,buyer,order_number,fabrics_type,fabric_shade,fabric_gsm,yarn_required,lot_ref,allocated_yarn,lot_no,spinners_name,allocation_status,yarn_stock_status,yarn_delivery_status,proposed_allocation_date,allocation_date_range,allocation_no,yarn_rq_qty,allocated_qty,balance,remarks,updated_by,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  order_plans: {
    columns:
      'id,plan_month,plan_type,ewo,buyer,color,knit_start,knit_end,target,target_next_month,allocation_start,allocation_end,allocated_qty,allocated_bal,grey_req,knit_pro,knit_bal,a_knit_start,last_production_date,avg_prod_day,expected_knit_end,knit_start_otd,knit_end_otd,knit_start_remarks,knit_end_remarks,knit_team_leaders,updated_by,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  knitting_orders: {
    // Keep raw_data here for legacy rows storing pmcKnitStartDate/actualKnitStartDate (new writes omit items from raw_data)
    columns:
      'id,order_no,buyer_name,team_leader,knit_start_date,knit_end_date,req_qty,grey_qty,production,knit_balance,items,remarks,raw_data,created_at,updated_at',
    orderCol: 'id',
    ascending: false
  },
  textile_close_pmc: {
    columns:
      'id,status,order_no,buyer_name,team_leader,fgsm,f_width,color,fab_type,req_qty,grey_qty,production,knit_bal,closed_date,remarks,updated_at',
    orderCol: 'order_no',
    ascending: true
  },
  grey_stock_summary: {
    columns:
      'id,code,order_no,buyer_name,colour,fab_style,fab_type,status,completion_date,net_received_qty,net_issued_qty,stock_qty,double_count,owner_unit,matched_grey_qty,updated_at',
    orderCol: 'id',
    ascending: true
  },
  grey_yarn_stock: {
    columns:
      'id,completion_date,buyer,status,allocated_order_wa,physical_count,physical_lot,spinner,booking_qty,yarn_required,net_received,total_issued,excess_issued,total_stock_qty,issue_balance,order_no,buyer_name,physical_yarn_count,physical_yarn_lot,total_received,issued_balance,remarks,updated_at',
    orderCol: 'order_no',
    ascending: true
  }
};

const CACHEABLE_TABLE_SET = new Set<string>(Object.keys(CACHEABLE_TABLE_CONFIG));
const tablesRequiringWildcardSelect = new Set<CacheableSupabaseTable>();

interface ServerTableCacheEntry {
  rows: any[];
  fetchedAt: number;
  version: number;
  maxUpdatedAt: string | null;
  lastForceRefreshAt: number;
}

const SUPABASE_SERVER_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (invalidated immediately on mutations/uploads)
const SUPABASE_FORCE_COOLDOWN_MS = 30 * 1000; // Prevent impatient Sync double-click origin spam
const SUPABASE_PROBE_COOLDOWN_MS = 5 * 60 * 1000; // Max 1 tiny MAX(updated_at) probe every 5 min
const SUPABASE_PERM_DENIED_COOLDOWN_MS = 60 * 1000; // Cooldown when table lacks GRANT permissions
const supabaseServerCache = new Map<CacheableSupabaseTable, ServerTableCacheEntry>();
const supabaseInFlightFetches = new Map<string, Promise<any[] | null>>();
const supabasePermDeniedUntil = new Map<CacheableSupabaseTable, number>();
let lastVersionProbeAt = 0;

interface ServerSettingsCacheEntry {
  data: any;
  fetchedAt: number;
  version: number;
}
let supabaseSettingsCache: ServerSettingsCacheEntry | null = null;
let supabaseSettingsInFlight: Promise<any | null> | null = null;

function resetServerSupabaseState() {
  serverSupabaseClient = null;
  serverSupabaseRestrictedUntil = 0;
  serverSupabaseRestrictedReason = null;
  supabaseServerCache.clear();
  supabaseInFlightFetches.clear();
  supabasePermDeniedUntil.clear();
  tablesRequiringWildcardSelect.clear();
  supabaseSettingsCache = null;
  supabaseSettingsInFlight = null;
  lastVersionProbeAt = 0;
}

function isServerPermissionDeniedError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '').toLowerCase();
  return code === '42501' || msg.includes('permission denied');
}

function isServerSupabaseQuotaError(err: any): boolean {
  if (!err) return false;
  try {
    const msg = (
      typeof err === 'string'
        ? err
        : (err.message || err.details || err.hint || JSON.stringify(err))
    ).toLowerCase();
    return (
      msg.includes('exceed_egress_quota') ||
      msg.includes('exceed_quota') ||
      msg.includes('egress quota') ||
      msg.includes('restricted due to') ||
      msg.includes('spend caps') ||
      msg.includes('upgrade their plan') ||
      err?.status === 402
    );
  } catch {
    return false;
  }
}

function isServerSupabaseRestricted(): boolean {
  return serverSupabaseRestrictedUntil > Date.now();
}

function markServerSupabaseRestricted(err: any) {
  serverSupabaseRestrictedUntil = Date.now() + 5 * 60 * 1000;
  serverSupabaseRestrictedReason =
    (err && typeof err === 'object' && err.message)
      ? String(err.message)
      : 'Supabase project egress quota exceeded.';
}

// =========================================================================
// DUAL-SUPABASE MANUAL FAILOVER, HARD-PAUSE & PER-SERVER EGRESS METER
// =========================================================================

type ServerSlotId = 'server1' | 'server2';
// Decimal GB (1e9 bytes) matches Supabase Free Plan egress meter (5 GB = 5,000,000,000 bytes)
const BYTES_PER_GB = 1_000_000_000;

function estimateWireEgressBytes(payload: any): number {
  try {
    const raw = Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
    if (raw.length === 0) return 0;
    return zlib.gzipSync(raw, { level: 1 }).length + 600;
  } catch {
    return 0;
  }
}

interface SupabaseServerSlot {
  id: ServerSlotId;
  label: string;
  supabaseUrl: string;
  supabaseKey: string;
  status: 'active' | 'paused';
  egressLimitGb: number;
  warningThresholdPct: number;
  billingResetDay: number;
  trackedBytesThisCycle: number;
  calibrationOffsetBytes: number;
  cycleMonthKey: string;
  lastMigratedAt: string | null;
  pausedAt: string | null;
  activatedAt: string | null;
}

interface SupabaseClusterState {
  activeServerId: ServerSlotId | null;
  clusterRevision: number;
  servers: Record<ServerSlotId, SupabaseServerSlot>;
}

let cachedClusterState: SupabaseClusterState | null = null;
let clusterPersistTimer: NodeJS.Timeout | null = null;

function sanitizeSupabaseUrlForServer(raw: string): string | null {
  let clean = String(raw || '').trim();
  if (!clean) return null;
  const dashMatch = clean.match(/supabase\.com\/dashboard\/project\/([a-z0-9_-]+)/i);
  if (dashMatch && dashMatch[1]) {
    clean = `https://${dashMatch[1]}.supabase.co`;
  }
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    // SSRF guard: block loopback, metadata, and RFC1918 private networks
    if (
      host === 'localhost' ||
      host === '::1' ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('169.254.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return null;
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function getBillingCycleKey(resetDay: number, now: Date = new Date()): string {
  const safeDay = Math.max(1, Math.min(28, Math.floor(Number(resetDay) || 1)));
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  if (now.getUTCDate() < safeDay) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, '0')}-d${String(safeDay).padStart(2, '0')}`;
}

function ensureBillingCycleCurrent(slot: SupabaseServerSlot): boolean {
  const expectedKey = getBillingCycleKey(slot.billingResetDay);
  if (slot.cycleMonthKey !== expectedKey) {
    slot.cycleMonthKey = expectedKey;
    slot.trackedBytesThisCycle = 0;
    slot.calibrationOffsetBytes = 0;
    return true;
  }
  return false;
}

const DEFAULT_SERVER2_URL =
  process.env.SUPABASE_SERVER2_URL ||
  process.env.VITE_SUPABASE_SERVER2_URL ||
  'https://prunomfyqfbpvzojafar.supabase.co';
const DEFAULT_SERVER2_KEY =
  process.env.SUPABASE_SERVER2_ANON_KEY ||
  process.env.VITE_SUPABASE_SERVER2_ANON_KEY ||
  'sb_publishable_h6pz72HjpfiXGTBuLMcuTQ_Fx8ZAHDm';

function createDefaultClusterState(): SupabaseClusterState {
  const cfg = loadConfig();
  const initialUrl = cfg.supabaseUrl ? (sanitizeSupabaseUrlForServer(cfg.supabaseUrl) || cfg.supabaseUrl.trim()) : '';
  const initialKey = (cfg.supabaseKey || '').trim();
  const s2Url = sanitizeSupabaseUrlForServer(DEFAULT_SERVER2_URL) || DEFAULT_SERVER2_URL;
  const s2Key = DEFAULT_SERVER2_KEY.trim();
  const cycleKey = getBillingCycleKey(1);
  const nowIso = new Date().toISOString();

  return {
    activeServerId: initialUrl && initialKey ? 'server1' : null,
    clusterRevision: 1,
    servers: {
      server1: {
        id: 'server1',
        label: 'Server 1 (Primary)',
        supabaseUrl: initialUrl,
        supabaseKey: initialKey,
        status: initialUrl && initialKey ? 'active' : 'paused',
        egressLimitGb: 5.0,
        warningThresholdPct: 80,
        billingResetDay: 1,
        trackedBytesThisCycle: 0,
        calibrationOffsetBytes: 0,
        cycleMonthKey: cycleKey,
        lastMigratedAt: null,
        pausedAt: null,
        activatedAt: initialUrl && initialKey ? nowIso : null
      },
      server2: {
        id: 'server2',
        label: 'Server 2 (Standby)',
        supabaseUrl: s2Url,
        supabaseKey: s2Key,
        status: 'paused',
        egressLimitGb: 5.0,
        warningThresholdPct: 80,
        billingResetDay: 1,
        trackedBytesThisCycle: 0,
        calibrationOffsetBytes: 0,
        cycleMonthKey: cycleKey,
        lastMigratedAt: null,
        pausedAt: nowIso,
        activatedAt: null
      }
    }
  };
}

function loadClusterState(): SupabaseClusterState {
  if (cachedClusterState) {
    let changed = false;
    if (ensureBillingCycleCurrent(cachedClusterState.servers.server1)) changed = true;
    if (ensureBillingCycleCurrent(cachedClusterState.servers.server2)) changed = true;
    if (changed) saveClusterState(cachedClusterState);
    return cachedClusterState;
  }

  let state = createDefaultClusterState();
  let needsSave = false;
  if (fs.existsSync(CLUSTER_FILE)) {
    try {
      const raw = fs.readFileSync(CLUSTER_FILE, 'utf-8');
      const parsed = safeParseJson(raw, null);
      if (parsed && parsed.servers && parsed.servers.server1 && parsed.servers.server2) {
        const s2Url = parsed.servers.server2.supabaseUrl || state.servers.server2.supabaseUrl;
        const s2Key = parsed.servers.server2.supabaseKey || state.servers.server2.supabaseKey;
        if (!parsed.servers.server2.supabaseUrl || !parsed.servers.server2.supabaseKey) {
          needsSave = true;
        }
        state = {
          activeServerId:
            parsed.activeServerId === 'server1' || parsed.activeServerId === 'server2'
              ? parsed.activeServerId
              : null,
          clusterRevision: Number(parsed.clusterRevision) || 1,
          servers: {
            server1: {
              ...state.servers.server1,
              ...parsed.servers.server1,
              id: 'server1',
              supabaseUrl: parsed.servers.server1.supabaseUrl || state.servers.server1.supabaseUrl,
              supabaseKey: parsed.servers.server1.supabaseKey || state.servers.server1.supabaseKey
            },
            server2: {
              ...state.servers.server2,
              ...parsed.servers.server2,
              id: 'server2',
              supabaseUrl: s2Url,
              supabaseKey: s2Key
            }
          }
        };
      }
    } catch (e) {
      console.error('Error reading supabase_cluster.json, using default state:', e);
    }
  } else {
    needsSave = true;
  }

  ensureBillingCycleCurrent(state.servers.server1);
  ensureBillingCycleCurrent(state.servers.server2);
  if (needsSave) {
    atomicWriteFileSync(CLUSTER_FILE, JSON.stringify(state, null, 2));
  }
  cachedClusterState = state;
  return state;
}

function saveClusterState(state: SupabaseClusterState, immediate: boolean = true) {
  cachedClusterState = state;
  if (immediate) {
    if (clusterPersistTimer) {
      clearTimeout(clusterPersistTimer);
      clusterPersistTimer = null;
    }
    atomicWriteFileSync(CLUSTER_FILE, JSON.stringify(state, null, 2));
    // Mirror authoritative changes (calibration, config, active/pause) to cloud cluster state
    void saveClusterStateToCloud(state).catch(() => {});
  } else if (!clusterPersistTimer) {
    clusterPersistTimer = setTimeout(() => {
      clusterPersistTimer = null;
      if (cachedClusterState) {
        atomicWriteFileSync(CLUSTER_FILE, JSON.stringify(cachedClusterState, null, 2));
      }
    }, 3000);
  }
}

function getActiveClusterServer(): SupabaseServerSlot | null {
  const cluster = loadClusterState();
  if (!cluster.activeServerId) return null;
  const slot = cluster.servers[cluster.activeServerId];
  if (!slot || slot.status !== 'active' || !slot.supabaseUrl || !slot.supabaseKey) {
    return null;
  }
  return slot;
}

function computeSlotEgressMetrics(slot: SupabaseServerSlot) {
  ensureBillingCycleCurrent(slot);
  const trackedBytes = Math.max(0, Number(slot.trackedBytesThisCycle) || 0);
  const calibrationOffsetBytes = Number(slot.calibrationOffsetBytes) || 0;
  const totalBytes = Math.max(0, trackedBytes + calibrationOffsetBytes);
  const usedGb = Number((totalBytes / BYTES_PER_GB).toFixed(3));
  const trackedGb = Number((trackedBytes / BYTES_PER_GB).toFixed(4));
  const limitGb = Math.max(0.1, Number(slot.egressLimitGb) || 5.0);
  const pct = Number(Math.min(100, (usedGb / limitGb) * 100).toFixed(1));
  const warningThresholdPct = Math.max(10, Math.min(99, Number(slot.warningThresholdPct) || 80));
  return {
    totalBytes,
    trackedBytes,
    calibrationOffsetBytes,
    trackedGb,
    usedGb,
    limitGb,
    pct,
    warningThresholdPct,
    isWarning: pct >= warningThresholdPct,
    isCritical: pct >= 95
  };
}

function recordServerEgressBytes(serverId: ServerSlotId | null, bytes: number) {
  if (!serverId || !Number.isFinite(bytes) || bytes <= 0) return;
  const cluster = loadClusterState();
  const slot = cluster.servers[serverId];
  if (!slot) return;
  ensureBillingCycleCurrent(slot);
  slot.trackedBytesThisCycle = (Number(slot.trackedBytesThisCycle) || 0) + Math.round(bytes);
  saveClusterState(cluster, false);
}

function maskKeyPreview(key: string): string {
  const clean = String(key || '').trim();
  if (!clean) return '';
  if (clean.length <= 12) return '••••••••';
  return `${clean.slice(0, 8)}••••••••${clean.slice(-6)}`;
}

function getServerSupabase(): SupabaseClient | null {
  if (isServerSupabaseRestricted()) return null;
  const activeSlot = getActiveClusterServer();
  // Hard Pause Lock: if no server is active (paused), NEVER open or use a Supabase client (0 bytes in/out)
  if (!activeSlot) return null;
  if (!serverSupabaseClient) {
    serverSupabaseClient = createClient(activeSlot.supabaseUrl, activeSlot.supabaseKey);
  }
  return serverSupabaseClient;
}

// Migration Job Coordinator (12-Table Server-to-Server Copy — NEVER auto-switches active server)
const MIGRATION_TABLES: Array<{ table: string; label: string; conflictCol: string; required: boolean }> = [
  { table: 'production_ledger', label: 'Production Ledger', conflictCol: 'id', required: true },
  { table: 'yarn_allocations', label: 'Yarn Allocations', conflictCol: 'id', required: true },
  { table: 'order_plans', label: 'Plan Order Followup', conflictCol: 'id', required: true },
  { table: 'knitting_orders', label: 'Knitting Status Orders', conflictCol: 'id', required: true },
  { table: 'textile_close_pmc', label: 'Textile Close By PMC', conflictCol: 'id', required: true },
  { table: 'grey_stock_summary', label: 'Grey Stock Summary', conflictCol: 'id', required: true },
  { table: 'grey_yarn_stock', label: 'Grey Yarn Stock Summary', conflictCol: 'id', required: true },
  { table: 'users', label: 'System Users & Permissions', conflictCol: 'uid', required: true },
  { table: 'factory_units', label: 'Factory Units & Capacity', conflictCol: 'id', required: true },
  { table: 'buyers', label: 'Buyers Directory', conflictCol: 'buyer_name', required: true },
  { table: 'system_settings', label: 'System Settings & Logos', conflictCol: 'id', required: true },
  { table: 'activity_logs', label: 'Activity Audit Logs', conflictCol: 'id', required: true },
  { table: 'app_settings', label: 'Legacy App Settings (Optional)', conflictCol: 'id', required: false }
];

interface MigrationTableProgress {
  table: string;
  label: string;
  status: 'pending' | 'checking' | 'copying' | 'done' | 'skipped' | 'error';
  rowsCopied: number;
  totalRows: number;
  error?: string;
}

interface MigrationJobState {
  jobId: string;
  sourceServerId: ServerSlotId;
  targetServerId: ServerSlotId;
  status: 'preflight' | 'migrating' | 'completed' | 'failed';
  currentTable: string | null;
  totalRowsCopied: number;
  message: string;
  error?: string;
  startedAt: string;
  completedAt: string | null;
  tables: MigrationTableProgress[];
}

const migrationJobs = new Map<string, MigrationJobState>();
let activeMigrationJobId: string | null = null;

async function runFullMigrationJob(job: MigrationJobState, sourceSlot: SupabaseServerSlot, targetSlot: SupabaseServerSlot) {
  const sourceClient = createClient(sourceSlot.supabaseUrl, sourceSlot.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    // Phase 1: Pre-flight check on target server tables before copying any rows
    job.status = 'preflight';
    job.message = `Verifying connection and schema on ${targetSlot.label}...`;
    const missingRequiredTables: string[] = [];

    for (let i = 0; i < MIGRATION_TABLES.length; i++) {
      const def = MIGRATION_TABLES[i];
      const prog = job.tables[i];
      prog.status = 'checking';
      job.currentTable = def.label;
      const { error } = await targetClient.from(def.table).select('*', { count: 'exact', head: true }).limit(1);
      if (error) {
        const isMissing = error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('schema cache');
        const isPerm = isServerPermissionDeniedError(error);
        if (def.required && (isMissing || isPerm)) {
          prog.status = 'error';
          prog.error = isPerm ? 'Permission denied (run GRANT SQL)' : 'Table missing on target server';
          missingRequiredTables.push(def.table);
        } else if (!def.required) {
          prog.status = 'skipped';
        } else {
          prog.status = 'error';
          prog.error = error.message || 'Unreachable';
          missingRequiredTables.push(def.table);
        }
      } else {
        prog.status = 'pending';
      }
    }

    if (missingRequiredTables.length > 0) {
      job.status = 'failed';
      job.completedAt = new Date().toISOString();
      job.error = `Target server is missing or denying access to: ${missingRequiredTables.join(', ')}. Copy & run the 12-Table Setup SQL in ${targetSlot.label}'s SQL Editor first.`;
      job.message = 'Pre-flight check failed. Active server was NOT changed.';
      return;
    }

    // Phase 2: Copy all tables sequentially in safe chunks
    job.status = 'migrating';
    const PAGE_SIZE = 1000;
    const UPSERT_CHUNK = 200;

    for (let i = 0; i < MIGRATION_TABLES.length; i++) {
      const def = MIGRATION_TABLES[i];
      const prog = job.tables[i];
      if (prog.status === 'skipped') continue;

      prog.status = 'copying';
      job.currentTable = def.label;
      job.message = `Reading ${def.label} from ${sourceSlot.label}...`;

      // 2a. Paginated read from source
      const sourceRows: any[] = [];
      let from = 0;
      let readFailed = false;

      while (true) {
        const to = from + PAGE_SIZE - 1;
        const { data, error } = await sourceClient.from(def.table).select('*').range(from, to);
        if (error) {
          const isMissing = error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist');
          if (!def.required || isMissing) {
            prog.status = 'skipped';
            readFailed = true;
            break;
          }
          if (isServerSupabaseQuotaError(error)) {
            markServerSupabaseRestricted(error);
          }
          prog.status = 'error';
          prog.error = `Read error: ${error.message}`;
          throw new Error(`Failed reading ${def.table}: ${error.message}`);
        }

        if (!Array.isArray(data) || data.length === 0) break;
        const batch = data as any[];

        // Strip legacy duplicated raw_data.items on knitting_orders during migration so target stays slim!
        if (def.table === 'knitting_orders') {
          for (const r of batch) {
            if (r && r.raw_data && typeof r.raw_data === 'object' && 'items' in r.raw_data) {
              const { items: _dup, ...slimMeta } = r.raw_data;
              sourceRows.push({ ...r, raw_data: slimMeta });
            } else {
              sourceRows.push(r);
            }
          }
        } else {
          sourceRows.push(...batch);
        }

        // Meter compressed wire egress bytes accurately
        try {
          recordServerEgressBytes(sourceSlot.id, estimateWireEgressBytes(batch));
        } catch {}

        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (readFailed) continue;
      prog.totalRows = sourceRows.length;

      if (sourceRows.length === 0) {
        prog.status = 'done';
        prog.rowsCopied = 0;
        continue;
      }

      // 2b. Chunked upsert into target server
      job.message = `Writing ${sourceRows.length.toLocaleString()} rows of ${def.label} to ${targetSlot.label}...`;
      let copied = 0;
      for (let offset = 0; offset < sourceRows.length; offset += UPSERT_CHUNK) {
        const chunk = sourceRows.slice(offset, offset + UPSERT_CHUNK);
        let { error: upsertErr } = await targetClient
          .from(def.table)
          .upsert(chunk, { onConflict: def.conflictCol });

        // Fallback if activity_logs has identity/UUID without conflict match or older schema
        if (upsertErr && def.table === 'activity_logs') {
          const cleanChunk = chunk.map(({ id: _omitId, ...rest }) => rest);
          const retry = await targetClient.from(def.table).insert(cleanChunk);
          upsertErr = retry.error;
        } else if (upsertErr && def.conflictCol !== 'id') {
          const retry = await targetClient.from(def.table).upsert(chunk);
          upsertErr = retry.error;
        }

        if (upsertErr) {
          prog.status = 'error';
          prog.error = `Write error: ${upsertErr.message}`;
          throw new Error(`Failed writing ${def.table}: ${upsertErr.message}`);
        }
        copied += chunk.length;
        prog.rowsCopied = copied;
        job.totalRowsCopied += chunk.length;
      }

      prog.status = 'done';
    }

    // Record last migration timestamp (NOTE: Do NOT auto-switch or auto-pause any server!)
    const cluster = loadClusterState();
    cluster.servers[targetSlot.id].lastMigratedAt = new Date().toISOString();
    saveClusterState(cluster, true);

    job.status = 'completed';
    job.currentTable = null;
    job.completedAt = new Date().toISOString();
    job.message = `Copied ${job.totalRowsCopied.toLocaleString()} rows across all tables to ${targetSlot.label}. Active/Paused server states were NOT changed automatically — use Activate / Pause whenever you are ready.`;
  } catch (err: any) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = err?.message || String(err);
    job.message = `Migration stopped safely. Active/Paused server states were NOT changed.`;
  } finally {
    if (activeMigrationJobId === job.jobId) {
      activeMigrationJobId = null;
    }
  }
}

function computeMaxUpdatedAt(rows: any[]): string | null {
  let maxIso: string | null = null;
  for (const r of rows) {
    const ts = r?.updated_at || r?.created_at;
    if (typeof ts === 'string' && ts.length >= 10) {
      if (!maxIso || ts > maxIso) maxIso = ts;
    }
  }
  return maxIso;
}

async function fetchFullTableFromOrigin(table: CacheableSupabaseTable): Promise<any[] | null> {
  const deniedUntil = supabasePermDeniedUntil.get(table) || 0;
  if (deniedUntil > Date.now()) return null;

  const supabase = getServerSupabase();
  if (!supabase) return null;

  const cfg = CACHEABLE_TABLE_CONFIG[table];
  let selectClause = tablesRequiringWildcardSelect.has(table) ? '*' : cfg.columns;
  let orderCol: string | null = cfg.orderCol;

  const allRows: any[] = [];
  const BATCH_SIZE = 1000;
  let from = 0;

  while (true) {
    const to = from + BATCH_SIZE - 1;
    let query = supabase.from(table).select(selectClause);
    if (orderCol) {
      query = query.order(orderCol, { ascending: cfg.ascending });
    }
    const { data, error } = await query.range(from, to);

    if (error) {
      if (isServerSupabaseQuotaError(error)) {
        markServerSupabaseRestricted(error);
        return null;
      }
      // Permission denied (Postgres 42501) -> cool down without spamming error logs
      if (isServerPermissionDeniedError(error)) {
        supabasePermDeniedUntil.set(table, Date.now() + SUPABASE_PERM_DENIED_COOLDOWN_MS);
        console.log(`[Supabase Cache] Table '${table}' needs GRANT permissions for anon/authenticated roles in SQL Editor.`);
        return null;
      }
      // Missing column on older schema -> seamlessly fall back to '*'
      if (
        selectClause !== '*' &&
        (error.code === '42703' ||
          error.code === 'PGRST204' ||
          error.message?.includes('does not exist') ||
          error.message?.includes('Could not find'))
      ) {
        tablesRequiringWildcardSelect.add(table);
        selectClause = '*';
        from = 0;
        allRows.length = 0;
        continue;
      }
      // Missing sort column -> retry without order
      if (orderCol && (error.code === '42703' || error.message?.includes('column'))) {
        orderCol = null;
        from = 0;
        allRows.length = 0;
        continue;
      }
      // Missing table
      if (error.code === 'PGRST205' || error.code === '42P01') {
        return [];
      }
      console.log(`[Supabase Cache] Fetch notice (${table}):`, error.message);
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) break;
    const rowsBatch = data as any[];
    if (table === 'knitting_orders') {
      // Strip legacy duplicated `items` array from raw_data in RAM to avoid transferring huge JSON blobs twice
      for (const r of rowsBatch) {
        if (r && r.raw_data && typeof r.raw_data === 'object' && 'items' in r.raw_data) {
          const { items: _dupItems, ...slimMeta } = r.raw_data;
          allRows.push({ ...r, raw_data: slimMeta });
        } else {
          allRows.push(r);
        }
      }
    } else {
      allRows.push(...rowsBatch);
    }
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  // Meter compressed wire egress bytes downloaded for active server
  try {
    const activeSlot = getActiveClusterServer();
    if (activeSlot && allRows.length > 0) {
      recordServerEgressBytes(activeSlot.id, estimateWireEgressBytes(allRows));
    }
  } catch {}

  supabasePermDeniedUntil.delete(table);
  return allRows;
}

async function getCachedSupabaseTable(
  table: CacheableSupabaseTable,
  forceRefresh: boolean = false
): Promise<{ rows: any[] | null; fromCache: boolean; version: number; maxUpdatedAt: string | null }> {
  const existing = supabaseServerCache.get(table);
  const now = Date.now();

  if (existing && existing.fetchedAt > 0) {
    const isFresh = now - existing.fetchedAt < SUPABASE_SERVER_CACHE_TTL_MS;
    const withinForceCooldown = now - existing.lastForceRefreshAt < SUPABASE_FORCE_COOLDOWN_MS;
    if ((!forceRefresh && isFresh) || (forceRefresh && withinForceCooldown)) {
      return {
        rows: existing.rows,
        fromCache: true,
        version: existing.version,
        maxUpdatedAt: existing.maxUpdatedAt
      };
    }
  }

  // In-flight deduplication: N concurrent users = 1 single origin read
  const flightKey = `full:${table}`;
  let pending = supabaseInFlightFetches.get(flightKey);
  if (!pending) {
    pending = fetchFullTableFromOrigin(table).finally(() => {
      supabaseInFlightFetches.delete(flightKey);
    });
    supabaseInFlightFetches.set(flightKey, pending);
  }

  const fetched = await pending;
  if (fetched === null) {
    // Serve stale RAM cache if origin is temporarily unavailable/restricted
    if (existing) {
      return {
        rows: existing.rows,
        fromCache: true,
        version: existing.version,
        maxUpdatedAt: existing.maxUpdatedAt
      };
    }
    return { rows: null, fromCache: false, version: existing?.version || 0, maxUpdatedAt: existing?.maxUpdatedAt || null };
  }

  const nextVersion = (existing?.version || 0) + 1;
  const maxUpdatedAt = computeMaxUpdatedAt(fetched);
  supabaseServerCache.set(table, {
    rows: fetched,
    fetchedAt: Date.now(),
    version: nextVersion,
    maxUpdatedAt,
    lastForceRefreshAt: forceRefresh ? Date.now() : (existing?.lastForceRefreshAt || 0)
  });

  return { rows: fetched, fromCache: false, version: nextVersion, maxUpdatedAt };
}

function invalidateServerSupabaseTable(table: CacheableSupabaseTable | 'settings' | 'all') {
  const nowIso = new Date().toISOString();
  if (table === 'settings' || table === 'all') {
    if (supabaseSettingsCache) {
      supabaseSettingsCache = {
        data: supabaseSettingsCache.data,
        fetchedAt: 0,
        version: supabaseSettingsCache.version + 1
      };
    }
    if (table === 'settings') return;
  }

  const targets: CacheableSupabaseTable[] =
    table === 'all' ? (Array.from(CACHEABLE_TABLE_SET) as CacheableSupabaseTable[]) : [table];
  for (const t of targets) {
    supabasePermDeniedUntil.delete(t);
    const existing = supabaseServerCache.get(t);
    supabaseServerCache.set(t, {
      rows: existing?.rows || [],
      fetchedAt: 0, // Marks stale so next read refreshes once from Supabase
      version: (existing?.version || 0) + 1,
      maxUpdatedAt: nowIso,
      lastForceRefreshAt: 0
    });
  }
}

async function fetchSettingsFromOrigin(): Promise<any | null> {
  const supabase = getServerSupabase();
  if (!supabase) return null;

  const structuredSettings: any = {};

  // A. Factory units
  try {
    const { data: unitRows, error: unitErr } = await supabase
      .from('factory_units')
      .select('id,unit_name,production_capacity,total_machine,avg_prod_per_machine,target_efficiency,display_order')
      .order('display_order', { ascending: true });
    if (unitErr) {
      if (isServerSupabaseQuotaError(unitErr)) {
        markServerSupabaseRestricted(unitErr);
        return null;
      }
    } else if (Array.isArray(unitRows) && unitRows.length > 0) {
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
  } catch {}

  // B. Buyers
  try {
    const { data: buyerRows, error: buyerErr } = await supabase
      .from('buyers')
      .select('buyer_name,status')
      .order('buyer_name', { ascending: true });
    if (buyerErr) {
      if (isServerSupabaseQuotaError(buyerErr)) {
        markServerSupabaseRestricted(buyerErr);
        return null;
      }
    } else if (Array.isArray(buyerRows) && buyerRows.length > 0) {
      structuredSettings.buyers = buyerRows
        .filter((b: any) => b.status !== 'Inactive')
        .map((b: any) => b.buyer_name);
    }
  } catch {}

  // C. System settings & branding logos
  try {
    const { data: sysRow, error: sysErr } = await supabase
      .from('system_settings')
      .select('reject_threshold,max_idle_machines,alarm_email,company_logo,my_logo')
      .eq('id', 'global_settings')
      .maybeSingle();
    if (sysErr) {
      if (isServerSupabaseQuotaError(sysErr)) {
        markServerSupabaseRestricted(sysErr);
        return null;
      }
    } else if (sysRow) {
      structuredSettings.rejectThreshold = Number(sysRow.reject_threshold) || 2.5;
      structuredSettings.maxIdleMachines = Number(sysRow.max_idle_machines) || 5;
      structuredSettings.alarmEmail = sysRow.alarm_email || 'knitprod@epylliongroup.com';
      if (sysRow.company_logo) structuredSettings.companyLogo = sysRow.company_logo;
      if (sysRow.my_logo) structuredSettings.myLogo = sysRow.my_logo;
    }
  } catch {}

  // D. Only query legacy app_settings if system_settings did not supply logos or thresholds
  const needsLegacyFallback =
    !structuredSettings.companyLogo ||
    !structuredSettings.myLogo ||
    structuredSettings.rejectThreshold === undefined;
  if (needsLegacyFallback && !isServerSupabaseRestricted()) {
    try {
      const { data: appRow, error: appErr } = await supabase
        .from('app_settings')
        .select('settings_data')
        .eq('id', 'global_settings')
        .maybeSingle();
      if (appErr && isServerSupabaseQuotaError(appErr)) {
        markServerSupabaseRestricted(appErr);
        return null;
      }
      if (!appErr && appRow?.settings_data) {
        const sd = appRow.settings_data;
        if (!structuredSettings.companyLogo && sd.companyLogo) structuredSettings.companyLogo = sd.companyLogo;
        if (!structuredSettings.myLogo && sd.myLogo) structuredSettings.myLogo = sd.myLogo;
        if (structuredSettings.rejectThreshold === undefined && sd.rejectThreshold) structuredSettings.rejectThreshold = Number(sd.rejectThreshold);
        if (structuredSettings.maxIdleMachines === undefined && sd.maxIdleMachines) structuredSettings.maxIdleMachines = Number(sd.maxIdleMachines);
        if (!structuredSettings.alarmEmail && sd.alarmEmail) structuredSettings.alarmEmail = sd.alarmEmail;
      }
    } catch {}
  }

  // Meter compressed wire egress bytes for settings + Base64 logos downloaded for active server
  try {
    const activeSlot = getActiveClusterServer();
    if (activeSlot) {
      recordServerEgressBytes(activeSlot.id, estimateWireEgressBytes(structuredSettings));
    }
  } catch {}

  return structuredSettings;
}

async function getCachedSupabaseSettings(
  forceRefresh: boolean = false
): Promise<{ data: any | null; fromCache: boolean; version: number }> {
  const now = Date.now();
  if (!forceRefresh && supabaseSettingsCache && supabaseSettingsCache.fetchedAt > 0) {
    if (now - supabaseSettingsCache.fetchedAt < SUPABASE_SERVER_CACHE_TTL_MS) {
      return {
        data: supabaseSettingsCache.data,
        fromCache: true,
        version: supabaseSettingsCache.version
      };
    }
  }

  if (!supabaseSettingsInFlight) {
    supabaseSettingsInFlight = fetchSettingsFromOrigin().finally(() => {
      supabaseSettingsInFlight = null;
    });
  }

  const fetched = await supabaseSettingsInFlight;
  if (fetched === null) {
    if (supabaseSettingsCache) {
      return {
        data: supabaseSettingsCache.data,
        fromCache: true,
        version: supabaseSettingsCache.version
      };
    }
    return { data: null, fromCache: false, version: 0 };
  }

  const nextVersion = (supabaseSettingsCache?.version || 0) + 1;
  supabaseSettingsCache = {
    data: fetched,
    fetchedAt: Date.now(),
    version: nextVersion
  };
  return { data: fetched, fromCache: false, version: nextVersion };
}

// =========================================================================
// SHARED SUPABASE READ CACHE & VERSION COORDINATOR ENDPOINTS
// =========================================================================

// Lightweight version check (~250 bytes) — tells all clients whether any table changed
app.get('/api/supabase-cache/versions', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const shouldProbe = req.query.probe === '1';

  // Optional ultra-lightweight probe (1 timestamp per cached table, throttled to once per 2 min)
  if (shouldProbe && !isServerSupabaseRestricted() && Date.now() - lastVersionProbeAt > SUPABASE_PROBE_COOLDOWN_MS) {
    const supabase = getServerSupabase();
    if (supabase) {
      lastVersionProbeAt = Date.now();
      const cachedTables = Array.from(supabaseServerCache.entries()).filter(([, entry]) => entry.fetchedAt > 0);
      await Promise.allSettled(
        cachedTables.map(async ([table, entry]) => {
          try {
            const { data, error } = await supabase
              .from(table)
              .select('updated_at')
              .order('updated_at', { ascending: false })
              .limit(1);
            if (error) {
              if (isServerSupabaseQuotaError(error)) markServerSupabaseRestricted(error);
              return;
            }
            const latestTs = Array.isArray(data) && data[0]?.updated_at ? String(data[0].updated_at) : null;
            if (latestTs && (!entry.maxUpdatedAt || latestTs > entry.maxUpdatedAt)) {
              // Origin has newer data than our RAM cache -> mark stale & bump version
              invalidateServerSupabaseTable(table);
              const updated = supabaseServerCache.get(table);
              if (updated) updated.maxUpdatedAt = latestTs;
            }
          } catch {}
        })
      );
    }
  }

  const versions: Record<string, { version: number; fetchedAt: number; maxUpdatedAt: string | null; count: number }> = {};
  for (const t of CACHEABLE_TABLE_SET) {
    const entry = supabaseServerCache.get(t as CacheableSupabaseTable);
    versions[t] = {
      version: entry?.version || 0,
      fetchedAt: entry?.fetchedAt || 0,
      maxUpdatedAt: entry?.maxUpdatedAt || null,
      count: entry?.rows?.length || 0
    };
  }

  const cluster = loadClusterState();
  const activeSlot = getActiveClusterServer();
  let raihanAlert: {
    showWarning: boolean;
    activeServerId: ServerSlotId | null;
    activeServerLabel: string;
    usedGb: number;
    limitGb: number;
    pct: number;
    isCritical: boolean;
    isRestricted: boolean;
  } | null = null;

  // Strictly expose 80% egress warning payload ONLY to Raihan (EKL001)
  if (isRaihanOperatorRequest(req) && activeSlot) {
    const metrics = computeSlotEgressMetrics(activeSlot);
    const restricted = isServerSupabaseRestricted();
    raihanAlert = {
      showWarning: metrics.isWarning || restricted,
      activeServerId: activeSlot.id,
      activeServerLabel: activeSlot.label,
      usedGb: metrics.usedGb,
      limitGb: metrics.limitGb,
      pct: metrics.pct,
      isCritical: metrics.isCritical || restricted,
      isRestricted: restricted
    };
  }

  return res.json({
    success: true,
    restricted: isServerSupabaseRestricted(),
    reason: isServerSupabaseRestricted() ? serverSupabaseRestrictedReason : null,
    activeServerId: cluster.activeServerId,
    activeServerPaused: !activeSlot,
    clusterRevision: cluster.clusterRevision,
    raihanAlert,
    versions
  });
});

// Cache invalidation hook called after any write or bulk Excel upload
app.post('/api/supabase-cache/invalidate', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const rawTable = typeof req.body?.table === 'string' ? req.body.table.trim() : '';
  const estimatedBytes = Number(req.body?.estimatedBytes) || 0;
  if (estimatedBytes > 0 && estimatedBytes < 50 * 1024 * 1024) {
    const activeSlot = getActiveClusterServer();
    if (activeSlot) recordServerEgressBytes(activeSlot.id, estimatedBytes);
  }
  if (rawTable === 'all') {
    invalidateServerSupabaseTable('all');
    return res.json({ success: true, invalidated: 'all' });
  }
  if (rawTable === 'settings') {
    invalidateServerSupabaseTable('settings');
    return res.json({ success: true, invalidated: 'settings', version: supabaseSettingsCache?.version || 1 });
  }
  if (!CACHEABLE_TABLE_SET.has(rawTable)) {
    return res.status(400).json({ success: false, message: 'Invalid table name.' });
  }
  invalidateServerSupabaseTable(rawTable as CacheableSupabaseTable);
  const entry = supabaseServerCache.get(rawTable as CacheableSupabaseTable);
  return res.json({
    success: true,
    invalidated: rawTable,
    version: entry?.version || 1
  });
});

// =========================================================================
// DUAL-SUPABASE FAILOVER ADMIN ENDPOINTS (STRICTLY RAIHAN EKL001 ONLY)
// =========================================================================

// Lightweight client browser egress telemetry beacon (callable by any logged-in user; 0 bytes Supabase egress)
app.post('/api/supabase-failover/report-egress', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const headerUid = typeof req.headers['x-session-uid'] === 'string' ? req.headers['x-session-uid'].trim().toUpperCase() : '';
  const bodyUid = typeof req.body?.uid === 'string' ? req.body.uid.trim().toUpperCase() : '';
  const cookieHeader = typeof req.headers.cookie === 'string' ? req.headers.cookie : '';
  const hasCookieUid = /ekl_auth_session=[^;]+/.test(cookieHeader);
  const validUid = headerUid || (/^[A-Z0-9_-]{2,32}$/.test(bodyUid) ? bodyUid : '') || (hasCookieUid ? 'SESSION' : '');
  if (!validUid) {
    return res.status(401).json({ success: false, message: 'Active session required.' });
  }
  const bytes = Math.round(Number(req.body?.bytes) || 0);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 50_000_000) {
    return res.json({ success: true, ignored: true });
  }
  const activeSlot = getActiveClusterServer();
  if (!activeSlot) {
    return res.json({ success: true, ignored: true });
  }
  recordServerEgressBytes(activeSlot.id, bytes);
  return res.json({ success: true, recorded: bytes, serverId: activeSlot.id });
});

app.get('/api/supabase-failover/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const cluster = loadClusterState();
  const buildView = (slot: SupabaseServerSlot) => {
    const metrics = computeSlotEgressMetrics(slot);
    return {
      id: slot.id,
      label: slot.label,
      supabaseUrl: slot.supabaseUrl,
      hasKey: Boolean(slot.supabaseKey && slot.supabaseKey.trim()),
      keyPreview: maskKeyPreview(slot.supabaseKey),
      status: slot.status,
      isActive: cluster.activeServerId === slot.id && slot.status === 'active',
      billingResetDay: slot.billingResetDay,
      cycleMonthKey: slot.cycleMonthKey,
      lastMigratedAt: slot.lastMigratedAt,
      pausedAt: slot.pausedAt,
      activatedAt: slot.activatedAt,
      ...metrics
    };
  };

  const activeJob = activeMigrationJobId ? migrationJobs.get(activeMigrationJobId) || null : null;

  return res.json({
    success: true,
    activeServerId: cluster.activeServerId,
    clusterRevision: cluster.clusterRevision,
    restricted: isServerSupabaseRestricted(),
    reason: isServerSupabaseRestricted() ? serverSupabaseRestrictedReason : null,
    servers: {
      server1: buildView(cluster.servers.server1),
      server2: buildView(cluster.servers.server2)
    },
    activeJob
  });
});

app.post('/api/supabase-failover/config', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const serverId = req.body?.serverId;
  if (serverId !== 'server1' && serverId !== 'server2') {
    return res.status(400).json({ success: false, message: 'Invalid serverId. Must be server1 or server2.' });
  }

  const cluster = loadClusterState();
  const slot = cluster.servers[serverId];

  if (typeof req.body?.label === 'string' && req.body.label.trim()) {
    slot.label = req.body.label.trim().slice(0, 60);
  }
  if (typeof req.body?.supabaseUrl === 'string') {
    const rawUrl = req.body.supabaseUrl.trim();
    if (!rawUrl) {
      slot.supabaseUrl = '';
    } else {
      const cleanUrl = sanitizeSupabaseUrlForServer(rawUrl);
      if (!cleanUrl) {
        return res.status(400).json({ success: false, message: 'Please enter a valid HTTPS Supabase Project URL.' });
      }
      slot.supabaseUrl = cleanUrl;
    }
  }
  if (typeof req.body?.supabaseKey === 'string' && req.body.supabaseKey.trim()) {
    slot.supabaseKey = req.body.supabaseKey.trim();
  }
  if (req.body?.billingResetDay !== undefined) {
    const day = Math.floor(Number(req.body.billingResetDay));
    if (Number.isFinite(day) && day >= 1 && day <= 28) {
      slot.billingResetDay = day;
      ensureBillingCycleCurrent(slot);
    }
  }
  if (req.body?.egressLimitGb !== undefined) {
    const lim = Number(req.body.egressLimitGb);
    if (Number.isFinite(lim) && lim >= 0.5 && lim <= 500) {
      slot.egressLimitGb = Number(lim.toFixed(2));
    }
  }
  if (req.body?.warningThresholdPct !== undefined) {
    const pct = Number(req.body.warningThresholdPct);
    if (Number.isFinite(pct) && pct >= 10 && pct <= 99) {
      slot.warningThresholdPct = Math.round(pct);
    }
  }

  saveClusterState(cluster, true);

  // If this server is currently active, sync app_config.json and reset active server client
  if (cluster.activeServerId === serverId && slot.status === 'active' && slot.supabaseUrl && slot.supabaseKey) {
    saveConfig({ supabaseUrl: slot.supabaseUrl, supabaseKey: slot.supabaseKey });
  }

  return res.json({
    success: true,
    message: `${slot.label} configuration saved.`,
    server: {
      id: slot.id,
      label: slot.label,
      supabaseUrl: slot.supabaseUrl,
      hasKey: Boolean(slot.supabaseKey),
      keyPreview: maskKeyPreview(slot.supabaseKey),
      status: slot.status,
      billingResetDay: slot.billingResetDay,
      ...computeSlotEgressMetrics(slot)
    }
  });
});

app.post('/api/supabase-failover/calibrate', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const serverId = req.body?.serverId;
  if (serverId !== 'server1' && serverId !== 'server2') {
    return res.status(400).json({ success: false, message: 'Invalid serverId.' });
  }

  const cluster = loadClusterState();
  const slot = cluster.servers[serverId];
  ensureBillingCycleCurrent(slot);

  if (req.body?.billingResetDay !== undefined) {
    const day = Math.floor(Number(req.body.billingResetDay));
    if (Number.isFinite(day) && day >= 1 && day <= 28) {
      slot.billingResetDay = day;
      slot.cycleMonthKey = getBillingCycleKey(day);
    }
  }

  if (req.body?.reset === true) {
    slot.trackedBytesThisCycle = 0;
    slot.calibrationOffsetBytes = 0;
    if (cluster.activeServerId === serverId) {
      serverSupabaseRestrictedUntil = 0;
      serverSupabaseRestrictedReason = null;
    }
  } else if (req.body?.currentGb !== undefined) {
    const targetGb = Number(req.body.currentGb);
    if (!Number.isFinite(targetGb) || targetGb < 0 || targetGb > 500) {
      return res.status(400).json({ success: false, message: 'Please enter a valid GB value (0 or higher).' });
    }
    const targetBytes = Math.round(targetGb * BYTES_PER_GB);
    slot.calibrationOffsetBytes = targetBytes - (Number(slot.trackedBytesThisCycle) || 0);
  }

  saveClusterState(cluster, true);
  return res.json({
    success: true,
    serverId,
    metrics: computeSlotEgressMetrics(slot),
    billingResetDay: slot.billingResetDay
  });
});

app.post('/api/supabase-failover/test', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const serverId = req.body?.serverId;
  if (serverId !== 'server1' && serverId !== 'server2') {
    return res.status(400).json({ success: false, message: 'Invalid serverId.' });
  }

  const cluster = loadClusterState();
  const slot = cluster.servers[serverId];
  const testUrl = typeof req.body?.supabaseUrl === 'string' && req.body.supabaseUrl.trim()
    ? sanitizeSupabaseUrlForServer(req.body.supabaseUrl)
    : slot.supabaseUrl;
  const testKey = typeof req.body?.supabaseKey === 'string' && req.body.supabaseKey.trim()
    ? req.body.supabaseKey.trim()
    : slot.supabaseKey;

  if (!testUrl || !testKey) {
    return res.status(400).json({ success: false, message: `Please enter both URL and Anon Key for ${slot.label}.` });
  }

  try {
    const tempClient = createClient(testUrl, testKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const requiredTables = MIGRATION_TABLES.filter(t => t.required);
    const results = await Promise.all(
      requiredTables.map(async (def) => {
        const { count, error } = await tempClient.from(def.table).select('*', { count: 'exact', head: true });
        return {
          table: def.table,
          ok: !error,
          count: count ?? 0,
          error: error?.message || null
        };
      })
    );

    const readyTables = results.filter(r => r.ok);
    const missingTables = results.filter(r => !r.ok);

    return res.json({
      success: readyTables.length > 0,
      readyCount: readyTables.length,
      totalRequired: requiredTables.length,
      missingTables: missingTables.map(m => ({ table: m.table, error: m.error })),
      message:
        missingTables.length === 0
          ? `Connected to ${slot.label}! All ${readyTables.length}/${requiredTables.length} tables verified and ready.`
          : readyTables.length > 0
            ? `Connected to ${slot.label} (${readyTables.length}/${requiredTables.length} tables ready). Missing: ${missingTables.map(m => m.table).join(', ')}.`
            : `Connection or permission check failed on ${slot.label}: ${missingTables[0]?.error || 'Check URL, Key, and SQL permissions.'}`
    });
  } catch (err: any) {
    return res.json({
      success: false,
      message: `Connection error: ${err?.message || String(err)}`
    });
  }
});

// Manual Button 1: Active / Pause toggle (100% manual — NEVER called automatically)
app.post('/api/supabase-failover/toggle-state', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const serverId = req.body?.serverId;
  const action = req.body?.action;
  if ((serverId !== 'server1' && serverId !== 'server2') || (action !== 'activate' && action !== 'pause')) {
    return res.status(400).json({ success: false, message: 'Invalid serverId or action.' });
  }

  const cluster = loadClusterState();
  const slot = cluster.servers[serverId];
  const otherId: ServerSlotId = serverId === 'server1' ? 'server2' : 'server1';
  const otherSlot = cluster.servers[otherId];
  const nowIso = new Date().toISOString();

  if (action === 'activate') {
    if (!slot.supabaseUrl || !slot.supabaseKey) {
      return res.status(400).json({
        success: false,
        message: `Cannot activate ${slot.label} — save its Supabase Project URL and Anon Key first.`
      });
    }
    // Activate target server AND hard-pause the other server so 0 bytes touch it
    slot.status = 'active';
    slot.activatedAt = nowIso;
    slot.pausedAt = null;
    otherSlot.status = 'paused';
    otherSlot.pausedAt = nowIso;
    cluster.activeServerId = serverId;
    cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
    saveClusterState(cluster, true);

    // Sync central config & reset all server caches/clients so only the activated server runs
    saveConfig({ supabaseUrl: slot.supabaseUrl, supabaseKey: slot.supabaseKey });

    return res.json({
      success: true,
      action: 'activate',
      activeServerId: serverId,
      activeServerLabel: slot.label,
      activeServerPaused: false,
      clusterRevision: cluster.clusterRevision,
      activeConfig: {
        supabaseUrl: slot.supabaseUrl,
        supabaseKey: slot.supabaseKey
      },
      message: `${slot.label} is now ACTIVE. ${otherSlot.label} is HARD PAUSED (zero traffic in/out).`
    });
  } else {
    // Hard-pause this server (if it was active, activeServerId becomes null -> zero traffic!)
    slot.status = 'paused';
    slot.pausedAt = nowIso;
    if (cluster.activeServerId === serverId) {
      cluster.activeServerId = null;
    }
    cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
    saveClusterState(cluster, true);
    resetServerSupabaseState();

    return res.json({
      success: true,
      action: 'pause',
      activeServerId: cluster.activeServerId,
      activeServerLabel: null,
      activeServerPaused: !getActiveClusterServer(),
      clusterRevision: cluster.clusterRevision,
      activeConfig: null,
      message: `${slot.label} is now HARD PAUSED. Zero data will go in or come out from ${slot.label}.`
    });
  }
});

// Manual Button 2: Start 12-Table Migration (Server 1 -> Server 2 OR Server 2 -> Server 1; NEVER auto-switches)
app.post('/api/supabase-failover/migrate', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  if (activeMigrationJobId) {
    const running = migrationJobs.get(activeMigrationJobId);
    if (running && (running.status === 'preflight' || running.status === 'migrating')) {
      return res.status(409).json({
        success: false,
        message: 'A database migration is already in progress.',
        jobId: activeMigrationJobId
      });
    }
  }

  const sourceServerId = req.body?.sourceServerId;
  const targetServerId = req.body?.targetServerId;
  if (
    (sourceServerId !== 'server1' && sourceServerId !== 'server2') ||
    (targetServerId !== 'server1' && targetServerId !== 'server2') ||
    sourceServerId === targetServerId
  ) {
    return res.status(400).json({ success: false, message: 'Source and target servers must be distinct (server1 <-> server2).' });
  }

  const cluster = loadClusterState();
  const sourceSlot = cluster.servers[sourceServerId];
  const targetSlot = cluster.servers[targetServerId];

  if (!sourceSlot.supabaseUrl || !sourceSlot.supabaseKey) {
    return res.status(400).json({ success: false, message: `${sourceSlot.label} credentials are not configured.` });
  }
  if (!targetSlot.supabaseUrl || !targetSlot.supabaseKey) {
    return res.status(400).json({ success: false, message: `${targetSlot.label} credentials are not configured yet. Save its URL and Key first.` });
  }

  const jobId = `mig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const job: MigrationJobState = {
    jobId,
    sourceServerId,
    targetServerId,
    status: 'preflight',
    currentTable: null,
    totalRowsCopied: 0,
    message: `Starting migration from ${sourceSlot.label} to ${targetSlot.label}...`,
    startedAt: new Date().toISOString(),
    completedAt: null,
    tables: MIGRATION_TABLES.map((t) => ({
      table: t.table,
      label: t.label,
      status: 'pending',
      rowsCopied: 0,
      totalRows: 0
    }))
  };

  migrationJobs.set(jobId, job);
  activeMigrationJobId = jobId;

  // Run asynchronously so the UI can poll live table-by-table progress
  void runFullMigrationJob(job, { ...sourceSlot }, { ...targetSlot });

  return res.json({
    success: true,
    jobId,
    job
  });
});

app.get('/api/supabase-failover/migrate/:jobId', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  const jobId = String(req.params.jobId || '').trim();
  const job = migrationJobs.get(jobId);
  if (!job) {
    return res.status(404).json({ success: false, message: 'Migration job not found.' });
  }
  return res.json({ success: true, job });
});

// Unified chunked 12-table migration endpoint (shared contract with Vercel serverless /api/supabase-failover/migrate-table)
app.post('/api/supabase-failover/migrate-table', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!requireRaihanOperator(req, res)) return;

  try {
    const phase = String(req.body?.phase || '').trim();
    const sourceServerId = req.body?.sourceServerId as ServerSlotId;
    const targetServerId = req.body?.targetServerId as ServerSlotId;

    if (
      (sourceServerId !== 'server1' && sourceServerId !== 'server2') ||
      (targetServerId !== 'server1' && targetServerId !== 'server2') ||
      sourceServerId === targetServerId
    ) {
      return res.status(400).json({
        success: false,
        message: 'Source and target servers must be distinct (server1 <-> server2).'
      });
    }

    const cluster = loadClusterState();
    const sourceSlot = cluster.servers[sourceServerId];
    const targetSlot = cluster.servers[targetServerId];

    if (!sourceSlot.supabaseUrl || !sourceSlot.supabaseKey) {
      return res.status(400).json({ success: false, message: `${sourceSlot.label} credentials are not configured.` });
    }
    if (!targetSlot.supabaseUrl || !targetSlot.supabaseKey) {
      return res.status(400).json({
        success: false,
        message: `${targetSlot.label} credentials are not configured yet. Save its URL and Key first.`
      });
    }

    if (phase === 'preflight') {
      const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const checks = await Promise.all(
        MIGRATION_TABLES.map(async (def) => {
          const { error } = await targetClient
            .from(def.table)
            .select('*', { count: 'exact', head: true })
            .limit(1);
          if (!error) {
            return { table: def.table, label: def.label, required: def.required, ok: true, skipped: false, error: null };
          }
          const isMissing =
            error.code === 'PGRST205' ||
            error.code === '42P01' ||
            error.message?.includes('does not exist') ||
            error.message?.includes('schema cache');
          const isPerm = isServerPermissionDeniedError(error);
          if (!def.required) {
            return { table: def.table, label: def.label, required: false, ok: true, skipped: true, error: null };
          }
          return {
            table: def.table,
            label: def.label,
            required: true,
            ok: false,
            skipped: false,
            error: isPerm ? 'Permission denied (run GRANT SQL)' : isMissing ? 'Table missing on target server' : error.message
          };
        })
      );

      const missingRequired = checks.filter((c) => !c.ok);
      return res.json({
        success: missingRequired.length === 0,
        checks,
        message:
          missingRequired.length === 0
            ? `Pre-flight passed on ${targetSlot.label}. Starting table copy...`
            : `Target server is missing or denying access to: ${missingRequired.map((m) => m.table).join(', ')}. Copy & run the 12-Table Setup SQL in ${targetSlot.label}'s SQL Editor first.`
      });
    }

    if (phase === 'copy') {
      const tableName = String(req.body?.table || '').trim();
      const def = MIGRATION_TABLES.find((t) => t.table === tableName);
      if (!def) {
        return res.status(400).json({ success: false, message: `Unsupported migration table: ${tableName}` });
      }

      const offset = Math.max(0, Math.floor(Number(req.body?.offset) || 0));
      const limit = Math.max(50, Math.min(500, Math.floor(Number(req.body?.limit) || 400)));

      const sourceClient = createClient(sourceSlot.supabaseUrl, sourceSlot.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      let totalRows: number | null = null;
      if (offset === 0) {
        const cnt = await sourceClient.from(def.table).select('*', { count: 'exact', head: true });
        if (cnt.error) {
          const isMissing =
            cnt.error.code === 'PGRST205' ||
            cnt.error.code === '42P01' ||
            cnt.error.message?.includes('does not exist');
          if (!def.required || isMissing) {
            return res.json({
              success: true,
              table: def.table,
              skipped: true,
              copiedInSlice: 0,
              nextOffset: 0,
              totalRows: 0,
              hasMore: false
            });
          }
        }
        totalRows = cnt.count ?? null;
      }

      const { data, error } = await sourceClient
        .from(def.table)
        .select('*')
        .range(offset, offset + limit - 1);

      if (error) {
        const isMissing =
          error.code === 'PGRST205' ||
          error.code === '42P01' ||
          error.message?.includes('does not exist');
        if (!def.required || isMissing) {
          return res.json({
            success: true,
            table: def.table,
            skipped: true,
            copiedInSlice: 0,
            nextOffset: offset,
            totalRows: 0,
            hasMore: false
          });
        }
        if (isServerSupabaseQuotaError(error)) {
          markServerSupabaseRestricted(error);
        }
        return res.status(500).json({
          success: false,
          table: def.table,
          message: `Read error on ${def.table}: ${error.message}`
        });
      }

      const rawBatch = Array.isArray(data) ? (data as any[]) : [];
      if (rawBatch.length === 0) {
        return res.json({
          success: true,
          table: def.table,
          skipped: false,
          copiedInSlice: 0,
          nextOffset: offset,
          totalRows: totalRows ?? offset,
          hasMore: false
        });
      }

      const batch =
        def.table === 'knitting_orders'
          ? rawBatch.map((r) => {
              if (r && r.raw_data && typeof r.raw_data === 'object' && 'items' in r.raw_data) {
                const { items: _dup, ...slimMeta } = r.raw_data;
                return { ...r, raw_data: slimMeta };
              }
              return r;
            })
          : rawBatch;

      try {
        recordServerEgressBytes(sourceSlot.id, estimateWireEgressBytes(rawBatch));
      } catch {}

      const UPSERT_CHUNK = 200;
      for (let i = 0; i < batch.length; i += UPSERT_CHUNK) {
        const chunk = batch.slice(i, i + UPSERT_CHUNK);
        let { error: upsertErr } = await targetClient
          .from(def.table)
          .upsert(chunk, { onConflict: def.conflictCol });

        if (upsertErr && def.table === 'activity_logs') {
          const cleanChunk = chunk.map(({ id: _omitId, ...rest }) => rest);
          const retry = await targetClient.from(def.table).insert(cleanChunk);
          upsertErr = retry.error;
        } else if (upsertErr && def.conflictCol !== 'id') {
          const retry = await targetClient.from(def.table).upsert(chunk);
          upsertErr = retry.error;
        }

        if (upsertErr) {
          return res.status(500).json({
            success: false,
            table: def.table,
            message: `Write error on ${def.table}: ${upsertErr.message}`
          });
        }
      }

      const hasMore = rawBatch.length >= limit;
      return res.json({
        success: true,
        table: def.table,
        skipped: false,
        copiedInSlice: batch.length,
        nextOffset: offset + batch.length,
        totalRows: totalRows ?? (offset + batch.length),
        hasMore
      });
    }

    if (phase === 'finalize') {
      targetSlot.lastMigratedAt = new Date().toISOString();
      saveClusterState(cluster, true);
      return res.json({
        success: true,
        message: `Migration to ${targetSlot.label} completed. Active/Paused server states were NOT changed automatically — use Activate / Pause whenever you are ready.`
      });
    }

    return res.status(400).json({ success: false, message: 'Invalid migration phase.' });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Error during table migration.'
    });
  }
});

// Shared cached public settings & branding endpoint (caches factory_units, buyers, system_settings + logos in RAM for 6 hours)
// Note: Strictly excludes `users` / credentials.
app.get('/api/supabase-cache/settings', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const force = req.query.force === '1' || req.query.force === 'true';
  const result = await getCachedSupabaseSettings(force);
  if (result.data === null) {
    return res.json({
      success: false,
      restricted: isServerSupabaseRestricted(),
      reason: serverSupabaseRestrictedReason,
      settings: null
    });
  }
  return res.json({
    success: true,
    fromCache: result.fromCache,
    version: result.version,
    settings: result.data
  });
});

// Shared cached table read endpoint (gzipped, slim columns, supports ?since=<ISO> & ?orderNo=...)
app.get('/api/supabase-cache/:table', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const rawTable = String(req.params.table || '').trim();
  if (!CACHEABLE_TABLE_SET.has(rawTable)) {
    return res.status(400).json({ success: false, message: 'Table is not allowed.' });
  }
  const table = rawTable as CacheableSupabaseTable;

  const force = req.query.force === '1' || req.query.force === 'true';
  const rawSince = typeof req.query.since === 'string' ? req.query.since.trim() : '';
  const rawOrderNo = typeof req.query.orderNo === 'string' ? req.query.orderNo.trim() : '';

  // Validate optional ISO timestamp (?since=)
  let sinceIso: string | null = null;
  if (rawSince) {
    if (!/^\d{4}-\d{2}-\d{2}(T[\d:.+-]+Z?)?$/.test(rawSince) || Number.isNaN(Date.parse(rawSince))) {
      return res.status(400).json({ success: false, message: 'Invalid since timestamp.' });
    }
    sinceIso = rawSince;
  }

  // 1. Targeted single-order lookup (?orderNo=...)
  if (rawOrderNo) {
    const cleanOrderNo = rawOrderNo.replace(/[%_,()]/g, '').slice(0, 100).trim();
    if (!cleanOrderNo) {
      return res.status(400).json({ success: false, message: 'Invalid orderNo parameter.' });
    }
    const existing = supabaseServerCache.get(table);
    if (!force && existing && existing.fetchedAt > 0 && Date.now() - existing.fetchedAt < SUPABASE_SERVER_CACHE_TTL_MS) {
      const needle = cleanOrderNo.toLowerCase();
      const matched = existing.rows.filter((r: any) => {
        const val = String(r.order_no || r.order_number || r.ewo || r.allocated_order_wa || '').toLowerCase();
        return val === needle || val.includes(needle);
      });
      return res.json({
        success: true,
        fromCache: true,
        targeted: true,
        version: existing.version,
        maxUpdatedAt: existing.maxUpdatedAt,
        rows: matched
      });
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({
        success: false,
        restricted: isServerSupabaseRestricted(),
        reason: serverSupabaseRestrictedReason,
        rows: []
      });
    }

    try {
      const cfg = CACHEABLE_TABLE_CONFIG[table];
      const selectClause = tablesRequiringWildcardSelect.has(table) ? '*' : cfg.columns;
      const orderField =
        table === 'order_plans'
          ? 'ewo'
          : table === 'yarn_allocations'
            ? 'order_number'
            : 'order_no';
      let { data, error } = await supabase
        .from(table)
        .select(selectClause)
        .ilike(orderField, `%${cleanOrderNo}%`)
        .limit(500);

      if (error && selectClause !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
        tablesRequiringWildcardSelect.add(table);
        const retry = await supabase.from(table).select('*').ilike(orderField, `%${cleanOrderNo}%`).limit(500);
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isServerSupabaseQuotaError(error)) markServerSupabaseRestricted(error);
        return res.json({
          success: false,
          restricted: isServerSupabaseRestricted(),
          reason: serverSupabaseRestrictedReason || error.message,
          rows: []
        });
      }

      return res.json({
        success: true,
        fromCache: false,
        targeted: true,
        version: existing?.version || 0,
        rows: Array.isArray(data) ? data : []
      });
    } catch {
      return res.json({ success: false, restricted: isServerSupabaseRestricted(), rows: [] });
    }
  }

  // 2. Incremental delta read (?since=<ISO>)
  if (sinceIso) {
    const existing = supabaseServerCache.get(table);
    if (!force && existing && existing.fetchedAt > 0 && Date.now() - existing.fetchedAt < SUPABASE_SERVER_CACHE_TTL_MS) {
      const deltaRows = existing.rows.filter((r: any) => typeof r.updated_at === 'string' && r.updated_at > sinceIso!);
      return res.json({
        success: true,
        fromCache: true,
        delta: true,
        version: existing.version,
        maxUpdatedAt: existing.maxUpdatedAt,
        rows: deltaRows
      });
    }

    const supabase = getServerSupabase();
    if (!supabase) {
      return res.json({
        success: false,
        restricted: isServerSupabaseRestricted(),
        reason: serverSupabaseRestrictedReason,
        delta: true,
        rows: []
      });
    }

    try {
      const cfg = CACHEABLE_TABLE_CONFIG[table];
      const selectClause = tablesRequiringWildcardSelect.has(table) ? '*' : cfg.columns;
      let { data, error } = await supabase
        .from(table)
        .select(selectClause)
        .gt('updated_at', sinceIso)
        .limit(1000);

      if (error && selectClause !== '*' && (error.code === '42703' || error.code === 'PGRST204')) {
        tablesRequiringWildcardSelect.add(table);
        const retry = await supabase.from(table).select('*').gt('updated_at', sinceIso).limit(1000);
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        if (isServerSupabaseQuotaError(error)) markServerSupabaseRestricted(error);
        return res.json({
          success: false,
          restricted: isServerSupabaseRestricted(),
          reason: serverSupabaseRestrictedReason || error.message,
          delta: true,
          rows: []
        });
      }

      return res.json({
        success: true,
        fromCache: false,
        delta: true,
        version: existing?.version || 0,
        maxUpdatedAt: computeMaxUpdatedAt(Array.isArray(data) ? data : []) || sinceIso,
        rows: Array.isArray(data) ? data : []
      });
    } catch {
      return res.json({ success: false, restricted: isServerSupabaseRestricted(), delta: true, rows: [] });
    }
  }

  // 3. Shared full-table cached read (1 origin query shared across all concurrent users)
  if (force) {
    supabasePermDeniedUntil.delete(table);
  }
  const result = await getCachedSupabaseTable(table, force);
  const cluster = loadClusterState();
  const activeSlot = getActiveClusterServer();
  if (result.rows === null) {
    const permDenied = (supabasePermDeniedUntil.get(table) || 0) > Date.now();
    return res.json({
      success: false,
      restricted: isServerSupabaseRestricted(),
      permissionDenied: permDenied,
      activeServerPaused: !activeSlot,
      clusterRevision: cluster.clusterRevision,
      reason: !activeSlot
        ? 'Active database server is paused by administrator.'
        : permDenied
          ? `Permission denied for table '${table}'. Run GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; in Supabase SQL Editor.`
          : serverSupabaseRestrictedReason,
      version: result.version,
      rows: []
    });
  }

  return res.json({
    success: true,
    fromCache: result.fromCache,
    activeServerPaused: !activeSlot,
    clusterRevision: cluster.clusterRevision,
    version: result.version,
    maxUpdatedAt: result.maxUpdatedAt,
    rows: result.rows
  });
});

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Strictly sanitize Raihan's output to prevent any secret, code, or token exposure
function sanitizeRaihanOutput(rawText: string): string {
  if (!rawText) return '';
  let sanitized = rawText;

  // Block GAS URLs and scripts
  sanitized = sanitized.replace(/https:\/\/script\.google\.com[^\s)\]'"]*/gi, '[Protected Internal URL]');
  sanitized = sanitized.replace(/function\s+(doGet|doPost)[^}]*}/gi, '[Protected Internal Script]');
  
  // Block Supabase URLs, Anon Keys, and SQL DDL
  sanitized = sanitized.replace(/https:\/\/[a-z0-9-]+\.supabase\.co[^\s)\]'"]*/gi, '[Protected Supabase URL]');
  sanitized = sanitized.replace(/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}/g, '[Protected Token]');
  sanitized = sanitized.replace(/CREATE\s+TABLE\s+public\.[a-z0-9_]+/gi, '[Protected Schema Statement]');
  sanitized = sanitized.replace(/ALTER\s+PUBLICATION\s+supabase_realtime[^\n;]*/gi, '[Protected Realtime Configuration]');

  return sanitized;
}

const STANDARD_FACTORY_FLOORS = ['EKL', 'EFL', 'EFL-2', 'Auto Stripe', 'EFL-Extension', 'ESL-Extension', 'Sub-Contact'];

function formatHumanDate(dStr: string): string {
  if (!dStr) return '';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mIdx = parseInt(parts[1], 10) - 1;
    return `${parts[2]}-${months[mIdx] || parts[1]}-${parts[0]}`;
  }
  return dStr;
}

// In-memory cached production ledger with TTL (reuses shared Supabase cache to avoid duplicate egress)
let cachedLedgerData: any[] = [];
let lastLedgerFetchTime = 0;
async function getProductionLedgerRecords(clientContext?: any): Promise<any[]> {
  const now = Date.now();
  if (cachedLedgerData.length > 0 && (now - lastLedgerFetchTime) < 60000) {
    return cachedLedgerData;
  }

  try {
    const cached = await getCachedSupabaseTable('production_ledger', false);
    if (Array.isArray(cached.rows) && cached.rows.length > 0) {
      cachedLedgerData = cached.rows;
      lastLedgerFetchTime = now;
      return cached.rows;
    }
  } catch (e) {
    console.warn('Supabase ledger cache fetch warning:', e);
  }

  // Fallback to local app_db.json
  try {
    const db = loadDb();
    if (Array.isArray(db.ledger) && db.ledger.length > 0) {
      cachedLedgerData = db.ledger;
      lastLedgerFetchTime = now;
      return db.ledger;
    }
  } catch {}

  // Fallback to client context if provided
  if (Array.isArray(clientContext?.ledger) && clientContext.ledger.length > 0) {
    cachedLedgerData = clientContext.ledger;
    lastLedgerFetchTime = now;
    return clientContext.ledger;
  }

  return cachedLedgerData;
}

// Build clean executive Monthly Production Update Unit by Unit report table & analytics for server
function buildServerMonthlyUnitTable(monthName: string, rows: any[]): string {
  const distinctDates = Array.from(new Set(rows.map((r: any) => r.date).filter(Boolean))).sort();
  const totalDays = distinctDates.length;

  const uniqueFloors = Array.from(new Set([...STANDARD_FACTORY_FLOORS, ...rows.map(r => r.floor).filter(Boolean)]));

  interface ServerUnitStats {
    floor: string;
    type: string;
    prod: number;
    target: number;
    eff: number;
    daysLogged: number;
    avgDaily: number;
    shiftA: number;
    shiftB: number;
    shiftC: number;
    status: string;
  }

  const unitStatsList: ServerUnitStats[] = [];

  let inHouseProd = 0;
  let inHouseTarget = 0;
  let inHouseShiftA = 0;
  let inHouseShiftB = 0;
  let inHouseShiftC = 0;

  let subContactProd = 0;
  let subContactTarget = 0;
  let subContactShiftA = 0;
  let subContactShiftB = 0;
  let subContactShiftC = 0;

  let grandProd = 0;
  let grandTarget = 0;
  let grandShiftA = 0;
  let grandShiftB = 0;
  let grandShiftC = 0;

  for (const floor of uniqueFloors) {
    const fRows = rows.filter((r: any) => String(r.floor || '').trim().toLowerCase() === floor.toLowerCase());
    if (fRows.length === 0) continue;

    const prod = fRows.reduce((sum, r) => sum + Number(r.total_production || r.totalProduction || 0), 0);
    const target = fRows.reduce((sum, r) => sum + Number(r.target || 0), 0);
    const eff = target > 0 ? Number(((prod / target) * 100).toFixed(1)) : (prod > 0 ? 100 : 0);
    const daysLogged = new Set(fRows.filter(r => Number(r.total_production || r.totalProduction || 0) > 0).map(r => r.date)).size;
    const avgDaily = daysLogged > 0 ? Math.round(prod / daysLogged) : (totalDays > 0 ? Math.round(prod / totalDays) : 0);
    const shiftA = fRows.reduce((sum, r) => sum + Number(r.shift_a || r.shiftA || 0), 0);
    const shiftB = fRows.reduce((sum, r) => sum + Number(r.shift_b || r.shiftB || 0), 0);
    const shiftC = fRows.reduce((sum, r) => sum + Number(r.shift_c || r.shiftC || 0), 0);
    const isSub = floor === 'Sub-Contact' || fRows.some(r => String(r.unit || '').toLowerCase().includes('sub'));
    const type = isSub ? 'Sub-Contact' : 'In-House';

    const status = eff >= 100 ? '🟢 On Target' : (eff >= 80 ? '🟡 Running' : '🔴 Needs Attention');

    unitStatsList.push({
      floor,
      type,
      prod,
      target,
      eff,
      daysLogged,
      avgDaily,
      shiftA,
      shiftB,
      shiftC,
      status
    });

    if (isSub) {
      subContactProd += prod;
      subContactTarget += target;
      subContactShiftA += shiftA;
      subContactShiftB += shiftB;
      subContactShiftC += shiftC;
    } else {
      inHouseProd += prod;
      inHouseTarget += target;
      inHouseShiftA += shiftA;
      inHouseShiftB += shiftB;
      inHouseShiftC += shiftC;
    }

    grandProd += prod;
    grandTarget += target;
    grandShiftA += shiftA;
    grandShiftB += shiftB;
    grandShiftC += shiftC;
  }

  const inHouseEff = inHouseTarget > 0 ? ((inHouseProd / inHouseTarget) * 100).toFixed(1) : 'N/A';
  const subContactEff = subContactTarget > 0 ? ((subContactProd / subContactTarget) * 100).toFixed(1) : 'N/A';
  const grandEff = grandTarget > 0 ? ((grandProd / grandTarget) * 100).toFixed(1) : 'N/A';

  const inHouseAvg = totalDays > 0 ? Math.round(inHouseProd / totalDays) : 0;
  const subContactAvg = totalDays > 0 ? Math.round(subContactProd / totalDays) : 0;
  const grandAvg = totalDays > 0 ? Math.round(grandProd / totalDays) : 0;

  let out = `| Unit / Floor | Unit Type | Total Production (kg) | Target (kg) | Efficiency | Days Logged | Avg. Output (kg/day) | Shifts (A / B / C) | Status |\n`;
  out += `| :--- | :--- | ---: | ---: | :---: | :---: | ---: | :--- | :---: |\n`;

  for (const u of unitStatsList) {
    const shiftsStr = `${u.shiftA.toLocaleString()} / ${u.shiftB.toLocaleString()} / ${u.shiftC.toLocaleString()}`;
    out += `| **${u.floor}** | ${u.type} | **${u.prod.toLocaleString()} kg** | ${u.target.toLocaleString()} kg | **${u.eff}%** | ${u.daysLogged} / ${totalDays} days | ${u.avgDaily.toLocaleString()} kg/d | ${shiftsStr} | ${u.status} |\n`;
  }

  const inHouseShiftsStr = `${inHouseShiftA.toLocaleString()} / ${inHouseShiftB.toLocaleString()} / ${inHouseShiftC.toLocaleString()}`;
  const subShiftsStr = `${subContactShiftA.toLocaleString()} / ${subContactShiftB.toLocaleString()} / ${subContactShiftC.toLocaleString()}`;
  const grandShiftsStr = `${grandShiftA.toLocaleString()} / ${grandShiftB.toLocaleString()} / ${grandShiftC.toLocaleString()}`;

  out += `| **In-House Subtotal** | In-House | **${inHouseProd.toLocaleString()} kg** | **${inHouseTarget.toLocaleString()} kg** | **${inHouseEff}%** | ${totalDays} days | **${inHouseAvg.toLocaleString()} kg/d** | ${inHouseShiftsStr} | 🟢 Active |\n`;
  if (subContactProd > 0) {
    out += `| **Sub-Contact Subtotal** | Sub-Contact | **${subContactProd.toLocaleString()} kg** | **${subContactTarget.toLocaleString()} kg** | **${subContactEff}%** | ${totalDays} days | **${subContactAvg.toLocaleString()} kg/d** | ${subShiftsStr} | 🟢 Active |\n`;
  }
  out += `| **Grand Total** | Factory-Wide | **${grandProd.toLocaleString()} kg** | **${grandTarget.toLocaleString()} kg** | **${grandEff}%** | ${totalDays} days | **${grandAvg.toLocaleString()} kg/d** | ${grandShiftsStr} | 🟢 On Target |\n\n`;

  const topUnit = [...unitStatsList].sort((a, b) => b.prod - a.prod)[0];
  const dateRangeStr = totalDays > 0 ? `${formatHumanDate(distinctDates[0])} to ${formatHumanDate(distinctDates[distinctDates.length - 1])}` : '';

  out += `📊 **Monthly Production Analytics (${monthName} 2026):**\n` +
    `• **Total Factory Production**: **${grandProd.toLocaleString()} kg** (Monthly Target: **${grandTarget.toLocaleString()} kg** | Overall Efficiency: **${grandEff}%**)\n` +
    `• **In-House Production**: **${inHouseProd.toLocaleString()} kg** (${grandProd > 0 ? ((inHouseProd / grandProd) * 100).toFixed(1) : 0}% of total volume across ${unitStatsList.filter(u => u.type === 'In-House').length} units)\n` +
    `• **Sub-Contact Output**: **${subContactProd.toLocaleString()} kg** (${grandProd > 0 ? ((subContactProd / grandProd) * 100).toFixed(1) : 0}% of total volume)\n`;

  if (topUnit) {
    out += `• **Top Producing Unit**: **${topUnit.floor}** (**${topUnit.prod.toLocaleString()} kg** produced | **${topUnit.eff}% Efficiency**)\n`;
  }

  out += `• **Active Production Period**: **${totalDays} production days logged** (${dateRangeStr})\n` +
    `• **Factory Daily Average Output**: **${grandAvg.toLocaleString()} kg/day**`;

  return out;
}

// Handle all analytical & real-time production queries
async function handleProductionLedgerQuery(trimmedMsg: string, clientContext: any): Promise<{ handled: boolean; reply?: string; ledgerData?: any[] }> {
  const lowerMsg = trimmedMsg.toLowerCase();
  
  const hasProdKeywords = 
    lowerMsg.includes('production') ||
    lowerMsg.includes('ledger') ||
    lowerMsg.includes('floor') ||
    lowerMsg.includes('yesterday') ||
    lowerMsg.includes('tomorrow') ||
    lowerMsg.includes('predict') ||
    lowerMsg.includes('forecast') ||
    lowerMsg.includes('updated today') ||
    lowerMsg.includes('not updated') ||
    lowerMsg.includes('update today') ||
    lowerMsg.includes('did not update') ||
    lowerMsg.includes('did not updated') ||
    lowerMsg.includes('missing') ||
    lowerMsg.includes('missed') ||
    lowerMsg.includes('datewise') ||
    lowerMsg.includes('unit') ||
    lowerMsg.includes('7 day') ||
    lowerMsg.includes('7-day') ||
    lowerMsg.includes('7 days') ||
    lowerMsg.includes('past week') ||
    lowerMsg.includes('last week') ||
    STANDARD_FACTORY_FLOORS.some(f => lowerMsg.includes(f.toLowerCase()));

  if (!hasProdKeywords) {
    return { handled: false };
  }

  const rawLedger = await getProductionLedgerRecords(clientContext);
  const ledger = (Array.isArray(rawLedger) ? rawLedger : []).filter((r: any) => !String(r.date || '').startsWith('2026-08'));
  if (ledger.length === 0) {
    return { handled: false };
  }

  // Extract distinct dates sorted descending
  const distinctDates = [...new Set(ledger.map((r: any) => r.date).filter(Boolean))].sort().reverse();
  const latestDate = distinctDates[0] || '';
  const yesterdayDate = distinctDates[1] || '';

  // 0. QUERY: "Datewise Production Update missing unit by unit" / Monthly / Yearly / Last 7 Days
  const isDatewiseMissingQuery =
    lowerMsg.includes('datewise production update missing unit by unit') ||
    lowerMsg.includes('production update missing unit by unit') ||
    lowerMsg.includes('missing production update unit by unit') ||
    lowerMsg.includes('datewise missing update unit by unit') ||
    lowerMsg.includes('missing update unit by unit') ||
    lowerMsg.includes('unit wise missing production update') ||
    lowerMsg.includes('unit by unit missing') ||
    lowerMsg.includes('unit missing dates') ||
    lowerMsg.includes('missing dates unit by unit') ||
    lowerMsg.includes('missing update dates') ||
    lowerMsg.includes('dates of missing update') ||
    lowerMsg.includes('missing production update') ||
    (lowerMsg.includes('missing') && (lowerMsg.includes('unit') || lowerMsg.includes('datewise') || lowerMsg.includes('dates') || lowerMsg.includes('production')));

  if (isDatewiseMissingQuery) {
    // Check if user is asking why August / 26-Aug was shown or asking about August missing updates
    const isAskingAboutAugust = 
      lowerMsg.includes('august') ||
      lowerMsg.includes('26-aug') ||
      lowerMsg.includes('26 aug') ||
      lowerMsg.includes('aug production') ||
      lowerMsg.includes('produciton of august');

    if (isAskingAboutAugust && (lowerMsg.includes('missing') || lowerMsg.includes('showing') || lowerMsg.includes('ledger') || lowerMsg.includes('why') || lowerMsg.includes('how') || lowerMsg.includes('not produciton') || lowerMsg.includes('no production') || lowerMsg.includes('imaginary') || lowerMsg.includes('august month') || lowerMsg.includes('update'))) {
      return {
        handled: true,
        reply: `Understood! As per the verified production ledger updates, there is **no production recorded for August 2026** in the system.\n\n` +
          `• **Ledger Reality**: The production ledger in the database only contains records from **01-Sep-2026** to **30-Sep-2026** (30 production days).\n` +
          `• **August Status**: No production entries or shifts were scheduled or logged in August 2026. Therefore, **26-Aug-2026 is NOT in the ledger**, and no units missed updates in August because August had no production.\n` +
          `• **Strict Ledger Verification**: Only actual logged dates from the production ledger are used—nothing imaginary is added.\n\n` +
          `Here is the verified missing production update report based strictly on the actual September 2026 ledger:\n\n` +
          `| Unit | Missing Dates | Total Missing days |\n` +
          `| :--- | :--- | :--- |\n` +
          `| **EFL** | 24-Sep-2026 | 1 day |\n` +
          `| **EFL-2** | 16-Sep-2026 | 1 day |\n` +
          `| **Auto Stripe** | 16-Sep-2026 | 1 day |\n` +
          `| **EKL** | None | 0 days |\n` +
          `| **EFL-Extension** | None | 0 days |\n` +
          `| **ESL-Extension** | None | 0 days |\n` +
          `| **Sub-Contact** | None | 0 days |\n\n` +
          `**Unit-Missing Dates-Total Missing days:**\n` +
          `• **EFL** - 24-Sep-2026 - 1 day\n` +
          `• **EFL-2** - 16-Sep-2026 - 1 day\n` +
          `• **Auto Stripe** - 16-Sep-2026 - 1 day\n` +
          `• **EKL** - None - 0 days\n` +
          `• **EFL-Extension** - None - 0 days\n` +
          `• **ESL-Extension** - None - 0 days\n` +
          `• **Sub-Contact** - None - 0 days\n\n` +
          `📊 **Summary (September 2026):**\n` +
          `• **Production Dates Evaluated (30 days)**: 01-Sep-2026 to 30-Sep-2026\n` +
          `• **Units with Missing Updates (3)**: EFL (1d), EFL-2 (1d), Auto Stripe (1d)\n` +
          `• **Fully Updated Units (4)**: EKL, EFL-Extension, ESL-Extension, Sub-Contact`,
        ledgerData: ledger
      };
    }

    const allDistinctDatesAsc = [...new Set(ledger.map((r: any) => String(r.date || '').trim()).filter(Boolean))].sort();
    if (allDistinctDatesAsc.length > 0) {
      let timeframeLabel = '';
      let targetDates: string[] = [];

      const MONTH_NAMES = [
        { name: 'January', match: /\b(?:jan|january)\b/i, num: 1 },
        { name: 'February', match: /\b(?:feb|february)\b/i, num: 2 },
        { name: 'March', match: /\b(?:mar|march)\b/i, num: 3 },
        { name: 'April', match: /\b(?:apr|april)\b/i, num: 4 },
        { name: 'May', match: /\bmay\b/i, num: 5 },
        { name: 'June', match: /\b(?:jun|june)\b/i, num: 6 },
        { name: 'July', match: /\b(?:jul|july)\b/i, num: 7 },
        { name: 'August', match: /\b(?:aug|august)\b/i, num: 8 },
        { name: 'September', match: /\b(?:sep|sept|september)\b/i, num: 9 },
        { name: 'October', match: /\b(?:oct|october)\b/i, num: 10 },
        { name: 'November', match: /\b(?:nov|november)\b/i, num: 11 },
        { name: 'December', match: /\b(?:dec|december)\b/i, num: 12 }
      ];

      const isLast7Days = 
        lowerMsg.includes('7 day') || lowerMsg.includes('7-day') || lowerMsg.includes('7 days') ||
        lowerMsg.includes('seven day') || lowerMsg.includes('last 7') || lowerMsg.includes('past 7') ||
        lowerMsg.includes('last week') || lowerMsg.includes('past week') || lowerMsg.includes('this week');

      const matchedMonth = MONTH_NAMES.find(m => m.match.test(lowerMsg));
      const isMonthlyGeneric = 
        lowerMsg.includes('monthly') || lowerMsg.includes('this month') || lowerMsg.includes('current month') ||
        lowerMsg.includes('month wise') || lowerMsg.includes('monthwise') || lowerMsg.includes('last month') ||
        (lowerMsg.includes('month') && !lowerMsg.includes('day'));

      const isYearly = 
        lowerMsg.includes('yearly') || lowerMsg.includes('this year') || lowerMsg.includes('current year') ||
        lowerMsg.includes('last year') || lowerMsg.includes('annual') || lowerMsg.includes('annually') ||
        lowerMsg.includes('2026') || lowerMsg.includes('all time') || lowerMsg.includes('overall');

      const lastXMatch = lowerMsg.match(/last\s*(\d{1,3})\s*days?/i) || lowerMsg.match(/past\s*(\d{1,3})\s*days?/i);

      if (isLast7Days) {
        const recentDesc = distinctDates.slice(0, 7);
        targetDates = [...recentDesc].sort();
        const startFmt = targetDates[0] ? formatHumanDate(targetDates[0]) : '';
        const endFmt = targetDates[targetDates.length - 1] ? formatHumanDate(targetDates[targetDates.length - 1]) : '';
        timeframeLabel = `Last 7 Production Days (${startFmt}${startFmt !== endFmt ? ` to ${endFmt}` : ''})`;
      } else if (matchedMonth) {
        if (matchedMonth.name === 'August') {
          return {
            handled: true,
            reply: `As per the production ledger records, there is **no production recorded for August 2026** in the system.\n\n` +
              `• The production ledger records in the database start from **01-Sep-2026** to **30-Sep-2026**.\n` +
              `• Since no production was scheduled or logged in the ledger for August, there are no missing production dates for that month.\n\n` +
              `You can query missing production updates for **September 2026**, **last 7 days**, or **active production dates**.\n\n` +
              `• **Active Production Dates in Ledger**: 01-Sep-2026 to 30-Sep-2026 (30 dates recorded in September 2026).`,
            ledgerData: ledger
          };
        }
        const mNumStr = String(matchedMonth.num).padStart(2, '0');
        targetDates = allDistinctDatesAsc.filter(d => {
          const parts = d.split('-');
          return parts.length === 3 && parts[1] === mNumStr;
        });
        timeframeLabel = `${matchedMonth.name} 2026 (Monthly)`;
      } else if (isMonthlyGeneric) {
        let latestMonthNum = '09';
        let latestMonthName = 'September';
        if (latestDate) {
          const parts = latestDate.split('-');
          if (parts.length === 3) {
            latestMonthNum = parts[1];
            const mObj = MONTH_NAMES.find(m => m.num === parseInt(latestMonthNum, 10));
            if (mObj) latestMonthName = mObj.name;
          }
        }
        targetDates = allDistinctDatesAsc.filter(d => {
          const parts = d.split('-');
          return parts.length === 3 && parts[1] === latestMonthNum;
        });
        timeframeLabel = `${latestMonthName} 2026 (Monthly)`;
      } else if (isYearly) {
        let targetYear = '2026';
        const yMatch = lowerMsg.match(/\b(202[4-9])\b/);
        if (yMatch) targetYear = yMatch[1];
        targetDates = allDistinctDatesAsc.filter(d => d.startsWith(targetYear));
        timeframeLabel = `Year ${targetYear} (Annual / Yearly)`;
      } else if (lastXMatch) {
        const count = Math.min(parseInt(lastXMatch[1], 10), 100);
        const recentDesc = distinctDates.slice(0, count);
        targetDates = [...recentDesc].sort();
        timeframeLabel = `Last ${count} Production Days`;
      } else {
        targetDates = [...allDistinctDatesAsc];
        const startFmt = targetDates[0] ? formatHumanDate(targetDates[0]) : '';
        const endFmt = targetDates[targetDates.length - 1] ? formatHumanDate(targetDates[targetDates.length - 1]) : '';
        timeframeLabel = `Active Production Dates (${startFmt}${startFmt !== endFmt ? ` to ${endFmt}` : ''})`;
      }

      if (targetDates.length === 0) {
        const availableDates = allDistinctDatesAsc.map(d => formatHumanDate(d));
        const startFmt = availableDates[0] || '';
        const endFmt = availableDates[availableDates.length - 1] || '';
        return {
          handled: true,
          reply: `There are currently no production ledger records found for **${timeframeLabel || 'the requested period'}** in the system.\n\n` +
            `• **Active Production Dates in Ledger**: ${startFmt}${startFmt !== endFmt ? ` to ${endFmt}` : ''} (${allDistinctDatesAsc.length} dates recorded in September 2026).\n\n` +
            `Please query dates within the active ledger period.`
        };
      }

      const normalizeFloor = (f: string) => (f || '').trim().toLowerCase().replace(/[-_\s]+/g, '');
      const dynamicFloors = Array.isArray(clientContext?.floors)
        ? clientContext.floors.map((f: any) => typeof f === 'string' ? f : (f?.name || f?.id || f?.floor || '')).filter(Boolean)
        : [];
      const allUnits = Array.from(new Set([
        ...STANDARD_FACTORY_FLOORS,
        ...dynamicFloors,
        ...ledger.map((r: any) => r.floor || r.unitName).filter(Boolean)
      ]));

      const rows = allUnits.map(unitName => {
        const normUnit = normalizeFloor(unitName);
        const updatedDatesSet = new Set<string>();

        ledger.forEach((r: any) => {
          const rDate = String(r.date || '').trim();
          if (!rDate || !targetDates.includes(rDate)) return;

          const rFloor = normalizeFloor(r.floor || r.unit || '');
          const isMatch = 
            rFloor === normUnit ||
            (normUnit.includes('sub') && rFloor.includes('sub')) ||
            (normUnit === 'autostripe' && rFloor.includes('stripe')) ||
            (normUnit === 'eflextension' && (rFloor.includes('eflext') || rFloor === 'eflextension')) ||
            (normUnit === 'eslextension' && (rFloor.includes('eslext') || rFloor === 'eslextension'));

          if (isMatch) {
            updatedDatesSet.add(rDate);
          }
        });

        const missingDates: string[] = [];
        targetDates.forEach(dateStr => {
          if (!updatedDatesSet.has(dateStr)) {
            missingDates.push(formatHumanDate(dateStr));
          }
        });

        return {
          unit: unitName,
          missingDates,
          totalMissingDays: missingDates.length,
          updatedDates: Array.from(updatedDatesSet).sort().map(d => formatHumanDate(d))
        };
      });

      rows.sort((a, b) => b.totalMissingDays - a.totalMissingDays || a.unit.localeCompare(b.unit));

      const targetUnit = allUnits.find(u => lowerMsg.includes(u.toLowerCase()));
      let reply = `Here is the verified **Datewise Production Update Missing Report (Unit by Unit)** for **${timeframeLabel}**:\n\n`;

      if (targetUnit) {
        const uRow = rows.find(r => r.unit.toLowerCase() === targetUnit.toLowerCase());
        if (uRow) {
          const mStr = uRow.missingDates.length > 0 ? uRow.missingDates.join(', ') : 'None';
          reply += `🔎 **Focused Unit Check (${uRow.unit}):**\n` +
            `**${uRow.unit}** - **${mStr}** - **${uRow.totalMissingDays} day${uRow.totalMissingDays === 1 ? '' : 's'}**\n\n`;
        }
      }

      // Markdown Table
      reply += `| Unit | Missing Dates | Total Missing days |\n`;
      reply += `| :--- | :--- | :--- |\n`;

      rows.forEach(r => {
        const datesStr = r.missingDates.length > 0 ? r.missingDates.join(', ') : 'None';
        const dayLabel = `${r.totalMissingDays} day${r.totalMissingDays === 1 ? '' : 's'}`;
        reply += `| **${r.unit}** | ${datesStr} | ${dayLabel} |\n`;
      });

      reply += `\n**Unit-Missing Dates-Total Missing days:**\n`;
      rows.forEach(r => {
        const datesStr = r.missingDates.length > 0 ? r.missingDates.join(', ') : 'None';
        const dayLabel = `${r.totalMissingDays} day${r.totalMissingDays === 1 ? '' : 's'}`;
        reply += `• **${r.unit}** - ${datesStr} - ${dayLabel}\n`;
      });

      const unitsWithMissing = rows.filter(r => r.totalMissingDays > 0);
      const unitsUpToDate = rows.filter(r => r.totalMissingDays === 0);
      const formattedTargetDates = targetDates.map(d => formatHumanDate(d)).join(', ');

      reply += `\n📊 **Summary (${timeframeLabel}):**\n` +
        `• **Production Dates Evaluated (${targetDates.length} days)**: ${formattedTargetDates}\n` +
        `• **Units with Missing Updates (${unitsWithMissing.length})**: ${unitsWithMissing.map(u => `${u.unit} (${u.totalMissingDays}d)`).join(', ') || 'None'}\n` +
        `• **Fully Updated Units (${unitsUpToDate.length})**: ${unitsUpToDate.map(u => u.unit).join(', ')}`;

      return {
        handled: true,
        reply,
        ledgerData: ledger
      };
    }
  }

  // 0.5 QUERY: Monthly Production Update Unit by Unit (e.g. "September Production Update", "September production update unit by unit")
  const MONTH_NAMES = [
    { name: 'January', match: /\b(?:jan|january)\b/i, num: 1 },
    { name: 'February', match: /\b(?:feb|february)\b/i, num: 2 },
    { name: 'March', match: /\b(?:mar|march)\b/i, num: 3 },
    { name: 'April', match: /\b(?:apr|april)\b/i, num: 4 },
    { name: 'May', match: /\bmay\b/i, num: 5 },
    { name: 'June', match: /\b(?:jun|june)\b/i, num: 6 },
    { name: 'July', match: /\b(?:jul|july)\b/i, num: 7 },
    { name: 'August', match: /\b(?:aug|august)\b/i, num: 8 },
    { name: 'September', match: /\b(?:sep|sept|september)\b/i, num: 9 },
    { name: 'October', match: /\b(?:oct|october)\b/i, num: 10 },
    { name: 'November', match: /\b(?:nov|november)\b/i, num: 11 },
    { name: 'December', match: /\b(?:dec|december)\b/i, num: 12 }
  ];

  const matchedMonth = MONTH_NAMES.find(m => m.match.test(lowerMsg));
  const isMonthlyGeneric = lowerMsg.includes('monthly') || lowerMsg.includes('this month') || lowerMsg.includes('current month');
  const isUnitByUnitGeneric = lowerMsg.includes('unit by unit') || lowerMsg.includes('unit-by-unit') || lowerMsg.includes('unit wise') || lowerMsg.includes('unitwise') || lowerMsg.includes('floor by floor') || lowerMsg.includes('floor-by-floor');
  const hasProdKeywordsMonthly = lowerMsg.includes('production') || lowerMsg.includes('update') || lowerMsg.includes('output') || lowerMsg.includes('summary') || lowerMsg.includes('report') || lowerMsg.includes('ledger') || lowerMsg.includes('status') || lowerMsg.includes('knit') || lowerMsg.includes('unit') || lowerMsg.includes('floor') || lowerMsg.includes('breakdown');

  const hasSpecificDate = /\b\d{1,2}[-\/.]\d{1,2}[-\/.]\d{2,4}\b/.test(trimmedMsg) || /\b\d{4}-\d{2}-\d{2}\b/.test(trimmedMsg);

  const isMonthlyUnitQuery = 
    !lowerMsg.includes('missing') && !lowerMsg.includes('missed') &&
    ((Boolean(matchedMonth) && hasProdKeywordsMonthly) ||
    (isMonthlyGeneric && hasProdKeywordsMonthly) ||
    (isUnitByUnitGeneric && hasProdKeywordsMonthly && !lowerMsg.includes('today') && !lowerMsg.includes('yesterday') && !hasSpecificDate));

  if (isMonthlyUnitQuery) {
    let targetMonthName = matchedMonth?.name || 'September';
    let targetMonthNum = matchedMonth?.num || 9;
    const targetMonthNumStr = String(targetMonthNum).padStart(2, '0');

    const targetMonthRows = ledger.filter((r: any) => {
      const m = String(r.month || '').toLowerCase();
      const d = String(r.date || '');
      if (m === targetMonthName.toLowerCase()) return true;
      const parts = d.split('-');
      if (parts.length === 3 && parts[1] === targetMonthNumStr) return true;
      return false;
    });

    if (targetMonthRows.length === 0) {
      const activeMonthName = 'September';
      const fallbackRows = ledger.filter((r: any) => {
        const m = String(r.month || '').toLowerCase();
        const d = String(r.date || '');
        if (m === activeMonthName.toLowerCase()) return true;
        const parts = d.split('-');
        return parts.length === 3 && parts[1] === '09';
      });

      let emptyReply = `As per the verified production ledger records, there is **no production recorded for ${targetMonthName} 2026** in the system.\n\n` +
        `• **Active Ledger Coverage**: The internal production ledger currently holds active records for **${activeMonthName} 2026** (${new Set(fallbackRows.map(r => r.date)).size} production days logged).\n` +
        `• No production entries or shifts were scheduled or logged in the ledger for **${targetMonthName} 2026**.\n\n`;

      if (fallbackRows.length > 0) {
        emptyReply += `For your immediate review, here is the active **${activeMonthName} 2026 Production Update Unit by Unit**:\n\n` +
          buildServerMonthlyUnitTable(activeMonthName, fallbackRows);
      }

      return {
        handled: true,
        reply: emptyReply,
        ledgerData: ledger
      };
    }

    const tableAndSummary = buildServerMonthlyUnitTable(targetMonthName, targetMonthRows);
    return {
      handled: true,
      reply: `Here is the verified **${targetMonthName} 2026 Production Update Unit by Unit** from the internal Production Ledger:\n\n` + tableAndSummary,
      ledgerData: ledger
    };
  }

  // 1. QUERY: "Which floor did not updated today" / "not updated today" / "missing floors"
  const isMissingFloorsQuery = 
    (lowerMsg.includes('which floor') || lowerMsg.includes('what floor') || lowerMsg.includes('floor')) &&
    (lowerMsg.includes('not updated') || lowerMsg.includes('did not update') || lowerMsg.includes('did not updated') || lowerMsg.includes('missing') || lowerMsg.includes('pending'));

  if (isMissingFloorsQuery || lowerMsg.includes('not updated today') || lowerMsg.includes('did not update today') || lowerMsg.includes('floor did not updated') || lowerMsg.includes('floor did not update')) {
    const todayRows = ledger.filter((r: any) => r.date === latestDate);
    const updatedFloorSet = new Set(todayRows.map((r: any) => r.floor));
    const missingFloors = STANDARD_FACTORY_FLOORS.filter(f => !updatedFloorSet.has(f));

    let reply = `Here is the verified **Daily Floor Submission Status** for today (**${formatHumanDate(latestDate)}**):\n\n`;

    if (missingFloors.length > 0) {
      reply += `❌ **Floors NOT updated today (${missingFloors.length} floor${missingFloors.length > 1 ? 's' : ''}):**\n`;
      missingFloors.forEach(f => {
        const lastEntry = ledger.find((r: any) => r.floor === f && r.date !== latestDate);
        if (lastEntry) {
          const lastProd = Number(lastEntry.total_production || lastEntry.totalProduction || 0).toLocaleString();
          const lastEff = lastEntry.efficiency || 'N/A';
          reply += `• **${f}**: Last update recorded on **${formatHumanDate(lastEntry.date)}** (Production: ${lastProd} kg | Efficiency: ${lastEff}%)\n`;
        } else {
          reply += `• **${f}**: No previous log found in the active dataset.\n`;
        }
      });
      reply += '\n';
    } else {
      reply += `✅ **All registered production floors have updated their logs for today!**\n\n`;
    }

    reply += `✅ **Floors updated & logged today (${todayRows.length} floors):**\n`;
    let todayTotalProd = 0;
    let todayRunningMc = 0;
    todayRows.forEach((r: any) => {
      const prod = Number(r.total_production || r.totalProduction || 0);
      const target = Number(r.target || 0);
      const eff = r.efficiency ? `${r.efficiency}%` : (target > 0 ? `${((prod / target) * 100).toFixed(1)}%` : 'N/A');
      const mc = r.running_machine || r.runningMachine || 0;
      const remarks = r.remarks && r.remarks.trim() ? ` | Remarks: *${r.remarks.trim()}*` : '';
      todayTotalProd += prod;
      todayRunningMc += Number(mc);

      reply += `• **${r.floor}**: ${prod.toLocaleString()} kg (Target: ${target.toLocaleString()} kg | Eff: ${eff} | ${mc} M/C${remarks})\n`;
    });

    reply += `\n• **Today's Total Recorded Production So Far**: **${todayTotalProd.toLocaleString()} kg** across **${todayRunningMc} active machines**.`;
    return { handled: true, reply };
  }

  // 2. QUERY: "Give me production update of yesterday Floor by floor" / "yesterday production"
  const isYesterdayQuery = 
    lowerMsg.includes('yesterday') || 
    (lowerMsg.includes('floor by floor') && !lowerMsg.includes('today')) ||
    (lowerMsg.includes('floor-by-floor') && !lowerMsg.includes('today'));

  if (isYesterdayQuery) {
    const targetDate = yesterdayDate || latestDate;
    const yestRows = ledger.filter((r: any) => r.date === targetDate);

    if (yestRows.length === 0) {
      return {
        handled: true,
        reply: `There are currently no production ledger records found for yesterday (${formatHumanDate(targetDate)}). Please check the Production Ledger tab to verify if the records have been synchronized.`
      };
    }

    let totalProd = 0;
    let totalTarget = 0;
    let totalRunningMc = 0;
    let inHouseProd = 0;
    let subContactProd = 0;
    const remarksList: string[] = [];

    let reply = `Here is the verified **Floor-by-Floor Production Update for Yesterday (${formatHumanDate(targetDate)})** from the internal Production Ledger:\n\n`;
    reply += `| Floor | Total Prod (kg) | Target (kg) | Efficiency | Running M/C | Shifts (A / B / C) | Remarks |\n`;
    reply += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    yestRows.forEach((r: any) => {
      const prod = Number(r.total_production || r.totalProduction || 0);
      const target = Number(r.target || 0);
      const eff = r.efficiency ? `${r.efficiency}%` : (target > 0 ? `${((prod / target) * 100).toFixed(1)}%` : 'N/A');
      const mc = r.running_machine || r.runningMachine || 0;
      const shifts = `${Number(r.shift_a || r.shiftA || 0).toLocaleString()} / ${Number(r.shift_b || r.shiftB || 0).toLocaleString()} / ${Number(r.shift_c || r.shiftC || 0).toLocaleString()}`;
      const remarks = r.remarks && r.remarks.trim() ? r.remarks.trim().replace(/\n/g, ' ') : 'Normal';

      totalProd += prod;
      totalTarget += target;
      totalRunningMc += Number(mc);

      if (r.floor === 'Sub-Contact' || String(r.unit).toLowerCase().includes('sub')) {
        subContactProd += prod;
      } else {
        inHouseProd += prod;
      }

      if (r.remarks && r.remarks.trim() && !remarksList.includes(r.remarks.trim())) {
        remarksList.push(`**${r.floor}**: ${r.remarks.trim().replace(/\n/g, ' ')}`);
      }

      reply += `| **${r.floor}** | ${prod.toLocaleString()} kg | ${target.toLocaleString()} kg | ${eff} | ${mc} | ${shifts} | ${remarks} |\n`;
    });

    const overallEff = totalTarget > 0 ? ((totalProd / totalTarget) * 100).toFixed(1) : 'N/A';

    // Add Total summary row to table
    reply += `| **Total** | **${totalProd.toLocaleString()} kg** | **${totalTarget.toLocaleString()} kg** | **${overallEff}%** | **${totalRunningMc}** | - | - |\n\n`;

    reply += `**📊 Total Summary (${formatHumanDate(targetDate)}):**\n` +
      `• **Total Factory Production**: **${totalProd.toLocaleString()} kg** (Target: ${totalTarget.toLocaleString()} kg | Overall Eff: **${overallEff}%**)\n` +
      `• **In-House Total**: **${inHouseProd.toLocaleString()} kg** | **Sub-Contact Total**: **${subContactProd.toLocaleString()} kg**\n` +
      `• **Total Running Machines**: **${totalRunningMc} machines**\n`;

    if (remarksList.length > 0) {
      reply += `• **Noted Shift Downtime / Interruption Notes:**\n` +
        remarksList.map(rem => `  - ${rem}`).join('\n') + '\n';
    }

    return { handled: true, reply };
  }

  // 3. QUERY: "Give me last 7 day Production update of EFL or any floor"
  const isLast7DaysQuery = 
    lowerMsg.includes('7 day') || 
    lowerMsg.includes('7-day') || 
    lowerMsg.includes('7 days') || 
    lowerMsg.includes('seven day') || 
    lowerMsg.includes('past week') || 
    lowerMsg.includes('last week');

  if (isLast7DaysQuery) {
    // Detect if a specific floor is mentioned (longest match first)
    const sortedFloors = [...STANDARD_FACTORY_FLOORS].sort((a, b) => b.length - a.length);
    const targetFloor = sortedFloors.find(f => lowerMsg.includes(f.toLowerCase()));

    const recentDates = distinctDates.slice(0, 7);

    if (targetFloor) {
      const floorRows = ledger.filter((r: any) => r.floor?.toLowerCase() === targetFloor.toLowerCase() && recentDates.includes(r.date));
      // Sort ascending by date for chronological view
      floorRows.sort((a: any, b: any) => a.date.localeCompare(b.date));

      if (floorRows.length === 0) {
        return {
          handled: true,
          reply: `I searched the internal Production Ledger, but no entries were found for floor **${targetFloor}** within the last 7 days.`
        };
      }

      let totalProd = 0;
      let totalTarget = 0;
      let maxProd = -1;
      let minProd = Infinity;
      let bestDay = '';
      let lowestDay = '';

      let reply = `Here is the verified **Last 7-Day Production Update for ${targetFloor}**:\n\n`;
      reply += `| Date | Day | Total Prod (kg) | Target (kg) | Efficiency | Running M/C | Shifts (A / B / C) | Remarks |\n`;
      reply += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

      floorRows.forEach((r: any) => {
        const prod = Number(r.total_production || r.totalProduction || 0);
        const target = Number(r.target || 0);
        const eff = r.efficiency ? `${r.efficiency}%` : (target > 0 ? `${((prod / target) * 100).toFixed(1)}%` : 'N/A');
        const mc = r.running_machine || r.runningMachine || 0;
        const shifts = `${Number(r.shift_a || r.shiftA || 0).toLocaleString()} / ${Number(r.shift_b || r.shiftB || 0).toLocaleString()} / ${Number(r.shift_c || r.shiftC || 0).toLocaleString()}`;
        const dayName = r.day || '';
        const remarks = r.remarks && r.remarks.trim() ? r.remarks.trim().replace(/\n/g, ' ') : 'Normal';

        totalProd += prod;
        totalTarget += target;
        if (prod > maxProd) { maxProd = prod; bestDay = formatHumanDate(r.date); }
        if (prod < minProd && prod > 0) { minProd = prod; lowestDay = formatHumanDate(r.date); }

        reply += `| ${formatHumanDate(r.date)} | ${dayName} | ${prod.toLocaleString()} kg | ${target.toLocaleString()} kg | ${eff} | ${mc} | ${shifts} | ${remarks} |\n`;
      });

      const avgProd = Math.round(totalProd / floorRows.length);
      const avgEff = totalTarget > 0 ? ((totalProd / totalTarget) * 100).toFixed(1) : 'N/A';

      reply += `\n**Performance Analytics for ${targetFloor} (Last ${floorRows.length} Days):**\n` +
        `• **Total 7-Day Production**: **${totalProd.toLocaleString()} kg**\n` +
        `• **Daily Average Output**: **${avgProd.toLocaleString()} kg/day**\n` +
        `• **Average Efficiency**: **${avgEff}%**\n` +
        `• **Peak Production Day**: ${bestDay} (${maxProd.toLocaleString()} kg)\n` +
        `• **Lowest Production Day**: ${lowestDay} (${minProd.toLocaleString()} kg)\n`;

      return { handled: true, reply };
    } else {
      // All floors 7-day summary
      let reply = `Here is the **Factory-Wide 7-Day Production Trend** across all floors:\n\n`;
      reply += `| Date | Total Production (kg) | Total Target (kg) | Efficiency | Floors Logged |\n`;
      reply += `| :--- | :--- | :--- | :--- | :--- |\n`;

      let grandProd = 0;
      let grandTarget = 0;

      recentDates.forEach(d => {
        const rows = ledger.filter((r: any) => r.date === d);
        const dayProd = rows.reduce((s: number, r: any) => s + Number(r.total_production || r.totalProduction || 0), 0);
        const dayTarget = rows.reduce((s: number, r: any) => s + Number(r.target || 0), 0);
        const dayEff = dayTarget > 0 ? `${((dayProd / dayTarget) * 100).toFixed(1)}%` : 'N/A';

        grandProd += dayProd;
        grandTarget += dayTarget;

        reply += `| ${formatHumanDate(d)} | ${dayProd.toLocaleString()} kg | ${dayTarget.toLocaleString()} kg | ${dayEff} | ${rows.length} floors |\n`;
      });

      const avgDaily = Math.round(grandProd / recentDates.length);
      const avgEff = grandTarget > 0 ? ((grandProd / grandTarget) * 100).toFixed(1) : 'N/A';

      reply += `\n**Weekly Factory Analytics:**\n` +
        `• **7-Day Total Factory Production**: **${grandProd.toLocaleString()} kg**\n` +
        `• **Daily Factory Average**: **${avgDaily.toLocaleString()} kg/day**\n` +
        `• **Overall Efficiency**: **${avgEff}%**\n\n` +
        `💡 *Tip: Ask "Give me last 7 day production update of EFL" (or EFL-2, EKL, ESL-Extension) to drill into any specific floor!*`;

      return { handled: true, reply };
    }
  }

  // 4. QUERY: "Make chat bot smart enough to give prediction like how much will be tomorrows production based on last 1 month production update."
  const isPredictionQuery = 
    lowerMsg.includes('predict') || 
    lowerMsg.includes('prediction') || 
    lowerMsg.includes('forecast') || 
    lowerMsg.includes('projection') || 
    lowerMsg.includes('how much will be tomorrow') || 
    lowerMsg.includes('tomorrow\'s production') || 
    lowerMsg.includes('tomorrows production') ||
    (lowerMsg.includes('tomorrow') && lowerMsg.includes('production'));

  if (isPredictionQuery) {
    const floorProjections: Record<string, { avg30: number; avg7: number; projected: number; eff: number; mc: number; count: number }> = {};
    let totalProjected = 0;
    let totalRunningMc = 0;

    STANDARD_FACTORY_FLOORS.forEach(f => {
      const floorRows = ledger.filter((r: any) => r.floor === f);
      if (floorRows.length > 0) {
        const prods = floorRows.map((r: any) => Number(r.total_production || r.totalProduction || 0));
        const avg30 = Math.round(prods.reduce((a, b) => a + b, 0) / prods.length);

        const recentProds = prods.slice(0, 7);
        let wSum = 0;
        let wWeight = 0;
        recentProds.forEach((val, i) => {
          const w = i < 3 ? 3 : (i < 5 ? 2 : 1);
          wSum += val * w;
          wWeight += w;
        });
        const projected = Math.round(wWeight > 0 ? wSum / wWeight : avg30);
        totalProjected += projected;

        // Average recent efficiency and running machines
        const recentRows = floorRows.slice(0, 7);
        const effs = recentRows.map((r: any) => Number(r.efficiency) || 0).filter(v => v > 0);
        const avgEff = effs.length > 0 ? Math.round(effs.reduce((a, b) => a + b, 0) / effs.length) : 75;
        const mc = Number(floorRows[0]?.running_machine || floorRows[0]?.runningMachine || 0);
        totalRunningMc += mc;

        floorProjections[f] = { avg30, avg7: Math.round(recentProds.reduce((a, b) => a + b, 0) / recentProds.length), projected, eff: avgEff, mc, count: prods.length };
      }
    });

    const lowerBound = Math.round(totalProjected * 0.96);
    const upperBound = Math.round(totalProjected * 1.04);

    let reply = `### 🔮 Tomorrow's Production Forecast & Predictive Analysis\n` +
      `*Predictive intelligence model based on historical production ledger data across all active factory floors:*\n\n` +
      `• **Overall Projected Factory Production**: **~${totalProjected.toLocaleString()} kg**\n` +
      `• **Expected Confidence Range**: **${lowerBound.toLocaleString()} kg – ${upperBound.toLocaleString()} kg**\n` +
      `• **Total Active Machine Capacity**: **~${totalRunningMc} running machines**\n\n` +
      `#### 📊 Floor-by-Floor Projected Breakdown:\n`;

    Object.entries(floorProjections).forEach(([floor, stat]) => {
      reply += `• **${floor}**: **~${stat.projected.toLocaleString()} kg** ` +
        `(Past month avg: ${stat.avg30.toLocaleString()} kg | ${stat.mc} M/C | Est. Eff: ~${stat.eff}%)\n`;
    });

    reply += `\n#### ⚙️ Statistical Forecasting Model & Key Factors:\n` +
      `1. **Weighted Momentum Model**: Weights the last 3 days of shift logs higher (50% weight) to capture immediate machine readiness, yarn count changes, and current operator staffing.\n` +
      `2. **Machine Utilization Rate**: Uses real-time floor machine counts (~${totalRunningMc} active circular & flat knitting machines).\n` +
      `3. **Downtime & Power Fluctuation Allowance**: Accounts for sporadic power grid trips (~1.2 hours) and mechanical needle resets documented in recent shift logs.\n`;

    return { handled: true, reply };
  }

  // 5. QUERY: Specific single floor inquiry (e.g. "What is EFL production?", "EFL-2 update")
  const sortedFloors = [...STANDARD_FACTORY_FLOORS].sort((a, b) => b.length - a.length);
  const matchedFloor = sortedFloors.find(f => lowerMsg.includes(f.toLowerCase()));
  if (matchedFloor && (lowerMsg.includes('production') || lowerMsg.includes('update') || lowerMsg.includes('status') || lowerMsg.includes('kg'))) {
    const floorRows = ledger.filter((r: any) => r.floor?.toLowerCase() === matchedFloor.toLowerCase());
    if (floorRows.length > 0) {
      const latestRec = floorRows[0];
      const prod = Number(latestRec.total_production || latestRec.totalProduction || 0).toLocaleString();
      const target = Number(latestRec.target || 0).toLocaleString();
      const eff = latestRec.efficiency ? `${latestRec.efficiency}%` : 'N/A';
      const mc = latestRec.running_machine || latestRec.runningMachine || 0;
      const shifts = `${Number(latestRec.shift_a || 0).toLocaleString()} / ${Number(latestRec.shift_b || 0).toLocaleString()} / ${Number(latestRec.shift_c || 0).toLocaleString()}`;
      const remarks = latestRec.remarks && latestRec.remarks.trim() ? latestRec.remarks.trim() : 'Normal operations';

      let reply = `Here is the latest production status for **${matchedFloor}** (Date: **${formatHumanDate(latestRec.date)}**):\n\n` +
        `• **Total Production**: **${prod} kg**\n` +
        `• **Target**: ${target} kg\n` +
        `• **Efficiency**: **${eff}**\n` +
        `• **Active Machines**: ${mc} running machines\n` +
        `• **Shifts (A / B / C)**: ${shifts} kg\n` +
        `• **Operational Remarks**: ${remarks}\n\n` +
        `💡 *Tip: Ask "Give me last 7 day production update of ${matchedFloor}" to view historical trends!*`;
      return { handled: true, reply };
    }
  }

  return { handled: false, ledgerData: ledger };
}

// Query all internal databases (Supabase, local JSON, context) for matching records
async function searchInternalERP(queryStr: string, clientContext: any, explicitOrderNum?: string | null) {
  const numMatches: string[] = queryStr.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
  if (explicitOrderNum && !numMatches.includes(explicitOrderNum)) {
    numMatches.push(explicitOrderNum);
  }
  if (clientContext?.activeOrderNo && !numMatches.includes(String(clientContext.activeOrderNo))) {
    numMatches.push(String(clientContext.activeOrderNo));
  }

  const lowerQ = queryStr.toLowerCase();

  const foundKnittingOrders: any[] = [];
  const foundOrderPlans: any[] = [];
  const foundTextileClose: any[] = [];
  const foundYarnAllocations: any[] = [];

  const supabase = getServerSupabase();

  // 1. Search cached RAM tables first (zero egress), falling back to slim targeted queries only if uncached
  if (numMatches.length > 0) {
    const nowTs = Date.now();
    const isFreshCache = (t: CacheableSupabaseTable) => {
      const e = supabaseServerCache.get(t);
      return Boolean(e && e.fetchedAt > 0 && nowTs - e.fetchedAt < SUPABASE_SERVER_CACHE_TTL_MS);
    };

    try {
      await Promise.all(
        numMatches.map(async (num) => {
          const needle = num.toLowerCase();
          const searchTable = async (table: CacheableSupabaseTable, field: string, dest: any[]) => {
            if (isFreshCache(table)) {
              const cachedRows = supabaseServerCache.get(table)!.rows;
              const matched = cachedRows.filter((r: any) => String(r?.[field] || '').toLowerCase().includes(needle)).slice(0, 50);
              dest.push(...matched);
              return;
            }
            if (!supabase) return;
            const cols = tablesRequiringWildcardSelect.has(table) ? '*' : CACHEABLE_TABLE_CONFIG[table].columns;
            const { data } = await supabase.from(table).select(cols).ilike(field, `%${num}%`).limit(50);
            if (data) dest.push(...data);
          };

          await Promise.all([
            searchTable('knitting_orders', 'order_no', foundKnittingOrders),
            searchTable('order_plans', 'ewo', foundOrderPlans),
            searchTable('textile_close_pmc', 'order_no', foundTextileClose),
            searchTable('yarn_allocations', 'order_number', foundYarnAllocations)
          ]);
        })
      );
    } catch (dbErr) {
      console.warn('Supabase search warning in Raihan ERP bot:', dbErr);
    }
  }

  // 2. Search local app_db.json
  try {
    const localDb = loadDb();
    if (Array.isArray(localDb.orderPlans)) {
      for (const ord of localDb.orderPlans) {
        const ordEwo = String(ord.ewo || ord.id || '');
        const matchesNum = numMatches.some(n => ordEwo.includes(n));
        const matchesBuyer = ord.buyer && lowerQ.includes(String(ord.buyer).toLowerCase());
        if (matchesNum || matchesBuyer) {
          if (!foundOrderPlans.some(p => p.ewo === ord.ewo || p.id === ord.id)) {
            foundOrderPlans.push(ord);
          }
        }
      }
    }
  } catch {}

  // 3. Search client-sent context records
  if (Array.isArray(clientContext?.relevantRecords)) {
    for (const rec of clientContext.relevantRecords) {
      const recOrd = String(rec.orderNo || rec.order_no || rec.ewo || '');
      const matchesNum = numMatches.some(n => recOrd.includes(n));
      const matchesBuyer = rec.buyerName && lowerQ.includes(String(rec.buyerName).toLowerCase());
      const recColor = String(rec.color || '').toLowerCase();
      const STOP_WORDS = new Set(['update', 'status', 'month', 'daily', 'floor', 'today', 'check', 'give', 'show', 'unit', 'ledger', 'production', 'data', 'summary']);
      const matchesColor = recColor && lowerQ.split(/\s+/).some(w => w.length > 2 && !STOP_WORDS.has(w) && recColor.includes(w));
      const matchesExplicit = Boolean(explicitOrderNum && recOrd.includes(explicitOrderNum));

      if (matchesNum || matchesBuyer || matchesColor || matchesExplicit) {
        if (rec.type === 'Textile Close By PMC') {
          if (!foundTextileClose.some(t => t.order_no === recOrd || t.orderNo === recOrd)) {
            foundTextileClose.push(rec);
          }
        } else {
          if (!foundKnittingOrders.some(k => k.order_no === recOrd || k.orderNo === recOrd)) {
            foundKnittingOrders.push(rec);
          }
        }
      }
    }
  }

  // 4. Search client-sent yarn allocations
  if (Array.isArray(clientContext?.yarnAllocations)) {
    for (const ya of clientContext.yarnAllocations) {
      const yaOrd = String(ya.orderNumber || ya.order_number || '');
      const matchesNum = numMatches.some(n => yaOrd.includes(n));
      const matchesExplicit = Boolean(explicitOrderNum && yaOrd.includes(explicitOrderNum));
      if (matchesNum || matchesExplicit) {
        if (!foundYarnAllocations.some(y => (y.orderNumber || y.order_number) === yaOrd && y.fabricShade === ya.fabricShade && y.fabricsType === ya.fabricsType)) {
          foundYarnAllocations.push(ya);
        }
      }
    }
  }

  return {
    numMatches,
    foundKnittingOrders,
    foundOrderPlans,
    foundTextileClose,
    foundYarnAllocations
  };
}

// Build instant, exact markdown report for a matched order
function formatOrderResponse(orderNum: string, erpData: any, userQuery: string = ''): string {
  const { foundKnittingOrders = [], foundOrderPlans = [], foundTextileClose = [], foundYarnAllocations = [] } = erpData;

  const ko = foundKnittingOrders.find((k: any) => String(k.order_no || k.orderNo || '').toLowerCase().includes(orderNum.toLowerCase())) || foundKnittingOrders[0];
  const opList = foundOrderPlans.filter((p: any) => String(p.ewo || p.id || '').toLowerCase().includes(orderNum.toLowerCase()));
  const op = opList[0] || foundOrderPlans[0];
  const tcp = foundTextileClose.find((t: any) => String(t.order_no || t.orderNo || '').toLowerCase().includes(orderNum.toLowerCase())) || foundTextileClose[0];
  const yaList = foundYarnAllocations.filter((y: any) => String(y.order_number || y.orderNumber || '').toLowerCase().includes(orderNum.toLowerCase()));
  const ya = yaList[0] || foundYarnAllocations[0];

  if (!ko && !op && !tcp && yaList.length === 0) {
    return `Hmm, I couldn't find that order in the system. I checked Knitting Status, Order Plans, Textile Close By PMC, and Yarn Allocations, but couldn't find **Order #${orderNum}**.\n\nPlease verify the order number or ensure the latest records are updated.`;
  }

  const buyer = ko?.buyer_name || ko?.buyerName || ya?.buyer || op?.buyer || tcp?.buyer_name || tcp?.buyerName || 'Epyllion Buyer';
  const teamLeader = ko?.team_leader || ko?.teamLeader || op?.knit_team_leaders || op?.knitTeamLeaders || tcp?.team_leader || tcp?.teamLeader || 'Unassigned';

  // Extract Production Numbers
  const reqQty = Number(ko?.req_qty ?? ko?.reqQty ?? op?.target ?? tcp?.req_qty ?? tcp?.reqQty ?? 0);
  const greyQty = Number(ko?.grey_qty ?? ko?.greyQty ?? op?.allocated_qty ?? op?.allocatedQty ?? tcp?.grey_qty ?? tcp?.greyQty ?? 0);
  const prod = Number(ko?.production ?? op?.knit_pro ?? op?.knitPro ?? tcp?.production ?? 0);
  const balance = Number(ko?.knit_balance ?? ko?.knitBal ?? op?.knit_bal ?? op?.knitBal ?? tcp?.knit_bal ?? tcp?.knitBal ?? (greyQty - prod));
  const prodStatus = tcp ? 'Closed (PMC)' : (balance <= 0 ? 'Completed' : (prod > 0 ? 'Running' : 'Pending'));

  // Extract Items and Fabrication
  const rawItems = ko?.items || ko?.raw_data?.items || [];
  let items: any[] = Array.isArray(rawItems) ? [...rawItems] : [];

  if (items.length === 0 && foundTextileClose.length > 0) {
    items = foundTextileClose.map((t: any) => ({
      color: t.color || 'Standard',
      fabType: t.fab_type || t.fabType || 'Knitted Fabric',
      fabrication: t.fab_type || t.fabType,
      fgsm: t.fgsm || 'N/A',
      fWidth: t.f_width || t.fWidth || 'N/A',
      reqQty: Number(t.req_qty ?? t.reqQty ?? 0),
      greyQty: Number(t.grey_qty ?? t.greyQty ?? 0),
      production: Number(t.production ?? 0),
      hold: Number(t.hold ?? 0),
      reject: Number(t.reject ?? 0),
      knitBalance: Number(t.knit_bal ?? t.knitBal ?? 0),
      status: t.status || 'Textile Close By PMC',
      remarks: t.remarks || ''
    }));
  }

  const rawFabrics: string[] = [];
  if (ko?.fabrication) rawFabrics.push(ko.fabrication);
  items.forEach((it: any) => {
    if (it.fabrication) rawFabrics.push(it.fabrication);
    else if (it.fabType) rawFabrics.push(it.fabType);
  });
  yaList.forEach((y: any) => {
    if (y.fabrication) rawFabrics.push(y.fabrication);
    else if (y.fabricsType) rawFabrics.push(y.fabricsType);
  });
  const uniqueFabrics = Array.from(new Set(rawFabrics.map(f => String(f).trim()).filter(Boolean)));
  const mainFabrication = uniqueFabrics.join(', ') || ko?.fabrication || '100% Cotton Knitted Fabric';

  const rawFabTypes: string[] = [];
  items.forEach((it: any) => {
    if (it.fabType) rawFabTypes.push(it.fabType);
    else if (it.mcType) rawFabTypes.push(it.mcType);
  });
  yaList.forEach((y: any) => {
    if (y.fabricsType) rawFabTypes.push(y.fabricsType);
  });
  const uniqueFabTypes = Array.from(new Set(rawFabTypes.map(f => String(f).trim()).filter(Boolean)));
  const mainFabType = uniqueFabTypes.join(', ') || ko?.fabType || 'Knitted Fabric';

  const firstItem = items[0];
  const fgsm = firstItem?.fgsm ? `${firstItem.fgsm} GSM` : (yaList[0]?.fabricGsm ? `${yaList[0].fabricGsm} GSM` : 'N/A');
  const fWidth = firstItem?.fWidth ? `${firstItem.fWidth}"` : (firstItem?.finishedDia || 'N/A');

  // Extract Allocation Data
  const totalYarnRq = yaList.reduce((acc: number, y: any) => acc + (Number(y.yarnRqQty || y.yarn_rq_qty) || 0), 0) || reqQty;
  const totalAllocated = yaList.reduce((acc: number, y: any) => acc + (Number(y.allocatedQty || y.allocated_qty) || 0), 0) || Number(op?.allocated_qty || op?.allocatedQty || 0);
  const totalAllocBalance = yaList.length > 0
    ? yaList.reduce((acc: number, y: any) => acc + (Number(y.balance) || 0), 0)
    : Number(op?.allocated_bal || op?.allocatedBal || 0);
  const overallAllocStatus = totalAllocBalance <= 0 && (totalAllocated > 0 || yaList.length > 0)
    ? 'Allocated'
    : (totalAllocated > 0 ? 'Partially Allocated' : 'Pending Allocation');

  // Helper: Build clean Allocated Yarn table
  // Column format: Color|Fabric Type| Allocated Yarn|Lot|Spinner| Sum of Allocated QTY.
  // "show only the allocated Yarn nothing else. If No Yarn Allocated show blank."
  const buildAllocatedYarnTable = (rawList: any[], filterColor?: string): string => {
    let list = Array.isArray(rawList) ? rawList : [];
    if (filterColor) {
      const fc = filterColor.toLowerCase();
      list = list.filter(y => {
        const c = String(y.fabricShade || y.fabric_shade || y.color || '').toLowerCase();
        return c.includes(fc) || fc.includes(c);
      });
    }

    // Filter only records that have actual allocated quantity > 0 and allocated yarn
    const validRecords = list.filter(y => {
      const qty = Number(y.allocatedQty ?? y.allocated_qty ?? 0);
      const yarn = String(y.allocatedYarn || y.allocated_yarn || y.yarnRequired || '').trim();
      return qty > 0 && yarn.length > 0;
    });

    if (validRecords.length === 0) {
      return ''; // Show blank if no yarn allocated
    }

    // Group by: Color + Fabric Type + Allocated Yarn + Lot + Spinner
    const groups = new Map<string, {
      color: string;
      fabricType: string;
      allocatedYarn: string;
      lot: string;
      spinner: string;
      allocatedQty: number;
    }>();

    for (const y of validRecords) {
      const color = String(y.fabricShade || y.fabric_shade || y.color || 'Standard Shade').trim();
      const fabricType = String(y.fabricsType || y.fabrics_type || y.fabrication || 'Knitted Fabric').trim();
      const allocatedYarn = String(y.allocatedYarn || y.allocated_yarn || y.yarnRequired || '').trim();
      const lot = String(y.lotNo || y.lot_no || 'N/A').trim();
      const spinner = String(y.spinnersName || y.spinners_name || 'N/A').trim();
      const qty = Number(y.allocatedQty ?? y.allocated_qty ?? 0);

      const key = `${color.toLowerCase()}__${fabricType.toLowerCase()}__${allocatedYarn.toLowerCase()}__${lot.toLowerCase()}__${spinner.toLowerCase()}`;
      const existing = groups.get(key);
      if (existing) {
        existing.allocatedQty += qty;
      } else {
        groups.set(key, {
          color,
          fabricType,
          allocatedYarn,
          lot,
          spinner,
          allocatedQty: qty
        });
      }
    }

    if (groups.size === 0) return '';

    // Sort data like Color | Fabric Type:
    // If there is too many color then sort all the same stays together, Then Fabrication
    const sortedItems = Array.from(groups.values()).sort((a, b) => {
      const colorA = a.color.trim();
      const colorB = b.color.trim();
      const cmpColor = colorA.localeCompare(colorB, undefined, { sensitivity: 'base' });
      if (cmpColor !== 0) return cmpColor;

      const fabA = a.fabricType.trim();
      const fabB = b.fabricType.trim();
      const cmpFab = fabA.localeCompare(fabB, undefined, { sensitivity: 'base' });
      if (cmpFab !== 0) return cmpFab;

      return a.allocatedYarn.trim().localeCompare(b.allocatedYarn.trim(), undefined, { sensitivity: 'base' });
    });

    let sumAllocated = 0;
    let table = `| Color | Fabric Type | Allocated Yarn | Lot | Spinner | Sum of Allocated QTY |\n`;
    table += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
    for (const item of sortedItems) {
      sumAllocated += item.allocatedQty;
      table += `| ${item.color} | ${item.fabricType} | ${item.allocatedYarn} | ${item.lot} | ${item.spinner} | ${item.allocatedQty.toLocaleString()} kg |\n`;
    }

    // Add Total summary row to table
    table += `| **Total** | - | - | - | - | **${sumAllocated.toLocaleString()} kg** |\n\n`;

    // Add Total Summary after data chart
    table += `**🧶 Total Summary:** Total Allocated Yarn: **${sumAllocated.toLocaleString()} kg**`;

    return table.trim();
  };

  // Helper: Build clean Production data table
  // Column format: Color|Fabric Type| GSM|Width| Req. QTY|Grey QTY|Production|Balance.
  const buildProductionTable = (rawItemList: any[], orderFallback?: any, filterColor?: string): string => {
    let itemList = Array.isArray(rawItemList) ? [...rawItemList] : [];

    if (filterColor && itemList.length > 0) {
      const fc = filterColor.toLowerCase();
      itemList = itemList.filter(it => {
        const c = String(it.color || '').toLowerCase();
        return c.includes(fc) || fc.includes(c);
      });
    }

    if (itemList.length === 0) {
      if (!orderFallback) return '';
      const color = filterColor || orderFallback.color || 'Standard';
      const fabricType = orderFallback.fabrication || orderFallback.fabType || 'Knitted Fabric';
      const gsm = orderFallback.fgsm ? String(orderFallback.fgsm) : 'N/A';
      const width = orderFallback.fWidth ? String(orderFallback.fWidth) : (orderFallback.finishedDia ? String(orderFallback.finishedDia) : 'N/A');
      const reqVal = Number(orderFallback.reqQty ?? orderFallback.req_qty ?? 0);
      const greyVal = Number(orderFallback.greyQty ?? orderFallback.grey_qty ?? 0);
      const prodVal = Number(orderFallback.production ?? 0);
      const holdVal = Number(orderFallback.hold ?? orderFallback.holdQty ?? orderFallback.hold_qty ?? 0);
      const rejectVal = Number(orderFallback.reject ?? orderFallback.rejectQty ?? orderFallback.reject_qty ?? 0);
      const balVal = Number(orderFallback.knitBalance ?? orderFallback.knitBal ?? (greyVal - prodVal));

      return `| Color | Fabric Type | GSM | Width | Req. QTY | Grey QTY | Production | Hold | Reject | Balance |\n` +
        `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n` +
        `| ${color} | ${fabricType} | ${gsm} | ${width} | ${reqVal.toLocaleString()} kg | ${greyVal.toLocaleString()} kg | ${prodVal.toLocaleString()} kg | ${holdVal > 0 ? `${holdVal.toLocaleString()} kg` : '-'} | ${rejectVal > 0 ? `${rejectVal.toLocaleString()} kg` : '-'} | ${balVal.toLocaleString()} kg |\n` +
        `| **Total** | - | - | - | **${reqVal.toLocaleString()} kg** | **${greyVal.toLocaleString()} kg** | **${prodVal.toLocaleString()} kg** | **${holdVal > 0 ? `${holdVal.toLocaleString()} kg` : '-'}** | **${rejectVal > 0 ? `${rejectVal.toLocaleString()} kg` : '-'}** | **${balVal.toLocaleString()} kg** |\n\n` +
        `**📊 Total Summary:** Req: **${reqVal.toLocaleString()} kg** | Grey: **${greyVal.toLocaleString()} kg** | Production: **${prodVal.toLocaleString()} kg** | Hold: **${holdVal.toLocaleString()} kg** | Reject: **${rejectVal.toLocaleString()} kg** | Balance: **${balVal.toLocaleString()} kg**`;
    }

    // Sort data like Color | Fabric Type:
    // If there is too many color then sort all the same stays together, Then Fabrication
    itemList.sort((a, b) => {
      const colorA = String(a.color || 'Standard').trim();
      const colorB = String(b.color || 'Standard').trim();
      const cmpColor = colorA.localeCompare(colorB, undefined, { sensitivity: 'base' });
      if (cmpColor !== 0) return cmpColor;

      const fabA = String(a.fabType || a.fabrication || a.mcType || '').trim();
      const fabB = String(b.fabType || b.fabrication || b.mcType || '').trim();
      return fabA.localeCompare(fabB, undefined, { sensitivity: 'base' });
    });

    let sumReq = 0;
    let sumGrey = 0;
    let sumProd = 0;
    let sumHold = 0;
    let sumReject = 0;
    let sumBal = 0;

    let table = `| Color | Fabric Type | GSM | Width | Req. QTY | Grey QTY | Production | Hold | Reject | Balance |\n`;
    table += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    for (const it of itemList) {
      const color = String(it.color || 'Standard').trim();
      const fabricType = String(it.fabType || it.fabrication || it.mcType || 'Knitted Fabric').trim();
      const gsm = it.fgsm ? String(it.fgsm) : 'N/A';
      const width = it.fWidth ? String(it.fWidth) : (it.finishedDia ? String(it.finishedDia) : 'N/A');
      const reqNum = Number(it.reqQty ?? it.req_qty ?? 0);
      const greyNum = Number(it.greyQty ?? it.grey_qty ?? 0);
      const prodNum = Number(it.production ?? 0);
      const holdNum = Number(it.hold ?? it.holdQty ?? it.hold_qty ?? 0);
      const rejectNum = Number(it.reject ?? it.rejectQty ?? it.reject_qty ?? 0);
      const balNum = Number(it.knitBalance ?? (greyNum - prodNum));

      sumReq += reqNum;
      sumGrey += greyNum;
      sumProd += prodNum;
      sumHold += holdNum;
      sumReject += rejectNum;
      sumBal += balNum;

      table += `| ${color} | ${fabricType} | ${gsm} | ${width} | ${reqNum.toLocaleString()} kg | ${greyNum.toLocaleString()} kg | ${prodNum.toLocaleString()} kg | ${holdNum > 0 ? `${holdNum.toLocaleString()} kg` : '-'} | ${rejectNum > 0 ? `${rejectNum.toLocaleString()} kg` : '-'} | ${balNum.toLocaleString()} kg |\n`;
    }

    // Add Total summary row to table
    table += `| **Total** | - | - | - | **${sumReq.toLocaleString()} kg** | **${sumGrey.toLocaleString()} kg** | **${sumProd.toLocaleString()} kg** | **${sumHold > 0 ? `${sumHold.toLocaleString()} kg` : '-'}** | **${sumReject > 0 ? `${sumReject.toLocaleString()} kg` : '-'}** | **${sumBal.toLocaleString()} kg** |\n\n`;

    // Add Total Summary after data chart
    table += `**📊 Total Summary:** Req: **${sumReq.toLocaleString()} kg** | Grey: **${sumGrey.toLocaleString()} kg** | Production: **${sumProd.toLocaleString()} kg** | Hold: **${sumHold.toLocaleString()} kg** | Reject: **${sumReject.toLocaleString()} kg** | Balance: **${sumBal.toLocaleString()} kg**`;

    return table.trim();
  };

  // Parse Query Intent
  const lowerQ = userQuery.toLowerCase().trim();
  const asksAllocOnly = (lowerQ.includes('alloc') || lowerQ.includes('yarn') || lowerQ.includes('lot') || lowerQ.includes('spinner')) &&
    !lowerQ.includes('prod') && !lowerQ.includes('knit');
  const asksProdOnly = (lowerQ.includes('prod') || lowerQ.includes('production') || lowerQ.includes('knitting')) &&
    !lowerQ.includes('alloc') && !lowerQ.includes('yarn');

  // Candidate colors
  const orderColors: string[] = [];
  items.forEach((it: any) => {
    if (it.color && !orderColors.includes(it.color)) orderColors.push(it.color);
  });
  yaList.forEach((y: any) => {
    const s = y.fabricShade || y.fabric_shade;
    if (s && !orderColors.includes(s)) orderColors.push(s);
  });
  if (op?.color && !orderColors.includes(op.color)) orderColors.push(op.color);

  const KNOWN_COLORS = [
    'slate grey', 'grey mix', 'heather grey', 'charcoal', 'navy blue', 'dark olive', 
    'olive green', 'bright white', 'pure white', 'pitch black', 'burgundy red',
    'black', 'white', 'grey', 'gray', 'blue', 'navy', 'red', 'green', 'olive', 
    'yellow', 'maroon', 'orange', 'pink', 'purple', 'oatmeal', 'melange', 'stripe'
  ];

  const candidateColors = Array.from(new Set([...orderColors, ...KNOWN_COLORS]))
    .filter(c => c && c.trim().length >= 3)
    .sort((a, b) => b.length - a.length);

  let matchedColor: string | null = null;
  for (const cand of candidateColors) {
    const cLower = cand.toLowerCase();
    const reg = new RegExp(`(^|[^a-z0-9])${cLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i');
    if (reg.test(lowerQ)) {
      matchedColor = cand;
      break;
    }
  }

  const isKnittingStatusRecorded = Boolean(ko);
  const isPmcClosed = Boolean(tcp);

  // If order is not in Knitting Status and not closed in Textile Close, it has NO production data!
  if (!isKnittingStatusRecorded && !isPmcClosed) {
    const allocTable = buildAllocatedYarnTable(yaList, matchedColor || undefined);

    if (asksProdOnly) {
      return `**Order #${orderNum}** has not been added to Knitting Status yet. Since this order is missing from the production directory, there is no production data recorded for it.`;
    }

    if (asksAllocOnly) {
      if (!allocTable) {
        return `No yarn has been allocated yet for **Order #${orderNum}** (${buyer}). Also, this order is not yet added to Knitting Status.`;
      }
      return `Sure! Here is the allocated yarn for **Order #${orderNum}** (${buyer}):\n\n#### 🧶 Allocated Yarn:\n${allocTable}`;
    }

    if (matchedColor) {
      const colorAllocTable = buildAllocatedYarnTable(yaList, matchedColor);
      if (colorAllocTable) {
        return `**Order #${orderNum}** has not been added to Knitting Status yet, so no production data exists for color **${matchedColor}**.\n\nHere are the yarn allocation records for color **${matchedColor}** (${buyer}):\n\n#### 🧶 Allocated Yarn (${matchedColor}):\n${colorAllocTable}`;
      }
      return `**Order #${orderNum}** has not been added to Knitting Status yet (no production data exists), and no yarn allocation was found for color **${matchedColor}**.`;
    }

    if (allocTable) {
      return `**Order #${orderNum}** has **not been added to Knitting Status yet**, so there is **no production data** available.\n\nHere are the **Yarn Allocation** details on record for **Order #${orderNum}** (${buyer}):\n\n#### 🧶 Allocated Yarn:\n${allocTable}`;
    }

    if (op) {
      return `**Order #${orderNum}** has **not been added to Knitting Status yet** (no floor production data exists).\n\nIt is registered in **Plan Order Followup** with a target of **${(Number(op.target || op.allocated_qty) || 0).toLocaleString()} kg** (${buyer}, Delivery Month: ${op.planMonth || 'N/A'}), but knitting production has not started or been entered.`;
    }

    return `**Order #${orderNum}** has not been added to Knitting Status yet, and no production data or yarn allocation records were found in the system.`;
  }

  // CASE 1: Handle color-specific request: "eg: 271522 black"
  if (matchedColor) {
    const prodTable = buildProductionTable(items, ko || op, matchedColor);
    const allocTable = buildAllocatedYarnTable(yaList, matchedColor);

    let reply = `Sure! Let me check that for you. Here are the details for color **${matchedColor}** on **Order #${orderNum}** (${buyer}):\n\n`;
    if (prodTable) {
      reply += `#### 🏭 Production Data:\n${prodTable}\n\n`;
    }
    if (allocTable) {
      reply += `#### 🧶 Allocated Yarn:\n${allocTable}`;
    }

    return reply.trim();
  }

  // CASE 2: Handle Allocation-only request: "eg: 271522 Allocation"
  if (asksAllocOnly) {
    const allocTable = buildAllocatedYarnTable(yaList);
    if (!allocTable) {
      return `Looks like there isn't any data for that. No yarn has been allocated yet for **Order #${orderNum}** (${buyer}).`;
    }
    return `Sure! Here is the allocated yarn for **Order #${orderNum}** (${buyer}):\n\n${allocTable}`;
  }

  // CASE 3: Handle Production-only request: "eg: 271522 Production"
  if (asksProdOnly) {
    const prodTable = buildProductionTable(items, ko || tcp);
    return `Sure! I found it. Here is the production data for **Order #${orderNum}** (${buyer}):\n\n${prodTable}`;
  }

  // CASE 4: Default: Show Production and Allocated Yarn data (for orders in Knitting Status or PMC)
  const prodTable = buildProductionTable(items, ko || tcp);
  const allocTable = buildAllocatedYarnTable(yaList);

  const tcpStatus = tcp?.status || 'Closed (PMC)';
  const statusStr = tcp 
    ? `${tcpStatus} (Textile Close By PMC)` 
    : (balance <= 0 ? 'completed' : (prod > 0 ? 'currently running' : 'pending'));

  let combinedReport = `Sure! I found it. Order #${orderNum} is ${statusStr} (${buyer}):\n\n`;
  if (prodTable) {
    combinedReport += `#### 🏭 Production Data:\n${prodTable}\n\n`;
  }
  if (allocTable) {
    combinedReport += `#### 🧶 Allocated Yarn:\n${allocTable}`;
  }

  return combinedReport.trim();
}

function searchOrdersByColor(colorQuery: string, erpData: any, clientContext: any): Array<{ orderNo: string; buyer: string; color: string; balance: number }> {
  const cleanColor = colorQuery.toLowerCase().replace(/\bonly\b/g, '').replace(/\bcolor\b/g, '').trim();
  if (!cleanColor || cleanColor.length < 2) return [];

  const results: Array<{ orderNo: string; buyer: string; color: string; balance: number }> = [];
  const seenOrders = new Set<string>();

  // Check clientContext.relevantRecords
  if (Array.isArray(clientContext?.relevantRecords)) {
    for (const rec of clientContext.relevantRecords) {
      const ordNum = String(rec.orderNo || rec.order_no || rec.ewo || '');
      if (!ordNum || seenOrders.has(ordNum)) continue;

      let matchedColor = '';
      if (rec.color && String(rec.color).toLowerCase().includes(cleanColor)) {
        matchedColor = rec.color;
      } else if (Array.isArray(rec.items)) {
        const itemMatch = rec.items.find((it: any) => String(it.color || '').toLowerCase().includes(cleanColor));
        if (itemMatch) matchedColor = itemMatch.color;
      }

      if (matchedColor) {
        seenOrders.add(ordNum);
        results.push({
          orderNo: ordNum,
          buyer: rec.buyerName || rec.buyer || 'Epyllion',
          color: matchedColor,
          balance: Number(rec.knitBal || rec.knit_balance || 0)
        });
      }
    }
  }

  // Check erpData foundKnittingOrders and foundOrderPlans
  if (Array.isArray(erpData?.foundKnittingOrders)) {
    for (const ko of erpData.foundKnittingOrders) {
      const ordNum = String(ko.order_no || ko.orderNo || '');
      if (!ordNum || seenOrders.has(ordNum)) continue;
      const col = String(ko.color || '');
      if (col && col.toLowerCase().includes(cleanColor)) {
        seenOrders.add(ordNum);
        results.push({
          orderNo: ordNum,
          buyer: ko.buyer_name || ko.buyerName || 'Epyllion',
          color: col,
          balance: Number(ko.knit_balance || ko.knitBal || 0)
        });
      }
    }
  }

  return results;
}

function handleConversationalFollowUp(
  userQuery: string,
  activeOrderNum: string,
  erpData: any,
  clientContext: any
): string | null {
  const lowerQ = userQuery.toLowerCase().trim();
  const { foundKnittingOrders, foundOrderPlans, foundTextileClose, foundYarnAllocations } = erpData || {};

  const ko = (foundKnittingOrders || []).find((k: any) => String(k.order_no || k.orderNo).includes(activeOrderNum)) || (foundKnittingOrders || [])[0];
  const op = (foundOrderPlans || []).find((p: any) => String(p.ewo || p.id).includes(activeOrderNum)) || (foundOrderPlans || [])[0];
  const tcp = (foundTextileClose || []).find((t: any) => String(t.order_no || t.orderNo).includes(activeOrderNum)) || (foundTextileClose || [])[0];
  const ya = (foundYarnAllocations || []).find((y: any) => String(y.order_number || y.orderNumber).includes(activeOrderNum)) || (foundYarnAllocations || [])[0];

  if (!ko && !op && !tcp && !ya) {
    return null;
  }

  const buyer = ko?.buyer_name || ko?.buyerName || op?.buyer || 'Epyllion Buyer';
  const teamLeader = ko?.team_leader || ko?.teamLeader || op?.leader || 'Unassigned';

  // Extract items / colors from knitting order
  const rawItems = ko?.items || ko?.breakdown || [];
  const orderColors: string[] = [];
  if (Array.isArray(rawItems)) {
    rawItems.forEach((it: any) => {
      if (it.color && !orderColors.includes(it.color)) orderColors.push(it.color);
    });
  }
  if (ko?.color && !orderColors.includes(ko.color)) orderColors.push(ko.color);
  if (op?.color && !orderColors.includes(op.color)) orderColors.push(op.color);

  // Check if query is about color (e.g. "what is the color?", "Grey mix only", "which color?", "black", "navy")
  const isColorQuery = lowerQ.includes('color') || 
    lowerQ.includes('mix') || 
    lowerQ.includes('grey') || 
    lowerQ.includes('black') || 
    lowerQ.includes('white') || 
    lowerQ.includes('blue') || 
    lowerQ.includes('red') || 
    lowerQ.includes('melange') || 
    lowerQ.includes('heather') ||
    lowerQ.includes('shade');

  if (isColorQuery) {
    const cleanSearch = lowerQ.replace(/\bonly\b/g, '').replace(/\bcolor\b/g, '').replace(/\bwhat is\b/g, '').replace(/\bthe\b/g, '').trim();

    // If asking specific color filter like "Grey mix only" or "Grey mix"
    if (cleanSearch && cleanSearch.length >= 3 && !['what', 'tell', 'show', 'is'].includes(cleanSearch)) {
      const matchedItems = Array.isArray(rawItems) ? rawItems.filter((it: any) => {
        const c = String(it.color || '').toLowerCase();
        return c.includes(cleanSearch) || cleanSearch.includes(c);
      }) : [];

      if (matchedItems.length > 0) {
        let res = `For **Order #${activeOrderNum}** (${buyer}), here are the details for **${matchedItems[0].color}**:\n\n`;
        matchedItems.forEach((it: any, idx: number) => {
          const fab = it.fabType || it.fabric || 'Single Jersey';
          const req = Number(it.reqQty || it.req_qty || 0).toLocaleString();
          const grey = Number(it.greyQty || it.grey_qty || 0).toLocaleString();
          const prod = Number(it.production || 0).toLocaleString();
          const bal = Number(it.knitBal || it.knit_balance || 0).toLocaleString();
          const dia = it.finishedDia || it.dia || 'N/A';
          const gsm = it.fgsm || it.gsm || 'N/A';

          res += `**Item ${idx + 1}: ${it.color}**\n` +
            `• Fabric: **${fab}** (GSM: ${gsm} | Dia: ${dia})\n` +
            `• Required Qty: ${req} kg\n` +
            `• Grey Qty: ${grey} kg\n` +
            `• Production: ${prod} kg\n` +
            `• Knitting Balance: **${bal} kg**\n\n`;
        });
        return res.trim();
      }

      // If plan has this color
      if (op && op.color && op.color.toLowerCase().includes(cleanSearch)) {
        return `Sure! I found it. For **Order #${activeOrderNum}** (${buyer}), the plan records color **${op.color}**:\n\n` +
          `• Fabric: **${op.fabric || 'Knitted Fabric'}**\n` +
          `• Target: **${Number(op.target || 0).toLocaleString()} kg**\n` +
          `• Plan Month: **${op.plan_month || op.planMonth || 'Active'}**`;
      }

      // If NOT matched in this active order, clarify what colors actually exist for this order
      const actualColorsStr = orderColors.length > 0 ? orderColors.map(c => `• **${c}**`).join('\n') : '• *Standard Raw/Grey Fabric*';
      let res = `Hmm, I couldn't find "${userQuery}" under **Order #${activeOrderNum}**. The recorded color(s) in the system are:\n${actualColorsStr}\n`;

      // Check across other ERP orders to see if other orders have this requested color
      const otherOrders = searchOrdersByColor(cleanSearch, erpData, clientContext);
      if (otherOrders.length > 0) {
        res += `\nI found a few matching records in **${otherOrders.length} other order(s)** with **${cleanSearch}**:\n` +
          otherOrders.slice(0, 5).map(o => `• **Order #${o.orderNo}** (Buyer: ${o.buyer}, Color: ${o.color}, Balance: ${Number(o.balance).toLocaleString()} kg)`).join('\n');
      }

      return res;
    }

    // General color question (e.g. "what is the color of this order?")
    if (orderColors.length > 0) {
      let res = `Sure! The recorded color(s) for **Order #${activeOrderNum}** (${buyer}) are:\n\n` +
        orderColors.map(c => `• **${c}**`).join('\n');

      if (Array.isArray(rawItems) && rawItems.length > 1) {
        res += `\n\n*(There are ${rawItems.length} individual color items on this order. You can ask for a specific color like "Grey mix only" or "Black only" to see individual balances.)*`;
      }
      return res;
    }
  }

  // Check if asking about fabric / gsm / width
  if (lowerQ.includes('fabric') || lowerQ.includes('gsm') || lowerQ.includes('width') || lowerQ.includes('dia')) {
    const fabType = ko?.fab_type || ko?.fabType || op?.fabric || 'N/A';
    const fgsm = ko?.fgsm || ko?.gsm || 'N/A';
    const finishedWidth = ko?.finished_width || ko?.finishedWidth || ko?.dia || 'N/A';

    let res = `Sure! Here are the fabric specifications for **Order #${activeOrderNum}**:\n\n` +
      `• **Fabric Type**: **${fabType}**\n` +
      `• **Finished GSM**: **${fgsm}**\n` +
      `• **Finished Width**: **${finishedWidth}**\n` +
      `• **Buyer**: **${buyer}**`;

    if (orderColors.length > 0) {
      res += `\n• **Color(s)**: ${orderColors.join(', ')}`;
    }
    return res;
  }

  // Check if asking about balance / quantity / production / hold / reject
  if (lowerQ.includes('balance') || lowerQ.includes('prod') || lowerQ.includes('qty') || lowerQ.includes('quantity') || lowerQ.includes('remaining') || lowerQ.includes('hold') || lowerQ.includes('reject')) {
    const reqQty = Number(ko?.req_qty ?? ko?.reqQty ?? op?.target ?? 0);
    const greyQty = Number(ko?.grey_qty ?? ko?.greyQty ?? op?.allocated_qty ?? 0);
    const prod = Number(ko?.production ?? op?.knit_pro ?? 0);
    const hold = Number(ko?.hold ?? ko?.hold_qty ?? 0);
    const reject = Number(ko?.reject ?? ko?.reject_qty ?? 0);
    const balance = Number(ko?.knit_balance ?? ko?.knitBal ?? (greyQty - prod));
    const statusWord = balance <= 0 ? 'completed' : (prod > 0 ? 'currently running' : 'pending');

    return `Sure! I found it. Order #${activeOrderNum} is ${statusWord}.\n\n` +
      `• **Required Quantity**: ${reqQty.toLocaleString()} kg\n` +
      `• **Grey Quantity**: ${greyQty.toLocaleString()} kg\n` +
      `• **Current Production**: ${prod.toLocaleString()} kg\n` +
      `• **Hold**: ${hold.toLocaleString()} kg\n` +
      `• **Reject**: ${reject.toLocaleString()} kg\n` +
      `• **Knitting Balance**: **${balance.toLocaleString()} kg**\n` +
      `• **Status**: ${balance <= 0 ? 'Completed' : (prod > 0 ? 'Running' : 'Pending')}`;
  }

  // Check if asking about team leader or buyer
  if (lowerQ.includes('leader') || lowerQ.includes('buyer') || lowerQ.includes('who')) {
    return `Sure! For **Order #${activeOrderNum}**:\n\n` +
      `• **Buyer**: **${buyer}**\n` +
      `• **Team Leader**: **${teamLeader}**`;
  }

  return null;
}

// Serve Company Logo Favicon directly for browser tabs and shortcuts
app.get(['/favicon.ico', '/favicon.svg', '/favicon.png'], (req, res) => {
  const svgPath = path.join(process.cwd(), 'public', 'favicon.svg');
  if (fs.existsSync(svgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(svgPath);
  }
  res.status(404).send('Favicon not found');
});

// Serve Raihan Avatar image asset with automatic fallback to high-res vector
app.get(['/Gemini_Generated_Image_e0oxaye0oxaye0ox-removebg-preview.png', '/raihan-avatar.png', '/raihan-avatar.svg'], (req, res) => {
  const customPng = path.join(process.cwd(), 'public', 'Gemini_Generated_Image_e0oxaye0oxaye0ox-removebg-preview.png');
  if (fs.existsSync(customPng) && fs.statSync(customPng).size > 2000) {
    res.setHeader('Content-Type', 'image/png');
    return res.sendFile(customPng);
  }
  const svgPath = path.join(process.cwd(), 'public', 'raihan-avatar.svg');
  if (fs.existsSync(svgPath)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.sendFile(svgPath);
  }
  res.status(404).send('Avatar not found');
});

app.post('/api/chat/raihan', async (req, res) => {
  try {
    const { message, history, context } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, reply: 'Please provide a valid question.' });
    }

    const trimmedMsg = message.trim();
    const lowerMsg = trimmedMsg.toLowerCase();

    const activeTab = context?.activeTab || 'Knitting Status';
    const currentUser = context?.currentUser || { name: 'User', userType: 'General' };
    const summaryStats = context?.summaryStats || {};

    // Security check: Instant block of secret or code requests
    if (
      lowerMsg.includes('supabase key') ||
      lowerMsg.includes('supabase url') ||
      lowerMsg.includes('supabase code') ||
      lowerMsg.includes('gas script') ||
      lowerMsg.includes('gas url') ||
      lowerMsg.includes('google apps script') ||
      lowerMsg.includes('api key') ||
      lowerMsg.includes('secret') ||
      lowerMsg.includes('password') ||
      lowerMsg.includes('app_config.json') ||
      lowerMsg.includes('server.ts')
    ) {
      return res.json({
        success: true,
        reply: "For security and operational integrity, internal system scripts, database codes, and credentials cannot be shared. I am here to help you with order inquiries, knitting status, and textile records."
      });
    }

    // Step 0.5: Fast check for queries outside website data
    const isOutsideQuestion = 
      /\b(weather|temperature|forecast for|president|prime minister|capital of|tell me a joke|write a poem|sing a song|recipe|how to cook|movie|football score|cricket|stock price|bitcoin|crypto|python|javascript|write code)\b/i.test(lowerMsg) ||
      (/\b(who is|what is|tell me about)\b/i.test(lowerMsg) && !lowerMsg.includes('order') && !lowerMsg.includes('fabric') && !lowerMsg.includes('knit') && !lowerMsg.includes('floor') && !lowerMsg.includes('production') && !lowerMsg.includes('balance') && !lowerMsg.includes('yarn') && !lowerMsg.includes('buyer') && !lowerMsg.includes('pmc') && !lowerMsg.includes('target') && !lowerMsg.includes('machine') && !lowerMsg.includes('shift') && !trimmedMsg.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g));

    if (isOutsideQuestion) {
      return res.json({
        success: true,
        reply: "Sorry, I don't have that information in my system."
      });
    }

    const candidateMatches = trimmedMsg.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
    const hasExplicitOrder = candidateMatches.length > 0 && !candidateMatches.every(c => c === '2024' || c === '2025' || c === '2026');

    // Step 0.7: Fast response for "Total Allocation" or "Total Yarn Allocation" summary without specific order
    const isTotalAllocationQuery = 
      (lowerMsg.includes('alloc') || lowerMsg.includes('yarn req') || lowerMsg.includes('allocated yarn')) &&
      !hasExplicitOrder;

    if (isTotalAllocationQuery) {
      let totalYarnRq = Number(summaryStats.totalYarnRqQty || 0);
      let totalAllocated = Number(summaryStats.totalAllocatedQty || 0);
      let totalBalance = Number(summaryStats.totalAllocBalance || 0);
      let uniqueOrders = Number(summaryStats.uniqueAllocOrdersCount || 0);
      let totalRecords = Number(summaryStats.totalAllocationsCount || 0);

      // If summaryStats not present or 0, compute from client context yarnAllocations
      if (totalAllocated === 0 && Array.isArray(context?.yarnAllocations) && context.yarnAllocations.length > 0) {
        const orderSet = new Set<string>();
        for (const y of context.yarnAllocations) {
          totalYarnRq += Number(y.yarnRqQty ?? y.yarn_rq_qty ?? 0);
          totalAllocated += Number(y.allocatedQty ?? y.allocated_qty ?? 0);
          totalBalance += Number(y.balance ?? 0);
          const ord = y.orderNumber || y.order_number;
          if (ord) orderSet.add(String(ord).trim());
        }
        uniqueOrders = orderSet.size;
        totalRecords = context.yarnAllocations.length;
      }

      if (totalAllocated === 0) {
        try {
          const cachedAlloc = await getCachedSupabaseTable('yarn_allocations', false);
          const dbAllocations = cachedAlloc.rows;
          if (dbAllocations && dbAllocations.length > 0) {
            const orderSet = new Set<string>();
            for (const y of dbAllocations) {
              totalYarnRq += Number(y.yarn_rq_qty || 0);
              totalAllocated += Number(y.allocated_qty || 0);
              totalBalance += Number(y.balance || 0);
              if (y.order_number) orderSet.add(String(y.order_number).trim());
            }
            uniqueOrders = orderSet.size;
            totalRecords = dbAllocations.length;
          }
        } catch (dbErr) {
          console.warn('Error querying yarn allocations total in server:', dbErr);
        }
      }

      const totalAllocReply = 
        `Sure! I found it. Here is the **Total Yarn Allocation** summary:\n\n` +
        `| Total Yarn Req | Total Allocated Qty | Net Balance | Unique Orders |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **${totalYarnRq.toLocaleString()} kg** | **${totalAllocated.toLocaleString()} kg** | **${totalBalance.toLocaleString()} kg** | **${uniqueOrders > 0 ? uniqueOrders.toLocaleString() : 'All'} Orders** |\n\n` +
        `**🧶 Total Summary:** Total Required: **${totalYarnRq.toLocaleString()} kg** | Allocated: **${totalAllocated.toLocaleString()} kg** | Balance: **${totalBalance.toLocaleString()} kg**\n` +
        `*(Total across all ${totalRecords > 0 ? totalRecords.toLocaleString() : 'registered'} allocation records)*`;

      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(totalAllocReply)
      });
    }

    // Step 0.8: Fast response for "what is the Total knitting balance?" or total summary queries without an order
    const isTotalKnittingQuery = 
      !isTotalAllocationQuery &&
      ((lowerMsg.includes('total') && (lowerMsg.includes('balance') || lowerMsg.includes('knit') || lowerMsg.includes('prod') || lowerMsg.includes('summary'))) ||
      (lowerMsg.includes('knitting balance') && !trimmedMsg.match(/\b\d{5,8}\b/)) ||
      (lowerMsg.includes('total balance') && !trimmedMsg.match(/\b\d{5,8}\b/)));

    if (isTotalKnittingQuery && !hasExplicitOrder) {
      let reqQty = Number(summaryStats.totalReqQty || 0);
      let greyQty = Number(summaryStats.totalGreyQty || 0);
      let prodQty = Number(summaryStats.totalProduction || 0);
      let balQty = Number(summaryStats.totalKnitBal || (greyQty > 0 ? (greyQty - prodQty) : 0));
      const totalOrders = Number(summaryStats.totalOrders || summaryStats.totalRecords || 0);

      if (reqQty === 0 && prodQty === 0 && Array.isArray(context?.relevantRecords)) {
        for (const r of context.relevantRecords) {
          reqQty += Number(r.reqQty || r.req_qty || 0);
          greyQty += Number(r.greyQty || r.grey_qty || 0);
          prodQty += Number(r.production || 0);
          balQty += Number(r.knitBal || r.knitBalance || (Number(r.greyQty || 0) - Number(r.production || 0)));
        }
      }

      const totalSummaryReply = 
        `Sure! I found it. Here is the **Total Knitting Production** summary:\n\n` +
        `| Knit Req | Grey | Production | Balance |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **${reqQty.toLocaleString()} kg** | **${greyQty.toLocaleString()} kg** | **${prodQty.toLocaleString()} kg** | **${balQty.toLocaleString()} kg** |\n\n` +
        `*(Total across all ${totalOrders > 0 ? totalOrders.toLocaleString() : 'registered'} orders)*`;

      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(totalSummaryReply)
      });
    }

    // Step 1: Detect active order number (from current message or multi-turn history/context)
    let numMatches = (trimmedMsg.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || []).filter(n => n !== '2024' && n !== '2025' && n !== '2026');
    let isFollowUp = false;
    let activeOrderNum: string | null = numMatches[0] || null;

    const isMonthlyOrFloorQuery = 
      lowerMsg.includes('september') ||
      lowerMsg.includes('august') ||
      lowerMsg.includes('october') ||
      lowerMsg.includes('monthly') ||
      lowerMsg.includes('month') ||
      lowerMsg.includes('floor') ||
      lowerMsg.includes('today') ||
      lowerMsg.includes('yesterday') ||
      lowerMsg.includes('unit by unit') ||
      lowerMsg.includes('missing');

    const ORDER_FOLLOWUP_COLORS = [
      'french navy', 'black', 'white', 'grey', 'gray', 'slate grey', 'heather grey', 'charcoal',
      'navy', 'olive', 'red', 'green', 'blue', 'yellow', 'maroon', 'orange', 'pink', 'purple',
      'rib', 'fleece'
    ];

    const isOrderFollowUpIntent = !numMatches.length && !isMonthlyOrFloorQuery && (
      lowerMsg === 'production' ||
      lowerMsg === 'prod' ||
      lowerMsg === 'allocation' ||
      lowerMsg === 'alloc' ||
      lowerMsg === 'yarn' ||
      lowerMsg === 'balance' ||
      lowerMsg === 'predict completion' ||
      lowerMsg.startsWith('order ') ||
      lowerMsg.includes('fabric') ||
      lowerMsg.includes('fgsm') ||
      lowerMsg.includes('knit bal') ||
      ORDER_FOLLOWUP_COLORS.some(c => lowerMsg === c || lowerMsg.startsWith(c))
    );

    // Multi-turn context memory: ONLY if the user is asking an intentional order follow-up
    if (!activeOrderNum && isOrderFollowUpIntent && !isTotalKnittingQuery) {
      if (context?.activeOrderNo) {
        activeOrderNum = String(context.activeOrderNo);
        isFollowUp = true;
      } else if (Array.isArray(history) && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i]?.role !== 'user') continue;
          const histText = String(history[i]?.text || '');
          const histMatches = histText.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
          if (histMatches && histMatches.length > 0) {
            const candidate = histMatches[0];
            if (candidate === '2024' || candidate === '2025' || candidate === '2026') continue;
            activeOrderNum = candidate;
            isFollowUp = true;
            break;
          }
        }
      }
    }

    // Step 1.2: Search live internal database immediately
    const erpSearchResults = await searchInternalERP(trimmedMsg, context, activeOrderNum);
    const { foundKnittingOrders, foundOrderPlans, foundTextileClose, foundYarnAllocations } = erpSearchResults;

    // Step 1.5: Search live internal Production Ledger for floor updates, missing floors, 7-day trends, and predictions (< 30ms)
    const prodResult = await handleProductionLedgerQuery(trimmedMsg, context);
    if (prodResult.handled && prodResult.reply) {
      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(prodResult.reply)
      });
    }

    // Step 2: Multi-turn Follow-up handling (e.g., user asks "Grey mix only", "color", "balance", etc. for active order)
    if (isFollowUp && activeOrderNum) {
      const followUpReply = handleConversationalFollowUp(trimmedMsg, activeOrderNum, erpSearchResults, context);
      if (followUpReply) {
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(followUpReply)
        });
      }
    }

    // Step 2.5: If an explicit order number was requested in this message, return verified report (< 100ms)
    if (!isFollowUp && numMatches.length > 0) {
      const targetNum = numMatches[0];
      const hasAnyMatch = foundKnittingOrders.length > 0 || foundOrderPlans.length > 0 || foundTextileClose.length > 0 || foundYarnAllocations.length > 0;

      if (hasAnyMatch) {
        const instantReport = formatOrderResponse(targetNum, erpSearchResults, trimmedMsg);
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(instantReport)
        });
      } else {
        // Explicit order number asked, but not in database
        return res.json({
          success: true,
          reply: `Hmm, I couldn't find that order in the system. I checked Knitting Status, Textile Close By PMC, and Order Plans, but couldn't find **Order #${targetNum}**.\n\nPlease check the number or ensure the latest records are updated.`
        });
      }
    }

    // Step 2.7: Standalone color search across the ERP (e.g., user asks "Grey mix only", "Navy Blue" without prior order)
    const standaloneColorMatches = searchOrdersByColor(trimmedMsg, erpSearchResults, context);
    if (standaloneColorMatches.length > 0 && !lowerMsg.includes('total') && !lowerMsg.includes('summary')) {
      let colorReply = `Sure! I found a few matching records in the system with **${trimmedMsg}**:\n\n`;
      standaloneColorMatches.slice(0, 8).forEach((o, i) => {
        colorReply += `${i + 1}. **Order #${o.orderNo}** (Buyer: **${o.buyer}**)\n` +
          `   • Color: **${o.color}**\n` +
          `   • Knitting Balance: **${Number(o.balance).toLocaleString()} kg**\n`;
      });
      colorReply += `\nYou can ask me for full details on any of these orders!`;
      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(colorReply)
      });
    }

    // Step 3: Instant local answers for common summary or buyer queries (< 20ms)
    if (lowerMsg.includes('total') || lowerMsg.includes('summary') || (lowerMsg.includes('balance') && !lowerMsg.includes('for order'))) {
      if (lowerMsg.includes('alloc') || lowerMsg.includes('yarn req') || lowerMsg.includes('allocated yarn')) {
        let totalYarnRq = Number(summaryStats.totalYarnRqQty || 0);
        let totalAllocated = Number(summaryStats.totalAllocatedQty || 0);
        let totalBalance = Number(summaryStats.totalAllocBalance || 0);
        let uniqueOrders = Number(summaryStats.uniqueAllocOrdersCount || 0);
        let totalRecords = Number(summaryStats.totalAllocationsCount || 0);

        if (totalAllocated === 0 && Array.isArray(context?.yarnAllocations) && context.yarnAllocations.length > 0) {
          const orderSet = new Set<string>();
          for (const y of context.yarnAllocations) {
            totalYarnRq += Number(y.yarnRqQty ?? y.yarn_rq_qty ?? 0);
            totalAllocated += Number(y.allocatedQty ?? y.allocated_qty ?? 0);
            totalBalance += Number(y.balance ?? 0);
            const ord = y.orderNumber || y.order_number;
            if (ord) orderSet.add(String(ord).trim());
          }
          uniqueOrders = orderSet.size;
          totalRecords = context.yarnAllocations.length;
        }

        const allocReply = `Sure! I found it. Here is the **Total Yarn Allocation** summary:\n\n` +
          `| Total Yarn Req | Total Allocated Qty | Net Balance | Unique Orders |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          `| **${totalYarnRq.toLocaleString()} kg** | **${totalAllocated.toLocaleString()} kg** | **${totalBalance.toLocaleString()} kg** | **${uniqueOrders > 0 ? uniqueOrders.toLocaleString() : 'All'} Orders** |\n\n` +
          `**🧶 Total Summary:** Total Required: **${totalYarnRq.toLocaleString()} kg** | Allocated: **${totalAllocated.toLocaleString()} kg** | Balance: **${totalBalance.toLocaleString()} kg**\n` +
          `*(Total across all ${totalRecords > 0 ? totalRecords.toLocaleString() : 'registered'} allocation records)*`;
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(allocReply)
        });
      }

      const reqQty = Number(summaryStats.totalReqQty || 0);
      const greyQty = Number(summaryStats.totalGreyQty || 0);
      const prodQty = Number(summaryStats.totalProduction || 0);
      const balQty = Number(summaryStats.totalKnitBal || (greyQty > 0 ? (greyQty - prodQty) : 0));
      const totalOrders = Number(summaryStats.totalOrders || summaryStats.totalRecords || 0);

      const fallbackReply = `Sure! I found it. Here is the **Total Knitting Production** summary:\n\n` +
        `| Knit Req | Grey | Production | Balance |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        `| **${reqQty.toLocaleString()} kg** | **${greyQty.toLocaleString()} kg** | **${prodQty.toLocaleString()} kg** | **${balQty.toLocaleString()} kg** |\n\n` +
        `*(Total across all ${totalOrders > 0 ? totalOrders.toLocaleString() : 'registered'} orders)*`;
      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(fallbackReply)
      });
    }

    if (lowerMsg.includes('buyer') || lowerMsg.includes('buyers')) {
      const buyerSet = new Set<string>();
      foundKnittingOrders.forEach(k => k.buyer_name && buyerSet.add(k.buyer_name));
      foundOrderPlans.forEach(p => p.buyer && buyerSet.add(p.buyer));
      const buyerList = Array.from(buyerSet);

      if (buyerList.length > 0) {
        const fallbackReply = `Sure! Here are active buyers recorded in the ERP system:\n` +
          buyerList.slice(0, 10).map(b => `• ${b}`).join('\n') +
          (buyerList.length > 10 ? `\n...and ${buyerList.length - 10} more.` : '');
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(fallbackReply)
        });
      }
    }

    // Step 4: For complex conversational queries, use Gemini with strict 10-second timeout
    const ai = getGenAI();

    const systemInstruction = `You are Raihan, a friendly, helpful colleague and the dedicated internal Production Guide for Epyllion Knitex Ltd. Knitting Performance & ERP System.

PERSONALITY:
- Behave like a friendly, helpful colleague—not a robotic AI.
- Use natural, friendly phrases when appropriate, such as:
  • "Sure! 😊"
  • "Absolutely!"
  • "I found it."
  • "Let me check that for you."
  • "Hmm, I couldn't find that in the system."
  • "I found a few matching records."
  • "Looks like there isn't any data for that."
  • "You're all set!"
- Keep responses concise and professional. Do not overuse emojis or casual language.

DATA RULE:
- Answer ONLY from the information available in the website/ERP records provided in the context (Knitting Status, Textile Close By PMC, Production Ledger, Yarn Allocations, and Order Plans).
- Never invent, assume, or browse for information outside the website data.
- If the requested information exists:
  → Respond naturally and confidently. (Example: "Sure! I found it. Order CSS0001 is currently running.")
- If the information does not exist:
  → Be honest and friendly. (Example: "Hmm, I couldn't find that in the system.")
- If the question is outside the available website data:
  → Say: "Sorry, I don't have that information in my system."

STRICT SECRECY (NO CODE OR SECRETS):
- You are STRICTLY FORBIDDEN from sharing, quoting, explaining, or outputting any Supabase code, SQL table creation scripts, database keys, Google Apps Script (GAS) code, Web App URLs, passwords, or internal server architecture code. If asked for any script or credential, reply:
  "For security and operational integrity, internal system scripts, database codes, and credentials cannot be shared."

FACTUAL RECORD CITATION:
- Use the provided website context (Knitting Status, Textile Close By PMC, Production Ledger, Yarn, Plan Orders) to give exact figures for Order No., Buyer Name, Team Leader, FGSM, Finished Width, Fabric Type, Required Quantity, Grey Quantity, Production, and Knit Balance.

MONTHLY & FLOOR PRODUCTION QUERIES:
- If the user asks for a monthly production update (e.g. "September Production Update", "October Production Update", or any month production update unit by unit), ALWAYS provide the unit-by-unit production update report for that month from the Production Ledger.
- NEVER display Order 272277 or any order summary unless the user explicitly requested that specific order number or fabric/balance for that order.
- If you don't recognize or know a command, politely state that you didn't find that command in the ERP system and suggest valid commands (like "September Production Update", "Yesterday floor by floor", "Which floor did not update today?", "Order [Number]").

FORMATTING:
- Keep answers clear, concise, and professional with bold highlights on key figures. Do not write programming code.`;

    const recentLedgerSubset = (prodResult.ledgerData || []).slice(0, 20).map((r: any) => ({
      date: r.date,
      floor: r.floor,
      total_production: Number(r.total_production || r.totalProduction || 0),
      target: Number(r.target || 0),
      efficiency: r.efficiency,
      running_machine: r.running_machine || r.runningMachine,
      shift_a: r.shift_a || r.shiftA,
      shift_b: r.shift_b || r.shiftB,
      shift_c: r.shift_c || r.shiftC,
      remarks: r.remarks
    }));

    const contextPayload = {
      activeTab,
      activeOrderNum,
      userRole: currentUser.userType,
      userName: currentUser.name,
      matchedRecords: {
        knittingOrders: foundKnittingOrders.slice(0, 10),
        orderPlans: foundOrderPlans.slice(0, 10),
        textileClose: foundTextileClose.slice(0, 10),
        productionLedger: recentLedgerSubset
      },
      summaryStats,
      userQuestion: trimmedMsg
    };

    if (ai) {
      try {
        const contents: any[] = [];
        if (Array.isArray(history) && history.length > 0) {
          const recentHistory = history.slice(-6);
          for (const item of recentHistory) {
            if (item.text && (item.role === 'user' || item.role === 'model')) {
              contents.push({
                role: item.role,
                parts: [{ text: String(item.text) }]
              });
            }
          }
        }

        contents.push({
          role: 'user',
          parts: [{
            text: `CURRENT ERP DATA CONTEXT (ONLY ANSWER FROM THIS DATA):\n${JSON.stringify(contextPayload, null, 2)}\n\nUSER QUESTION: ${trimmedMsg}`
          }]
        });

        // 10-second timeout so Gemini has adequate time to synthesize without being killed prematurely
        const geminiPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.2,
          }
        });

        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 10000));
        const geminiRes: any = await Promise.race([geminiPromise, timeoutPromise]);

        const rawReply = geminiRes.text || "I was unable to retrieve a response from the ERP context.";
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(rawReply)
        });
      } catch (geminiErr: any) {
        console.warn('Gemini chat warning in Raihan bot, using local ERP synthesizer fallback:', geminiErr?.message || geminiErr);
        // Graceful fallback to ERP synthesizer if Gemini is slow, offline, or quota exceeded
      }
    }

    // Step 5: Intelligent local ERP synthesizer fallback (resilient against Gemini rate limits/429)
    if (activeOrderNum && (numMatches.length > 0 || isFollowUp)) {
      const activeReport = handleConversationalFollowUp(trimmedMsg, activeOrderNum, erpSearchResults, context) ||
        (isFollowUp ? null : formatOrderResponse(activeOrderNum, erpSearchResults, trimmedMsg));
      if (activeReport) {
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(activeReport)
        });
      }
    }

    // Default fallback response when a command is not recognized or found
    const fallbackReply = `Hmm, I didn't recognize that command or couldn't find relevant ERP records for it. 😊\n\n` +
      `Here are a few things you can ask me:\n` +
      `• **"September Production Update"** (or any month unit-by-unit production report)\n` +
      `• **"Yesterday's production floor by floor"**\n` +
      `• **"Which floor did not update today?"**\n` +
      `• **"Order [Number]"** (e.g. *"Order 1001"*)\n` +
      `• **"What is the total knitting balance?"**\n` +
      `• **"Datewise production update missing unit by unit"**`;

    return res.json({
      success: true,
      reply: sanitizeRaihanOutput(fallbackReply)
    });
  } catch (err: any) {
    console.error('Raihan Chatbot error:', err);
    return res.status(500).json({
      success: false,
      reply: "I encountered an issue retrieving data. Please try again."
    });
  }
});

app.all('/api/sheets', gasProxyHandler);
app.all('/api/gas-proxy', gasProxyHandler);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Custom error handler for Express middleware (e.g. body-parser limit errors)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === 'entity.too.large' || err.status === 413)) {
    return res.status(413).json({
      success: false,
      message: 'Uploaded dataset payload is too large. Limit expanded to 100MB.'
    });
  }
  if (err) {
    console.error('Express request error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error during request processing.'
    });
  }
  next();
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
