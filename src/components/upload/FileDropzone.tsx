import { useCallback, useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

interface FileDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export function FileDropzone({ onFileSelected, disabled }: FileDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragError, setDragError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!isAcceptedFile(file)) {
        setDragError("Format non supporté. Utilisez un fichier .csv, .xlsx ou .xls.");
        return;
      }
      setDragError(null);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  return (
    <div className="w-full">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group relative flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed px-8 py-20 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-accent bg-accent/[0.06] shadow-[0_0_0_6px_hsl(var(--accent)/0.08)]"
            : "border-border bg-card/60 shadow-soft hover:border-accent/40 hover:bg-accent/[0.03]",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 -z-10 bg-gradient-to-b from-accent/[0.04] to-transparent opacity-0 transition-opacity duration-300",
            isDragActive && "opacity-100"
          )}
        />

        <div
          className={cn(
            "relative flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-transform duration-300 ease-out",
            isDragActive ? "scale-110" : "group-hover:-translate-y-0.5 group-hover:scale-105"
          )}
        >
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-accent/10" />
          <UploadCloud className="h-7 w-7" strokeWidth={1.75} />
        </div>

        <div className="space-y-1.5">
          <p className="text-base font-medium text-foreground">
            Glissez-déposez votre fichier ici
          </p>
          <p className="text-sm text-muted-foreground">
            ou{" "}
            <span className="font-medium text-accent underline decoration-accent/30 underline-offset-4 group-hover:decoration-accent">
              parcourez vos fichiers
            </span>
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-subtle">
          {["CSV", "XLSX", "XLS"].map((format) => (
            <span
              key={format}
              className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 font-medium tracking-wide"
            >
              {format}
            </span>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      {dragError && (
        <p className="mt-2.5 text-sm text-destructive" role="alert">
          {dragError}
        </p>
      )}
    </div>
  );
}
