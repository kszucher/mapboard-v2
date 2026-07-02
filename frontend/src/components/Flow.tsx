import { Controls, ReactFlow, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import FlowEdge from './FlowEdge.tsx';
import { CustomNode } from './FlowNode.tsx';
import { useGraphWebSocket } from './hooks/useGraphWebSocket.ts';

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: FlowEdge };

const FlowContent = ({
  selectedGraphId,
}: {
  selectedGraphId: string;
}) => {
  const nodes = useGraphStore(state => state.nodes);
  const edges = useGraphStore(state => state.edges);
  const isLoading = useGraphStore(state => state.isLoading);
  const init = useGraphStore(state => state.init);

  const onNodesChange = useGraphStore(state => state.onNodesChange);
  const onEdgesChange = useGraphStore(state => state.onEdgesChange);
  const onConnect = useGraphStore(state => state.onConnect);
  const onEdgesDelete = useGraphStore(state => state.onEdgesDelete);
  const onReconnect = useGraphStore(state => state.onReconnect);
  const onNodeDragStop = useGraphStore(state => state.onNodeDragStop);

  const { fitView } = useReactFlow();

  useGraphWebSocket(selectedGraphId);

  useEffect(() => {
    void init(selectedGraphId);
  }, [selectedGraphId, init]);

  const isValidConnection = useCallback(() => true, []);

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('react-flow__pane')) {
        event.preventDefault();
        void fitView({ padding: 0.1, duration: 300 });
      }
    },
    [fitView],
  );

  if (isLoading) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--gray-11)',
      }}>
        Loading Graph...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgesDelete={onEdgesDelete}
        onReconnect={onReconnect}
        onNodeDragStop={onNodeDragStop}
        isValidConnection={isValidConnection}
        nodesDraggable={true}
        colorMode="dark"
        zoomOnScroll={true}
        zoomOnDoubleClick={false}
        panOnScroll={false}
        onDoubleClick={handleDoubleClick}
      >
        <Controls/>
      </ReactFlow>
    </div>
  );
};

export const Flow = ({ selectedGraphId }: { selectedGraphId: string }) => {
  return (
    <FlowContent key={selectedGraphId} selectedGraphId={selectedGraphId}/>
  );
};
