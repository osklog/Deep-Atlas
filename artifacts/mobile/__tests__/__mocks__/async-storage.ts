const store: Record<string, string> = {};

const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return store[key] ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    store[key] = value;
  },
  removeItem: async (key: string): Promise<void> => {
    delete store[key];
  },
  clear: async (): Promise<void> => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  getAllKeys: async (): Promise<string[]> => {
    return Object.keys(store);
  },
  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map((k) => [k, store[k] ?? null]);
  },
  multiSet: async (pairs: [string, string][]): Promise<void> => {
    for (const [k, v] of pairs) {
      store[k] = v;
    }
  },
  multiRemove: async (keys: string[]): Promise<void> => {
    for (const k of keys) delete store[k];
  },
};

export default AsyncStorage;
