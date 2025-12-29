import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, getClientId } from '../client'
import type { components } from '../generated/schema'
import { queryKeys } from '../queryKeys'

type NodeRead = components['schemas']['NodeRead'];

export const useCreateExpression = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ nodeId, idx, raw_string }: {
      nodeId: string;
      idx: number;
      raw_string: string;
      graphId: string
    }) => {
      const res = await apiClient.POST('/expressions', {
        headers: { 'X-Client-Id': getClientId() },
        body: {
          node_id: nodeId,
          idx,
          raw_string,
        },
      })
      if ('error' in res) throw res.error
      return res.data
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.edges.byGraph(variables.graphId) })
    },
  })
}

export const useUpdateExpression = () => {
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: async ({ expressionId, patch, graphId }: {
      expressionId: string;
      patch: components['schemas']['ExpressionUpdate'];
      graphId: string
    }) => {
      const queryKey = queryKeys.nodes.byGraph(graphId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey)

      if (previous) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old
          return old.map(node => ({
            ...node,
            expressions: (node.expressions || []).map(exp =>
              exp.id === expressionId ? { ...exp, ...patch } as components['schemas']['ExpressionRead'] : exp
            )
          }))
        })
      }

      return { previous, graphId }
    },
    mutationFn: async ({ expressionId, patch }: {
      expressionId: string;
      patch: components['schemas']['ExpressionUpdate'];
      graphId: string
    }) => {
      const res = await apiClient.PATCH('/expressions/{expression_id}', {
        params: { path: { expression_id: expressionId } },
        headers: { 'X-Client-Id': getClientId() },
        body: patch,
      })
      if ('error' in res) throw res.error
    },
    onError: (_err, _variables, context) => {
      if (context?.graphId) {
        queryClient.setQueryData(queryKeys.nodes.byGraph(context.graphId), context.previous)
      }
    },
  })
}

export const useDeleteExpression = () => {
  const queryClient = useQueryClient()

  return useMutation({
    onMutate: async ({ expressionId, graphId }: { expressionId: string; graphId: string }) => {
      const queryKey = queryKeys.nodes.byGraph(graphId)
      await queryClient.cancelQueries({ queryKey })

      const previous = queryClient.getQueryData<NodeRead[]>(queryKey)

      if (previous) {
        queryClient.setQueryData<NodeRead[]>(queryKey, old => {
          if (!old) return old
          return old.map(node => ({
            ...node,
            expressions: (node.expressions || []).filter(exp => exp.id !== expressionId)
          }))
        })
      }

      return { previous, graphId }
    },
    mutationFn: async ({ expressionId }: { expressionId: string; graphId: string }) => {
      const res = await apiClient.DELETE('/expressions/{expression_id}', {
        params: { path: { expression_id: expressionId } },
        headers: { 'X-Client-Id': getClientId() },
      })
      if ('error' in res) throw res.error
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.nodes.byGraph(variables.graphId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.edges.byGraph(variables.graphId) })
    },
    onError: (_err, _variables, context) => {
      if (context?.graphId) {
        queryClient.setQueryData(queryKeys.nodes.byGraph(context.graphId), context.previous)
      }
    },
  })
}
