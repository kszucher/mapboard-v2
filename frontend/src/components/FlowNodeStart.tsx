import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';

export const FlowNodeStart = () => {
  return (
    <>
      <Flex direction="column" gap="3" style={{ marginTop: 38 }}>

      </Flex>

      <Handle id="0" type="source" position={Position.Right} />
    </>
  );
};
