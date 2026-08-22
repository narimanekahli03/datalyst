import { useState } from "react";
import { Check, Copy, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SqlCodeBlockProps {
  sql: string;
}

export function SqlCodeBlock({ sql }: SqlCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (permissions, insecure context) — nothing to fall back to.
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-secondary/50">
      <div className="flex items-center justify-between border-b border-border bg-secondary/70 px-3 py-1.5">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          SQL généré
        </div>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={handleCopy}>
          {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <pre className="scrollbar-thin overflow-x-auto px-4 py-3 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground">{sql}</code>
      </pre>
    </div>
  );
}
