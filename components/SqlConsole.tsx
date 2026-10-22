"use client";

import { useState, useEffect } from "react";

type Result = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  truncated?: boolean;
  error?: string;
};

type RecentQuery = {
  sql: string;
  timestamp: number;
};

const RECENT_QUERIES_KEY = "db-studio-recent-queries";
const MAX_RECENT_QUERIES = 10;

function loadRecentQueries(): RecentQuery[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_QUERIES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRecentQuery(sql: string) {
  const trimmed = sql.trim();
  if (!trimmed) return;
  
  const queries = loadRecentQueries();
  const filtered = queries.filter((q) => q.sql !== trimmed);
  const updated = [{ sql: trimmed, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT_QUERIES);
  
  try {
    localStorage.setItem(RECENT_QUERIES_KEY, JSON.stringify(updated));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function SqlConsole() {
  const [sql, setSql] = useState("select current_schema(), now()");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recentQueries, setRecentQueries] = useState<RecentQuery[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  useEffect(() => {
    setRecentQueries(loadRecentQueries());
  }, []);

  async function run() {
    setLoading(true);
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sql }),
    });
    const data = (await res.json()) as Result;
    setResult(data);
    setLoading(false);
    
    if (!data.error) {
      saveRecentQuery(sql);
      setRecentQueries(loadRecentQueries());
    }
  }

  async function copyAsJson() {
    if (!result?.rows) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  }

  function selectRecentQuery(query: RecentQuery) {
    setSql(query.sql);
    setShowRecent(false);
  }

  function clearRecentQueries() {
    try {
      localStorage.removeItem(RECENT_QUERIES_KEY);
      setRecentQueries([]);
    } catch {
      // localStorage might be unavailable
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <p className="text-sm text-slate-400">
        Consola read-only: solo <code className="text-sky-300">SELECT</code>, máximo 200 filas.
      </p>
      <textarea
        value={sql}
        onChange={(e) => setSql(e.target.value)}
        className="h-40 resize-none rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-sm outline-none focus:border-sky-400"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "ejecutando…" : "ejecutar"}
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowRecent(!showRecent)}
            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600"
          >
            recientes {recentQueries.length > 0 && `(${recentQueries.length})`}
          </button>
          
          {showRecent && recentQueries.length > 0 && (
            <div className="absolute left-0 top-full z-10 mt-1 w-80 rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2">
                <span className="text-xs text-slate-400">Consultas recientes</span>
                <button
                  onClick={clearRecentQueries}
                  className="text-xs text-rose-400 hover:text-rose-300"
                >
                  limpiar
                </button>
              </div>
              <div className="max-h-60 overflow-auto">
                {recentQueries.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => selectRecentQuery(q)}
                    className="block w-full border-b border-slate-800 px-3 py-2 text-left hover:bg-slate-800"
                  >
                    <div className="truncate font-mono text-xs text-slate-200">
                      {q.sql}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {new Date(q.timestamp).toLocaleString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {result?.error && <p className="text-sm text-rose-300">{result.error}</p>}
      {result?.truncated && <p className="text-xs text-amber-200">Resultado truncado a 200 filas.</p>}
      {result?.columns && (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-700 bg-slate-900 px-2 py-1.5">
            <span className="text-xs text-slate-400">
              {result.rows?.length ?? 0} filas
            </span>
            <button
              onClick={copyAsJson}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-700"
            >
              {copied ? (
                <>
                  <svg className="h-3.5 w-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  copiado
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  copiar JSON
                </>
              )}
            </button>
          </div>
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-9 bg-slate-900 text-slate-400">
              <tr>
                {result.columns.map((c) => (
                  <th key={c} className="px-2 py-1">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(result.rows ?? []).map((row, i) => (
                <tr key={i} className="border-t border-slate-800">
                  {result.columns!.map((c) => (
                    <td key={c} className="max-w-[280px] truncate px-2 py-1 font-mono">
                      {row[c] == null ? "null" : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
