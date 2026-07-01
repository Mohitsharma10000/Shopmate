import { Client, Account, Databases, Storage } from 'appwrite';

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT || (typeof process !== 'undefined' ? process.env.VITE_APPWRITE_ENDPOINT : '');
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID || (typeof process !== 'undefined' ? process.env.VITE_APPWRITE_PROJECT_ID : '');
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID || (typeof process !== 'undefined' ? process.env.VITE_APPWRITE_DATABASE_ID : '');

if (!endpoint || !projectId) {
  console.warn('[Appwrite Client] Missing endpoint or project ID configuration.');
}

export const client = new Client();
if (endpoint && projectId) {
  client.setEndpoint(endpoint).setProject(projectId);
}

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
export const APPWRITE_DATABASE_ID = databaseId || '';

// JWT token caching to avoid fetching a new JWT on every single server function call.
// Appwrite JWT tokens are valid for 15 minutes.
let cachedJwt: string | null = null;
let jwtExpiry = 0;

export async function getSessionToken(): Promise<string | null> {
  try {
    const now = Date.now();
    if (cachedJwt && now < jwtExpiry) {
      return cachedJwt;
    }
    const session = await account.createJWT();
    cachedJwt = session.jwt;
    // Set cache expiry to 13 minutes (780,000ms) to ensure safety margin before token actually expires in 15m.
    jwtExpiry = now + 13 * 60 * 1000;
    return cachedJwt;
  } catch (error) {
    // User is likely not logged in or session is expired.
    cachedJwt = null;
    jwtExpiry = 0;
    return null;
  }
}

export function clearSessionTokenCache() {
  cachedJwt = null;
  jwtExpiry = 0;
}

// Custom event emitter to replicate onAuthStateChange behavior in TanStack Router client routes
export const authEvents = {
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  },
  notify() {
    clearSessionTokenCache();
    this.listeners.forEach((l) => l());
  },
};
