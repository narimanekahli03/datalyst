import { useEffect, useState } from "react";
import { CheckCircle2, TriangleAlert, X } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";

const AUTO_DISMISS_MS = 5000;

export function OperationFeedback() {
  const lastResult = useDatasetStore((s) => s.lastResult);
  const lastResultId = useDatasetStore((s) => s.lastResultId);
  const operationError = useDatasetStore((s) => s.operationError);
  const dismissOperationError = useDatasetStore((s) => s.dismissOperationError);

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastResultId) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [lastResultId]);

  const showSuccess = Boolean(lastResult && visible);
  const showError = Boolean(operationError);

  if (!showSuccess && !showError) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-6 sm:items-end sm:px-6">
      {showError && (
        <div
          role="alert"
          className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-destructive/30 bg-card px-4 py-3 text-sm shadow-elevated animate-in fade-in-0 slide-in-from-bottom-2"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-foreground">{operationError}</p>
          <button
            onClick={dismissOperationError}
            className="shrink-0 rounded-sm text-muted-foreground opacity-70 hover:opacity-100"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showSuccess && lastResult && (
        <div
          key={lastResultId}
          role="status"
          className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-elevated animate-in fade-in-0 slide-in-from-bottom-2"
        >
          <div className="flex items-start gap-2.5 px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{lastResult.label}</p>
              <p className="text-muted-foreground">{lastResult.detail}</p>
            </div>
            <button
              onClick={() => setVisible(false)}
              className="shrink-0 rounded-sm text-muted-foreground opacity-70 hover:opacity-100"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="h-0.5 w-full bg-success/15">
            <div
              className="h-full origin-left bg-success"
              style={{
                animation: `toast-progress ${AUTO_DISMISS_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
