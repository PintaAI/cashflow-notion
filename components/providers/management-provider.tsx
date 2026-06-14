"use client";

import { createContext, useContext, useEffect } from "react";
import { LOCAL_THEME_CHANGED_EVENT, LOCAL_THEMES_KEY, SELECTED_LOCAL_THEME_KEY, getPreferredLocalTheme, type LocalTheme } from "@/components/layout";

const CURRENT_MANAGEMENT_CACHE_PREFIX = "cashflow_current_management:";
const WALLET_CACHE_KEY = "cashflow_wallets";

function getLocalThemes(): LocalTheme[] {
  try {
    const rawThemes = window.localStorage.getItem(LOCAL_THEMES_KEY);
    if (!rawThemes) return [];
    const parsed = JSON.parse(rawThemes);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveManagementTheme(theme: LocalTheme) {
  const nextThemes = [theme, ...getLocalThemes().filter((item) => item.id !== theme.id)].slice(0, 12);
  window.localStorage.setItem(LOCAL_THEMES_KEY, JSON.stringify(nextThemes));
  window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, theme.id);
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function clearManagementTheme() {
  const fallbackTheme = getPreferredLocalTheme(getLocalThemes(), null);
  if (fallbackTheme) {
    window.localStorage.setItem(SELECTED_LOCAL_THEME_KEY, fallbackTheme.id);
  } else {
    window.localStorage.removeItem(SELECTED_LOCAL_THEME_KEY);
  }
  window.dispatchEvent(new Event(LOCAL_THEME_CHANGED_EVENT));
}

function syncCachedManagementTheme(managementId: string) {
  try {
    const raw = window.localStorage.getItem(`${CURRENT_MANAGEMENT_CACHE_PREFIX}${managementId}`);
    const current = raw ? JSON.parse(raw) : null;
    const walletRaw = window.localStorage.getItem(WALLET_CACHE_KEY);
    const wallets = walletRaw ? JSON.parse(walletRaw) : null;
    const wallet = Array.isArray(wallets) ? wallets.find((item) => item.id === managementId) : null;
    const management = current?.management ?? wallet;
    if (!management) return false;

    const theme = management.imageTheme;
    if (!theme) {
      clearManagementTheme();
      return true;
    }

    saveManagementTheme({
      id: `management:${managementId}`,
      name: `${management.name} theme`,
      colors: theme,
      createdAt: new Date().toISOString(),
    });
    return true;
  } catch {
    return false;
  }
}

function ManagementThemeSync({ managementId }: { managementId: string }) {
  useEffect(() => {
    syncCachedManagementTheme(managementId);
  }, [managementId]);

  return null;
}

type ManagementContextValue = {
  managementId: string;
};

const ManagementContext = createContext<ManagementContextValue | null>(null);

export function ManagementProvider({
  children,
  managementId,
}: {
  children: React.ReactNode;
  managementId: string;
}) {
  return (
    <ManagementContext.Provider value={{ managementId }}>
      <ManagementThemeSync managementId={managementId} />
      {children}
    </ManagementContext.Provider>
  );
}

export function useManagement() {
  const context = useContext(ManagementContext);
  if (!context) {
    throw new Error("useManagement must be used within ManagementProvider");
  }
  return context;
}

export function useOptionalManagement() {
  return useContext(ManagementContext);
}
