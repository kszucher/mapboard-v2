import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';

export const FlowNodeStart = () => {
  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>

      </Flex>

      <Handle type="target" position={Position.Left} />
    </>
  );
};
