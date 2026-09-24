/**
 * Stockage clé/valeur asynchrone (JSON).
 * Web : localStorage. Mobile (phase 3) : @capacitor/preferences, même interface.
 */
export interface StorageService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export function createLocalStorage(
  backend: Storage | undefined = globalThis.localStorage,
): StorageService {
  const memory = new Map<string, string>();
  const read = (key: string): string | null => {
    try {
      return backend ? backend.getItem(key) : (memory.get(key) ?? null);
    } catch {
      return memory.get(key) ?? null;
    }
  };
  const write = (key: string, value: string): void => {
    try {
      if (backend) backend.setItem(key, value);
      else memory.set(key, value);
    } catch {
      // Stockage plein ou interdit (navigation privée) : on garde en mémoire.
      memory.set(key, value);
    }
  };
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = read(key);
      if (raw === null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      write(key, JSON.stringify(value));
    },
    async remove(key: string): Promise<void> {
      memory.delete(key);
      try {
        backend?.removeItem(key);
      } catch {
        // ignoré
      }
    },
  };
}

export const storage: StorageService = createLocalStorage();
