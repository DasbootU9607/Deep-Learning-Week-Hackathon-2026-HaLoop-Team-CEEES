import { Sidebar } from "@/components/layout/Sidebar";
import { IncidentBanner } from "@/components/layout/IncidentBanner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <IncidentBanner />
        {children}
      </div>
    </div>
  );
}
