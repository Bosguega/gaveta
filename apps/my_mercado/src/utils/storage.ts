/* eslint-disable no-console */
import { logger } from "./logger";
/**
 * Storage Unificado com Fallback Automático
 *
 * Estratégia em camadas:
 * 1. IndexedDB (preferencial - suporta grandes volumes)
 * 2. localStorage (fallback - limitado a ~5MB)
 * 3. sessionStorage (último recurso - limpa ao fechar)
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
 */

const STORAGE_PREFIX = "@MyMercado:";

// ==============================
// TYPE DEFINITIONS
// ==============================

export type StorageKey =
  | "receipts"
  | "dictionary"
  | "canonical_products"
  | "settings"
  | "backup";

export interface StorageOptions {
  /** Usar fallback localStorage se IndexedDB falhar */
  useFallback?: boolean;
  /** Expiração em ms (opcional) */
  ttl?: number;
}

// ==============================
// INDEXEDDB WRAPPER
// ==============================

const DB_NAME = "MyMercadoDB";
const DB_VERSION = 1;

interface DBSchema {
  receipts: { id: string; value: unknown; timestamp: number };
  dictionary: { id: string; value: unknown; timestamp: number };
  canonical_products: { id: string; value: unknown; timestamp: number };
  settings: { id: string; value: unknown; timestamp: number };
  backup: { id: string; value: unknown; timestamp: number };
}

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Inicializa ou retorna instância do IndexedDB
 */
async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbInitPromise = null;
      reject(new Error("IndexedDB não disponível"));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbInitPromise = null;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Criar object stores se não existirem
      const stores: (keyof DBSchema)[] = [
        "receipts",
        "dictionary",
        "canonical_products",
        "settings",
        "backup",
      ];

      stores.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
        }
      });
    };
  });

  return dbInitPromise;
}

/**
 * Verifica se IndexedDB está disponível
 */
export function isIndexedDBAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

/**
 * Salva dado no IndexedDB
 */
export async function indexedDBSet<T>(
  store: keyof DBSchema,
  key: string,
  value: T,
): Promise<void> {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const objectStore = transaction.objectStore(store);

      const request = objectStore.put({
        id: key,
        value,
        timestamp: Date.now(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao salvar em ${store}`));
    });
  } catch (error) {
    console.warn(`IndexedDB falhou para ${store}, usando fallback:`, error);
    throw error;
  }
}

/**
 * Lê dado do IndexedDB
 */
export async function indexedDBGet<T>(
  store: keyof DBSchema,
  key: string,
): Promise<T | null> {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const objectStore = transaction.objectStore(store);

      const request = objectStore.get(key);

      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? (result.value as T) : null);
      };
      request.onerror = () => reject(new Error(`Erro ao ler ${store}`));
    });
  } catch (error) {
    console.warn(`IndexedDB falhou para ${store}, usando fallback:`, error);
    throw error;
  }
}

/**
 * Remove dado do IndexedDB
 */
export async function indexedDBDelete(
  store: keyof DBSchema,
  key: string,
): Promise<void> {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const objectStore = transaction.objectStore(store);

      const request = objectStore.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao deletar de ${store}`));
    });
  } catch (error) {
    console.warn(`IndexedDB falhou para ${store}:`, error);
    throw error;
  }
}

/**
 * Limpa toda a store do IndexedDB
 */
export async function indexedDBClear(store: keyof DBSchema): Promise<void> {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      const objectStore = transaction.objectStore(store);

      const request = objectStore.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao limpar ${store}`));
    });
  } catch (error) {
    console.warn(`IndexedDB falhou para ${store}:`, error);
    throw error;
  }
}

/**
 * Obtém todos os itens de uma store
 */
export async function indexedDBGetAll<T>(
  store: keyof DBSchema,
): Promise<T[]> {
  try {
    const db = await getDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, "readonly");
      const objectStore = transaction.objectStore(store);

      const request = objectStore.getAll();

      request.onsuccess = () => {
        const results = request.result;
        resolve(results.map((r) => r.value as T));
      };
      request.onerror = () => reject(new Error(`Erro ao ler todos de ${store}`));
    });
  } catch (error) {
    console.warn(`IndexedDB falhou para ${store}:`, error);
    throw error;
  }
}

// ==============================
// LOCALSTORAGE WRAPPER
// ==============================

/**
 * Salva dado no localStorage
 */
export function localStorageSet<T>(key: string, value: T): void {
  try {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  } catch (error) {
    logger.error("UnifiedStorage", "localStorage cheio ou não disponível", error);
    throw error;
  }
}

/**
 * Lê dado do localStorage
 */
export function localStorageGet<T>(key: string): T | null {
  try {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    const item = localStorage.getItem(fullKey);
    return item ? (JSON.parse(item) as T) : null;
  } catch (error) {
    logger.error("UnifiedStorage", "Erro ao ler localStorage", error);
    return null;
  }
}

/**
 * Remove dado do localStorage
 */
export function localStorageDelete(key: string): void {
  try {
    const fullKey = `${STORAGE_PREFIX}${key}`;
    localStorage.removeItem(fullKey);
  } catch (error) {
    logger.error("UnifiedStorage", "Erro ao deletar localStorage", error);
  }
}

/**
 * Limpa todos os dados do MyMercado no localStorage
 */
export function localStorageClear(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (error) {
    logger.error("UnifiedStorage", "Erro ao limpar localStorage", error);
  }
}

// ==============================
// UNIFIED STORAGE API
// ==============================

/**
 * Storage unificado com fallback automático
 * Tenta IndexedDB primeiro, fallback para localStorage
 */
export class UnifiedStorage {
  private store: keyof DBSchema;
  private useFallback: boolean;

  constructor(store: keyof DBSchema, options: StorageOptions = {}) {
    this.store = store;
    this.useFallback = options.useFallback ?? true;
  }

  /**
   * Salva dado com fallback automático
   */
  async set<T>(key: string, value: T): Promise<"indexeddb" | "localStorage"> {
    try {
      if (isIndexedDBAvailable()) {
        await indexedDBSet(this.store, key, value);
        return "indexeddb";
      }
    } catch (error) {
      console.warn(`IndexedDB falhou, tentando fallback:`, error);
    }

    if (this.useFallback) {
      localStorageSet(`${this.store}:${key}`, value);
      return "localStorage";
    }

    throw new Error("Nenhum storage disponível");
  }

  /**
   * Lê dado com fallback automático
   */
  async get<T>(key: string): Promise<T | null> {
    // Tenta IndexedDB primeiro
    if (isIndexedDBAvailable()) {
      try {
        const value = await indexedDBGet<T>(this.store, key);
        if (value !== null) {
          return value;
        }
      } catch (error) {
        console.warn(`IndexedDB falhou, tentando fallback:`, error);
      }
    }

    // Fallback para localStorage
    if (this.useFallback) {
      return localStorageGet<T>(`${this.store}:${key}`);
    }

    return null;
  }

  /**
   * Remove dado de ambos os storages
   */
  async delete(key: string): Promise<void> {
    // Remove de IndexedDB se disponível
    if (isIndexedDBAvailable()) {
      try {
        await indexedDBDelete(this.store, key);
      } catch (error) {
        console.warn(`Erro ao deletar de IndexedDB:`, error);
      }
    }

    // Remove de localStorage
    if (this.useFallback) {
      localStorageDelete(`${this.store}:${key}`);
    }
  }

  /**
   * Limpa toda a store
   */
  async clear(): Promise<void> {
    // Limpa IndexedDB se disponível
    if (isIndexedDBAvailable()) {
      try {
        await indexedDBClear(this.store);
      } catch (error) {
        console.warn(`Erro ao limpar IndexedDB:`, error);
      }
    }

    // Limpa localStorage
    if (this.useFallback) {
      localStorageClear();
    }
  }

  /**
   * Obtém todos os itens
   */
  async getAll<T>(): Promise<T[]> {
    // Tenta IndexedDB primeiro
    if (isIndexedDBAvailable()) {
      try {
        const values = await indexedDBGetAll<T>(this.store);
        if (values.length > 0) {
          return values;
        }
      } catch (error) {
        console.warn(`IndexedDB falhou, tentando fallback:`, error);
      }
    }

    // Fallback: varrer localStorage
    if (this.useFallback) {
      const prefix = `${STORAGE_PREFIX}${this.store}:`;
      const results: T[] = [];

      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith(prefix)) {
            const item = localStorage.getItem(key);
            if (item) {
              results.push(JSON.parse(item) as T);
            }
          }
        }
      } catch (error) {
        console.warn(`Erro ao ler localStorage:`, error);
      }

      return results;
    }

    return [];
  }
}

// ==============================
// CONVENIENCE FACTORIES
// ==============================

/**
 * Cria storage unificado para receipts
 */
export function createReceiptsStorage() {
  return new UnifiedStorage("receipts");
}

/**
 * Cria storage unificado para dicionário
 */
export function createDictionaryStorage() {
  return new UnifiedStorage("dictionary");
}

/**
 * Cria storage unificado para produtos canônicos
 */
export function createCanonicalProductsStorage() {
  return new UnifiedStorage("canonical_products");
}

/**
 * Cria storage unificado para settings
 */
export function createSettingsStorage() {
  return new UnifiedStorage("settings");
}

// ==============================
// MIGRATION UTILS
// ==============================

/**
 * Migra dados do localStorage para IndexedDB
 */
export async function migrateLocalStorageToIndexedDB(): Promise<{
  migrated: number;
  errors: number;
}> {
  let migrated = 0;
  let errors = 0;

  if (!isIndexedDBAvailable()) {
    console.warn("IndexedDB não disponível, migração cancelada");
    return { migrated: 0, errors: 0 };
  }

  const stores: (keyof DBSchema)[] = [
    "receipts",
    "dictionary",
    "canonical_products",
    "settings",
  ];

  for (const store of stores) {
    const prefix = `${STORAGE_PREFIX}${store}:`;
    const keysToMigrate: string[] = [];

    // Encontrar chaves no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const shortKey = key.replace(prefix, "");
        keysToMigrate.push(shortKey);
      }
    }

    // Migrar cada chave
    for (const key of keysToMigrate) {
      try {
        const value = localStorageGet(`${store}:${key}`);
        if (value !== null) {
          await indexedDBSet(store, key, value);
          localStorageDelete(`${store}:${key}`);
          migrated++;
        }
      } catch (error) {
        logger.error("UnifiedStorage", `Erro ao migrar ${store}:${key}`, error);
        errors++;
      }
    }
  }

  console.log(`Migração concluída: ${migrated} itens migrados, ${errors} erros`);
  return { migrated, errors };
}

/**
 * Verifica status do storage
 */
export async function getStorageStatus(): Promise<{
  indexedDB: boolean;
  localStorage: boolean;
  totalItems: number;
  storageUsed: "indexeddb" | "localStorage" | "none";
}> {
  const indexedDB = isIndexedDBAvailable();
  const hasLocalStorage = typeof window !== "undefined" && !!window.localStorage;

  let totalItems = 0;
  let storageUsed: "indexeddb" | "localStorage" | "none" = "none";

  if (indexedDB) {
    try {
      const db = await getDB();
      const stores = db.objectStoreNames;

      for (let i = 0; i < stores.length; i++) {
        const store = stores.item(i);
        if (store) {
          const count = await new Promise<number>((resolve) => {
            const transaction = db.transaction(store, "readonly");
            const objectStore = transaction.objectStore(store);
            const request = objectStore.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(0);
          });
          totalItems += count;
        }
      }

      if (totalItems > 0) {
        storageUsed = "indexeddb";
      }
    } catch (error) {
      console.warn("Erro ao verificar IndexedDB:", error);
    }
  }

  if (storageUsed === "none" && typeof window !== "undefined" && window.localStorage) {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      if (ls.key(i)?.startsWith(STORAGE_PREFIX)) {
        totalItems++;
        storageUsed = "localStorage";
      }
    }
  }

  return { indexedDB, localStorage: hasLocalStorage, totalItems, storageUsed };
}
