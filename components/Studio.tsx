"use client";

import { useEffect, useMemo, useState } from "react";
import type { SchemaGraph, TableInfo } from "@/lib/types";
import { ErdView } from "./ErdView";
import { SqlConsole } from "./SqlConsole";
import { TableDetail } from "./TableDetail";

type Tab = "schema" | "erd" | "sql";
type Filter = "all" | "junction" | "nofk" | "views";

function tableKey(t: TableInfo) {
  return `${t.schema}.${t.name}`;
}

export function Studio() {
  const [graph, setGraph] = useState<SchemaGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [schemaFilter, setSchemaFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("schema");
  const [erdScope, setErdScope] = useState<"all" | "selected">("selected");

  async function load() {
    setError(null);
    const res = await fetch("/api/schema");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "No se pudo cargar el schema");
      return;
    }
    setGraph(data as SchemaGraph);
    const first = (data as SchemaGraph).tables[0];
    if (first && !selected) setSelected(tableKey(first));
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!graph) return [];
    const q = search.toLowerCase().trim();
    return graph.tables.filter((t) => {
      if (schemaFilter !== "all" && t.schema !== schemaFilter) return false;
      if (kindFilter === "junction" && !t.isJunction) return false;
      if (kindFilter === "nofk" && t.foreignKeys.length === 0 && t.incomingFks.length === 0) return false;
      if (kindFilter === "views" && t.kind === "table") return false;
      if (!q) return true;
      const hay = [
        t.name,
        t.schema,
        t.comment ?? "",
        ...t.columns.map((c) => c.name),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [graph, search, schemaFilter, kindFilter]);

  const selectedTable = graph?.tables.find((t) => tableKey(t) === selected) ?? null;

  const erdTables = useMemo(() => {
    if (!graph) return [];
    if (erdScope === "all") return filtered.length ? filtered : graph.tables;
    if (!selectedTable) return filtered.slice(0, 20);
    const related = new Set<string>([tableKey(selectedTable)]);
    for (const fk of graph.foreignKeys) {
      const from = `${fk.fromSchema}.${fk.fromTable}`;
      const to = `${fk.toSchema}.${fk.toTable}`;
      if (from === tableKey(selectedTable)) related.add(to);
      if (to === tableKey(selectedTable)) related.add(from);
    }
    return graph.tables.filter((t) => related.has(tableKey(t)));
  }, [erdScope, filtered, graph, selectedTable]);

  const erdFks = useMemo(() => {
    if (!graph) return [];
    const keys = new Set(erdTables.map(tableKey));
    return graph.foreignKeys.filter(
      (fk) =>
        keys.has(`${fk.fromSchema}.${fk.fromTable}`) &&
        keys.has(`${fk.toSchema}.${fk.toTable}`)
    );
  }, [erdTables, graph]);

  const stats = useMemo(() => {
    if (!graph) return null;
    return {
      tables: graph.tables.filter((t) => t.kind === "table").length,
      views: graph.tables.filter((t) => t.kind !== "table").length,
      fks: graph.foreignKeys.length,
      junctions: graph.tables.filter((t) => t.isJunction).length,
    };
  }, [graph]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-slate-800 px-4 py-3">
        <div>
          <h1 className="text-base font-semibold">DB Studio</h1>
          <p className="text-xs text-slate-400">Explora tablas, relaciones y datos de Neon</p>
        </div>
        {stats && (
          <div className="flex gap-3 text-xs text-slate-300">
            <span>{stats.tables} tablas</span>
            <span>{stats.views} views</span>
            <span>{stats.fks} FKs</span>
            <span className="text-amber-200">{stats.junctions} intermedias</span>
          </div>
        )}
        <div className="ml-auto flex gap-2">
          {(["schema", "erd", "sql"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === t ? "bg-sky-500 text-slate-950" : "bg-slate-800 text-slate-200"
              }`}
            >
              {t === "schema" ? "Tablas" : t === "erd" ? "ERD" : "SQL"}
            </button>
          ))}
          <button onClick={() => void load()} className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm">
            recargar
          </button>
        </div>
      </header>

      {error && <div className="bg-rose-950 px-4 py-2 text-sm text-rose-200">{error}</div>}

      {!graph ? (
        <div className="p-6 text-slate-400">Cargando schema…</div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[280px_1fr]">
          <aside className="flex min-h-0 flex-col border-r border-slate-800">
            <div className="space-y-2 p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="buscar tabla o columna"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-400"
              />
              <select
                value={schemaFilter}
                onChange={(e) => setSchemaFilter(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="all">todos los schemas</option>
                {graph.schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as Filter)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="all">todas</option>
                <option value="junction">solo intermedias N:N</option>
                <option value="nofk">sin relaciones</option>
                <option value="views">views / matviews</option>
              </select>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {filtered.map((t) => {
                const key = tableKey(t);
                const active = key === selected;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelected(key);
                      if (tab === "sql") setTab("schema");
                    }}
                    className={`block w-full border-b border-slate-800 px-3 py-2 text-left text-sm ${
                      active ? "bg-sky-500/15" : "hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{t.name}</span>
                      {t.isJunction && <span className="text-[10px] text-amber-300">N:N</span>}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.schema} · {t.columns.length} cols · {t.foreignKeys.length} FK
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="min-h-0">
            {tab === "schema" && selectedTable && <TableDetail table={selectedTable} />}
            {tab === "schema" && !selectedTable && (
              <p className="p-6 text-slate-400">Selecciona una tabla.</p>
            )}
            {tab === "erd" && (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-2 text-xs">
                  <span className="text-slate-400">Alcance del diagrama</span>
                  <button
                    className={`rounded px-2 py-1 ${erdScope === "selected" ? "bg-sky-500 text-slate-950" : "bg-slate-800"}`}
                    onClick={() => setErdScope("selected")}
                  >
                    tabla + vecinas
                  </button>
                  <button
                    className={`rounded px-2 py-1 ${erdScope === "all" ? "bg-sky-500 text-slate-950" : "bg-slate-800"}`}
                    onClick={() => setErdScope("all")}
                  >
                    filtro actual
                  </button>
                  <span className="text-slate-500">
                    {erdTables.length} tablas · {erdFks.length} relaciones · arrastra nodos y usa el minimap
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <ErdView
                    tables={erdTables}
                    foreignKeys={erdFks}
                    selectedKey={selected}
                    onSelect={(key) => setSelected(key)}
                  />
                </div>
              </div>
            )}
            {tab === "sql" && <SqlConsole />}
          </main>
        </div>
      )}
    </div>
  );
}
