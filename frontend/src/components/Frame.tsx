import { CaretDownIcon, MixIcon, PlayIcon } from '@radix-ui/react-icons';
import { Box, Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { ReactFlowProvider } from '@xyflow/react';
import { useMutation } from 'convex/react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { NODE_TYPES, type NodeTypeValue } from '../../../convex/convex/schema.ts';
import { Flow } from './Flow.tsx';

export const Frame = () => {
  const activeMapId: Id<'maps'> = 'j972jys6e4qata01jzwmsp2a457wamnd';

  const createNode = useMutation(api.nodes.createNode);

  const handleCreateNode = (mapId: Id<'maps'>, nodeTypeValue: NodeTypeValue) => {
    switch (nodeTypeValue) {
      case 'START':
        void createNode({
          mapId,
          iid: 1,
          width: 200,
          height: 120,
          offsetX: 0,
          offsetY: 50,
          color: 'yellow',
          label: 'Start',
          numHandles: 2,
          nodeType: nodeTypeValue,
          isProcessing: false,

          // Optional fields:
          inputValue: null,
          outputValue: null,
          inputSchema: null,
          outputSchema: null,
        });
        break;
    }
  };

  const tabMapInfo = [{ name: 'Map A' }, { name: 'Map B' }];

  return (
    <>
      {/* App Bar (Floating Overlay) */}
      <Box
        position="fixed"
        width="100%"
        height="40px"
        px="3"
        style={{
          zIndex: 9999,
          backgroundColor: 'rgba(32, 32, 36, 0.9)', // translucent
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid var(--gray-4)',
        }}
      >
        <Flex direction="row" align="center" justify="between" height="100%">
          {/* Left */}
          <Flex align="center" gap="2" width={'192px'}>
            <Text size="2" weight="bold" color="gray">
              mapboard
            </Text>
          </Flex>

          {/* Center */}
          <Flex align="center" gap="2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="soft" color="gray" radius="full">
                  <CaretDownIcon />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                <DropdownMenu.Label>My Maps</DropdownMenu.Label>
                {tabMapInfo.map((tab, i) => (
                  <DropdownMenu.Item key={i}>{tab.name}</DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator />
                <DropdownMenu.Label>Shared Maps</DropdownMenu.Label>
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button variant="solid" radius="full">
              My Map
            </Button>
          </Flex>

          {/* Right */}
          <Flex align="center" gap="2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="solid" color="gray" radius="full">
                  <MixIcon width="20" height="20" />
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                {NODE_TYPES.map((nodeTypeValue, id) => (
                  <DropdownMenu.Item onClick={() => handleCreateNode(activeMapId, nodeTypeValue)} key={id}>
                    {nodeTypeValue}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <IconButton variant="solid" color="gray" radius="full" onClick={() => console.log('play...')}>
              <PlayIcon width="20" height="20" />
            </IconButton>
          </Flex>
        </Flex>
      </Box>
      <div style={{ width: '100vw', height: '100vh' }}>
        <ReactFlowProvider>
          <Flow />
        </ReactFlowProvider>
      </div>
    </>
  );
};
