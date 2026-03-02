import { create } from "zustand";
import { persist } from "zustand/middleware";

interface IncidentState {
  isIncidentMode: boolean;
  activatedAt?: string;
  activatedBy?: string;
  reason?: string;
  enableIncidentMode: (by: string, reason?: string) => void;
  disableIncidentMode: () => void;
}

export const useIncidentStore = create<IncidentState>()(
  persist(
    (set) => ({
      isIncidentMode: false,
      activatedAt: undefined,
      activatedBy: undefined,
      reason: undefined,
      enableIncidentMode: (by: string, reason?: string) =>
        set({
          isIncidentMode: true,
          activatedAt: new Date().toISOString(),
          activatedBy: by,
          reason,
        }),
      disableIncidentMode: () =>
        set({
          isIncidentMode: false,
          activatedAt: undefined,
          activatedBy: undefined,
          reason: undefined,
        }),
    }),
    {
      name: "guardian-incident",
    }
  )
);
