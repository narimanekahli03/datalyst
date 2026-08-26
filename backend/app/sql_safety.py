import re

import sqlglot
from sqlglot import exp

# Belt-and-suspenders: the AST check below is the primary guard, but a plain
# keyword scan catches anything the parser might represent in an unexpected
# node shape (e.g. table-function calls across sqlglot versions).
_FORBIDDEN_KEYWORDS = {
    "INSERT", "UPDATE", "DELETE", "MERGE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "GRANT", "REVOKE", "ATTACH", "DETACH", "COPY", "EXPORT",
    "IMPORT", "INSTALL", "LOAD", "PRAGMA", "SET", "CALL", "VACUUM",
    "CHECKPOINT", "EXECUTE", "PREPARE",
}

# DuckDB table functions that read from the filesystem or network — a
# read-only SELECT could otherwise still exfiltrate local files or hit
# arbitrary URLs via read_csv('...')/read_parquet('...') etc.
_FORBIDDEN_TABLE_FUNCTIONS = {
    "read_csv", "read_csv_auto", "read_parquet", "read_json", "read_json_auto",
    "read_ndjson", "read_text", "read_blob", "glob", "sniff_csv",
}


class SqlSafetyError(Exception):
    """Raised when generated SQL fails the read-only safety check."""


def validate_read_only_sql(sql: str, allowed_tables: set[str]) -> None:
    """Raises SqlSafetyError unless `sql` is a single, read-only SELECT
    statement that only references tables in `allowed_tables` (or CTEs it
    defines) — one table when there's no secondary table loaded, more when
    the user has joined a second file on the query page."""
    text = sql.strip()
    if not text:
        raise SqlSafetyError("La requête générée est vide.")

    try:
        statements = [s for s in sqlglot.parse(text, read="duckdb") if s is not None]
    except Exception as exc:
        raise SqlSafetyError(f"La requête générée n'est pas un SQL valide : {exc}") from exc

    if len(statements) != 1:
        raise SqlSafetyError("Une seule instruction SELECT est autorisée par requête.")

    root = statements[0]
    if not isinstance(root, (exp.Select, exp.Union, exp.With)):
        kind = getattr(root, "key", type(root).__name__).upper()
        raise SqlSafetyError(f"Seules les requêtes SELECT sont autorisées (reçu : {kind}).")

    upper_text = text.upper()
    for keyword in _FORBIDDEN_KEYWORDS:
        if re.search(rf"\b{keyword}\b", upper_text):
            raise SqlSafetyError(f"Mot-clé non autorisé détecté dans la requête : {keyword}.")

    # CTEs (WITH x AS (...)) define names that are legitimately referenced
    # later in the query without being the dataset's own table.
    cte_names = {cte.alias_or_name.lower() for cte in root.find_all(exp.CTE)}
    allowed = {t.lower() for t in allowed_tables} | cte_names

    for table in root.find_all(exp.Table):
        name = table.name.lower()
        if name in _FORBIDDEN_TABLE_FUNCTIONS:
            raise SqlSafetyError(
                f"Fonction non autorisée : {name} (accès fichier/réseau interdit)."
            )
        if name not in allowed:
            allowed_list = ", ".join(f'"{t}"' for t in sorted(allowed_tables))
            raise SqlSafetyError(
                f'Table inconnue référencée : "{name}". Tables autorisées : {allowed_list}.'
            )
