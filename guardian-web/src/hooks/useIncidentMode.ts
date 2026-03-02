import { useIncidentStore } from "@/store/incident";

export function useIncidentMode() {
  return useIncidentStore();
}
