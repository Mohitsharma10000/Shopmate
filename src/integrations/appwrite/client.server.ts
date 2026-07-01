import { Client, Account, Databases, Storage } from 'node-appwrite';

const endpoint = process.env.VITE_APPWRITE_ENDPOINT;
const projectId = process.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = process.env.VITE_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId) {
  console.warn('[Appwrite Server] Missing Appwrite environment variables in server runtime.');
}

export const APPWRITE_DATABASE_ID = databaseId || '';

export function createAdminClient() {
  if (!apiKey) {
    throw new Error('Missing APPWRITE_API_KEY environment variable on the server');
  }

  const client = new Client()
    .setEndpoint(endpoint || '')
    .setProject(projectId || '')
    .setKey(apiKey);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
  };
}

export function createUserClient(jwt: string) {
  const client = new Client()
    .setEndpoint(endpoint || '')
    .setProject(projectId || '')
    .setJWT(jwt);

  return {
    get account() {
      return new Account(client);
    },
    get databases() {
      return new Databases(client);
    },
    get storage() {
      return new Storage(client);
    },
  };
}
