import { Handle, Position } from '@xyflow/react';
import type { AppFlowNode } from './types.ts';

interface FlowNodeStartProps {
  data: AppFlowNode['data'];
}

export const FlowNodeStart = ({ data }: FlowNodeStartProps) => {
  const { node } = data;
  const SPACING = 24;
  const BASE_OFFSET = 50;

  return (
    <>
      <div style={{ marginTop: 40 }}>{'Instructions'}</div>

      <Handle type="target" position={Position.Left} />

      {Array.from({ length: node.numHandles }).map((_, i) => (
        <Handle
          key={i}
          id={String(i)}
          type="source"
          position={Position.Right}
          style={{
            top: BASE_OFFSET + i * SPACING,
          }}
        />
      ))}
    </>
  );
};
