import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Bot, Loader2 } from "lucide-react";
import { useDatasetStore } from "@/store/datasetStore";
import { useTextToSqlStore } from "@/store/textToSqlStore";
import { buildExampleQuestions } from "@/lib/textToSql/schemaBuilder";
import { inferAutoChart } from "@/lib/textToSql/autoChart";
import { Header } from "@/components/layout/Header";
import { NoDatasetState } from "@/components/shared/NoDatasetState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuestionBar } from "@/components/query/QuestionBar";
import { SqlCodeBlock } from "@/components/query/SqlCodeBlock";
import { QueryResultTable } from "@/components/query/QueryResultTable";
import { QueryResultChart } from "@/components/query/QueryResultChart";
import { QueryHistoryPanel } from "@/components/query/QueryHistoryPanel";
import { AgentExplorationPanel } from "@/components/query/AgentExplorationPanel";
import { cn } from "@/lib/utils";

function DuckDbLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card/60 px-8 py-24 text-center shadow-soft">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent/15" />
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Préparation du moteur SQL local…</p>
        <p className="text-sm text-muted-foreground">
          Chargement de DuckDB-WASM et import de vos données dans le navigateur.
        </p>
      </div>
    </div>
  );
}

function DuckDbErrorState({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-border bg-card/60 px-8 py-16 text-center shadow-soft">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <div className="space-y-1.5">
        <h2 className="font-display text-xl text-foreground">Moteur SQL indisponible</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {message ?? "Une erreur est survenue lors de l'initialisation de DuckDB-WASM."}
        </p>
      </div>
      <Button onClick={onRetry}>Réessayer</Button>
    </div>
  );
}

function ErrorCallout({ message }: { message: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

export function QueryPage() {
  const [mode, setMode] = useState<"ask" | "agent">("ask");
  const dataset = useDatasetStore((s) => s.dataset);

  const duckDbStatus = useTextToSqlStore((s) => s.duckDbStatus);
  const duckDbError = useTextToSqlStore((s) => s.duckDbError);
  const phase = useTextToSqlStore((s) => s.phase);
  const currentSql = useTextToSqlStore((s) => s.currentSql);
  const currentExplanation = useTextToSqlStore((s) => s.currentExplanation);
  const currentResult = useTextToSqlStore((s) => s.currentResult);
  const currentSummary = useTextToSqlStore((s) => s.currentSummary);
  const errorMessage = useTextToSqlStore((s) => s.errorMessage);
  const history = useTextToSqlStore((s) => s.history);
  const initDuckDb = useTextToSqlStore((s) => s.initDuckDb);
  const ask = useTextToSqlStore((s) => s.ask);
  const replay = useTextToSqlStore((s) => s.replay);

  useEffect(() => {
    if (!dataset) return;
    initDuckDb(dataset);
  }, [dataset, initDuckDb]);

  const examples = useMemo(() => (dataset ? buildExampleQuestions(dataset) : []), [dataset]);
  const autoChart = useMemo(() => (currentResult ? inferAutoChart(currentResult) : null), [currentResult]);

  const isBusy =
    phase === "generating" || phase === "executing" || phase === "fixing" || phase === "summarizing";
  const showSqlCard = phase === "generating" || currentSql !== null;
  const showExecutionStatus = (phase === "executing" || phase === "fixing") && !currentResult;
  const showEmptyHint = phase === "idle" && !currentSql && history.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!dataset ? (
          <NoDatasetState
            icon={Bot}
            title="Aucune donnée à interroger"
            description="Chargez un fichier avant de poser des questions en langage naturel sur vos données. Retournez à la page de nettoyage pour importer un fichier."
          />
        ) : duckDbStatus === "idle" || duckDbStatus === "initializing" ? (
          <DuckDbLoadingState />
        ) : duckDbStatus === "error" ? (
          <DuckDbErrorState message={duckDbError} onRetry={() => initDuckDb(dataset)} />
        ) : (
          <div className="space-y-6">
            <div className="flex w-fit items-center gap-1.5 rounded-lg border border-border bg-secondary/40 p-0.5">
              <Button
                variant={mode === "ask" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("ask")}
              >
                Poser une question
              </Button>
              <Button
                variant={mode === "agent" ? "default" : "ghost"}
                size="sm"
                onClick={() => setMode("agent")}
              >
                Agent IA autonome
              </Button>
            </div>

            {mode === "agent" && <AgentExplorationPanel dataset={dataset} />}

            {mode === "ask" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-4 w-4 text-accent" />
                      Interroger mes données
                    </CardTitle>
                    <CardDescription>
                      Posez une question en français : l'IA génère la requête SQL, l'exécute
                      directement dans votre navigateur et vous répond en langage naturel.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <QuestionBar
                      examples={examples}
                      isBusy={isBusy}
                      onSubmit={(q) => ask(q, dataset)}
                    />
                  </CardContent>
                </Card>

                {showEmptyHint && (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/40 px-8 py-14 text-center">
                    <Bot className="h-8 w-8 text-muted-foreground/60" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-foreground">
                      Posez votre première question ci-dessus
                    </p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      Ou cliquez sur un exemple pour voir comment ça fonctionne : SQL généré,
                      exécuté localement, résumé en français.
                    </p>
                  </div>
                )}

                {showSqlCard && (
                  <Card>
                    <CardHeader className="flex-row items-center justify-between space-y-0">
                      <CardTitle>Requête générée</CardTitle>
                      {phase === "fixing" && <Badge variant="warning">Correction en cours…</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!currentSql ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin text-accent" />
                          Génération de la requête SQL…
                        </div>
                      ) : (
                        <>
                          <SqlCodeBlock sql={currentSql} />
                          {currentExplanation && (
                            <p className="text-sm text-muted-foreground">{currentExplanation}</p>
                          )}
                          {showExecutionStatus && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                              {phase === "fixing"
                                ? "Correction de la requête suite à une erreur d'exécution…"
                                : "Exécution de la requête sur vos données…"}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}

                {phase === "error" && <ErrorCallout message={errorMessage} />}

                {currentResult && (
                  <>
                    <Card className="border-accent/25 bg-accent/[0.04]">
                      <CardContent className="flex items-start gap-3 pt-5">
                        <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        {phase === "summarizing" && !currentSummary ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Rédaction du résumé…
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed text-foreground">
                            {currentSummary}
                          </p>
                        )}
                      </CardContent>
                    </Card>

                    <div className={cn("grid grid-cols-1 gap-4", autoChart && "xl:grid-cols-2")}>
                      {autoChart && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Visualisation</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <QueryResultChart result={currentResult} spec={autoChart} />
                          </CardContent>
                        </Card>
                      )}
                      <QueryResultTable result={currentResult} />
                    </div>
                  </>
                )}

                <QueryHistoryPanel entries={history} onReplay={replay} />
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
