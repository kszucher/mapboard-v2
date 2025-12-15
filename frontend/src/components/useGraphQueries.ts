import { useQuery } from 'convex/react';
import { api } from '../../../convex/convex/_generated/api';
import type { Id } from '../../../convex/convex/_generated/dataModel';

export const useGraphQueries = (graphId: Id<'graphs'>) => {
  const nodes = useQuery(api.nodes.getNodesOfGraph, { graphId });
  const edges = useQuery(api.edges.getEdgesOfGraph, { graphId });

  return {
    nodes,
    edges,
  };
};

export const useActiveGraphId = (userId: Id<'users'> | null) => {
  return useQuery(api.users.getActiveGraphId, userId ? { userId } : 'skip');
};

export const useUserGraphs = (userId: Id<'users'> | null) => {
  return useQuery(api.graphs.listGraphsByUser, userId ? { userId } : 'skip');
};