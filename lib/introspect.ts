import { getSql } from "./db";
import type { ColumnInfo, ForeignKey, IndexInfo, SchemaGraph, TableInfo } from "./types";

type TableRow = {
  schema: string;
  name: string;
  kind: "table" | "view" | "matview";
  comment: string | null;
  estimated_rows: number | string | null;
};

type ColumnRow = {
  schema: string;
  table: string;
  name: string;
  data_type: string;
  udt_name: string;
  nullable: boolean;
  default_value: string | null;
  comment: string | null;
  ordinal: number;
};

type FkRow = {
  name: string;
  from_schema: string;
  from_table: string;
  from_columns: string[] | string;
  to_schema: string;
  to_table: string;
  to_columns: string[] | string;
};

type IndexRow = {
  schema: string;
  table: string;
  name: string;
  unique: boolean;
  primary: boolean;
  columns: string[] | string;
};

function asStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function tableKey(schema: string, name: string) {
  return `${schema}.${name}`;
}

function detectJunction(table: TableInfo): { isJunction: boolean; hint: string | null } {
  if (table.kind !== "table") return { isJunction: false, hint: null };

  const fks = table.foreignKeys;
  if (fks.length < 2) return { isJunction: false, hint: null };

  const fkCols = new Set(fks.flatMap((fk) => fk.fromColumns));
  const extraCols = table.columns.filter((c) => {
    if (fkCols.has(c.name)) return false;
    const n = c.name.toLowerCase();
    return !["id", "created_at", "updated_at", "createdat", "updatedat"].includes(n);
  });

  const pkCols = table.columns.filter((c) => c.isPk).map((c) => c.name);
  const pkIsCompositeOfFks =
    pkCols.length >= 2 && pkCols.every((c) => fkCols.has(c));

  const mostlyFk = extraCols.length <= 2 && fkCols.size >= 2;

  if (pkIsCompositeOfFks || mostlyFk) {
    const targets = [...new Set(fks.map((fk) => `${fk.toSchema}.${fk.toTable}`))];
    return {
      isJunction: true,
      hint: `Posible tabla intermedia (N:N) entre ${targets.join(" y ")}`,
    };
  }

  return { isJunction: false, hint: null };
}

export async function loadSchema(): Promise<SchemaGraph> {
  const sql = getSql();

  const tables = (await sql`
    select
      n.nspname as schema,
      c.relname as name,
      case c.relkind
        when 'r' then 'table'
        when 'p' then 'table'
        when 'v' then 'view'
        when 'm' then 'matview'
      end as kind,
      obj_description(c.oid) as comment,
      coalesce(c.reltuples, 0)::bigint as estimated_rows
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p', 'v', 'm')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
      and n.nspname not like 'pg_temp%'
    order by n.nspname, c.relname
  `) as TableRow[];

  const columns = (await sql`
    select
      n.nspname as schema,
      c.relname as table,
      a.attname as name,
      format_type(a.atttypid, a.atttypmod) as data_type,
      t.typname as udt_name,
      not a.attnotnull as nullable,
      pg_get_expr(ad.adbin, ad.adrelid) as default_value,
      col_description(c.oid, a.attnum) as comment,
      a.attnum as ordinal
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    left join pg_attrdef ad on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where a.attnum > 0
      and not a.attisdropped
      and c.relkind in ('r', 'p', 'v', 'm')
      and n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    order by n.nspname, c.relname, a.attnum
  `) as ColumnRow[];

  const fks = (await sql`
    select
      con.conname as name,
      nsp.nspname as from_schema,
      rel.relname as from_table,
      (
        select coalesce(json_agg(att.attname order by cols.ord), '[]'::json)
        from unnest(con.conkey) with ordinality as cols(attnum, ord)
        join pg_attribute att
          on att.attrelid = con.conrelid and att.attnum = cols.attnum
      ) as from_columns,
      fnsp.nspname as to_schema,
      frel.relname as to_table,
      (
        select coalesce(json_agg(att.attname order by cols.ord), '[]'::json)
        from unnest(con.confkey) with ordinality as cols(attnum, ord)
        join pg_attribute att
          on att.attrelid = con.confrelid and att.attnum = cols.attnum
      ) as to_columns
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fnsp on fnsp.oid = frel.relnamespace
    where con.contype = 'f'
      and nsp.nspname not in ('pg_catalog', 'information_schema')
    order by nsp.nspname, rel.relname, con.conname
  `) as FkRow[];

  const indexes = (await sql`
    select
      n.nspname as schema,
      t.relname as table,
      i.relname as name,
      ix.indisunique as unique,
      ix.indisprimary as primary,
      (
        select coalesce(json_agg(a.attname order by cols.ord), '[]'::json)
        from unnest(ix.indkey) with ordinality as cols(attnum, ord)
        join pg_attribute a on a.attrelid = t.oid and a.attnum = cols.attnum
      ) as columns
    from pg_index ix
    join pg_class t on t.oid = ix.indrelid
    join pg_class i on i.oid = ix.indexrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname not in ('pg_catalog', 'information_schema', 'pg_toast')
    order by n.nspname, t.relname, i.relname
  `) as IndexRow[];

  const tableMap = new Map<string, TableInfo>();

  for (const t of tables) {
    tableMap.set(tableKey(t.schema, t.name), {
      schema: t.schema,
      name: t.name,
      kind: t.kind,
      comment: t.comment,
      estimatedRows: Number(t.estimated_rows ?? 0),
      columns: [],
      foreignKeys: [],
      incomingFks: [],
      indexes: [],
      isJunction: false,
      junctionHint: null,
    });
  }

  const pkUnique = new Map<string, { pk: Set<string>; unique: Set<string> }>();
  for (const idx of indexes) {
    const key = tableKey(idx.schema, idx.table);
    if (!pkUnique.has(key)) pkUnique.set(key, { pk: new Set(), unique: new Set() });
    const entry = pkUnique.get(key)!;
    const cols = asStringArray(idx.columns);
    if (idx.primary) cols.forEach((c) => entry.pk.add(c));
    if (idx.unique && cols.length === 1) entry.unique.add(cols[0]);
    const table = tableMap.get(key);
    if (table) {
      table.indexes.push({
        name: idx.name,
        unique: idx.unique,
        primary: idx.primary,
        columns: cols,
      });
    }
  }

  const fkColsByTable = new Map<string, Set<string>>();
  const foreignKeys: ForeignKey[] = fks.map((fk) => ({
    name: fk.name,
    fromSchema: fk.from_schema,
    fromTable: fk.from_table,
    fromColumns: asStringArray(fk.from_columns),
    toSchema: fk.to_schema,
    toTable: fk.to_table,
    toColumns: asStringArray(fk.to_columns),
  }));

  for (const fk of foreignKeys) {
    const fromKey = tableKey(fk.fromSchema, fk.fromTable);
    const toKey = tableKey(fk.toSchema, fk.toTable);
    if (!fkColsByTable.has(fromKey)) fkColsByTable.set(fromKey, new Set());
    fk.fromColumns.forEach((c) => fkColsByTable.get(fromKey)!.add(c));
    tableMap.get(fromKey)?.foreignKeys.push(fk);
    tableMap.get(toKey)?.incomingFks.push(fk);
  }

  for (const col of columns) {
    const key = tableKey(col.schema, col.table);
    const table = tableMap.get(key);
    if (!table) continue;
    const flags = pkUnique.get(key);
    const column: ColumnInfo = {
      name: col.name,
      dataType: col.data_type,
      udtName: col.udt_name,
      nullable: col.nullable,
      defaultValue: col.default_value,
      isPk: flags?.pk.has(col.name) ?? false,
      isUnique: flags?.unique.has(col.name) ?? false,
      isFk: fkColsByTable.get(key)?.has(col.name) ?? false,
      comment: col.comment,
    };
    table.columns.push(column);
  }

  const resultTables = [...tableMap.values()].map((table) => {
    const junction = detectJunction(table);
    return { ...table, isJunction: junction.isJunction, junctionHint: junction.hint };
  });

  const schemas = [...new Set(resultTables.map((t) => t.schema))].sort();

  return { schemas, tables: resultTables, foreignKeys };
}
