import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../client'
import type { components } from '../generated/schema'
import { queryKeys } from '../queryKeys'

type ExpressionRead = components['schemas']['ExpressionRead'];

const fetchExpressions = async (graphId: string): Promise<ExpressionRead[]> => {
    const res = await (apiClient as any).GET('/expressions/graph/{graph_id}', {
        params: { path: { graph_id: graphId } }
    });
    if ('error' in res) throw res.error;
    return (res.data as any) ?? [];
};

export const useExpressions = (graphId: string) => {
    return useQuery({
        queryKey: queryKeys.expressions.byGraph(graphId),
        queryFn: () => fetchExpressions(graphId),
        enabled: Boolean(graphId),
    });
};
