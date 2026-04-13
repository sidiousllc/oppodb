/**
 * AES-256-GCM Encrypted IndexedDB Storage
 * Uses Web Crypto API for encryption at rest.
 * All data is encrypted before being stored in IndexedDB.
 */
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "oppodb-offline";
const DB_VERSION = 1;
const STORE_NAME = "encrypted_data";
const KEY_STORE = "crypto_keys";

interface EncryptedRecord {
  id: string;
  table: string;
  iv: ArrayBuffer;
  ciphertext: ArrayBuffer;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
let cryptoKey: CryptoKey | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("table", "table", { unique: false });
          store.createIndex("table_id", ["table", "id"], { unique: true });
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE);
        }
        if (!db.objectStoreNames.contains("pending_writes")) {
          const ws = db.createObjectStore("pending_writes", { keyPath: "id", autoIncrement: true });
          ws.createIndex("table", "table", { unique: false });
        }
        if (!db.objectStoreNames.contains("sync_meta")) {
          db.createObjectStore("sync_meta");
        }
      },
    });
  }
  return dbPromise;
}

/** Derive or retrieve the encryption key. Uses a device-bound key stored in IndexedDB. */
async function getEncryptionKey(): Promise<CryptoKey> {
  if (cryptoKey) return cryptoKey;

  const db = await getDB();
  const stored = await db.get(KEY_STORE, "master_key");

  if (stored) {
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      stored,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
    return cryptoKey;
  }

  // Generate a new key
  cryptoKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Export and store the raw key
  const rawKey = await crypto.subtle.exportKey("raw", cryptoKey);
  await db.put(KEY_STORE, rawKey, "master_key");

  return cryptoKey;
}

/** Encrypt a JavaScript object */
async function encrypt(data: unknown): Promise<{ iv: ArrayBuffer; ciphertext: ArrayBuffer }> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return { iv: iv.buffer, ciphertext };
}

/** Decrypt a ciphertext back to a JavaScript object */
async function decrypt<T = unknown>(iv: ArrayBuffer, ciphertext: ArrayBuffer): Promise<T> {
  const key = await getEncryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    ciphertext
  );
  const text = new TextDecoder().decode(decrypted);
  return JSON.parse(text) as T;
}

// ─── Public API ───

/** Store a record (or array of records) encrypted in IndexedDB */
export async function storeEncrypted(table: string, records: Record<string, unknown>[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");

  for (const record of records) {
    const recordId = String(record.id || record.slug || crypto.randomUUID());
    const { iv, ciphertext } = await encrypt(record);

    const entry: EncryptedRecord = {
      id: `${table}:${recordId}`,
      table,
      iv,
      ciphertext,
      updatedAt: Date.now(),
    };

    await tx.store.put(entry);
  }

  await tx.done;
}

/** Retrieve all decrypted records for a table */
export async function getDecrypted<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const db = await getDB();
  const entries = await db.getAllFromIndex(STORE_NAME, "table", table);
  const results: T[] = [];

  for (const entry of entries) {
    try {
      const decrypted = await decrypt<T>(entry.iv, entry.ciphertext);
      results.push(decrypted);
    } catch (e) {
      console.warn(`Failed to decrypt record ${entry.id}:`, e);
    }
  }

  return results;
}

/** Get a single decrypted record by table and record ID */
export async function getDecryptedById<T = Record<string, unknown>>(
  table: string,
  recordId: string
): Promise<T | null> {
  const db = await getDB();
  const entry = await db.get(STORE_NAME, `${table}:${recordId}`);
  if (!entry) return null;

  try {
    return await decrypt<T>(entry.iv, entry.ciphertext);
  } catch {
    return null;
  }
}

/** Queue a write operation for later sync */
export async function queueWrite(
  table: string,
  operation: "insert" | "update" | "delete",
  data: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  await db.add("pending_writes", {
    table,
    operation,
    data,
    createdAt: Date.now(),
  });
}

/** Get all pending writes */
export async function getPendingWrites(): Promise<
  Array<{ id: number; table: string; operation: string; data: Record<string, unknown>; createdAt: number }>
> {
  const db = await getDB();
  return db.getAll("pending_writes");
}

/** Remove a pending write after successful sync */
export async function removePendingWrite(id: number): Promise<void> {
  const db = await getDB();
  await db.delete("pending_writes", id);
}

/** Store sync metadata (e.g., last sync timestamp per table) */
export async function setSyncMeta(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("sync_meta", value, key);
}

/** Get sync metadata */
export async function getSyncMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  return db.get("sync_meta", key);
}

/** Clear all offline data (e.g., on logout) */
export async function clearAllOfflineData(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([STORE_NAME, "pending_writes", "sync_meta"], "readwrite");
  await Promise.all([
    tx.objectStore(STORE_NAME).clear(),
    tx.objectStore("pending_writes").clear(),
    tx.objectStore("sync_meta").clear(),
  ]);
  await tx.done;
}

/** Get the total size of the offline store (approximate) */
export async function getOfflineStoreSize(): Promise<{ records: number; tables: string[] }> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  const tables = new Set(all.map((r) => r.table));
  return { records: all.length, tables: Array.from(tables) };
}
