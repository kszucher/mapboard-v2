import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createGraph = mutation({
  args: {
    userId: v.id("users"),
    graphName: v.string(),
  },
  handler: async (ctx, { userId, graphName }) => {
    const graphId = await ctx.db.insert("graphs", {
      name: graphName,
      userId,
    });

    await ctx.db.patch(userId, {
      selectedGraphId: graphId,
    });

    return graphId;
  },
});
