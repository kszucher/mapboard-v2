import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { useRunGraph } from '../hooks/graph/useGraphMutations';
import { FullCodeEditor } from './FullCodeEditor';

interface SidebarProps {
  isSidebarOpen: boolean;
  isGraphSelected: boolean;
  graphId: string;
}

export const Sidebar = ({ isSidebarOpen, isGraphSelected, graphId }: SidebarProps) => {
  const { mutate: runGraph } = useRunGraph(graphId);

  return (
    <Box
      style={{
        width: isSidebarOpen ? '500px' : '0px',
        minWidth: isSidebarOpen ? '500px' : '0px',
        height: '100%',
        borderRight: isSidebarOpen ? '1px solid var(--gray-4)' : 'none',
        backgroundColor: 'var(--gray-2)',
        transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex direction="column" gap="4" p="4" style={{ width: '500px', height: '100%', minHeight: 0 }}>
        {/* Header */}
        <Flex justify="between" align="center" style={{ flexShrink: 0 }}>
          <Text size="3" weight="bold">Workflow Code</Text>
          <Button
            size="2"
            variant="solid"
            color="green"
            onClick={() => void runGraph()}
            disabled={!isGraphSelected}
            style={{ cursor: isGraphSelected ? 'pointer' : 'default' }}
          >
            ▶ Run Graph
          </Button>
        </Flex>

        <FullCodeEditor graphId={graphId}/>
      </Flex>
    </Box>
  );
};
