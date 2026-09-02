import type { Edge, Node } from "@xyflow/react";
import type { ForeignKey, TableInfo } from "@/lib/types";
import type { TableNodeData } from "./TableNode";

function keyOf(schema: string, name: string) {
  return `${schema}.${name}`;
}

export function layoutErd(
  tables: TableInfo[],
  fks: ForeignKey[],
  selectedKey: string | null
): { nodes: Node<TableNodeData>[]; edges: Edge[] } {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  for (const t of tables) {
    indegree.set(keyOf(t.schema, t.name), 0);
    outgoing.set(keyOf(t.schema, t.name), []);
  }

  for (const fk of fks) {
    const from = keyOf(fk.fromSchema, fk.fromTable);
    const to = keyOf(fk.toSchema, fk.toTable);
    if (!indegree.has(from) || !indegree.has(to) || from === to) continue;
    indegree.set(from, (indegree.get(from) ?? 0) + 1);
    outgoing.get(to)?.push(from);
  }

  const layers: string[][] = [];
  const remaining = new Set(indegree.keys());
  let current = [...remaining].filter((k) => (indegree.get(k) ?? 0) === 0);

  while (remaining.size) {
    if (!current.length) {
      current = [[...remaining][0]];
    }
    layers.push(current);
    current.forEach((k) => remaining.delete(k));
    const next: string[] = [];
    for (const k of current) {
      for (const child of outgoing.get(k) ?? []) {
        if (!remaining.has(child)) continue;
        indegree.set(child, (indegree.get(child) ?? 1) - 1);
        if ((indegree.get(child) ?? 0) <= 0) next.push(child);
      }
    }
    current = [...new Set(next)];
    if (!current.length && remaining.size) current = [[...remaining][0]];
  }

  const tableByKey = new Map(tables.map((t) => [keyOf(t.schema, t.name), t]));
  const nodes: Node<TableNodeData>[] = [];

  layers.forEach((layer, x) => {
    layer.forEach((k, y) => {
      const table = tableByKey.get(k);
      if (!table) return;
      nodes.push({
        id: k,
        type: "table",
        position: { x: x * 320, y: y * 240 },
        data: { table, selected: selectedKey === k },
      });
    });
  });

  const edges: Edge[] = fks.map((fk, i) => {
    const source = keyOf(fk.toSchema, fk.toTable);
    const target = keyOf(fk.fromSchema, fk.fromTable);
    return {
      id: `${fk.name}-${i}`,
      source,
      target,
      animated: false,
      label: `${fk.fromColumns.join(", ")} → ${fk.toColumns.join(", ")}`,
      style: { stroke: "#7dd3fc" },
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
    };
  });

  return { nodes, edges };
}
