import { CaretDownIcon, MixIcon, PlayIcon } from '@radix-ui/react-icons';
import { Box, Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { ReactFlowProvider } from '@xyflow/react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { Color, NodeType } from '../../../convex/convex/schema.ts';
import { Flow } from './Flow.tsx';

export const Frame = () => {
  const userId = 'js71tjgnrp94vywd89pqjafx3h7wc2tb' as Id<'users'>;

  const selectedGraphId = useQuery(api.users.getActiveGraphId, { userId });

  const createNode = useMutation(api.nodes.createNode);
  const createGraph = useMutation(api.graphs.createGraph);

  const handleCreateNode = (graphId: Id<'graphs'>, nodeType: NodeType) => {
    if (!graphId) return;

    void createNode({
      graphId,
      iid: 1,
      width: 200,
      height: 120,
      offsetX: 0,
      offsetY: 50,
      color: {
        [NodeType.START]: Color.gray,
        [NodeType.LOGIC]: Color.purple,
        [NodeType.AGENT]: Color.blue,
        [NodeType.LOGICAL_SWITCH]: Color.amber,
        [NodeType.AGENTIC_SWITCH]: Color.grass,
      }[nodeType],
      label: {
        [NodeType.START]: 'Start',
        [NodeType.LOGIC]: 'Logic',
        [NodeType.AGENT]: 'Agent',
        [NodeType.LOGICAL_SWITCH]: 'Logical Switch',
        [NodeType.AGENTIC_SWITCH]: 'Agentic Switch',
      }[nodeType],
      numHandles: 1,
      nodeType: nodeType,
      isProcessing: false,
      inputValue: null,
      outputValue: null,
      inputSchema: null,
      outputSchema: null,
    });
  };

  const handleCreateGraph = async () => {
    void createGraph({ userId, graphName: 'New Graph' });
  };

  const tabGraphInfo = [{ name: 'Graph A' }, { name: 'Graph B' }];

  const isGraphSelected = !!selectedGraphId;

  return (
    <>
      {/* App Bar */}
      <Box
        position="fixed"
        width="100%"
        height="40px"
        px="3"
        style={{
          zIndex: 9999,
          backgroundColor: 'rgba(32, 32, 36, 0.9)',
          backdropFilter: 'blur(6px)',
          borderBottom: '1px solid var(--gray-4)',
        }}
      >
        <Flex direction="row" align="center" justify="between" height="100%">
          {/* Left */}
          <Flex align="center" gap="2" width={'192px'}>
            <Text size="2" weight="bold" color="gray">
              graphboard
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
                <DropdownMenu.Label>My Graphs</DropdownMenu.Label>
                {tabGraphInfo.map((tab, i) => (
                  <DropdownMenu.Item key={i}>{tab.name}</DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button variant="solid" radius="full">
              My Graph
            </Button>

            {/* New Graph Button */}
            <IconButton variant="soft" color="gray" radius="full" onClick={handleCreateGraph}>
              +{/* or any icon you like */}
            </IconButton>
          </Flex>

          {/* Right */}
          <Flex align="center" gap="2">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="solid" color="gray" radius="full" disabled={!isGraphSelected}>
                  <MixIcon width="20" height="20" />
                </IconButton>
              </DropdownMenu.Trigger>
              {isGraphSelected && (
                <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                  {Object.values(NodeType).map((nodeType, id) => (
                    <DropdownMenu.Item onClick={() => handleCreateNode(selectedGraphId, nodeType)} key={id}>
                      {nodeType}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              )}
            </DropdownMenu.Root>

            <IconButton variant="solid" color="gray" radius="full" onClick={() => console.log('play...')}>
              <PlayIcon width="20" height="20" />
            </IconButton>
          </Flex>
        </Flex>
      </Box>

      {/* Flow */}
      {isGraphSelected && (
        <div style={{ width: '100vw', height: '100vh' }}>
          <ReactFlowProvider>
            <Flow selectedGraphId={selectedGraphId} />
          </ReactFlowProvider>
        </div>
      )}
    </>
  );
};
