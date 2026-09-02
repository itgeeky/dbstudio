"use client";

import { useEffect, useState } from "react";
import type { TableInfo } from "@/lib/types";

type Preview = {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
};

function cell(value: unknown) {
  if (value == null) return <span className="text-slate-500">null</span>;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function TableDetail({ table }: { table: TableInfo }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQ("");
    setPage(1);
  }, [table.schema, table.name]);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({
        schema: table.schema,
        table: table.name,
        q,
        page: String(page),
        pageSize: "25",
      });
      const res = await fetch(`/api/preview?${params}`, { signal: controller.signal });
      const data = (await res.json()) as Preview;
      setPreview(data);
      setLoading(false);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(t);
    };
  }, [table.schema, table.name, q, page]);

  const pages = Math.max(1, Math.ceil((preview?.total ?? 0) / 25));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-slate-800 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{table.schema}.{table.name}</h2>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs uppercase text-slate-300">
            {table.kind}
          </span>
          {table.isJunction && (
            <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-200">
              tabla intermedia
            </span>
          )}
          <span className="text-xs text-slate-400">~{table.estimatedRows.toLocaleString()} filas (estimado)</span>
        </div>
        {table.comment && <p className="mt-1 text-sm text-slate-400">{table.comment}</p>}
        {table.junctionHint && <p className="mt-1 text-sm text-amber-200">{table.junctionHint}</p>}
      </div>

      <div className="grid min-h-0 flex-1 grid-rows-2 lg:grid-cols-2 lg:grid-rows-1">
        <div className="overflow-auto border-b border-slate-800 p-4 lg:border-b-0 lg:border-r">
          <h3 className="mb-2 text-sm font-semibold text-slate-300">Columnas</h3>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="py-1">nombre</th>
                <th>tipo</th>
                <th>flags</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name} className="border-t border-slate-800">
                  <td className="py-1 font-mono">{col.name}</td>
                  <td className="text-slate-400">{col.dataType}</td>
                  <td className="space-x-1">
                    {col.isPk && <span className="text-amber-300">PK</span>}
                    {col.isFk && <span className="text-sky-300">FK</span>}
                    {col.isUnique && <span className="text-emerald-300">UQ</span>}
                    {!col.nullable && <span className="text-rose-300">NN</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-300">Foreign keys</h3>
          {table.foreignKeys.length === 0 ? (
            <p className="text-xs text-slate-500">Sin FKs salientes.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {table.foreignKeys.map((fk) => (
                <li key={fk.name} className="font-mono text-sky-200">
                  {fk.fromColumns.join(", ")} → {fk.toSchema}.{fk.toTable}({fk.toColumns.join(", ")})
                </li>
              ))}
            </ul>
          )}

          <h3 className="mb-2 mt-5 text-sm font-semibold text-slate-300">Referenciada por</h3>
          {table.incomingFks.length === 0 ? (
            <p className="text-xs text-slate-500">Nadie apunta a esta tabla.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {table.incomingFks.map((fk) => (
                <li key={fk.name} className="font-mono text-slate-300">
                  {fk.fromSchema}.{fk.fromTable}.{fk.fromColumns.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex min-h-0 flex-col p-4">
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-300">Datos</h3>
            {loading && <span className="text-xs text-slate-500">cargando…</span>}
            <input
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
              placeholder="buscar en columnas de texto/número"
              className="ml-auto w-64 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs outline-none focus:border-sky-400"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-800">
            {preview?.error ? (
              <p className="p-3 text-sm text-rose-300">{preview.error}</p>
            ) : (
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    {(preview?.columns ?? []).map((c) => (
                      <th key={c} className="whitespace-nowrap px-2 py-1">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(preview?.rows ?? []).map((row, i) => (
                    <tr key={i} className="border-t border-slate-800">
                      {(preview?.columns ?? []).map((c) => (
                        <td key={c} className="max-w-[260px] truncate px-2 py-1 font-mono">
                          {cell(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
            <span>{preview?.total ?? 0} filas</span>
            <div className="flex gap-2">
              <button
                className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                prev
              </button>
              <span>
                {page}/{pages}
              </span>
              <button
                className="rounded border border-slate-700 px-2 py-1 disabled:opacity-40"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
