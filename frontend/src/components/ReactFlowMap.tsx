import {
  type Connection,
  Controls,
  type NodeTypes,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useMutation, useQuery } from "convex/react"
import { type MouseEvent } from "react"
import { api } from "../../../convex-shared/convex/_generated/api"
import { CustomNode } from "./ReactFlowMapNode.tsx"

const nodeTypes: NodeTypes = { custom: CustomNode }

export const ReactFlowMap = ({ mapId }: { mapId: string }) => {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <FlowContent mapId={mapId}/>
      </ReactFlowProvider>
    </div>
  )
}

import type { Id } from "../../../convex-shared/convex/_generated/dataModel" // Import the Id type

const FlowContent = ({ mapId }: { mapId: string }) => {
  // Cast mapId to Id<"maps"> for Convex queries
  const nodesData = useQuery(api.nodes.getNodesOfMap, { mapId: mapId as Id<"maps"> });
  const edgesData = useQuery(api.edges.getEdgesOfMap, { mapId: mapId as Id<"maps"> });

  const updateNode = useMutation(api.nodes.updateNode);
  const createEdge = useMutation(api.edges.createEdge);
  const deleteEdge = useMutation(api.edges.deleteEdge);

  const { fitView } = useReactFlow();

  if (!nodesData || !edgesData) return null;

  const nodes = nodesData.map((n) => ({
    id: n._id,
    type: "custom",
    position: { x: n.offsetX, y: n.offsetY },
    data: {
      node: n,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const edges = edgesData.map((e) => ({
    id: e._id,
    source: e.fromNodeId,
    target: e.toNodeId,
    animated: false,
  }));

  // --- Fit view on first render ---
  if (nodes.length > 0) {
    fitView({ padding: 0.1, maxZoom: 1, duration: 0 });
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onConnect={(params: Connection) => {
        if (params.source && params.target) {
          createEdge({
            mapId: mapId as Id<"maps">,
            fromNodeId: params.source as Id<"nodes">,
            toNodeId: params.target as Id<"nodes">
          }).then();
        }
      }}
      onEdgesDelete={(edgesToDelete) => {
        edgesToDelete.forEach((e) => deleteEdge({ edgeId: e.id as Id<"edges"> }));
      }}
      onNodeDragStop={(_, node) => {
        updateNode({
          nodeId: node.id as Id<"nodes">,
          patch: {
            offsetX: Math.round(node.position.x),
            offsetY: Math.round(node.position.y),
          },
        }).then();
      }}
      onDoubleClick={(event: MouseEvent) => {
        event.preventDefault();
        fitView({ padding: 0.1, maxZoom: 1, duration: 300 }).then();
      }}
      colorMode="dark"
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      panOnScroll
    >
      <Controls />
    </ReactFlow>
  );
};
