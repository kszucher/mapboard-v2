import { Theme } from '@radix-ui/themes';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { Frame } from './Frame.tsx';

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

export const App = () => {
  return (
    <ConvexProvider client={convex}>
      <Theme appearance="dark" accentColor="iris" panelBackground="solid" scaling="100%" radius="full">
        <Frame />
      </Theme>
    </ConvexProvider>
  );
};
