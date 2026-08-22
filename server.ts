import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(process.cwd(), 'app_config.json');
const DB_FILE = path.join(process.cwd(), 'app_db.json');

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// In-memory cache for ultra-fast response times
let cachedConfigObj: { gasWebAppUrl: string; databaseMode: 'gas' | 'mock' } | null = null;
let cachedDbObj: any = null;
const gasProxyCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 15000; // 15-second cache for GET requests

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz6M8NmfDjG9GKdmkFMHggR6MGQwRU6Q42-hpd_gxEfbTQsjRL86mI_NavdqJB8Blzl/exec';

// Helper to load persistent server configuration with in-memory caching
function loadConfig() {
  if (cachedConfigObj) return cachedConfigObj;

  let config: { gasWebAppUrl: string; databaseMode: 'gas' | 'mock' } = {
    gasWebAppUrl: process.env.GAS_WEB_APP_URL || process.env.VITE_GAS_WEB_APP_URL || DEFAULT_GAS_URL,
    databaseMode: 'gas',
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const fileData = fs.readFileSync(CONFIG_FILE, 'utf-8');
      const data = JSON.parse(fileData);
      if (data) {
        if (typeof data.gasWebAppUrl === 'string' && data.gasWebAppUrl.trim()) {
          config.gasWebAppUrl = data.gasWebAppUrl.trim();
        }
        if (data.databaseMode === 'gas' || data.databaseMode === 'mock') {
          config.databaseMode = data.databaseMode;
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
function saveConfig(newConfig: Partial<{ gasWebAppUrl: string; databaseMode: 'gas' | 'mock' }>) {
  const current = loadConfig();
  const updated = {
    ...current,
    ...newConfig,
  };
  cachedConfigObj = updated;

  // Invalidate proxy cache on URL change
  gasProxyCache.clear();

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing app_config.json file:', e);
  }

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
          content = content.replace(serverRegex, `const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz6M8NmfDjG9GKdmkFMHggR6MGQwRU6Q42-hpd_gxEfbTQsjRL86mI_NavdqJB8Blzl/exec';`);
          fs.writeFileSync(serverPath, content, 'utf-8');
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
        const clientRegex = /(static DEFAULT_URL\s*=\s*)(['"])([\s\S]*?)\2;/g;
        if (clientRegex.test(content)) {
          content = content.replace(clientRegex, `static DEFAULT_URL = '${newUrl}';`);
          fs.writeFileSync(gasClientPath, content, 'utf-8');
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
        fs.writeFileSync(envPath, envContent, 'utf-8');
      } catch (e) {
        console.error('Error updating .env file:', e);
      }
    }
  }

  return updated;
}

// Central database helpers with in-memory caching
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
    users: [],
    ledger: [],
    productionEntries: [],
    activityLogs: []
  };

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileData = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(fileData);
      if (parsed) {
        db = { ...db, ...parsed };
      }
    } catch (e) {
      console.error('Error reading app_db.json:', e);
    }
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
    fs.writeFile(DB_FILE, JSON.stringify(updated), 'utf-8', (err) => {
      if (err) {
        console.warn('Warning writing app_db.json:', err);
      }
    });
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

// GET auth session state via HTTP-only cookie
app.get('/api/auth/session', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionUid = cookies['ekl_auth_session'];
  if (sessionUid && sessionUid.trim()) {
    res.json({ authenticated: true, uid: sessionUid.trim() });
  } else {
    res.json({ authenticated: false, uid: null });
  }
});

// POST establish auth session via HTTP-only cookie
app.post('/api/auth/session', (req, res) => {
  const { uid } = req.body || {};
  if (typeof uid === 'string' && uid.trim()) {
    const cleanUid = uid.trim().toUpperCase();
    res.setHeader(
      'Set-Cookie',
      `ekl_auth_session=${encodeURIComponent(cleanUid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`
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
    `ekl_auth_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
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
  const { gasWebAppUrl, databaseMode } = req.body || {};
  const updated = saveConfig({
    gasWebAppUrl: typeof gasWebAppUrl === 'string' ? gasWebAppUrl : undefined,
    databaseMode: (databaseMode === 'gas' || databaseMode === 'mock') ? databaseMode : undefined,
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
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
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
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

      const action = String(req.query.action || 'all');
      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = `${trimmedUrl}_${action}_${JSON.stringify(req.query)}`;
      const now = Date.now();
      const cached = gasProxyCache.get(cacheKey);

      // Return instant cache if fresh and not force-refreshed
      if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return res.json(cached.data);
      }

      // Handle 'all' or 'bulk' action with fallback to concurrent multi-endpoint fetching
      if (action === 'all' || action === 'bulk') {
        const localDb = loadDb();
        const hasLocalData = (localDb.orderPlans?.length > 0 || localDb.yarnAllocations?.length > 0 || localDb.ledger?.length > 0);

        // If not force refresh and we have local database data, serve instantly
        if (!forceRefresh && hasLocalData) {
          const quickPayload = {
            success: true,
            data: {
              orderPlans: localDb.orderPlans || [],
              yarnAllocations: localDb.yarnAllocations || [],
              ledger: localDb.ledger || [],
              totalOrders: (localDb.orderPlans || []).length,
              totalYarn: (localDb.yarnAllocations || []).length,
              totalLedger: (localDb.ledger || []).length,
            }
          };
          gasProxyCache.set(cacheKey, { timestamp: now, data: quickPayload });
          return res.json(quickPayload);
        }

        // 1. Try direct action=all with adequate timeout for large sheets
        const directAllRes = await fetchGasEndpoint(trimmedUrl, 'all', req.query, 60000);
        if (directAllRes && directAllRes.success && directAllRes.data && (directAllRes.data.orderPlans || directAllRes.data.orders || directAllRes.data.yarnAllocations || directAllRes.data.yarn || directAllRes.data.ledger)) {
          const directData = directAllRes.data;
          const mergedOrders = (directData.orderPlans && directData.orderPlans.length > 0) ? directData.orderPlans : ((directData.orders && directData.orders.length > 0) ? directData.orders : (localDb.orderPlans || []));
          const mergedYarn = (directData.yarnAllocations && directData.yarnAllocations.length > 0) ? directData.yarnAllocations : ((directData.yarn && directData.yarn.length > 0) ? directData.yarn : (localDb.yarnAllocations || []));
          const mergedLedger = (directData.ledger && directData.ledger.length > 0) ? directData.ledger : (localDb.ledger || []);
          
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

          // Save fresh datasets to local persistent store
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

        // If GAS is slow/empty, fall back to local persistent store
        if (ordersData.length === 0 && localDb.orderPlans && localDb.orderPlans.length > 0) ordersData = localDb.orderPlans;
        else if (ordersData.length > 0) localDb.orderPlans = ordersData;

        if (yarnData.length === 0 && localDb.yarnAllocations && localDb.yarnAllocations.length > 0) yarnData = localDb.yarnAllocations;
        else if (yarnData.length > 0) localDb.yarnAllocations = yarnData;

        if (ledgerData.length === 0 && localDb.ledger && localDb.ledger.length > 0) ledgerData = localDb.ledger;
        else if (ledgerData.length > 0) localDb.ledger = ledgerData;

        saveDb(localDb);

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
      if (!forceRefresh) {
        const localDb = loadDb();
        if (action.includes('yarn') && localDb.yarnAllocations && localDb.yarnAllocations.length > 0) {
          return res.json({ success: true, count: localDb.yarnAllocations.length, data: localDb.yarnAllocations });
        }
        if (action.includes('order') && localDb.orderPlans && localDb.orderPlans.length > 0) {
          return res.json({ success: true, count: localDb.orderPlans.length, data: localDb.orderPlans });
        }
        if (action.includes('ledger') && localDb.ledger && localDb.ledger.length > 0) {
          return res.json({ success: true, count: localDb.ledger.length, data: localDb.ledger });
        }
      }

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
          if (cached) return res.json(cached.data);
          return res.status(response.status).json({
            success: false,
            message: `Google Apps Script returned HTTP status ${response.status}`
          });
        }

        const text = await response.text();
        try {
          const json = JSON.parse(text);
          if (json && json.success !== false) {
            gasProxyCache.set(cacheKey, { timestamp: now, data: json });
            // Save to local database
            const localDb = loadDb();
            if (action.includes('yarn') && Array.isArray(json.data) && json.data.length > 0) {
              localDb.yarnAllocations = json.data;
              saveDb(localDb);
            } else if (action.includes('order') && Array.isArray(json.data) && json.data.length > 0) {
              localDb.orderPlans = json.data;
              saveDb(localDb);
            }
          }
          return res.json(json);
        } catch (e) {
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

      // Immediately save mutation to local persistent database
      try {
        const localDb = loadDb();
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
            localDb.ledger = postBody.ledger;
          } else {
            const existingMap = new Map((localDb.ledger || []).map((l: any) => [l.id, l]));
            postBody.ledger.forEach((l: any) => existingMap.set(l.id, l));
            localDb.ledger = Array.from(existingMap.values());
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
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch (e) {
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
