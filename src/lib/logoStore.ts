/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SupabaseSync } from './supabaseClient';

const LOGO_STORAGE_KEY = 'ekl_company_logo';
const MY_LOGO_STORAGE_KEY = 'ekl_my_logo';

export function getCompanyLogo(): string | null {
  try {
    return localStorage.getItem(LOGO_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveCompanyLogo(base64DataUrl: string): void {
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, base64DataUrl);
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: base64DataUrl }));
    // Sync to Supabase settings asynchronously
    SupabaseSync.saveSettings({ companyLogo: base64DataUrl }).catch((err) => {
      console.warn('Failed to sync logo to Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to save company logo:', e);
  }
}

export function removeCompanyLogo(): void {
  try {
    localStorage.removeItem(LOGO_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('company_logo_updated', { detail: null }));
    SupabaseSync.saveSettings({ companyLogo: '' }).catch((err) => {
      console.warn('Failed to remove logo from Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to remove company logo:', e);
  }
}

// ----------------------------------------------------
// DEDICATED "MY LOGO" / "POWERED BY LOGO" MANAGEMENT
// ----------------------------------------------------
export function getMyLogo(): string | null {
  try {
    return localStorage.getItem(MY_LOGO_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function saveMyLogo(base64DataUrl: string): void {
  try {
    localStorage.setItem(MY_LOGO_STORAGE_KEY, base64DataUrl);
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: base64DataUrl }));
    SupabaseSync.saveSettings({ myLogo: base64DataUrl }).catch((err) => {
      console.warn('Failed to sync My Logo to Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to save My Logo:', e);
  }
}

export function removeMyLogo(): void {
  try {
    localStorage.removeItem(MY_LOGO_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('my_logo_updated', { detail: null }));
    SupabaseSync.saveSettings({ myLogo: '' }).catch((err) => {
      console.warn('Failed to remove My Logo from Supabase:', err);
    });
  } catch (e) {
    console.error('Failed to remove My Logo:', e);
  }
}

// Aliases for convenience
export const getPoweredByLogo = getMyLogo;
export const savePoweredByLogo = saveMyLogo;
export const removePoweredByLogo = removeMyLogo;
