import { v } from 'convex/values';
import { mutation, query } from './_generated/server';

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
