import logging
import os

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.config import CORS_ALLOWED_ORIGINS
from app.mistral_client import call_mistral_json
from app.prompts import (
    AGENT_STEP_SYSTEM_PROMPT,
    FIX_SQL_SYSTEM_PROMPT,
    GENERATE_SQL_SYSTEM_PROMPT,
    INSIGHTS_SYSTEM_PROMPT,
    SUMMARIZE_SYSTEM_PROMPT,
    build_agent_step_user_message,
    build_fix_sql_user_message,
    build_generate_sql_user_message,
    build_insights_user_message,
    build_summarize_user_message,
)
from app.schemas import (
    AgentStepRequest,
    AgentStepResponse,
    DatasetSchema,
    FixSqlRequest,
    FixSqlResponse,
    GenerateSqlRequest,
    GenerateSqlResponse,
    InsightsRequest,
    InsightsResponse,
    SummarizeRequest,
    SummarizeResponse,
)
from app.sql_safety import SqlSafetyError, validate_read_only_sql

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Datalyst — API text-to-SQL")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_methods=["POST"],
    allow_headers=["Content-Type"],
)


def _extract_sql_response(data: dict, allowed_tables: set[str]) -> GenerateSqlResponse:
    """Shared by /generate-sql and /fix-sql: both expect the same
    {"sql", "explanation"} shape and go through the same safety check."""
    explanation = data.get("explanation") or ""
    sql = data.get("sql")

    if not sql:
        raise HTTPException(
            status_code=422,
            detail=explanation or "Impossible de générer une requête SQL pour cette question.",
        )

    try:
        validate_read_only_sql(sql, allowed_tables)
    except SqlSafetyError as exc:
        raise HTTPException(
            status_code=422, detail=f"La requête générée n'est pas autorisée : {exc}"
        ) from exc

    return GenerateSqlResponse(sql=sql, explanation=explanation)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/generate-sql", response_model=GenerateSqlResponse)
def generate_sql(request: GenerateSqlRequest) -> GenerateSqlResponse:
    schemas = [request.schema_] + request.secondary_tables
    user_message = build_generate_sql_user_message(request.question, schemas)
    data = call_mistral_json(GENERATE_SQL_SYSTEM_PROMPT, user_message)
    return _extract_sql_response(data, {s.table_name for s in schemas})


@app.post("/fix-sql", response_model=FixSqlResponse)
def fix_sql(request: FixSqlRequest) -> FixSqlResponse:
    schemas = [request.schema_] + request.secondary_tables
    user_message = build_fix_sql_user_message(
        request.question, request.sql, request.error_message, schemas
    )
    data = call_mistral_json(FIX_SQL_SYSTEM_PROMPT, user_message)
    return _extract_sql_response(data, {s.table_name for s in schemas})


@app.post("/summarize", response_model=SummarizeResponse)
def summarize(request: SummarizeRequest) -> SummarizeResponse:
    user_message = build_summarize_user_message(request)
    data = call_mistral_json(SUMMARIZE_SYSTEM_PROMPT, user_message)

    summary = data.get("summary")
    if not summary:
        raise HTTPException(
            status_code=502, detail="Le modèle n'a pas renvoyé de résumé exploitable."
        )
    return SummarizeResponse(summary=summary)


@app.post("/generate-insights", response_model=InsightsResponse)
def generate_insights(request: InsightsRequest) -> InsightsResponse:
    user_message = build_insights_user_message(request)
    data = call_mistral_json(INSIGHTS_SYSTEM_PROMPT, user_message)

    try:
        response = InsightsResponse(insights=data.get("insights") or [])
    except ValidationError as exc:
        raise HTTPException(
            status_code=502, detail="Le modèle a renvoyé des observations dans un format inattendu."
        ) from exc

    if not response.insights:
        raise HTTPException(
            status_code=502, detail="Le modèle n'a pas renvoyé d'observations exploitables."
        )
    return response


def _validate_agent_sql(sql: str | None, allowed_tables: set[str]) -> str:
    """Used only by /agent-step's 'query' action — validates the proposed SQL
    the same way _extract_sql_response does, but returns just the string
    since the agent response shape isn't {"sql", "explanation"}."""
    if not sql:
        raise HTTPException(status_code=422, detail="L'agent n'a pas proposé de requête SQL.")
    try:
        validate_read_only_sql(sql, allowed_tables)
    except SqlSafetyError as exc:
        raise HTTPException(
            status_code=422, detail=f"La requête proposée par l'agent n'est pas autorisée : {exc}"
        ) from exc
    return sql


def _validate_chart_fields(
    x_field: str | None, y_fields: list[str] | None, schema: DatasetSchema
) -> str | None:
    """Used only by /agent-step's 'chart' action. Checks the agent's chosen
    columns actually exist in the schema, and that every Y (measure) column is
    numeric — chartData.ts renders a bar/line/area chart with visible axes but
    no bars/lines for a non-numeric measure, which looks broken with no
    explanation, so this is worth catching before it reaches the dashboard.

    Returns an error message on failure, None on success — deliberately NOT an
    HTTPException: a bad column name is agent-recoverable content the same way
    a failed SQL execution is (see the 'query' action's error_message path),
    not a hard protocol failure. The caller wraps this into a normal 200
    response with error_message set, so the frontend loop can feed it back
    into history and continue instead of aborting the whole run."""
    if not x_field or not y_fields:
        return "L'agent n'a pas proposé de colonnes valides pour le graphique."
    columns_by_name = {c.name: c for c in schema.columns}
    if x_field not in columns_by_name:
        return f"Colonne inconnue proposée pour l'axe X : {x_field}"
    for y_field in y_fields:
        column = columns_by_name.get(y_field)
        if column is None:
            return f"Colonne inconnue proposée pour la mesure : {y_field}"
        if column.type != "number":
            return f"La colonne \"{y_field}\" n'est pas numérique, elle ne peut pas être une mesure."
    return None


@app.post("/agent-step", response_model=AgentStepResponse)
def agent_step(request: AgentStepRequest) -> AgentStepResponse:
    user_message = build_agent_step_user_message(request)
    data = call_mistral_json(AGENT_STEP_SYSTEM_PROMPT, user_message)

    action = data.get("action")
    if action == "query":
        allowed_tables = {request.schema_.table_name} | {t.table_name for t in request.secondary_tables}
        sql = _validate_agent_sql(data.get("sql"), allowed_tables)
        return AgentStepResponse(action="query", sql=sql, reasoning=data.get("reasoning") or "")

    if action == "chart":
        x_field = data.get("chart_x_field")
        y_fields = data.get("chart_y_fields")
        chart_error = _validate_chart_fields(x_field, y_fields, request.schema_)
        if chart_error:
            return AgentStepResponse(
                action="chart",
                reasoning=data.get("reasoning") or "",
                chart_title=data.get("chart_title"),
                chart_x_field=x_field,
                chart_y_fields=y_fields,
                error_message=chart_error,
            )
        try:
            return AgentStepResponse(
                action="chart",
                reasoning=data.get("reasoning") or "",
                chart_title=data.get("chart_title") or "Graphique",
                chart_type=data.get("chart_type"),
                chart_x_field=x_field,
                chart_y_fields=y_fields,
                chart_aggregation=data.get("chart_aggregation") or "sum",
            )
        except ValidationError as exc:
            raise HTTPException(
                status_code=502,
                detail="L'agent a renvoyé une configuration de graphique dans un format inattendu.",
            ) from exc

    if action == "finish":
        try:
            response = AgentStepResponse(
                action="finish",
                summary=data.get("summary") or "",
                findings=data.get("findings") or [],
            )
        except ValidationError as exc:
            raise HTTPException(
                status_code=502,
                detail="L'agent a renvoyé des observations dans un format inattendu.",
            ) from exc
        if not response.summary or not response.findings:
            raise HTTPException(
                status_code=502, detail="L'agent n'a pas renvoyé de conclusion exploitable."
            )
        return response

    raise HTTPException(status_code=502, detail="L'agent a renvoyé une réponse dans un format inattendu.")


# In the Docker deployment (Hugging Face Space), this backend also serves the
# built frontend so the whole app runs behind a single origin/port. Absent
# locally, so `uvicorn --reload` during dev is unaffected.
_STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "static")
if os.path.isdir(_STATIC_DIR):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
