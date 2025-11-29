import { CaretDownIcon, MixIcon, PlayIcon } from '@radix-ui/react-icons';
import { Box, Button, DropdownMenu, Flex, IconButton, Text } from '@radix-ui/themes';
import { ReactFlowProvider } from '@xyflow/react';
import { NODE_TYPES } from '../../../convex/convex/schema.ts';
import { Flow } from './Flow.tsx';

export const Frame = () => {
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
                {NODE_TYPES.map((nodeType, id) => (
                  <DropdownMenu.Item key={id}>{nodeType}</DropdownMenu.Item>
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
