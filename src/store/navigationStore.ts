import { create } from "zustand";

export type AppPage = "cleaning" | "explore" | "dashboard" | "query" | "report";

interface NavigationStore {
  page: AppPage;
  setPage: (page: AppPage) => void;
}

export const useNavigationStore = create<NavigationStore>((set) => ({
  page: "cleaning",
  setPage: (page) => set({ page }),
}));
