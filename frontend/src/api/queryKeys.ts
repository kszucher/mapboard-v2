/**
 * Centralized query key factory for type-safe query keys.
 * This ensures consistency and makes refactoring easier.
 */
export const queryKeys = {
  // User queries
  users: {
    all: ['users'] as const,
    current: () => [...queryKeys.users.all, 'current'] as const,
    activeGraph: (userId: string | null) => [...queryKeys.users.all, userId, 'active-graph'] as const,
  },

  // Graph queries
  graphs: {
    all: ['graphs'] as const,
    byUser: (userId: string | null) => [...queryKeys.graphs.all, userId] as const,
  },

  // Node queries
  nodes: {
    all: ['nodes'] as const,
    byGraph: (graphId: string) => [...queryKeys.nodes.all, graphId] as const,
  },

  // Edge queries
  edges: {
    all: ['edges'] as const,
    byGraph: (graphId: string) => [...queryKeys.edges.all, graphId] as const,
  },

  // Expression queries
  expressions: {
    all: ['expressions'] as const,
    byGraph: (graphId: string) => [...queryKeys.expressions.all, graphId] as const,
  },
} as const;
