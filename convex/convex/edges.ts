import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { edgeFields } from './schema';

export const getEdgesOfGraph = query({
  args: { graphId: v.id('graphs') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('edges')
      .withIndex('by_graphId', q => q.eq('graphId', args.graphId))
      .collect();
  },
});

export const createEdge = mutation({
  args: edgeFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert('edges', args);
  },
});

export const deleteEdge = mutation({
  args: { edgeId: v.id('edges') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.edgeId);
  },
});

export const deleteEdgesByNodeAndHandles = mutation({
  args: {
    fromNodeId: v.id('nodes'),
    deletedHandleIndex: v.number(),
  },
  handler: async (ctx, args) => {
    // Find all edges from this node
    const edges = await ctx.db
      .query('edges')
      .withIndex('by_fromNodeId', q => q.eq('fromNodeId', args.fromNodeId))
      .collect();

    for (const edge of edges) {
      if (edge.handleIndex === args.deletedHandleIndex) {
        // Delete the edge at the exact deleted handle index
        await ctx.db.delete(edge._id);
      } else if (edge.handleIndex > args.deletedHandleIndex) {
        // Shift down (decrement) the handleIndex for edges above the deleted index
        await ctx.db.patch(edge._id, {
          handleIndex: edge.handleIndex - 1,
        });
      }
      // Edges with handleIndex < deletedHandleIndex remain unchanged
    }
  },
});
