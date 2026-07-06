import type { OnError } from '@xyflow/react';
import { Controls, ReactFlow, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback } from 'react';
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

  const onNodesChange = useGraphStore(state => state.onNodesChange);
  const onEdgesChange = useGraphStore(state => state.onEdgesChange);
  const onConnect = useGraphStore(state => state.onConnect);
  const onEdgesDelete = useGraphStore(state => state.onEdgesDelete);
  const onReconnect = useGraphStore(state => state.onReconnect);

  const { fitView } = useReactFlow();

  useGraphWebSocket(selectedGraphId);

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

  const handleError: OnError = useCallback((code, message) => {
    if (code === '008') {
      return;
    }
    console.warn(message);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{
        width: '100%',
        height: '100%',
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
        pointerEvents: isLoading ? 'none' : 'auto',
      }}>
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
          isValidConnection={isValidConnection}
          nodesDraggable={false}
          colorMode="dark"
          zoomOnScroll={true}
          zoomOnDoubleClick={false}
          panOnScroll={false}
          onDoubleClick={handleDoubleClick}
          onError={handleError}
        >
          <Controls/>
        </ReactFlow>
      </div>

      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--gray-11)',
          background: 'var(--gray-1)',
          zIndex: 10,
        }}>
          Loading Graph...
        </div>
      )}
    </div>
  );
};

export const Flow = ({ selectedGraphId }: { selectedGraphId: string }) => {
  return (
    <FlowContent key={selectedGraphId} selectedGraphId={selectedGraphId}/>
  );
};
