import { Theme } from '@radix-ui/themes';
import { QueryClientProvider } from '@tanstack/react-query';
import { Frame } from './Frame.tsx';

import { queryClient } from '../api/queryClient';



export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="iris" panelBackground="solid" scaling="100%" radius="full">
        <Frame/>
      </Theme>
    </QueryClientProvider>
  );
};
