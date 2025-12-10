import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { nodeFields } from './schema';

export const getNodesOfGraph = query({
  args: { graphId: v.id('graphs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('nodes')
      .withIndex('by_graphId', q => q.eq('graphId', args.graphId))
      .collect();
  },
});

export const createNode = mutation({
  args: nodeFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert('nodes', args);
  },
});

export const updateNode = mutation({
  args: {
    nodeId: v.id('nodes'),
    patch: v.object({
      ...Object.fromEntries(
        Object.entries(nodeFields).map(([key, validator]) => [
          key,
          v.optional(validator),
        ])
      ),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nodeId, args.patch);
  },
});

export const deleteNode = mutation({
  args: { nodeId: v.id('nodes') },
  handler: async (ctx, args) => {
    const fromEdges = await ctx.db
      .query('edges')
      .withIndex('by_fromNodeId', q => q.eq('fromNodeId', args.nodeId))
      .collect();
    for (const edge of fromEdges) {
      await ctx.db.delete(edge._id);
    }
    const toEdges = await ctx.db
      .query('edges')
      .withIndex('by_toNodeId', q => q.eq('toNodeId', args.nodeId))
      .collect();
    for (const edge of toEdges) {
      await ctx.db.delete(edge._id);
    }
    await ctx.db.delete(args.nodeId);
  },
});
