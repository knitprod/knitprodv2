/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Vercel Serverless Edge CDN Proxy Handler for Google Apps Script (TypeScript)
 * Endpoint: /api/sheets
 */

export interface ApiRequest {
  method?: string;
  query: Record<string, any>;
  body: any;
  headers: Record<string, any>;
}

export interface ApiResponse {
  setHeader: (key: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
  send: (data: any) => void;
  end: () => void;
}

const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbz6M8NmfDjG9GKdmkFMHggR6MGQwRU6Q42-hpd_gxEfbTQsjRL86mI_NavdqJB8Blzl/exec';

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const targetUrl = (
    process.env.GAS_DEPLOYMENT_URL ||
    process.env.GAS_WEB_APP_URL ||
    process.env.VITE_GAS_WEB_APP_URL ||
    (req.query.url as string) ||
    DEFAULT_GAS_URL
  ).toString().trim();

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('Vercel-CDN-Cache-Control', 'max-age=300, stale-while-revalidate=600');

    const action = (req.query.action as string) || 'all';

    const fetchEndpoint = async (act: string, timeoutMs = 35000) => {
      try {
        const u = new URL(targetUrl);
        u.searchParams.set('action', act);
        Object.entries(req.query).forEach(([k, v]) => {
          if (k !== 'url' && k !== 'refresh' && k !== 'action' && v !== undefined && v !== null) {
            u.searchParams.set(k, String(v));
          }
        });
        const res = await fetch(u.toString(), {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(timeoutMs)
        });
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json();
        const txt = await res.text();
        try { return JSON.parse(txt); } catch { return null; }
      } catch {
        return null;
      }
    };

    try {
      if (action === 'all' || action === 'bulk') {
        const directAll = await fetchEndpoint('all', 12000);
        if (directAll && directAll.success && directAll.data && (directAll.data.orderPlans || directAll.data.orders)) {
          return res.status(200).json(directAll);
        }

        // Concurrent fallback
        const [ordersRes, yarnRes, ledgerRes] = await Promise.allSettled([
          fetchEndpoint('orders/list', 35000),
          fetchEndpoint('yarn/list', 35000),
          fetchEndpoint('ledger/list', 35000)
        ]);

        const ordersData = ordersRes.status === 'fulfilled' && ordersRes.value?.data ? ordersRes.value.data : [];
        const yarnData = yarnRes.status === 'fulfilled' && yarnRes.value?.data ? yarnRes.value.data : [];
        const ledgerData = ledgerRes.status === 'fulfilled' && ledgerRes.value?.data ? ledgerRes.value.data : [];

        return res.status(200).json({
          success: true,
          data: {
            orderPlans: ordersData,
            yarnAllocations: yarnData,
            ledger: ledgerData,
            totalOrders: ordersData.length,
            totalYarn: yarnData.length,
            totalLedger: ledgerData.length
          }
        });
      }

      const singleRes = await fetchEndpoint(action, 35000);
      if (singleRes) {
        return res.status(200).json(singleRes);
      }

      return res.status(200).json({
        success: false,
        message: `Failed to fetch action ${action} from Google Sheets.`
      });
    } catch (err: any) {
      console.error('[API/SHEETS GET Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch spreadsheet data via edge proxy: ' + err.message
      });
    }
  }

  if (req.method === 'POST') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    try {
      const payload = req.body;
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
          'Accept': 'application/json'
        },
        body: typeof payload === 'string' ? payload : JSON.stringify(payload),
        signal: AbortSignal.timeout(45000)
      });

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return res.status(200).json(json);
      } else {
        const text = await response.text();
        try {
          const parsed = JSON.parse(text);
          return res.status(200).json(parsed);
        } catch (e) {
          return res.status(200).json({ success: true, message: text });
        }
      }
    } catch (err: any) {
      console.error('[API/SHEETS POST Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to write spreadsheet data via proxy: ' + err.message
      });
    }
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
