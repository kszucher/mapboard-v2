import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, getClientId } from '../client';
import type { components } from '../generated/schema';
import { queryKeys } from '../queryKeys';

export const useCreateExpression = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nodeId, idx, raw_string, type = 'SUB' }: {
      nodeId: string;
      idx?: number;
      raw_string: string;
      graphId: string;
      type?: 'BASE' | 'SUB';
    }) => {
      const res = await apiClient.POST('/expressions', {
        headers: { 'X-Client-Id': getClientId() },
        body: {
          node_id: nodeId,
          idx,
          raw_string,
          type,
        },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useUpdateExpression = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ expressionId, patch }: {
      expressionId: string;
      patch: components['schemas']['ExpressionUpdate'];
      graphId: string
    }) => {
      const res = await apiClient.PATCH('/expressions/{expression_id}', {
        params: { path: { expression_id: expressionId } },
        headers: { 'X-Client-Id': getClientId() },
        body: patch,
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useDeleteExpression = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { expressionId: string; graphId: string }) => {
      const res = await apiClient.DELETE('/expressions/{expression_id}', {
        params: { path: { expression_id: variables.expressionId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useMoveExpressionUp = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { expressionId: string; graphId: string }) => {
      const res = await apiClient.POST('/expressions/{expression_id}/move-up', {
        params: { path: { expression_id: variables.expressionId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};

export const useMoveExpressionDown = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { expressionId: string; graphId: string }) => {
      const res = await apiClient.POST('/expressions/{expression_id}/move-down', {
        params: { path: { expression_id: variables.expressionId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      return res.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.graphs.flow(variables.graphId) });
    },
  });
};
