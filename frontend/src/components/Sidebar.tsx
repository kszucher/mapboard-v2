import { Box, Button, Flex, Text } from '@radix-ui/themes';
import { useGraphStore } from '../store/useGraphStore';
import { FullCodeEditor } from './FullCodeEditor';

interface SidebarProps {
  isSidebarOpen: boolean;
  isGraphSelected: boolean;
}

export const Sidebar = ({ isSidebarOpen, isGraphSelected }: SidebarProps) => {
  const runGraph = useGraphStore(state => state.runGraph);

  return (
    <Box
      style={{
        width: isSidebarOpen ? '380px' : '0px',
        minWidth: isSidebarOpen ? '380px' : '0px',
        height: '100%',
        borderRight: isSidebarOpen ? '1px solid var(--gray-4)' : 'none',
        backgroundColor: 'var(--gray-2)',
        transition: 'width 0.2s ease-in-out, min-width 0.2s ease-in-out',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Flex direction="column" gap="4" p="4" style={{ width: '380px', height: '100%', minHeight: 0 }}>
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

        {/* Full-file code editor */}
        <FullCodeEditor isGraphSelected={isGraphSelected}/>
      </Flex>
    </Box>
  );
};


