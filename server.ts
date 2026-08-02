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
          content = content.replace(serverRegex, `const DEFAULT_GAS_URL = '${newUrl}';`);
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
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing app_db.json:', e);
  }
  return updated;
}

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

// Proxy to Google Apps Script REST API with high performance caching & 10s timeouts
app.all('/api/gas-proxy', async (req, res) => {
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
      const urlObj = new URL(trimmedUrl);
      for (const [key, val] of Object.entries(req.query)) {
        if (key !== 'url' && key !== 'refresh') {
          urlObj.searchParams.append(key, String(val));
        }
      }

      const cacheKey = urlObj.toString();
      const forceRefresh = req.query.refresh === 'true';
      const now = Date.now();
      const cached = gasProxyCache.get(cacheKey);

      // Return instant cache if fresh and not force-refreshed
      if (!forceRefresh && cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return res.json(cached.data);
      }

      try {
        const response = await fetch(urlObj.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          redirect: 'follow',
          signal: AbortSignal.timeout(25000) // 25-second timeout for GAS execution & cold starts
        });

        if (!response.ok) {
          let hint = '';
          if (response.status === 404) {
            hint = ' (404 Not Found: Ensure URL ends in "/exec", not "/dev").';
          } else if (response.status === 401 || response.status === 403) {
            hint = ' (Access Denied: Set "Who has access" to "Anyone" in Google Apps Script).';
          }
          if (cached) {
            // Serve stale cache on error
            return res.json(cached.data);
          }
          return res.status(response.status).json({
            success: false,
            message: `Google Apps Script returned HTTP status ${response.status}${hint}`
          });
        }

        const text = await response.text();
        try {
          const json = JSON.parse(text);
          if (json && json.success !== false) {
            gasProxyCache.set(cacheKey, { timestamp: now, data: json });
          }
          return res.json(json);
        } catch (e) {
          if (cached) return res.json(cached.data);
          return res.json({ success: false, message: 'Invalid JSON response from Apps Script', raw: text });
        }
      } catch (fetchErr: any) {
        // If fetch timed out or failed, serve cached data immediately if available
        if (cached) {
          return res.json(cached.data);
        }
        const isTimeout = fetchErr.name === 'TimeoutError' || fetchErr.message?.includes('timeout') || fetchErr.message?.includes('aborted');
        return res.json({
          success: false,
          message: isTimeout 
            ? 'Google Apps Script request timed out due to slow response or cold start. Please try again.'
            : (fetchErr.message || 'Error connecting to Google Apps Script')
        });
      }
    } else if (req.method === 'POST') {
      // Invalidate GET cache on write operations so next reads get fresh data
      gasProxyCache.clear();

      const postBody = { ...req.body };
      delete postBody.url;

      try {
        const response = await fetch(trimmedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(postBody),
          redirect: 'follow',
          signal: AbortSignal.timeout(90000) // 90-second timeout for batch mutations
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
});

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
