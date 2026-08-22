import { useState, type FormEvent } from "react";
import { Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuestionBarProps {
  examples: string[];
  isBusy: boolean;
  onSubmit: (question: string) => void;
}

export function QuestionBar({ examples, isBusy, onSubmit }: QuestionBarProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isBusy) return;
    onSubmit(trimmed);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Ex : quelles sont les 5 régions avec le plus de ventes ?"
          disabled={isBusy}
          className="h-11 text-sm"
        />
        <Button
          type="submit"
          size="lg"
          disabled={isBusy || value.trim() === ""}
          className="shrink-0 gap-2"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Interroger
        </Button>
      </form>

      {examples.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Exemples :
          </span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              disabled={isBusy}
              onClick={() => setValue(example)}
              className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
