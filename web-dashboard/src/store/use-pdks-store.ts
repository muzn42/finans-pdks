"use client";

import { create } from "zustand";

export type PortalRole = "HR" | "IT" | "ADMIN" | "DEPT_MANAGER" | "PERSONNEL";

export interface SessionUser {
  id: string;
  email: string;
  role: PortalRole;
  name: string;
  title: string;
  branch: string;
  managedDept?: string | null;
  employeeSicil?: string | null;
  perms: string[];
}

interface PdksGlobalState {
  user: SessionUser | null;
  activeTab: string;
  selectedProfileId: number;
  rangeDays: number;
  dateFrom: string | null;
  dateTo: string | null;
  branchFilter: string;
  theme: "light" | "dark";
  threeWebGlEnabled: boolean;
  setUser: (user: SessionUser | null) => void;
  setActiveTab: (tab: string) => void;
  setSelectedProfileId: (id: number) => void;
  setRangeDays: (days: number) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setBranchFilter: (branch: string) => void;
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setThreeWebGlEnabled: (enabled: boolean) => void;
}

export const usePdksStore = create<PdksGlobalState>((set) => ({
  user: null,
  activeTab: "overview",
  selectedProfileId: 459, // Alper Kaya (FN-1459) veya seçilen personel
  rangeDays: 30,
  dateFrom: null,
  dateTo: null,
  branchFilter: "ALL",
  theme: "light",
  threeWebGlEnabled: true,
  setUser: (user) => set({ user }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedProfileId: (selectedProfileId) => set({ selectedProfileId }),
  setRangeDays: (rangeDays) => set({ rangeDays, dateFrom: null, dateTo: null }),
  setDateRange: (dateFrom, dateTo) => set({ dateFrom, dateTo }),
  setBranchFilter: (branchFilter) => set({ branchFilter }),
  setTheme: (theme) => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", next);
      }
      return { theme: next };
    }),
  setThreeWebGlEnabled: (threeWebGlEnabled) => set({ threeWebGlEnabled })
}));
