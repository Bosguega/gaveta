import type { ConfigStore } from '@bosguega/gaveta-de-bagunca';
import { invoke } from '@tauri-apps/api/core';

export const tauriStore: ConfigStore = {
    apiKey: {
        get: (key) => invoke<string | null>('get_config', { key }),
        set: (key, value) => invoke('set_config', { key, value }),
        remove: (key) => invoke('remove_config', { key }),
    },
    preferences: {
        get: (key) => invoke<string | null>('get_config', { key }),
        set: (key, value) => invoke('set_config', { key, value }),
        remove: (key) => invoke('remove_config', { key }),
    },
};