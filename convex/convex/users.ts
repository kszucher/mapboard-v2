import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

export const getOrCreateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.db.query('users').first();
    if (user) {
      return user._id;
    }
    const userId = await ctx.db.insert('users', {
      name: 'User',
      colorMode: 'DARK',
      selectedGraphId: undefined,
    });
    return userId;
  },
});

export const getActiveGraphId = query({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return user.selectedGraphId;
  },
});

export const createUser = mutation({
  args: { userName: v.string() },
  handler: async (ctx, { userName }) => {
    const userId = await ctx.db.insert('users', {
      name: userName,
      colorMode: 'DARK',
      selectedGraphId: undefined,
    });
    return { userId };
  },
});

export const setActiveGraph = mutation({
  args: {
    userId: v.id('users'),
    graphId: v.id('graphs'),
  },
  handler: async (ctx, { userId, graphId }) => {
    const graph = await ctx.db.get(graphId);
    if (!graph) {
      throw new Error('Graph not found');
    }
    if (graph.userId !== userId) {
      throw new Error('Graph does not belong to user');
    }

    await ctx.db.patch(userId, { selectedGraphId: graphId });
  },
});