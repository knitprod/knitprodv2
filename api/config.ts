/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-contained Vercel Serverless Function for Active Cluster Configuration.
 * Endpoint: /api/config
 * Zero relative imports or static JSON imports so Node.js ESM never fails on Vercel.
 */

const DEFAULT_SERVER1_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://kwaezsfoalfhigzcnezd.supabase.co';

const DEFAULT_SERVER1_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3YWV6c2ZvYWxmaGlnemNuZXpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczOTUzNzksImV4cCI6MjEwMjk3MTM3OX0.eYxuK9fCwix4i0GnHW-UBl2Kg_gZNOaPWvQ6FkMy_Qs';

const DEFAULT_SERVER2_URL =
  process.env.SUPABASE_SERVER2_URL ||
  process.env.VITE_SUPABASE_SERVER2_URL ||
  'https://prunomfyqfbpvzojafar.supabase.co';

const DEFAULT_SERVER2_KEY =
  process.env.SUPABASE_SERVER2_ANON_KEY ||
  process.env.VITE_SUPABASE_SERVER2_ANON_KEY ||
  'sb_publishable_h6pz72HjpfiXGTBuLMcuTQ_Fx8ZAHDm';

const FIRESTORE_PROJECT = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0538168382';
const FIRESTORE_DB_ID =
  process.env.FIREBASE_DB_ID || 'ai-studio-epyllionknitexlt-52272a1a-3da9-4fb0-9f0d-7b27c4e625d8';
const FIRESTORE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyCySmVMKT0b84CB0wVjfO9zwYtppf6JPJw';

function getClusterDocUrl(): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    FIRESTORE_PROJECT
  )}/databases/${encodeURIComponent(
    FIRESTORE_DB_ID
  )}/documents/settings/supabase_cluster?key=${encodeURIComponent(FIRESTORE_API_KEY)}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-session-uid');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let activeServerId: 'server1' | 'server2' | null = 'server1';
  let activeServerPaused = false;
  let clusterRevision = 1;
  let supabaseUrl = DEFAULT_SERVER1_URL;
  let supabaseKey = DEFAULT_SERVER1_KEY;

  try {
    const docRes = await fetch(getClusterDocUrl(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (docRes.ok) {
      const doc = await docRes.json();
      const rawPayload = doc?.fields?.payload?.stringValue;
      if (typeof rawPayload === 'string' && rawPayload.trim()) {
        const parsed = JSON.parse(rawPayload);
        if (parsed && parsed.servers) {
          clusterRevision = Number(parsed.clusterRevision) || 1;
          activeServerId =
            parsed.activeServerId === 'server1' || parsed.activeServerId === 'server2'
              ? parsed.activeServerId
              : null;
          if (!activeServerId) {
            activeServerPaused = true;
            supabaseUrl = '';
            supabaseKey = '';
          } else {
            const slot = parsed.servers[activeServerId];
            if (!slot || slot.status !== 'active') {
              activeServerPaused = true;
              supabaseUrl = '';
              supabaseKey = '';
            } else {
              activeServerPaused = false;
              supabaseUrl =
                slot.supabaseUrl ||
                (activeServerId === 'server1' ? DEFAULT_SERVER1_URL : DEFAULT_SERVER2_URL);
              supabaseKey =
                slot.supabaseKey ||
                (activeServerId === 'server1' ? DEFAULT_SERVER1_KEY : DEFAULT_SERVER2_KEY);
            }
          }
        }
      }
    }
  } catch {
    // Graceful fallback to Server 1 defaults
  }

  return res.status(200).json({
    success: true,
    config: {
      gasWebAppUrl:
        process.env.GAS_WEB_APP_URL ||
        'https://script.google.com/macros/s/AKfycbzfsNc4kKa3jcyeC646qmVWhaCyvJKWMlGwvcRRJeDLqaTS61bIIteWEYvVb_Gk_Q/exec',
      databaseMode: 'gas',
      supabaseUrl,
      supabaseKey,
      activeServerId,
      activeServerPaused,
      clusterRevision
    }
  });
}
