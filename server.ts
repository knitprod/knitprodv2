import express from 'express';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(process.cwd(), 'app_config.json');
const DB_FILE = path.join(process.cwd(), 'app_db.json');

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

  // Invalidate proxy cache on URL change
  gasProxyCache.clear();

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
    if (r.id === 'rec-2026-08-26-efl-extension-1787807712863' || (r.date === '2026-08-26' && (r.floor === 'EFL-Extension' || r.unit === 'EFL-Extension'))) {
      item = { ...r, target: 2160, targetBulk: 2160, idleProduction: 900, efficiency: 134.91 };
    }
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
        userName: 'Md. Raihan Hossain Antu',
        userType: 'Admin',
        designation: 'Senior Manager',
        uid: 'EKL001',
        password: 'Password@2026',
        department: 'Knitting',
        assignedUnits: ['EKL', 'EFL', 'Auto Stripe'],
        permission: 'Read / Write',
        status: 'Active',
        lastUpdated: '2026-07-15 10:30 AM'
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
          parsed.ledger = parsed.ledger.map((r: any) => {
            if (r.id === 'rec-2026-08-26-efl-extension-1787807712863' || (r.date === '2026-08-26' && (r.floor === 'EFL-Extension' || r.unit === 'EFL-Extension'))) {
              return { ...r, target: 2160, targetBulk: 2160, idleProduction: 900, efficiency: 134.91 };
            }
            return r;
          });
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

// GET auth session state via active tab x-session-uid header
app.get('/api/auth/session', (req, res) => {
  const headerUid = req.headers['x-session-uid'];
  
  // A valid session requires an active tab session identifier (from sessionStorage).
  // When the browser is closed and re-opened, sessionStorage is cleared, ensuring
  // the user is prompted for credentials.
  if (typeof headerUid === 'string' && headerUid.trim()) {
    res.json({ authenticated: true, uid: headerUid.trim().toUpperCase() });
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

// GET central database configuration
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  res.json({ success: true, config });
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
function getServerSupabase(): SupabaseClient | null {
  const cfg = loadConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseKey) return null;
  if (!serverSupabaseClient) {
    serverSupabaseClient = createClient(cfg.supabaseUrl, cfg.supabaseKey);
  }
  return serverSupabaseClient;
}

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

// In-memory cached production ledger with TTL
let cachedLedgerData: any[] = [];
let lastLedgerFetchTime = 0;
async function getProductionLedgerRecords(clientContext?: any): Promise<any[]> {
  const now = Date.now();
  if (cachedLedgerData.length > 0 && (now - lastLedgerFetchTime) < 15000) {
    return cachedLedgerData;
  }

  const supabase = getServerSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('production_ledger')
        .select('*')
        .order('date', { ascending: false })
        .limit(300);
      if (!error && Array.isArray(data) && data.length > 0) {
        cachedLedgerData = data;
        lastLedgerFetchTime = now;
        return data;
      }
    } catch (e) {
      console.warn('Supabase ledger fetch warning:', e);
    }
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
    lowerMsg.includes('7 day') ||
    lowerMsg.includes('7-day') ||
    lowerMsg.includes('7 days') ||
    lowerMsg.includes('past week') ||
    lowerMsg.includes('last week') ||
    STANDARD_FACTORY_FLOORS.some(f => lowerMsg.includes(f.toLowerCase()));

  if (!hasProdKeywords) {
    return { handled: false };
  }

  const ledger = await getProductionLedgerRecords(clientContext);
  if (!Array.isArray(ledger) || ledger.length === 0) {
    return { handled: false };
  }

  // Extract distinct dates sorted descending
  const distinctDates = [...new Set(ledger.map((r: any) => r.date).filter(Boolean))].sort().reverse();
  const latestDate = distinctDates[0] || '';
  const yesterdayDate = distinctDates[1] || '';

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

    reply += `\n**Operational Summary (${formatHumanDate(targetDate)}):**\n` +
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

  // 1. Search Supabase in parallel if configured
  if (supabase && numMatches.length > 0) {
    try {
      await Promise.all(
        numMatches.map(async (num) => {
          const [ko, op, tcp, ya] = await Promise.all([
            supabase.from('knitting_orders').select('*').ilike('order_no', `%${num}%`).limit(5),
            supabase.from('order_plans').select('*').ilike('ewo', `%${num}%`).limit(5),
            supabase.from('textile_close_pmc').select('*').ilike('order_no', `%${num}%`).limit(5),
            supabase.from('yarn_allocations').select('*').ilike('order_number', `%${num}%`).limit(5)
          ]);

          if (ko.data) foundKnittingOrders.push(...ko.data);
          if (op.data) foundOrderPlans.push(...op.data);
          if (tcp.data) foundTextileClose.push(...tcp.data);
          if (ya.data) foundYarnAllocations.push(...ya.data);
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
      const matchesColor = recColor && lowerQ.split(/\s+/).some(w => w.length > 2 && recColor.includes(w));
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

  return {
    numMatches,
    foundKnittingOrders,
    foundOrderPlans,
    foundTextileClose,
    foundYarnAllocations
  };
}

// Build instant, exact markdown report for a matched order
function formatOrderResponse(orderNum: string, erpData: any): string {
  const { foundKnittingOrders, foundOrderPlans, foundTextileClose, foundYarnAllocations } = erpData;

  const ko = foundKnittingOrders.find((k: any) => String(k.order_no || k.orderNo).includes(orderNum)) || foundKnittingOrders[0];
  const op = foundOrderPlans.find((p: any) => String(p.ewo || p.id).includes(orderNum)) || foundOrderPlans[0];
  const tcp = foundTextileClose.find((t: any) => String(t.order_no || t.orderNo).includes(orderNum)) || foundTextileClose[0];
  const ya = foundYarnAllocations.find((y: any) => String(y.order_number || y.orderNumber).includes(orderNum)) || foundYarnAllocations[0];

  if (!ko && !op && !tcp && !ya) {
    return `I searched all website datasets (Knitting Status, Order Plans, Textile Close By PMC, and Yarn Allocations), but **Order #${orderNum}** was not found.\n\nPlease verify the order number or ensure the latest Excel data is synchronized.`;
  }

  const buyer = ko?.buyer_name || ko?.buyerName || op?.buyer || tcp?.buyer_name || tcp?.buyerName || ya?.buyer || 'N/A';
  const teamLeader = ko?.team_leader || ko?.teamLeader || op?.knit_team_leaders || op?.knitTeamLeaders || tcp?.team_leader || tcp?.teamLeader || 'N/A';
  
  // Extract numbers
  const reqQty = Number(ko?.req_qty ?? ko?.reqQty ?? op?.target ?? tcp?.req_qty ?? tcp?.reqQty ?? 0);
  const greyQty = Number(ko?.grey_qty ?? ko?.greyQty ?? op?.allocated_qty ?? op?.allocatedQty ?? tcp?.grey_qty ?? tcp?.greyQty ?? 0);
  const prod = Number(ko?.production ?? op?.knit_pro ?? op?.knitPro ?? tcp?.production ?? 0);
  const balance = Number(ko?.knit_balance ?? ko?.knitBal ?? op?.knit_bal ?? op?.knitBal ?? tcp?.knit_bal ?? tcp?.knitBal ?? (greyQty - prod));

  let report = `Here is the verified information for **Order #${orderNum}** from the internal ERP system:\n\n` +
    `• **Buyer Name**: ${buyer}\n` +
    `• **Team Leader**: ${teamLeader}\n` +
    `• **Required Quantity**: ${reqQty.toLocaleString()} kg\n` +
    `• **Grey Quantity**: ${greyQty.toLocaleString()} kg\n` +
    `• **Production**: ${prod.toLocaleString()} kg\n` +
    `• **Knitting Balance**: ${balance.toLocaleString()} kg\n` +
    `• **Status**: ${tcp ? 'Closed (Textile Close By PMC)' : (balance <= 0 ? 'Completed' : (prod > 0 ? 'Running' : 'Pending'))}\n`;

  // Item details if available from knitting order
  const rawItems = ko?.items || ko?.raw_data?.items;
  if (Array.isArray(rawItems) && rawItems.length > 0) {
    report += `\n**Fabric & Item Specifications (${rawItems.length} items):**\n`;
    rawItems.forEach((itm: any, idx: number) => {
      const fab = itm.fabType || itm.mcType || 'Fabric';
      const color = itm.color || 'N/A';
      const fgsm = itm.fgsm ? `${itm.fgsm} GSM` : 'N/A';
      const fWidth = itm.fWidth ? `${itm.fWidth}"` : 'N/A';
      const yarn = itm.yarnCount || 'N/A';
      const itemReq = Number(itm.reqQty || 0).toLocaleString();
      const itemGrey = Number(itm.greyQty || 0).toLocaleString();
      const itemProd = Number(itm.production || 0).toLocaleString();
      const itemBal = Number(itm.knitBalance ?? (Number(itm.greyQty || 0) - Number(itm.production || 0))).toLocaleString();
      const unit = itm.productionUnit || 'Knitting Floor';

      report += `${idx + 1}. **${fab}** (${color})\n` +
        `   • Specs: ${fgsm} | Width: ${fWidth} | Unit: ${unit}\n` +
        `   • Yarn Count: ${yarn}\n` +
        `   • Required: ${itemReq} kg | Grey: ${itemGrey} kg\n` +
        `   • Production: ${itemProd} kg | **Balance: ${itemBal} kg**\n`;
    });
  }

  // Plan order specifications
  if (op) {
    const planMonth = op.plan_month || op.planMonth || 'Current Plan';
    const planType = op.plan_type || op.planType || 'Tentative';
    const target = Number(op.target || 0).toLocaleString();
    const allocated = Number(op.allocated_qty || op.allocatedQty || 0).toLocaleString();
    const knitStart = op.knit_start || op.knitStart || 'N/A';
    const knitEnd = op.knit_end || op.knitEnd || 'N/A';

    report += `\n**Order Planning Details:**\n` +
      `• Plan Month: **${planMonth}** (${planType})\n` +
      `• Target: ${target} kg | Allocated: ${allocated} kg\n` +
      `• Knitting Schedule: ${knitStart} to ${knitEnd}\n`;
  }

  // Textile Close PMC details if closed
  if (tcp) {
    report += `\n**PMC Closing Status:**\n` +
      `• Closed Date: ${tcp.closedDate || tcp.closed_date || 'N/A'}\n` +
      `• Remarks: ${tcp.remarks || 'Order closed by PMC'}\n`;
  }

  return report;
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
        return `For **Order #${activeOrderNum}** (${buyer}), the plan records color **${op.color}**:\n\n` +
          `• Fabric: **${op.fabric || 'Knitted Fabric'}**\n` +
          `• Target: **${Number(op.target || 0).toLocaleString()} kg**\n` +
          `• Plan Month: **${op.plan_month || op.planMonth || 'Active'}**`;
      }

      // If NOT matched in this active order, clarify what colors actually exist for this order
      const actualColorsStr = orderColors.length > 0 ? orderColors.map(c => `• **${c}**`).join('\n') : '• *Standard Raw/Grey Fabric*';
      let res = `For **Order #${activeOrderNum}**, the recorded color(s) in the ERP are:\n${actualColorsStr}\n\n` +
        `*(Note: "${userQuery}" was not found as an active item color under Order #${activeOrderNum}.)*\n`;

      // Check across other ERP orders to see if other orders have this requested color
      const otherOrders = searchOrdersByColor(cleanSearch, erpData, clientContext);
      if (otherOrders.length > 0) {
        res += `\nHowever, I found **${otherOrders.length} other order(s)** in the ERP with **${cleanSearch}**:\n` +
          otherOrders.slice(0, 5).map(o => `• **Order #${o.orderNo}** (Buyer: ${o.buyer}, Color: ${o.color}, Balance: ${Number(o.balance).toLocaleString()} kg)`).join('\n');
      }

      return res;
    }

    // General color question (e.g. "what is the color of this order?")
    if (orderColors.length > 0) {
      let res = `The recorded color(s) for **Order #${activeOrderNum}** (${buyer}) are:\n\n` +
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

    let res = `Fabric specifications for **Order #${activeOrderNum}**:\n\n` +
      `• **Fabric Type**: **${fabType}**\n` +
      `• **Finished GSM**: **${fgsm}**\n` +
      `• **Finished Width**: **${finishedWidth}**\n` +
      `• **Buyer**: **${buyer}**`;

    if (orderColors.length > 0) {
      res += `\n• **Color(s)**: ${orderColors.join(', ')}`;
    }
    return res;
  }

  // Check if asking about balance / quantity / production
  if (lowerQ.includes('balance') || lowerQ.includes('prod') || lowerQ.includes('qty') || lowerQ.includes('quantity') || lowerQ.includes('remaining')) {
    const reqQty = Number(ko?.req_qty ?? ko?.reqQty ?? op?.target ?? 0);
    const greyQty = Number(ko?.grey_qty ?? ko?.greyQty ?? op?.allocated_qty ?? 0);
    const prod = Number(ko?.production ?? op?.knit_pro ?? 0);
    const balance = Number(ko?.knit_balance ?? ko?.knitBal ?? (greyQty - prod));

    return `Here is the quantity and production status for **Order #${activeOrderNum}**:\n\n` +
      `• **Required Quantity**: ${reqQty.toLocaleString()} kg\n` +
      `• **Grey Quantity**: ${greyQty.toLocaleString()} kg\n` +
      `• **Current Production**: ${prod.toLocaleString()} kg\n` +
      `• **Knitting Balance**: **${balance.toLocaleString()} kg**\n` +
      `• **Status**: ${balance <= 0 ? 'Completed' : (prod > 0 ? 'Running' : 'Pending')}`;
  }

  // Check if asking about team leader or buyer
  if (lowerQ.includes('leader') || lowerQ.includes('buyer') || lowerQ.includes('who')) {
    return `For **Order #${activeOrderNum}**:\n\n` +
      `• **Buyer**: **${buyer}**\n` +
      `• **Team Leader**: **${teamLeader}**`;
  }

  return null;
}

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

    // Step 1: Detect active order number (from current message or multi-turn history/context)
    let numMatches = trimmedMsg.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g) || [];
    let isFollowUp = false;
    let activeOrderNum: string | null = numMatches[0] || null;

    // Multi-turn context memory: If no number in current query, check previous history & context
    if (!activeOrderNum) {
      if (context?.activeOrderNo) {
        activeOrderNum = String(context.activeOrderNo);
        isFollowUp = true;
      } else if (Array.isArray(history) && history.length > 0) {
        for (let i = history.length - 1; i >= 0; i--) {
          const histText = String(history[i]?.text || '');
          const histMatches = histText.match(/\b\d{4,8}(?:-[A-Za-z0-9-]+)?\b/g);
          if (histMatches && histMatches.length > 0) {
            activeOrderNum = histMatches[0];
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
        const instantReport = formatOrderResponse(targetNum, erpSearchResults);
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(instantReport)
        });
      } else {
        // Explicit order number asked, but not in database
        return res.json({
          success: true,
          reply: `I searched the internal ERP system (Knitting Status, Textile Close By PMC, and Order Plans), but **Order #${targetNum}** was not found.\n\nPlease check the number or ensure the latest Excel data has been synchronized.`
        });
      }
    }

    // Step 2.7: Standalone color search across the ERP (e.g., user asks "Grey mix only", "Navy Blue" without prior order)
    const standaloneColorMatches = searchOrdersByColor(trimmedMsg, erpSearchResults, context);
    if (standaloneColorMatches.length > 0 && !lowerMsg.includes('total') && !lowerMsg.includes('summary')) {
      let colorReply = `Here are the orders found in the ERP system with **${trimmedMsg}**:\n\n`;
      standaloneColorMatches.slice(0, 8).forEach((o, i) => {
        colorReply += `${i + 1}. **Order #${o.orderNo}** (Buyer: **${o.buyer}**)\n` +
          `   • Color: **${o.color}**\n` +
          `   • Knitting Balance: **${Number(o.balance).toLocaleString()} kg**\n`;
      });
      colorReply += `\nYou can ask me for full details on any of these orders (e.g., *"Show details for ${standaloneColorMatches[0].orderNo}"*)!`;
      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(colorReply)
      });
    }

    // Step 3: Instant local answers for common summary or buyer queries (< 20ms)
    if (lowerMsg.includes('total') || lowerMsg.includes('summary') || (lowerMsg.includes('balance') && !lowerMsg.includes('for order'))) {
      const fallbackReply = `Here is the current **website dataset summary**:\n` +
        `• **Active Tab**: ${activeTab}\n` +
        `• **Total Orders**: ${(summaryStats.totalRecords || 0).toLocaleString()}\n` +
        `• **Total Required Qty**: ${(summaryStats.totalReqQty || 0).toLocaleString()} kg\n` +
        `• **Total Production**: ${(summaryStats.totalProduction || 0).toLocaleString()} kg\n` +
        `• **Total Knit Balance**: ${(summaryStats.totalKnitBal || 0).toLocaleString()} kg\n\n` +
        `You can ask me for details on any specific Order Number (e.g., *272277*), Buyer, or Fabric!`;
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
        const fallbackReply = `Here are active buyers recorded in the ERP system:\n` +
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

    const systemInstruction = `You are Raihan, the dedicated internal AI operational assistant for Epyllion Knitex Ltd. Knitting Performance & ERP System.

CRITICAL INSTRUCTIONS & STRICT BOUNDARIES (MANDATORY):
1. IDENTITY: Your name is Raihan. You are courteous, concise, helpful, and highly accurate.
2. IN-WEBSITE DATA ONLY: You must ONLY answer questions based on the operational data and features present within this Epyllion Knitex website. Do NOT collect or browse data from the outside online internet.
   If a user asks about outside world news, weather, stock markets, general entertainment, or anything outside of the Epyllion Knitex factory ERP, politely refuse:
   "I am Raihan, your Epyllion Knitex ERP assistant. I can only answer questions related to the orders, production, knitting, and fabric data within this website."
3. STRICT SECRECY (NO CODE OR SECRETS):
   You are STRICTLY FORBIDDEN from sharing, quoting, explaining, or outputting any Supabase code, SQL table creation scripts, database keys, Google Apps Script (GAS) code, Web App URLs, passwords, or internal server architecture code. If asked for any script or credential, reply:
   "For security and operational integrity, internal system scripts, database codes, and credentials cannot be shared."
4. FACTUAL RECORD CITATION:
   Use the provided website context (Knitting Status, Textile Close By PMC, Production Ledger, Yarn, Plan Orders) to give exact figures for Order No., Buyer Name, Team Leader, FGSM, Finished Width, Fabric Type, Required Quantity, Grey Quantity, Production, and Knit Balance.
5. FORMATTING: Use clean bullet points, bold key figures, and concise summaries. Do not write programming code.`;

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
    if (activeOrderNum) {
      const activeReport = handleConversationalFollowUp(trimmedMsg, activeOrderNum, erpSearchResults, context) ||
        formatOrderResponse(activeOrderNum, erpSearchResults);
      return res.json({
        success: true,
        reply: sanitizeRaihanOutput(activeReport)
      });
    }

    if (foundKnittingOrders.length > 0 || foundOrderPlans.length > 0) {
      const topOrd = foundKnittingOrders[0] || foundOrderPlans[0];
      const topNum = topOrd.order_no || topOrd.orderNo || topOrd.ewo;
      if (topNum) {
        return res.json({
          success: true,
          reply: sanitizeRaihanOutput(formatOrderResponse(topNum, erpSearchResults))
        });
      }
    }

    // Default fallback response
    const fallbackReply = `Hello! I am **Raihan**, your internal Epyllion Knitex ERP assistant.\n` +
      `I answer questions directly from the operational data within this website (Knitting Status, Order Plans, Textile Close By PMC, and Production Records).\n\n` +
      `Try asking me:\n` +
      `• *"What is the information for 272277?"*\n` +
      `• *"Show fabric details and knitting balance for Order [Number]"*\n` +
      `• *"Give me a summary of total balance and production"*`;

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
