import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { exportDatasetAsCsv, exportDatasetAsXlsx } from "@/lib/exporters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ExportMenu() {
  const dataset = useDatasetStore((s) => s.dataset);

  if (!dataset) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Download />
          Exporter
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => exportDatasetAsCsv(dataset)}>
          <FileText />
          Exporter en CSV
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exportDatasetAsXlsx(dataset)}>
          <FileSpreadsheet />
          Exporter en Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
