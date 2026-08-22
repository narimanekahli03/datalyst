import { Loader2, Sparkles, Table2, Wand2 } from "lucide-react";
import { FileDropzone } from "@/components/upload/FileDropzone";

interface EmptyStateProps {
  onFileSelected: (file: File) => void;
  isLoading: boolean;
}

const FEATURES = [
  {
    icon: Table2,
    title: "Aperçu instantané",
    description: "Vos données s'affichent dans un tableau paginé avec types détectés automatiquement.",
  },
  {
    icon: Wand2,
    title: "Nettoyage en un clic",
    description: "Doublons, valeurs manquantes, espaces superflus : corrigez tout sans écrire de code.",
  },
  {
    icon: Sparkles,
    title: "100% dans le navigateur",
    description: "Aucune donnée n'est envoyée à un serveur. Tout le traitement reste sur votre machine.",
  },
];

export function EmptyState({ onFileSelected, isLoading }: EmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card/60 px-8 py-24 text-center shadow-soft animate-in fade-in-0">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/15" />
          <Loader2 className="h-7 w-7 animate-spin text-accent" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Lecture du fichier en cours…</p>
          <p className="text-sm text-muted-foreground">
            Analyse des colonnes et détection des types de données.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-4 overflow-hidden px-4 pb-6 pt-14 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="bg-hero-mesh pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-9 text-center animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft backdrop-blur">
          <Sparkles className="h-3 w-3 text-accent" />
          Nettoyage de données propulsé par votre navigateur
        </div>

        <div className="space-y-3">
          <h1 className="text-balance bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text font-display text-4xl text-transparent sm:text-5xl">
            Chargez vos données pour commencer
          </h1>
          <p className="text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
            Importez un fichier CSV ou Excel : vous pourrez immédiatement l'explorer, en évaluer
            la qualité et le nettoyer avant de l'exporter.
          </p>
        </div>

        <FileDropzone onFileSelected={onFileSelected} />

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col gap-2.5 rounded-xl border border-border bg-card/70 p-4 text-left shadow-soft backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-elevated"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
                <feature.icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <p className="text-sm font-medium text-foreground">{feature.title}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
