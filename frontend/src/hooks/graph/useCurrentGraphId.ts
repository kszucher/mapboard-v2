import { useActiveGraphId, useUserId } from '../../api/queries';

/**
 * Custom hook to get the currently selected graph ID from the React Query cache.
 */
export const useCurrentGraphId = () => {
  const { data: userId } = useUserId();
  const { data: selectedGraphId } = useActiveGraphId(userId ?? null);
  return selectedGraphId || '';
};
