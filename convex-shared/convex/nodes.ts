import { v } from "convex/values"
import { query, mutation } from "./_generated/server"

export const getNodesOfMap = query({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nodes")
      .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId))
      .collect();
  },
});

export const createNode = mutation({
  args: {
    mapId: v.id("maps"),
    toolId: v.id("tools"),
    iid: v.number(),
    offsetX: v.number(),
    offsetY: v.number(),
    isProcessing: v.boolean(),
    inputValue: v.optional(v.any()),
    outputValue: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("nodes", args);
  },
});

export const updateNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    patch: v.object({
      mapId: v.optional(v.id("maps")),
      toolId: v.optional(v.id("tools")),
      iid: v.optional(v.number()),
      offsetX: v.optional(v.number()),
      offsetY: v.optional(v.number()),
      isProcessing: v.optional(v.boolean()),
      inputValue: v.optional(v.any()),
      outputValue: v.optional(v.any()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.nodeId, args.patch);
  },
});

export const deleteNode = mutation({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, args) => {
    const fromEdges = await ctx.db
      .query("edges")
      .withIndex("by_fromNodeId", (q) => q.eq("fromNodeId", args.nodeId))
      .collect();
    for (const edge of fromEdges) {
      await ctx.db.delete(edge._id);
    }
    const toEdges = await ctx.db
      .query("edges")
      .withIndex("by_toNodeId", (q) => q.eq("toNodeId", args.nodeId))
      .collect();
    for (const edge of toEdges) {
      await ctx.db.delete(edge._id);
    }
    await ctx.db.delete(args.nodeId);
  },
});
