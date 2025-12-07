import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import type { AppFlowNode } from './types.ts';
import { SwitchBody } from './SwitchBody.tsx';

interface FlowNodeLogicalSwitchProps {
  data: AppFlowNode['data'];
  updateNode: (args: { nodeId: Id<'nodes'>; patch: any }) => void;
}

export const FlowNodeLogicalSwitch = ({ data, updateNode }: FlowNodeLogicalSwitchProps) => {
  const { node } = data;
  const SPACING = 40;
  const BASE_OFFSET = 66;
  const num = Math.max(1, node.numHandles || 0);
  const LEFT_HANDLE_OFFSET = BASE_OFFSET + ((num - 1) * SPACING) / 2;

  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>
        <SwitchBody
          nodeId={node._id}
          inputValue={node.inputValue}
          inputTextsSecondary={node.inputTextsSecondary}
          updateNode={updateNode}
          isLogicalSwitch={true}
        />
      </Flex>

      <Handle type="target" position={Position.Left} style={{ top: LEFT_HANDLE_OFFSET }} />

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
