import { CaretDownIcon, PlayIcon } from "@radix-ui/react-icons"
import { Button, DropdownMenu, IconButton, Theme } from "@radix-ui/themes"
import { ConvexProvider, ConvexReactClient } from "convex/react"
import { ReactFlowMap } from "./ReactFlowMap.tsx"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export const App = () => {
  const tools: any[] = []
  const tabMapInfo: any[] = []

  return (
    <ConvexProvider client={convex}>

      <Theme
        appearance={'dark'}
        accentColor="iris"
        panelBackground="solid"
        scaling="100%"
        radius="full"
      >
        <ReactFlowMap mapId={'1'}/>
        <div className="dark:bg-zinc-800 bg-zinc-50 dark:border-neutral-700 fixed top-0 left-0 w-screen h-[40px] z-50">
          <div
            className="fixed box-border top-0 w-[192px] h-[40px] py-1 flex items-center justify-center text-white z-50 gap-2">
            <div style={{ fontFamily: 'Comfortaa' }} className="text-xl ">
              {'mapboard'}
            </div>
          </div>
          <div className="fixed left-1/2 -translate-x-1/2 h-[40px] flex flex-row items-center gap-1 align-center">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger>
                <IconButton variant="soft" color="gray" radius="full">
                  <CaretDownIcon/>
                </IconButton>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                <DropdownMenu.Label>{'My Maps'}</DropdownMenu.Label>
                {tabMapInfo?.map((_, index) => (
                  <DropdownMenu.Item
                    key={index}
                    onClick={() => {
                    }}
                  >
                    {tabMapInfo[index].name}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator/>
                <DropdownMenu.Label>{'Shared Maps'}</DropdownMenu.Label>

              </DropdownMenu.Content>
            </DropdownMenu.Root>
            <Button
              variant="solid"
              radius="full"
              onClick={() => {
              }}
            >
              {'My Map'}
            </Button>
          </div>
          <div className="fixed flex right-1 gap-6 h-[40px]">
            <div className="flex items-center gap-1">
              <DropdownMenu.Root>
                <DropdownMenu.Trigger>
                  <IconButton variant="solid" color="gray">
                    <PlayIcon/>
                  </IconButton>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
                  {tools.map(el => (
                    <DropdownMenu.Item
                      key={el.id}
                      onClick={() => {
                      }}
                    >
                      {el.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Root>
              <IconButton variant="solid" color="gray">
                <PlayIcon
                  onClick={() => {
                    console.log('play...')
                  }}
                />
              </IconButton>
            </div>
          </div>
        </div>
      </Theme>
    </ConvexProvider>
  )
}
