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
