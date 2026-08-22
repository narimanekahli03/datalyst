import { TooltipProvider } from "@/components/ui/tooltip";
import { useNavigationStore } from "@/store/navigationStore";
import { DataCleaningPage } from "@/pages/DataCleaningPage";
import { ExplorePage } from "@/pages/ExplorePage";
import { DashboardPage } from "@/pages/DashboardPage";
import { QueryPage } from "@/pages/QueryPage";
import { ReportPage } from "@/pages/ReportPage";

export default function App() {
  const page = useNavigationStore((s) => s.page);

  return (
    <TooltipProvider delayDuration={200}>
      {page === "cleaning" ? (
        <DataCleaningPage />
      ) : page === "explore" ? (
        <ExplorePage />
      ) : page === "dashboard" ? (
        <DashboardPage />
      ) : page === "query" ? (
        <QueryPage />
      ) : (
        <ReportPage />
      )}
    </TooltipProvider>
  );
}
