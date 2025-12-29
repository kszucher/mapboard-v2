import { Theme } from '@radix-ui/themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Frame } from './Frame.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});


export const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Theme appearance="dark" accentColor="iris" panelBackground="solid" scaling="100%" radius="full">
        <Frame />
      </Theme>
    </QueryClientProvider>
  );
};
