import { NextResponse } from "next/server";
import { getSql, quoteIdent } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schema = searchParams.get("schema");
  const table = searchParams.get("table");
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get("pageSize") ?? "25")));

  if (!schema || !table) {
    return NextResponse.json({ error: "schema y table son requeridos" }, { status: 400 });
  }

  if (!/^[a-zA-Z0-9_]+$/.test(schema) || !/^[a-zA-Z0-9_]+$/.test(table)) {
    return NextResponse.json({ error: "identificador inválido" }, { status: 400 });
  }

  const sql = getSql();
  const ident = `${quoteIdent(schema)}.${quoteIdent(table)}`;
  const offset = (page - 1) * pageSize;

  try {
    const cols = (await sql.query(
      `select column_name as name
       from information_schema.columns
       where table_schema = $1 and table_name = $2
       order by ordinal_position`,
      [schema, table]
    )) as { name: string }[];

    const textCols = (await sql.query(
      `select a.attname as name
       from pg_attribute a
       join pg_class c on c.oid = a.attrelid
       join pg_namespace n on n.oid = c.relnamespace
       join pg_type t on t.oid = a.atttypid
       where n.nspname = $1 and c.relname = $2
         and a.attnum > 0 and not a.attisdropped
         and t.typcategory in ('S', 'N')`,
      [schema, table]
    )) as { name: string }[];

    let where = "";
    const params: unknown[] = [];
    if (q && textCols.length) {
      const clauses = textCols.map((col, i) => {
        params.push(`%${q}%`);
        return `${quoteIdent(col.name)}::text ilike $${i + 1}`;
      });
      where = `where ${clauses.join(" or ")}`;
    }

    const countRows = (await sql.query(
      `select count(*)::int as count from ${ident} ${where}`,
      params
    )) as { count: number }[];

    const dataParams = [...params, pageSize, offset];
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    const rows = await sql.query(
      `select * from ${ident} ${where} limit $${limitIdx} offset $${offsetIdx}`,
      dataParams
    );

    return NextResponse.json({
      columns: cols.map((c) => c.name),
      rows,
      total: countRows[0]?.count ?? 0,
      page,
      pageSize,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al leer filas";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
