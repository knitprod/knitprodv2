/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseSync } from './supabaseClient';

const LOGO_STORAGE_KEY = 'ekl_company_logo';
const MY_LOGO_STORAGE_KEY = 'ekl_my_logo';

let inMemoryCompanyLogo: string | null = null;
let inMemoryMyLogo: string | null = null;
let isSyncing = false;

export function getCompanyLogo(): string | null {
  if (inMemoryCompanyLogo !== null) return inMemoryCompanyLogo;
  try {
    const stored = localStorage.getItem(LOGO_STORAGE_KEY);
    inMemoryCompanyLogo = stored || null;
    return inMemoryCompanyLogo;
  } catch {
    return inMemoryCompanyLogo;
  }
}

export function saveCompanyLogo(base64DataUrl: string): void {
  try {
    inMemoryCompanyLogo = base64DataUrl;
    try { localStorage.setItem(LOGO_STORAGE_KEY, base64DataUrl); } catch {}
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: base64DataUrl }));

    // 1. Instantly sync to Express central server (available to all devices & browsers)
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyLogo: base64DataUrl })
    }).catch((err) => {
      console.warn('Failed to sync company logo to Express server:', err);
    });

    // 2. Sync to Supabase cloud database
    SupabaseSync.saveSettings({ companyLogo: base64DataUrl }).catch((err) => {
      console.warn('Failed to sync company logo to Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to save company logo:', e);
  }
}

export function removeCompanyLogo(): void {
  try {
    inMemoryCompanyLogo = null;
    try { localStorage.removeItem(LOGO_STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: null }));

    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyLogo: '' })
    }).catch(() => {});

    SupabaseSync.saveSettings({ companyLogo: '' }).catch(() => {});
  } catch (e) {
    console.error('Failed to remove company logo:', e);
  }
}

// ----------------------------------------------------
// DEDICATED "MY LOGO" / "POWERED BY LOGO" MANAGEMENT
// ----------------------------------------------------
export function getMyLogo(): string | null {
  if (inMemoryMyLogo !== null) return inMemoryMyLogo;
  try {
    const stored = localStorage.getItem(MY_LOGO_STORAGE_KEY);
    inMemoryMyLogo = stored || null;
    return inMemoryMyLogo;
  } catch {
    return inMemoryMyLogo;
  }
}

export function saveMyLogo(base64DataUrl: string): void {
  try {
    inMemoryMyLogo = base64DataUrl;
    try { localStorage.setItem(MY_LOGO_STORAGE_KEY, base64DataUrl); } catch {}
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: base64DataUrl }));

    // 1. Instantly sync to Express central server (available to all devices & browsers)
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myLogo: base64DataUrl })
    }).catch((err) => {
      console.warn('Failed to sync My Logo to Express server:', err);
    });

    // 2. Sync to Supabase cloud database
    SupabaseSync.saveSettings({ myLogo: base64DataUrl }).catch((err) => {
      console.warn('Failed to sync My Logo to Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to save My Logo:', e);
  }
}

export function removeMyLogo(): void {
  try {
    inMemoryMyLogo = null;
    try { localStorage.removeItem(MY_LOGO_STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: null }));

    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myLogo: '' })
    }).catch(() => {});

    SupabaseSync.saveSettings({ myLogo: '' }).catch(() => {});
  } catch (e) {
    console.error('Failed to remove My Logo:', e);
  }
}

/**
 * Cross-Device Synchronization Initializer
 * Fetches active companyLogo and myLogo from the central cloud/server.
 * If local device has an existing logo that the server lacks, it auto-pushes to server.
 */
export async function initBrandingSync(): Promise<{ companyLogo: string | null; myLogo: string | null }> {
  if (isSyncing) {
    return { companyLogo: getCompanyLogo(), myLogo: getMyLogo() };
  }
  isSyncing = true;

  let remoteCompanyLogo: string | null = null;
  let remoteMyLogo: string | null = null;

  try {
    // 1. First attempt: Query Express central /api/branding
    const res = await fetch('/api/branding', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.branding) {
        if (data.branding.companyLogo) remoteCompanyLogo = data.branding.companyLogo;
        if (data.branding.myLogo) remoteMyLogo = data.branding.myLogo;
      }
    }
  } catch (err) {
    // Fallback
  }

  // 2. Second attempt: Check Supabase cloud settings
  if (!remoteCompanyLogo || !remoteMyLogo) {
    try {
      const supabaseSettings = await SupabaseSync.fetchSettings();
      if (supabaseSettings) {
        if (!remoteCompanyLogo && supabaseSettings.companyLogo) {
          remoteCompanyLogo = supabaseSettings.companyLogo;
        }
        if (!remoteMyLogo && supabaseSettings.myLogo) {
          remoteMyLogo = supabaseSettings.myLogo;
        }
      }
    } catch (err) {
      // Ignore network warning
    }
  }

  const localCompanyLogo = getCompanyLogo();
  const localMyLogo = getMyLogo();

  // Apply or publish Company Logo
  if (remoteCompanyLogo && typeof remoteCompanyLogo === 'string' && remoteCompanyLogo.trim()) {
    if (inMemoryCompanyLogo !== remoteCompanyLogo) {
      inMemoryCompanyLogo = remoteCompanyLogo;
      try { localStorage.setItem(LOGO_STORAGE_KEY, remoteCompanyLogo); } catch {}
      window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: remoteCompanyLogo }));
    }
  } else if (localCompanyLogo) {
    // Push local to remote server for other devices
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyLogo: localCompanyLogo })
    }).catch(() => {});
    SupabaseSync.saveSettings({ companyLogo: localCompanyLogo }).catch(() => {});
  }

  // Apply or publish My Logo ("POWERED BY")
  if (remoteMyLogo && typeof remoteMyLogo === 'string' && remoteMyLogo.trim()) {
    if (inMemoryMyLogo !== remoteMyLogo) {
      inMemoryMyLogo = remoteMyLogo;
      try { localStorage.setItem(MY_LOGO_STORAGE_KEY, remoteMyLogo); } catch {}
      window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: remoteMyLogo }));
    }
  } else if (localMyLogo) {
    // Push local to remote server for other devices
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myLogo: localMyLogo })
    }).catch(() => {});
    SupabaseSync.saveSettings({ myLogo: localMyLogo }).catch(() => {});
  }

  isSyncing = false;
  return { companyLogo: getCompanyLogo(), myLogo: getMyLogo() };
}

// Auto-run sync on module load in browser environments
if (typeof window !== 'undefined') {
  initBrandingSync().catch(() => {});
}

// Aliases for convenience
export const getPoweredByLogo = getMyLogo;
export const savePoweredByLogo = saveMyLogo;
export const removePoweredByLogo = removeMyLogo;
