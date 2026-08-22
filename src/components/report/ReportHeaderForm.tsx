import { useRef } from "react";
import { ImageUp, X } from "lucide-react";
import { useReportStore } from "@/store/reportStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function ReportHeaderForm() {
  const title = useReportStore((s) => s.title);
  const subtitle = useReportStore((s) => s.subtitle);
  const date = useReportStore((s) => s.date);
  const logoDataUrl = useReportStore((s) => s.logoDataUrl);
  const setTitle = useReportStore((s) => s.setTitle);
  const setSubtitle = useReportStore((s) => s.setSubtitle);
  const setDate = useReportStore((s) => s.setDate);
  const setLogo = useReportStore((s) => s.setLogo);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoChange = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>En-tête du rapport</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="report-title">Titre</Label>
          <Input id="report-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="report-subtitle">Sous-titre</Label>
          <Input
            id="report-subtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Optionnel"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="report-date">Date</Label>
          <Input
            id="report-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Logo</Label>
          {logoDataUrl ? (
            <div className="flex items-center gap-3 rounded-md border border-border p-2">
              <img src={logoDataUrl} alt="Logo" className="h-10 w-10 rounded object-contain" />
              <span className="flex-1 truncate text-xs text-muted-foreground">Logo chargé</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setLogo(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border py-3 text-xs font-medium text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
            >
              <ImageUp className="h-3.5 w-3.5" />
              Ajouter un logo
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleLogoChange(e.target.files?.[0])}
          />
        </div>
      </CardContent>
    </Card>
  );
}
