import { useQuery } from '@tanstack/react-query';
import { graphQueries } from '../../api/queries/graphs';

export const useGraphQuery = (graphId: string) => {
  return useQuery(graphQueries.flow(graphId));
};
