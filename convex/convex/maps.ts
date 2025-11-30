import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createMap = mutation({
  args: {
    userId: v.id("users"),
    mapName: v.string(),
  },
  handler: async (ctx, { userId, mapName }) => {
    const mapId = await ctx.db.insert("maps", {
      name: mapName,
      userId,
    });

    await ctx.db.patch(userId, {
      selectedMapId: mapId,
    });

    return mapId;
  },
});
