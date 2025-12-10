/* eslint-disable react-refresh/only-export-components */
import { createContext, type ReactNode, useContext } from 'react';
import { useGraphMutations } from '../useGraphMutations.ts';

type GraphMutationsContextType = ReturnType<typeof useGraphMutations>;

const GraphMutationsContext = createContext<GraphMutationsContextType | null>(null);

interface GraphMutationsProviderProps {
  children: ReactNode;
}

export const GraphMutationsProvider = ({ children }: GraphMutationsProviderProps) => {
  const mutations = useGraphMutations();

  return (
    <GraphMutationsContext.Provider value={mutations}>
      {children}
    </GraphMutationsContext.Provider>
  );
};

export const useGraphMutationsContext = () => {
  const context = useContext(GraphMutationsContext);
  if (!context) {
    throw new Error('useGraphMutationsContext must be used within GraphMutationsProvider');
  }
  return context;
};
