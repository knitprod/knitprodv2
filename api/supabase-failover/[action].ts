/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Vercel Serverless Handler for Dual-Supabase Failover, Egress Calibration,
 * Manual Active/Pause Switching, and Chunked 12-Table Migration.
 * Endpoint: /api/supabase-failover/:action
 * Strictly restricted to Superadmin (EKL001) / Raihan.
 */

import { createClient } from '@supabase/supabase-js';
import {
  BYTES_PER_GB,
  MIGRATION_TABLES,
  ServerSlotId,
  computeSlotEgressMetrics,
  ensureBillingCycleCurrent,
  estimateWireEgressBytes,
  getActiveClusterServer,
  getBillingCycleKey,
  getRequestSessionUid,
  isSupabasePermissionDeniedError,
  loadClusterStateFromCloud,
  maskKeyPreview,
  parseJsonBody,
  recordServerEgressBytesCloud,
  requireRaihanOperator,
  sanitizeSupabaseUrl,
  saveClusterStateToCloud,
  setNoStoreHeaders
} from '../_clusterStore';

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const rawAction = Array.isArray(req.query?.action) ? req.query.action[0] : req.query?.action;
  const fallbackFromUrl = typeof req.url === 'string'
    ? req.url.split('?')[0].split('/').filter(Boolean).pop()
    : '';
  const action = String(rawAction || fallbackFromUrl || '').trim().toLowerCase();
  const body = parseJsonBody(req);

  // 0. POST /api/supabase-failover/report-egress (any authenticated app user reports direct browser Supabase wire bytes)
  if (action === 'report-egress' && req.method === 'POST') {
    const headerOrCookieUid = getRequestSessionUid(req);
    const bodyUid = typeof body.uid === 'string' ? body.uid.trim().toUpperCase() : '';
    const effectiveUid = headerOrCookieUid || (/^[A-Z0-9_-]{2,32}$/.test(bodyUid) ? bodyUid : null);
    if (!effectiveUid) {
      return res.status(401).json({ success: false, message: 'Active session required.' });
    }
    const bytes = Math.round(Number(body.bytes) || 0);
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 50_000_000) {
      return res.status(200).json({ success: true, ignored: true });
    }
    try {
      const cluster = await loadClusterStateFromCloud(false);
      const activeSlot = getActiveClusterServer(cluster);
      if (!activeSlot) {
        return res.status(200).json({ success: true, ignored: true });
      }
      await recordServerEgressBytesCloud(activeSlot.id, bytes);
      return res.status(200).json({ success: true, recorded: bytes, serverId: activeSlot.id });
    } catch {
      return res.status(200).json({ success: true, ignored: true });
    }
  }

  if (!requireRaihanOperator(req, res)) {
    return;
  }

  try {
    // 1. GET /api/supabase-failover/status
    if (action === 'status' && req.method === 'GET') {
      const cluster = await loadClusterStateFromCloud(true);
      const buildView = (slot: (typeof cluster.servers)['server1']) => {
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

      return res.status(200).json({
        success: true,
        activeServerId: cluster.activeServerId,
        clusterRevision: cluster.clusterRevision,
        restricted: false,
        reason: null,
        servers: {
          server1: buildView(cluster.servers.server1),
          server2: buildView(cluster.servers.server2)
        },
        activeJob: null
      });
    }

    // 2. POST /api/supabase-failover/config
    if (action === 'config' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId. Must be server1 or server2.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];

      if (typeof body.label === 'string' && body.label.trim()) {
        slot.label = body.label.trim().slice(0, 60);
      }
      if (typeof body.supabaseUrl === 'string') {
        const rawUrl = body.supabaseUrl.trim();
        if (!rawUrl) {
          slot.supabaseUrl = '';
        } else {
          const cleanUrl = sanitizeSupabaseUrl(rawUrl);
          if (!cleanUrl) {
            return res.status(400).json({ success: false, message: 'Please enter a valid HTTPS Supabase Project URL.' });
          }
          slot.supabaseUrl = cleanUrl;
        }
      }
      if (typeof body.supabaseKey === 'string' && body.supabaseKey.trim()) {
        slot.supabaseKey = body.supabaseKey.trim();
      }
      if (body.billingResetDay !== undefined) {
        const day = Math.floor(Number(body.billingResetDay));
        if (Number.isFinite(day) && day >= 1 && day <= 28) {
          slot.billingResetDay = day;
          ensureBillingCycleCurrent(slot);
        }
      }
      if (body.egressLimitGb !== undefined) {
        const lim = Number(body.egressLimitGb);
        if (Number.isFinite(lim) && lim >= 0.5 && lim <= 500) {
          slot.egressLimitGb = Number(lim.toFixed(2));
        }
      }
      if (body.warningThresholdPct !== undefined) {
        const pct = Number(body.warningThresholdPct);
        if (Number.isFinite(pct) && pct >= 10 && pct <= 99) {
          slot.warningThresholdPct = Math.round(pct);
        }
      }

      await saveClusterStateToCloud(cluster);

      return res.status(200).json({
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
    }

    // 3. POST /api/supabase-failover/calibrate
    if (action === 'calibrate' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      ensureBillingCycleCurrent(slot);

      if (body.billingResetDay !== undefined) {
        const day = Math.floor(Number(body.billingResetDay));
        if (Number.isFinite(day) && day >= 1 && day <= 28) {
          slot.billingResetDay = day;
          slot.cycleMonthKey = getBillingCycleKey(day);
        }
      }

      if (body.reset === true) {
        slot.trackedBytesThisCycle = 0;
        slot.calibrationOffsetBytes = 0;
      } else if (body.currentGb !== undefined) {
        const targetGb = Number(body.currentGb);
        if (!Number.isFinite(targetGb) || targetGb < 0 || targetGb > 500) {
          return res.status(400).json({ success: false, message: 'Please enter a valid GB value (0 or higher).' });
        }
        const targetBytes = Math.round(targetGb * BYTES_PER_GB);
        slot.calibrationOffsetBytes = targetBytes - (Number(slot.trackedBytesThisCycle) || 0);
      }

      await saveClusterStateToCloud(cluster);
      return res.status(200).json({
        success: true,
        serverId,
        metrics: computeSlotEgressMetrics(slot),
        billingResetDay: slot.billingResetDay
      });
    }

    // 4. POST /api/supabase-failover/test
    if (action === 'test' && req.method === 'POST') {
      const serverId = body.serverId;
      if (serverId !== 'server1' && serverId !== 'server2') {
        return res.status(400).json({ success: false, message: 'Invalid serverId.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      const testUrl =
        typeof body.supabaseUrl === 'string' && body.supabaseUrl.trim()
          ? sanitizeSupabaseUrl(body.supabaseUrl)
          : slot.supabaseUrl;
      const testKey =
        typeof body.supabaseKey === 'string' && body.supabaseKey.trim()
          ? body.supabaseKey.trim()
          : slot.supabaseKey;

      if (!testUrl || !testKey) {
        return res.status(400).json({
          success: false,
          message: `Please enter both a valid HTTPS URL and Anon Key for ${slot.label}.`
        });
      }

      const tempClient = createClient(testUrl, testKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });
      const requiredTables = MIGRATION_TABLES.filter((t) => t.required);
      const results = await Promise.all(
        requiredTables.map(async (def) => {
          const { count, error } = await tempClient
            .from(def.table)
            .select('*', { count: 'exact', head: true });
          return {
            table: def.table,
            ok: !error,
            count: count ?? 0,
            error: error?.message || null
          };
        })
      );

      const readyTables = results.filter((r) => r.ok);
      const missingTables = results.filter((r) => !r.ok);

      return res.status(200).json({
        success: readyTables.length > 0,
        readyCount: readyTables.length,
        totalRequired: requiredTables.length,
        missingTables: missingTables.map((m) => ({ table: m.table, error: m.error })),
        message:
          missingTables.length === 0
            ? `Connected to ${slot.label}! All ${readyTables.length}/${requiredTables.length} tables verified and ready.`
            : readyTables.length > 0
              ? `Connected to ${slot.label} (${readyTables.length}/${requiredTables.length} tables ready). Missing: ${missingTables.map((m) => m.table).join(', ')}.`
              : `Connection or permission check failed on ${slot.label}: ${missingTables[0]?.error || 'Check URL, Key, and SQL permissions.'}`
      });
    }

    // 5. POST /api/supabase-failover/toggle-state (100% Manual Active / Pause)
    if (action === 'toggle-state' && req.method === 'POST') {
      const serverId = body.serverId;
      const toggleAction = body.action;
      if (
        (serverId !== 'server1' && serverId !== 'server2') ||
        (toggleAction !== 'activate' && toggleAction !== 'pause')
      ) {
        return res.status(400).json({ success: false, message: 'Invalid serverId or action.' });
      }

      const cluster = await loadClusterStateFromCloud(true);
      const slot = cluster.servers[serverId as ServerSlotId];
      const otherId: ServerSlotId = serverId === 'server1' ? 'server2' : 'server1';
      const otherSlot = cluster.servers[otherId];
      const nowIso = new Date().toISOString();

      if (toggleAction === 'activate') {
        if (!slot.supabaseUrl || !slot.supabaseKey) {
          return res.status(400).json({
            success: false,
            message: `Cannot activate ${slot.label} — save its Supabase Project URL and Anon Key first.`
          });
        }
        slot.status = 'active';
        slot.activatedAt = nowIso;
        slot.pausedAt = null;
        otherSlot.status = 'paused';
        otherSlot.pausedAt = nowIso;
        cluster.activeServerId = serverId;
        cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
        await saveClusterStateToCloud(cluster);

        return res.status(200).json({
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
        slot.status = 'paused';
        slot.pausedAt = nowIso;
        if (cluster.activeServerId === serverId) {
          cluster.activeServerId = null;
        }
        cluster.clusterRevision = (Number(cluster.clusterRevision) || 1) + 1;
        await saveClusterStateToCloud(cluster);

        return res.status(200).json({
          success: true,
          action: 'pause',
          activeServerId: cluster.activeServerId,
          activeServerLabel: null,
          activeServerPaused: !getActiveClusterServer(cluster),
          clusterRevision: cluster.clusterRevision,
          activeConfig: null,
          message: `${slot.label} is now HARD PAUSED. Zero data will go in or come out from ${slot.label}.`
        });
      }
    }

    // 6. POST /api/supabase-failover/migrate-table (Serverless-safe chunked 12-table migration — NEVER auto-switches)
    if (action === 'migrate-table' && req.method === 'POST') {
      const phase = String(body.phase || '').trim();
      const sourceServerId = body.sourceServerId as ServerSlotId;
      const targetServerId = body.targetServerId as ServerSlotId;

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

      const cluster = await loadClusterStateFromCloud(true);
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

      // Phase A: Pre-flight verify all 12 tables on target server
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
            const isPerm = isSupabasePermissionDeniedError(error);
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
        return res.status(200).json({
          success: missingRequired.length === 0,
          checks,
          message:
            missingRequired.length === 0
              ? `Pre-flight passed on ${targetSlot.label}. Starting table copy...`
              : `Target server is missing or denying access to: ${missingRequired.map((m) => m.table).join(', ')}. Copy & run the 12-Table Setup SQL in ${targetSlot.label}'s SQL Editor first.`
        });
      }

      // Phase B: Copy a single paginated slice of a table (fast <3s per call — zero Vercel timeout risk!)
      if (phase === 'copy') {
        const tableName = String(body.table || '').trim();
        const def = MIGRATION_TABLES.find((t) => t.table === tableName);
        if (!def) {
          return res.status(400).json({ success: false, message: `Unsupported migration table: ${tableName}` });
        }

        const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
        const limit = Math.max(50, Math.min(500, Math.floor(Number(body.limit) || 400)));

        const sourceClient = createClient(sourceSlot.supabaseUrl, sourceSlot.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const targetClient = createClient(targetSlot.supabaseUrl, targetSlot.supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // Get exact count on first slice so UI can show copied / total
        let totalRows: number | null = null;
        if (offset === 0) {
          const cnt = await sourceClient.from(def.table).select('*', { count: 'exact', head: true });
          if (cnt.error) {
            const isMissing =
              cnt.error.code === 'PGRST205' ||
              cnt.error.code === '42P01' ||
              cnt.error.message?.includes('does not exist');
            if (!def.required || isMissing) {
              return res.status(200).json({
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
            return res.status(200).json({
              success: true,
              table: def.table,
              skipped: true,
              copiedInSlice: 0,
              nextOffset: offset,
              totalRows: 0,
              hasMore: false
            });
          }
          return res.status(500).json({
            success: false,
            table: def.table,
            message: `Read error on ${def.table}: ${error.message}`
          });
        }

        const rawBatch = Array.isArray(data) ? (data as any[]) : [];
        if (rawBatch.length === 0) {
          return res.status(200).json({
            success: true,
            table: def.table,
            skipped: false,
            copiedInSlice: 0,
            nextOffset: offset,
            totalRows: totalRows ?? offset,
            hasMore: false
          });
        }

        // Strip legacy duplicated raw_data.items on knitting_orders so target stays lean
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

        // Meter compressed wire egress bytes from source server
        try {
          await recordServerEgressBytesCloud(sourceSlot.id, estimateWireEgressBytes(rawBatch));
        } catch {}

        // Upsert in 200-row sub-chunks
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
        return res.status(200).json({
          success: true,
          table: def.table,
          skipped: false,
          copiedInSlice: batch.length,
          nextOffset: offset + batch.length,
          totalRows: totalRows ?? (hasMore ? offset + batch.length : offset + batch.length),
          hasMore
        });
      }

      // Phase C: Finalize migration timestamp (NEVER auto-switches server states!)
      if (phase === 'finalize') {
        targetSlot.lastMigratedAt = new Date().toISOString();
        await saveClusterStateToCloud(cluster);
        return res.status(200).json({
          success: true,
          message: `Migration to ${targetSlot.label} completed. Active/Paused server states were NOT changed automatically — use Activate / Pause whenever you are ready.`
        });
      }

      return res.status(400).json({ success: false, message: 'Invalid migration phase.' });
    }

    return res.status(404).json({ success: false, message: `Unknown failover action: ${action}` });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      message: err?.message || 'Unexpected error in failover controller.'
    });
  }
}
