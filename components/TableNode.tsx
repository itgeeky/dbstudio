import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { TableInfo } from "@/lib/types";

export type TableNodeData = {
  table: TableInfo;
  selected: boolean;
};

export type TableNodeType = Node<TableNodeData, "table">;

export function TableNode({ data }: NodeProps<TableNodeType>) {
  const { table, selected } = data;
  const cols = table.columns.slice(0, 10);
  const extra = table.columns.length - cols.length;

  return (
    <div
      className={`min-w-[220px] rounded-xl border shadow-xl ${
        selected
          ? "border-sky-400 ring-2 ring-sky-400/40"
          : table.isJunction
            ? "border-amber-400/70"
            : "border-slate-600"
      } bg-slate-900`}
    >
      <Handle type="target" position={Position.Left} className="!bg-sky-400" />
      <div
        className={`rounded-t-xl px-3 py-2 text-sm font-semibold ${
          table.isJunction ? "bg-amber-500/20 text-amber-100" : "bg-slate-800 text-slate-100"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span>{table.name}</span>
          {table.isJunction && (
            <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
              N:N
            </span>
          )}
        </div>
        <div className="text-[10px] font-normal text-slate-400">{table.schema}</div>
      </div>
      <div className="px-3 py-2 font-mono text-[11px] leading-5">
        {cols.map((col) => (
          <div key={col.name} className="flex items-center justify-between gap-3">
            <span className={col.isPk ? "text-amber-300" : col.isFk ? "text-sky-300" : "text-slate-200"}>
              {col.isPk ? "🔑 " : col.isFk ? "🔗 " : ""}
              {col.name}
            </span>
            <span className="text-slate-500">{col.udtName}</span>
          </div>
        ))}
        {extra > 0 && <div className="pt-1 text-slate-500">+{extra} columnas</div>}
      </div>
      <Handle type="source" position={Position.Right} className="!bg-sky-400" />
    </div>
  );
}
