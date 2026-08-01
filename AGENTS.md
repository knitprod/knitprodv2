# 🔒 Security & Authentication Requirements (Mandatory)

This application is an enterprise production system. Security is the highest priority.

## Browser Storage & Credential Security

**DO NOT** save or cache plain text passwords, emails, credentials, or sensitive user secrets in:
* `localStorage`
* `sessionStorage`
* `IndexedDB`
* Browser Cache for user sensitive data
* Unencrypted client-side files

Never save:
* Plaintext Passwords
* User Authentication Secrets
* Unsanitized User Credentials

The browser must never store plaintext passwords or authentication tokens in unencrypted local storage.

---

## Authentication & User Session

Use **Firebase Authentication** & secure Firestore data models to verify login credentials.

1. Fetch and verify user profiles from Firestore upon authentication.
2. Store active session user profile in React memory (State/Context) without plaintext passwords.
3. Clear all active user state completely on logout or browser close.

---

## User Profile & Permissions

Never store raw user permissions or security roles in client-side storage keys.

* Dashboard Access
* Reports & Analytics Access
* User Management & Admin Rights
* Unit Assignment
* Data Modification Rights

Permissions must always be dynamically evaluated from Firestore or backend authentication context in memory.

---

## Authorization & UI Security

The frontend is **NOT** trusted.

Every protected action and entry must verify:
* Active User Session
* Account Status (Active / Inactive)
* Role & Department Permissions
* Assigned Factory Unit

Never rely solely on hidden buttons or menu items for data security.

---

## Logout & Session Inactivity Cleanup

On logout or session expiration:
* Clear active user state from memory.
* Remove session tokens and identifiers from session storage.
* Redirect to Login screen immediately.

---

## Development Rules

The generated code **must never** write plaintext passwords or user credentials into `localStorage` or `sessionStorage`. If any generated code attempts to use `localStorage` or `sessionStorage` for storing plaintext passwords or sensitive user credentials, treat it as a bug and replace it with secure memory/Firestore authentication.
