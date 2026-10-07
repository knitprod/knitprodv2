/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Safe clipboard helper for modern browsers and sandboxed iframe environments.
 * Prevents uncaught NotAllowedError exceptions when clipboard write permissions are denied.
 */

/**
 * Checks whether the current document / iframe allows clipboard-write operations
 */
export function isClipboardWritePermitted(): boolean {
  if (typeof document !== 'undefined') {
    try {
      if ('permissionsPolicy' in document && typeof (document as any).permissionsPolicy?.allowsFeature === 'function') {
        if (!(document as any).permissionsPolicy.allowsFeature('clipboard-write')) {
          return false;
        }
      }
      if ('featurePolicy' in document && typeof (document as any).featurePolicy?.allowsFeature === 'function') {
        if (!(document as any).featurePolicy.allowsFeature('clipboard-write')) {
          return false;
        }
      }
    } catch {
      // Ignore policy inspection errors
    }
  }
  return true;
}

/**
 * Safely copy text to clipboard with legacy document.execCommand fallback
 */
export async function safeCopyText(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Try modern Async Clipboard API if permitted
  if (
    isClipboardWritePermitted() &&
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      if (typeof window !== 'undefined' && typeof window.focus === 'function') {
        try { window.focus(); } catch { /* ignore */ }
      }
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Async clipboard writeText denied or unavailable, attempting execCommand fallback:', err);
    }
  }

  // 2. Fallback to textarea + execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.setAttribute('readonly', '');
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) return true;
    } catch (fallbackErr) {
      console.warn('execCommand copy fallback failed:', fallbackErr);
    }
  }

  return false;
}

/**
 * Safely copy image Blob to clipboard. If blocked by browser permissions,
 * catches the error safely and invokes fallback action (e.g. download).
 */
export async function safeCopyImageBlob(
  blob: Blob | null,
  fallbackAction?: () => void
): Promise<boolean> {
  if (!blob) {
    if (fallbackAction) {
      try { fallbackAction(); } catch { /* ignore */ }
    }
    return false;
  }

  // Verify feature/permissions policy first to prevent throwing NotAllowedError
  if (!isClipboardWritePermitted()) {
    console.warn('Clipboard write is not permitted by iframe sandbox or browser policy; executing fallback.');
    if (fallbackAction) {
      try { fallbackAction(); } catch { /* ignore */ }
    }
    return false;
  }

  // Check Permissions API if available
  if (typeof navigator !== 'undefined' && navigator.permissions && typeof navigator.permissions.query === 'function') {
    try {
      const status = await navigator.permissions.query({ name: 'clipboard-write' as any });
      if (status && status.state === 'denied') {
        console.warn('Clipboard write permission explicitly denied by user/browser.');
        if (fallbackAction) {
          try { fallbackAction(); } catch { /* ignore */ }
        }
        return false;
      }
    } catch {
      // Not all browsers support querying clipboard-write
    }
  }

  // Ensure window has focus before writing to clipboard
  if (typeof window !== 'undefined' && typeof window.focus === 'function') {
    try { window.focus(); } catch { /* ignore */ }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof (window as any).ClipboardItem !== 'undefined') {
    try {
      let item: any;
      try {
        item = new (window as any).ClipboardItem({ 'image/png': blob });
      } catch {
        item = new (window as any).ClipboardItem({ 'image/png': Promise.resolve(blob) });
      }
      await navigator.clipboard.write([item]);
      return true;
    } catch (err: any) {
      console.warn('Clipboard image write failed or permission denied, using fallback action:', err?.message || err);
      if (fallbackAction) {
        try {
          fallbackAction();
        } catch {
          // ignore
        }
      }
      return false;
    }
  }

  if (fallbackAction) {
    try {
      fallbackAction();
    } catch {
      // ignore
    }
  }
  return false;
}
