"use client";

import { useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import type { ForeignKey, TableInfo } from "@/lib/types";
import { layoutErd } from "./erdLayout";
import { TableNode, type TableNodeType } from "./TableNode";

const nodeTypes = { table: TableNode };

export function ErdView({
  tables,
  foreignKeys,
  selectedKey,
  onSelect,
}: {
  tables: TableInfo[];
  foreignKeys: ForeignKey[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const laidOut = useMemo(
    () => layoutErd(tables, foreignKeys, selectedKey),
    [tables, foreignKeys, selectedKey]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(laidOut.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(laidOut.edges);

  useEffect(() => {
    setNodes(laidOut.nodes);
    setEdges(laidOut.edges);
  }, [laidOut, setEdges, setNodes]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => onSelect(node.id)}
        fitView
        minZoom={0.15}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => {
            const node = n as TableNodeType;
            if (node.data?.table.isJunction) return "#fbbf24";
            return "#38bdf8";
          }}
          maskColor="rgba(2,6,23,0.7)"
        />
        <Controls />
        <Background color="#1e293b" gap={18} />
      </ReactFlow>
    </div>
  );
}
