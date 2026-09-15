import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type ThemeMode = "dark" | "light" | "system";

interface SettingsState {
  themeMode: ThemeMode;
  proxyUrl: string;
  /** V3: local coaching notifications (repeat mistake / level cleared).
   * Absent in pre-V3 persisted settings — read with `!== false` guards so the
   * default stays ON for fresh installs. Does not gate coaching or the
   * proficiency breakdown, which stay inline features. */
  notificationsOn?: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (m: ThemeMode) => void;
  setProxyUrl: (url: string) => void;
  setNotificationsOn: (v: boolean) => void;
}

const KEY = "vuga.settings.v1";

const DEFAULT_PROXY_URL = "http://localhost:8787";

interface PersistedSettings {
  themeMode: ThemeMode;
  proxyUrl: string;
  notificationsOn?: boolean;
}

export const useSettings = create<SettingsState>((set, get) => ({
  themeMode: "dark",
  proxyUrl: DEFAULT_PROXY_URL,
  notificationsOn: undefined,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedSettings>;
      set({
        themeMode: parsed.themeMode === "light" || parsed.themeMode === "system" ? parsed.themeMode : "dark",
        proxyUrl: typeof parsed.proxyUrl === "string" && parsed.proxyUrl ? parsed.proxyUrl : DEFAULT_PROXY_URL,
        // Preserve the user's V3 choice; undefined keeps the default ON path.
        notificationsOn: typeof parsed.notificationsOn === "boolean" ? parsed.notificationsOn : undefined,
      });
    } catch {
      // Corrupt settings are not fatal — fall back to defaults.
    }
  },

  setThemeMode: (m) => {
    set({ themeMode: m });
    void persist(get());
  },

  setProxyUrl: (url) => {
    set({ proxyUrl: url });
    void persist(get());
  },

  setNotificationsOn: (v) => {
    set({ notificationsOn: v });
    void persist(get());
  },
}));

function persist(state: SettingsState): Promise<void> {
  const data: PersistedSettings = {
    themeMode: state.themeMode,
    proxyUrl: state.proxyUrl,
    notificationsOn: state.notificationsOn,
  };
  return AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => undefined);
}
