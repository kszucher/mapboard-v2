import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import type { BadgeProps } from '@radix-ui/themes'
import { Badge, Box, DropdownMenu, Flex, IconButton } from '@radix-ui/themes'
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react'
import { memo, useCallback, useEffect, useMemo } from 'react'
import { useDeleteNode } from '../api/mutations'
import { useExpressions } from '../api/queries'
import { FlowNodeAgent } from './FlowNodeAgent.tsx'
import { FlowNodeAgenticSwitch } from './FlowNodeAgenticSwitch.tsx'
import { FlowNodeLogic } from './FlowNodeLogic.tsx'
import { FlowNodeLogicalSwitch } from './FlowNodeLogicalSwitch.tsx'
import { FlowNodeStart } from './FlowNodeStart.tsx'
import type { AppFlowNode } from './types.ts'

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNodeMutation = useDeleteNode();
  const updateNodeInternals = useUpdateNodeInternals();

  const { data: allExpressions } = useExpressions(data.node.graph_id);
  const myExpressionsHash = useMemo(() => {
    const mine = allExpressions?.filter(e => e.node_id === id) ?? [];
    const sorted = [...mine].sort((a, b) => a.idx - b.idx);
    return sorted.map(e => `${e.id}:${e.idx}`).join(',');
  }, [allExpressions, id]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [myExpressionsHash, data.node.node_type, id, updateNodeInternals]);

  const handleDelete = useCallback(() => {
    deleteNodeMutation.mutate({ nodeId: data.node.id });
  }, [data.node.id, deleteNodeMutation]);

  const renderBody = useMemo(() => {
    switch (data.node.node_type) {
      case 'START':
        return <FlowNodeStart />;
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
  }, [data]);

  if (!data) return null;

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
        <DropdownMenu.Root modal={false}>
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
            <DropdownMenu.Item onClick={handleDelete}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {renderBody}
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent);
