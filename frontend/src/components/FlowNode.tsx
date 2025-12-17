import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Badge, Box, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import type { BadgeProps } from '@radix-ui/themes';
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useEffect } from 'react';
import { useDeleteNode } from '../api/mutations';
import { FlowNodeAgent } from './FlowNodeAgent.tsx';
import { FlowNodeAgenticSwitch } from './FlowNodeAgenticSwitch.tsx';
import { FlowNodeLogic } from './FlowNodeLogic.tsx';
import { FlowNodeLogicalSwitch } from './FlowNodeLogicalSwitch.tsx';
import { FlowNodeStart } from './FlowNodeStart.tsx';
import type { AppFlowNode } from './types.ts';

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNodeMutation = useDeleteNode();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [data.node.num_handles, data.node.node_type, id, updateNodeInternals]);

  if (!data) return null;

  const renderBody = () => {
    switch (data.node.node_type) {
      case 'START':
        return <FlowNodeStart data={data} />;
      case 'LOGIC':
        return <FlowNodeLogic data={data} />;
      case 'AGENT':
        return <FlowNodeAgent data={data} />;
      case 'LOGICAL_SWITCH':
        return <FlowNodeLogicalSwitch data={data} />;
      case 'AGENTIC_SWITCH':
        return <FlowNodeAgenticSwitch data={data} />;
      default:
        return <div>Unknown Node Type</div>;
    }
  };

  return (
    <div
      style={{
        background: '#222222',
        borderRadius: 16,
        padding: 12,
        minWidth: 200,
        minHeight: 80,
      }}
    >
      <Box position="absolute" top="8px" left="8px">
        <Flex direction="row" gap="4px" align="center">
          <Badge color={'gray'} size="2">
            {'N' + data.node.iid}
          </Badge>
          <Badge color={data.node.color as BadgeProps['color']} size="2">
            {data.node.label}
          </Badge>
        </Flex>
      </Box>

      <Box position="absolute" top="8px" right="8px">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
              <DotsHorizontalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>{'Connect To...'}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item key={1}></DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item onClick={() => deleteNodeMutation.mutate({ nodeId: data.node.id })}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {renderBody()}
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prev, next) => {
  return prev.data === next.data;
});
