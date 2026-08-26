from typing import Literal

from pydantic import BaseModel, Field

# Mirrors src/types/dataset.ts's ColumnType exactly — the frontend sends one
# of these four strings for every column.
ColumnType = Literal["string", "number", "date", "boolean"]

# A result cell as sent by the frontend (src/types/dataset.ts CellValue).
CellValue = str | float | int | bool | None


class ColumnSchema(BaseModel):
    name: str
    type: ColumnType
    sample_values: list[str] = Field(default_factory=list)


class DatasetSchema(BaseModel):
    table_name: str
    columns: list[ColumnSchema]


class GenerateSqlRequest(BaseModel):
    question: str
    schema_: DatasetSchema = Field(alias="schema")
    # Optional second (third, ...) table joined on the query page — lets the
    # model write JOINs across datasets instead of being limited to one table.
    secondary_tables: list[DatasetSchema] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class GenerateSqlResponse(BaseModel):
    sql: str
    explanation: str


class FixSqlRequest(BaseModel):
    question: str
    sql: str
    error_message: str
    schema_: DatasetSchema = Field(alias="schema")
    secondary_tables: list[DatasetSchema] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


# Same shape as a fresh generation: a corrected query plus its explanation.
FixSqlResponse = GenerateSqlResponse


class SummarizeRequest(BaseModel):
    question: str
    sql: str
    columns: list[str]
    rows: list[dict[str, CellValue]]
    row_count: int
    truncated: bool


class SummarizeResponse(BaseModel):
    summary: str


class TopValueSummary(BaseModel):
    value: str
    percent: float


class ColumnInsightSummary(BaseModel):
    name: str
    type: ColumnType
    missing_percent: float
    # number columns
    mean: float | None = None
    median: float | None = None
    min: float | None = None
    max: float | None = None
    std_dev: float | None = None
    outlier_percent: float | None = None
    # string/boolean columns
    unique_count: int | None = None
    top_values: list[TopValueSummary] | None = None
    # date columns
    date_min: str | None = None
    date_max: str | None = None
    range_days: int | None = None


class CorrelationSummary(BaseModel):
    column_a: str
    column_b: str
    r: float


class InsightsRequest(BaseModel):
    row_count: int
    column_count: int
    duplicate_row_count: int
    missing_percent: float
    columns: list[ColumnInsightSummary]
    top_correlations: list[CorrelationSummary]


# Kept in sync with src/types/insights.ts's InsightCategory.
InsightCategory = Literal["qualite", "distribution", "correlation", "categorie", "general"]


class Insight(BaseModel):
    text: str
    category: InsightCategory


class InsightsResponse(BaseModel):
    insights: list[Insight]


# Kept in sync with src/types/dashboard.ts's ChartType/AggregationType — the
# agent's "chart" action reuses the exact same dashboard chart config shape.
ChartType = Literal["line", "bar", "area", "pie", "scatter"]
ChartAggregation = Literal["sum", "avg", "count", "min", "max"]


class AgentStepRecord(BaseModel):
    action: Literal["query", "chart"] = "query"
    reasoning: str
    # query fields
    sql: str | None = None
    row_count: int | None = None
    columns: list[str] | None = None
    sample_rows: list[dict[str, CellValue]] | None = None
    error_message: str | None = None
    # chart fields
    chart_title: str | None = None
    chart_type: ChartType | None = None
    chart_x_field: str | None = None
    chart_y_fields: list[str] | None = None
    chart_aggregation: ChartAggregation | None = None


class AgentStepRequest(BaseModel):
    schema_: DatasetSchema = Field(alias="schema")
    secondary_tables: list[DatasetSchema] = Field(default_factory=list)
    history: list[AgentStepRecord] = Field(default_factory=list)
    step_number: int
    max_steps: int
    must_finish: bool

    model_config = {"populate_by_name": True}


class AgentStepResponse(BaseModel):
    action: Literal["query", "chart", "finish"]
    sql: str | None = None
    reasoning: str | None = None
    chart_title: str | None = None
    chart_type: ChartType | None = None
    chart_x_field: str | None = None
    chart_y_fields: list[str] | None = None
    chart_aggregation: ChartAggregation | None = None
    summary: str | None = None
    findings: list[Insight] = Field(default_factory=list)
    error_message: str | None = None
