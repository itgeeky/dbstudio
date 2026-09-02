import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";

export const dynamic = "force-dynamic";

const FORBIDDEN = /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do|set|begin|commit|rollback)\b/i;

export async function POST(request: Request) {
  const body = (await request.json()) as { sql?: string };
  const query = body.sql?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "Escribe un SELECT" }, { status: 400 });
  }
  if (!/^\s*select\b/i.test(query)) {
    return NextResponse.json({ error: "Solo se permiten SELECT (read-only)" }, { status: 400 });
  }
  if (FORBIDDEN.test(query.replace(/'[^']*'/g, ""))) {
    return NextResponse.json({ error: "La consulta contiene palabras no permitidas" }, { status: 400 });
  }

  const sql = getSql();
  try {
    const wrapped = `select * from (${query.replace(/;\s*$/, "")}) q limit 200`;
    const rows = await sql.query(wrapped);
    const columns = rows.length ? Object.keys(rows[0] as object) : [];
    return NextResponse.json({ columns, rows, truncated: rows.length === 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al ejecutar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
