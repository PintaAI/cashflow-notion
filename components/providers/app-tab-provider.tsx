"use client";

import { createContext, useContext, useEffect, useState } from "react";

import type { AppTab } from "@/components/layout";
import { DEFAULT_TAB_KEY } from "@/components/settings/appearance-section";

type AppTabContextValue = {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
};

type SearchParamsLike = {
  get: (name: string) => string | null;
};

const AppTabContext = createContext<AppTabContextValue | null>(null);

function getTabFromParams(params: SearchParamsLike): AppTab {
  const tab = params.get("tab");
  return tab === "summary" || tab === "catatan" || tab === "setting" ? tab : "home";
}

function getTabUrl(pathname: string, tab: AppTab) {
  const params = new URLSearchParams(window.location.search);

  if (tab === "home") {
    params.delete("tab");
  } else {
    params.set("tab", tab);
  }
  params.delete("action");

  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

export function AppTabProvider({
  children,
  pathname,
  searchParams,
}: {
  children: React.ReactNode;
  pathname: string;
  searchParams: SearchParamsLike;
}) {
  const [activeTab, setActiveTabState] = useState(() => getTabFromParams(searchParams));

  useEffect(() => {
    if (searchParams.get("tab")) return;
    const saved = localStorage.getItem(DEFAULT_TAB_KEY);
    if (saved === "summary" || saved === "catatan" || saved === "setting") {
      setActiveTabState(saved);
      window.history.replaceState(window.history.state, "", getTabUrl(pathname, saved));
    }
  }, []);

  function setActiveTab(tab: AppTab) {
    setActiveTabState(tab);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", getTabUrl(pathname, tab));
    }
  }

  return (
    <AppTabContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </AppTabContext.Provider>
  );
}

export function useAppTab() {
  const context = useContext(AppTabContext);
  if (!context) {
    throw new Error("useAppTab must be used within AppTabProvider");
  }
  return context;
}
