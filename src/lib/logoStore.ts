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

/**
 * Compresses & optimizes an image file/dataUrl to standard logo dimensions (max 600x400)
 * to avoid LocalStorage quota issues and high payload transmission errors.
 */
export async function optimizeLogoImage(
  input: File | Blob | string,
  maxWidth = 600,
  maxHeight = 400,
  quality = 0.92
): Promise<string> {
  return new Promise((resolve, reject) => {
    const processDataUrl = (dataUrl: string) => {
      // If already small SVG or small PNG/JPEG (< 45KB), return as is
      if (dataUrl.startsWith('data:image/svg+xml') || dataUrl.length < 45000) {
        resolve(dataUrl);
        return;
      }

      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(width, 1);
          canvas.height = Math.max(height, 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          // Use PNG if original was PNG (preserves transparency), else JPEG
          const isPng = dataUrl.startsWith('data:image/png');
          const outputFormat = isPng ? 'image/png' : 'image/jpeg';
          const optimized = canvas.toDataURL(outputFormat, quality);

          resolve(optimized.length < dataUrl.length ? optimized : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      processDataUrl(input);
    } else if (input instanceof File || input instanceof Blob) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          processDataUrl(reader.result);
        } else {
          reject(new Error('Failed to read image file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(input);
    } else {
      reject(new Error('Invalid image input'));
    }
  });
}

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

export async function saveCompanyLogo(base64DataUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const optimized = await optimizeLogoImage(base64DataUrl);
    inMemoryCompanyLogo = optimized;
    try { 
      localStorage.setItem(LOGO_STORAGE_KEY, optimized); 
    } catch (lsErr) {
      console.warn('localStorage quota warning for company logo:', lsErr);
    }
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: optimized }));

    // 1. Instantly sync to Express central server (available to all devices & browsers)
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyLogo: optimized })
    }).catch((err) => {
      console.warn('Failed to sync company logo to Express server:', err);
    });

    // 2. Sync to Supabase cloud database
    const supabaseOk = await SupabaseSync.saveSettings({ companyLogo: optimized });
    if (!supabaseOk) {
      console.warn('Supabase logo save notice: fallback mechanisms active.');
    }
    return { success: true };
  } catch (e: any) {
    console.error('Failed to save company logo:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

export async function removeCompanyLogo(): Promise<void> {
  try {
    inMemoryCompanyLogo = null;
    try { localStorage.removeItem(LOGO_STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: null }));

    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyLogo: '' })
    }).catch(() => {});

    await SupabaseSync.saveSettings({ companyLogo: '' });
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

export async function saveMyLogo(base64DataUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const optimized = await optimizeLogoImage(base64DataUrl);
    inMemoryMyLogo = optimized;
    try { 
      localStorage.setItem(MY_LOGO_STORAGE_KEY, optimized); 
    } catch (lsErr) {
      console.warn('localStorage quota warning for My Logo:', lsErr);
    }
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: optimized }));

    // 1. Instantly sync to Express central server (available to all devices & browsers)
    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myLogo: optimized })
    }).catch((err) => {
      console.warn('Failed to sync My Logo to Express server:', err);
    });

    // 2. Sync to Supabase cloud database
    const supabaseOk = await SupabaseSync.saveSettings({ myLogo: optimized });
    if (!supabaseOk) {
      console.warn('Supabase My Logo save notice: fallback mechanisms active.');
    }
    return { success: true };
  } catch (e: any) {
    console.error('Failed to save My Logo:', e);
    return { success: false, error: e?.message || String(e) };
  }
}

export async function removeMyLogo(): Promise<void> {
  try {
    inMemoryMyLogo = null;
    try { localStorage.removeItem(MY_LOGO_STORAGE_KEY); } catch {}
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: null }));

    fetch('/api/branding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ myLogo: '' })
    }).catch(() => {});

    await SupabaseSync.saveSettings({ myLogo: '' });
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
  } catch {
    // Fallback to Supabase
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
    } catch {
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
    // Push local to remote server and Supabase for other devices
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
    // Push local to remote server and Supabase for other devices
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

