import { v } from 'convex/values';
import { mutation } from './_generated/server';
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
