import { CaretDownIcon, PlayIcon } from "@radix-ui/react-icons";
import {
  Button,
  DropdownMenu,
  IconButton,
  Theme,
  Flex,
  Box,
  Text
} from "@radix-ui/themes";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactFlowMap } from "./ReactFlowMap.tsx";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export const App = () => {
  const tools = [
    { id: 1, label: "Tool 1" },
    { id: 2, label: "Tool 2" },
  ];

  const tabMapInfo = [
    { name: "Map A" },
    { name: "Map B" },
  ];

  return (
    <ConvexProvider client={convex}>
      <Theme
        appearance="dark"
        accentColor="iris"
        panelBackground="solid"
        scaling="100%"
        radius="full"
      >

        {/* App Bar (Floating Overlay) */}
        <Box
          position="fixed"

          width="100%"
          height="40px"
          px="3"
          style={{
            zIndex: 9999,
            backgroundColor: "rgba(32, 32, 36, 0.9)", // translucent
            backdropFilter: "blur(6px)",
            borderBottom: "1px solid var(--gray-4)"
          }}
        >
          <Flex direction="row" align="center" justify="between" height="100%">
            {/* Left */}
            <Flex align="center" gap="2" width={"192px"}>
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
                <DropdownMenu.Content onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenu.Label>My Maps</DropdownMenu.Label>
                  {tabMapInfo.map((tab, i) => (
                    <DropdownMenu.Item key={i}>{tab.name}</DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Separator />
                  <DropdownMenu.Label>Shared Maps</DropdownMenu.Label>
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              <Button variant="solid" radius="full">My Map</Button>
            </Flex>

            {/* Right */}
            <Flex align="center" gap="2">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <IconButton variant="solid" color="gray" radius="full">
                    <PlayIcon />
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content onCloseAutoFocus={(e) => e.preventDefault()}>
                  {tools.map((tool) => (
                    <DropdownMenu.Item key={tool.id}>{tool.label}</DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>

              <IconButton
                variant="solid"
                color="gray"
                radius="full"
                onClick={() => console.log("play...")}
              >
                <PlayIcon />
              </IconButton>
            </Flex>
          </Flex>
        </Box>
        <ReactFlowMap mapId="1" />
      </Theme>
    </ConvexProvider>
  );
};
