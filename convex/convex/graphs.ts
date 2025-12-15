import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { Color, NodeType } from './schema';

export const createGraph = mutation({
  args: {
    userId: v.id('users'),
    graphName: v.string(),
  },
  handler: async (ctx, { userId, graphName }) => {
    const graphId = await ctx.db.insert('graphs', {
      name: graphName,
      userId,
    });

    await ctx.db.insert('nodes', {
      graphId,
      nodeType: NodeType.START,
      color: Color.gray,
      iid: 1,
      width: 200,
      height: 200,
      offsetX: 100,
      offsetY: 100,
      label: 'Start',
      numHandles: 1,
      isProcessing: false,
    });

    await ctx.db.patch(userId, {
      selectedGraphId: graphId,
    });

    return graphId;
  },
});

export const listGraphsByUser = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const graphs = await ctx.db
      .query('graphs')
      .withIndex('by_userId', q => q.eq('userId', userId))
      .collect();

    // Sort newest first so the recently created graph shows up at the top.
    return graphs.sort((a, b) => b._creationTime - a._creationTime);
  },
});
