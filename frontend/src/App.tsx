import { Theme } from '@radix-ui/themes';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from './api/queryClient';
import { Frame } from './Frame.tsx';


export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="iris" panelBackground="solid" scaling="100%" radius="full">
        <Frame/>
      </Theme>
    </QueryClientProvider>
  );
};
