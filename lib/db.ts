import { neon } from "@neondatabase/serverless";

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está definida en .env");
  }
  return neon(url);
}

export function quoteIdent(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}
