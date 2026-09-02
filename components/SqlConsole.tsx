"use client";

import { useState } from "react";

type Result = {
  columns?: string[];
  rows?: Record<string, unknown>[];
  truncated?: boolean;
  error?: string;
};

export function SqlConsole() {
  const [sql, setSql] = useState("select current_schema(), now()");
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sql }),
    });
    setResult((await res.json()) as Result);
    setLoading(false);
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
      <div>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {loading ? "ejecutando…" : "ejecutar"}
        </button>
      </div>
      {result?.error && <p className="text-sm text-rose-300">{result.error}</p>}
      {result?.truncated && <p className="text-xs text-amber-200">Resultado truncado a 200 filas.</p>}
      {result?.columns && (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-800">
          <table className="min-w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-900 text-slate-400">
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
