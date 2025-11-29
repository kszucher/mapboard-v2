import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { Badge, Box, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import type { AppFlowNode } from './types.ts';

export const CustomNode = ({ data }: NodeProps<AppFlowNode>) => {
  if (!data) return null;

  const SPACING = 24;
  const BASE_OFFSET = 50;

  return (
    <div
      style={{
        background: '#222222',
        borderRadius: 16,
        padding: 12,
        minWidth: 200,
        minHeight: 80,
        transition: 'left 0.3s, top 0.3s',
        transitionTimingFunction: 'cubic-bezier(0.0,0.0,0.58,1.0)',
      }}
    >
      {/* Top-left badges */}
      <Box position="absolute" top="8px" left="8px">
        <Flex direction="row" gap="4px" align="center">
          <Badge color="gray" size="2">
            {'N' + data.node.iid}
          </Badge>
          <Badge size="2">{'data.tool.label'}</Badge>
        </Flex>
      </Box>

      {/* Top-right dots button */}
      <Box position="absolute" top="8px" right="8px">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
              <DotsHorizontalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="DropdownMenuSubTrigger">{'Connect To...'}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item key={1}></DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            <DropdownMenu.Item onClick={() => {}}>{'Delete'}</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {/* Node body */}
      <div style={{ marginTop: 40 }}>{'Instructions'}</div>

      {/* Left handle */}
      <Handle type="target" position={Position.Left} />

      {/* Right handles */}
      {Array.from({ length: data.node.numHandles }).map((_, i) => (
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
    </div>
  );
};
