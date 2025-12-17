import { Theme } from '@radix-ui/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { subscribeCrossTab } from '../utils/crossTab';
import { Frame } from './Frame.tsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const CrossTabSync = () => {
  const client = useQueryClient();

  useEffect(() => {
    return subscribeCrossTab(message => {
      if (message.type === 'activeGraphChanged') {
        void client.invalidateQueries({ queryKey: ['users', message.userId, 'active-graph'] });
        void client.invalidateQueries({ queryKey: ['nodes', message.graphId] });
        void client.invalidateQueries({ queryKey: ['edges', message.graphId] });
      }

      if (message.type === 'graphCreated') {
        void client.invalidateQueries({ queryKey: ['graphs', message.userId] });
      }
    });
  }, [client]);

  return null;
};

export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <CrossTabSync />
      <Theme appearance="dark" accentColor="iris" panelBackground="solid" scaling="100%" radius="full">
        <Frame />
      </Theme>
    </QueryClientProvider>
  );
};
