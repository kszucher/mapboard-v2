import { CaretDownIcon, CheckIcon, MixIcon, PlayIcon } from '@radix-ui/react-icons';
import { Box, Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { ReactFlowProvider } from '@xyflow/react';
import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';
import { NodeType } from '../../../convex/convex/schema.ts';
import { Flow } from './Flow.tsx';
import { useGraphMutations } from './useGraphMutations.ts';
import { useActiveGraphId, useUserGraphs } from './useGraphQueries.ts';

export const Frame = () => {
  const [userId, setUserId] = useState<Id<'users'> | null>(null);
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);

  useEffect(() => {
    const fetchUser = async () => {
      const id = await getOrCreateUser();
      setUserId(id);
    };
    fetchUser();
  }, [getOrCreateUser]);

  const selectedGraphId = useActiveGraphId(userId);
  const graphs = useUserGraphs(userId);

  const { createNode, createGraph, setActiveGraph } = useGraphMutations();

  const handleCreateNode = (graphId: Id<'graphs'>, nodeType: NodeType) => {
    if (!graphId) return;
    createNode(graphId, nodeType);
  };

  const handleCreateGraph = async () => {
    if (!userId) return;
    createGraph(userId, 'New Graph');
  };

  const handleSelectGraph = (graphId: Id<'graphs'>) => {
    if (!userId) return;
    setActiveGraph(userId, graphId);
  };

  const activeGraphName = graphs?.find(graph => graph._id === selectedGraphId)?.name ?? 'Select graph';

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
                {!graphs && <DropdownMenu.Item disabled>Loading…</DropdownMenu.Item>}
                {graphs && graphs.length === 0 && <DropdownMenu.Item disabled>No graphs yet</DropdownMenu.Item>}
                {graphs?.map(graph => (
                  <DropdownMenu.Item key={graph._id} onClick={() => handleSelectGraph(graph._id)}>
                    <Flex align="center" gap="2">
                      {graph._id === selectedGraphId && <CheckIcon />}
                      <Text>{graph.name}</Text>
                    </Flex>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Root>

            <Button variant="solid" radius="full" disabled={!isGraphSelected}>
              {activeGraphName}
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
