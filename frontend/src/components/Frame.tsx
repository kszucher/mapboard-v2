import { CaretDownIcon, CheckIcon, MixIcon, PlayIcon, ResetIcon } from '@radix-ui/react-icons';
import { Box, Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { ReactFlowProvider } from '@xyflow/react';
import { useCallback, useEffect, useMemo } from 'react';
import { useCreateGraph, useSetActiveGraph } from '../api/mutations';
import { useActiveGraphId, useUserGraphs, useUserId } from '../api/queries';
import { useGraphStore } from '../store/useGraphStore';
import { Flow } from './Flow.tsx';
import type { NodeType } from './types';

const NODE_TYPES: NodeType[] = [
  'START',
  'END',
  'LOGIC',
  'AGENT',
  'LOGICAL_SWITCH',
  'AGENTIC_SWITCH',
  'LOGICAL_JOIN',
  'AGENTIC_JOIN',
  'TRANSFORM_AGENT_TO_LOGICAL',
  'TRANSFORM_LOGICAL_TO_AGENT',
];

export const Frame = () => {
  const { data: userId } = useUserId();
  const { data: selectedGraphId } = useActiveGraphId(userId ?? null);
  const { data: graphs } = useUserGraphs(userId ?? null);

  const undo = useGraphStore(state => state.undo);
  const redo = useGraphStore(state => state.redo);
  const canUndo = useGraphStore(state => state.past.length > 0);
  const canRedo = useGraphStore(state => state.future.length > 0);

  const addNode = useGraphStore(state => state.addNode);
  const createGraphMutation = useCreateGraph();
  const setActiveGraphMutation = useSetActiveGraph();

  const errorMessage = useGraphStore(state => state.errorMessage);
  const clearErrorMessage = useGraphStore(state => state.clearErrorMessage);

  useEffect(() => {
    if (errorMessage) {
      alert(errorMessage);
      clearErrorMessage();
    }
  }, [errorMessage, clearErrorMessage]);

  const handleCreateNode = useCallback(
    (nodeType: NodeType) => {
      void addNode(nodeType);
    },
    [addNode]
  );

  const handleCreateGraph = useCallback(() => {
    if (!userId) return;
    createGraphMutation.mutate({ userId, graphName: 'New Graph' });
  }, [userId, createGraphMutation]);

  const handleSelectGraph = useCallback(
    (graphId: string) => {
      if (!userId) return;
      setActiveGraphMutation.mutate({ userId, graphId });
    },
    [userId, setActiveGraphMutation]
  );

  const activeGraphName = useMemo(
    () => graphs?.find(graph => graph.id === selectedGraphId)?.name ?? 'Select graph',
    [graphs, selectedGraphId]
  );

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
                  <CaretDownIcon/>
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                <DropdownMenu.Label>My Graphs</DropdownMenu.Label>
                {!graphs && <DropdownMenu.Item disabled>Loading…</DropdownMenu.Item>}
                {graphs && graphs.length === 0 && <DropdownMenu.Item disabled>No graphs yet</DropdownMenu.Item>}
                {graphs?.map(graph => (
                  <DropdownMenu.Item key={graph.id} onClick={() => handleSelectGraph(graph.id)}>
                    <Flex align="center" gap="2">
                      {graph.id === selectedGraphId && <CheckIcon/>}
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
            <IconButton
              variant="solid"
              color="gray"
              radius="full"
              disabled={!isGraphSelected || !canUndo}
              onClick={undo}
            >
              <ResetIcon width="20" height="20"/>
            </IconButton>

            <IconButton
              variant="solid"
              color="gray"
              radius="full"
              disabled={!isGraphSelected || !canRedo}
              onClick={redo}
            >
              <ResetIcon width="20" height="20" style={{ transform: 'scaleX(-1)' }}/>
            </IconButton>

            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="solid" color="gray" radius="full" disabled={!isGraphSelected}>
                  <MixIcon width="20" height="20"/>
                </IconButton>
              </DropdownMenu.Trigger>
              {isGraphSelected && (
                <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                  {NODE_TYPES.map((nodeType, id) => (
                    <DropdownMenu.Item onClick={() => handleCreateNode(nodeType)} key={id}>
                      {nodeType}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              )}
            </DropdownMenu.Root>

            <IconButton variant="solid" color="gray" radius="full" onClick={() => console.log('play...')}>
              <PlayIcon width="20" height="20"/>
            </IconButton>
          </Flex>
        </Flex>
      </Box>

      {/* Flow */}
      {isGraphSelected && (
        <Box width="100vw" height="100vh">
          <ReactFlowProvider>
            <Flow selectedGraphId={selectedGraphId}/>
          </ReactFlowProvider>
        </Box>
      )}
    </>
  );
};
