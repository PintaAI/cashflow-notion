"use client";

import { createContext, useContext } from "react";

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
