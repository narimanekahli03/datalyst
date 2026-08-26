/**
 * Turns a filename into a valid, readable SQL identifier for a secondary
 * table — e.g. "Commandes 2024.csv" -> "commandes_2024". Falls back to
 * "table2" for anything empty or colliding with the primary table's name.
 */
export function sanitizeTableName(fileName: string, reserved: string): string {
  const withoutExtension = fileName.replace(/\.[^./]+$/, "");
  let name = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (/^[0-9]/.test(name)) name = `t_${name}`;
  if (!name || name === reserved.toLowerCase()) name = "table2";

  return name;
}
