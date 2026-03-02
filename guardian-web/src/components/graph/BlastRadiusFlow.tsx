"use client";

import { useCallback, useState, useMemo } from "react";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  MarkerType,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import { BlastRadius, BlastRadiusNode } from "@/types/cr";
import { FileNode } from "./FileNode";
import { ServiceNode } from "./ServiceNode";
import { NodeDetailDrawer } from "./NodeDetailDrawer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 60;

function layoutGraph(blastRadius: BlastRadius): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: 60, ranksep: 120 });
  g.setDefaultEdgeLabel(() => ({}));

  blastRadius.nodes.forEach((n) => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }));
  blastRadius.edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const nodes: Node[] = blastRadius.nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: n.type === "file" ? "fileNode" : "serviceNode",
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: {
        label: n.label,
        risk_level: n.risk_level,
        type: n.type,
        metadata: n.metadata,
      },
    };
  });

  const edges: Edge[] = blastRadius.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: false,
    style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(var(--muted-foreground))" },
    labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 10 },
    labelBgStyle: { fill: "hsl(var(--background))" },
  }));

  return { nodes, edges };
}

const nodeTypes = { fileNode: FileNode, serviceNode: ServiceNode };

interface BlastRadiusFlowProps {
  blastRadius: BlastRadius;
}

export function BlastRadiusFlow({ blastRadius }: BlastRadiusFlowProps) {
  const [selectedNode, setSelectedNode] = useState<BlastRadiusNode | null>(null);

  const { nodes: initNodes, edges: initEdges } = useMemo(
    () => layoutGraph(blastRadius),
    [blastRadius]
  );

  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const found = blastRadius.nodes.find((n) => n.id === node.id) ?? null;
      setSelectedNode(found);
    },
    [blastRadius.nodes]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Network className="h-4 w-4" />
          Blast Radius
          <span className="text-xs text-muted-foreground font-normal ml-1">
            {blastRadius.nodes.length} nodes · {blastRadius.edges.length} edges
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-[400px] rounded-b-lg overflow-hidden border-t border-border">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="hsl(var(--border))" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(n) => {
                const risk = (n.data as { risk_level?: string }).risk_level;
                if (risk === "high") return "#ef4444";
                if (risk === "med") return "#eab308";
                return "#22c55e";
              }}
              maskColor="rgba(0,0,0,0.5)"
            />
          </ReactFlow>
          <NodeDetailDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
        </div>
      </CardContent>
    </Card>
  );
}
