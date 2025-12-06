import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { nodeFields } from './schema';

export const getNodesOfGraph = query({
  args: { graphId: v.id("graphs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("nodes")
      .withIndex("by_graphId", (q) => q.eq("graphId", args.graphId))
      .collect();
  },
});

export const createNode = mutation({
  args: nodeFields,
  handler: async (ctx, args) => {
    return await ctx.db.insert("nodes", args);
  },
});

export const updateNode = mutation({
  args: {
    nodeId: v.id("nodes"),
    patch: v.object({
      graphId: v.optional(v.id("graphs")),
      toolId: v.optional(v.id("tools")),
      iid: v.optional(v.number()),
      offsetX: v.optional(v.number()),
      offsetY: v.optional(v.number()),
      isProcessing: v.optional(v.boolean()),
      inputValue: v.optional(v.any()),
      outputValue: v.optional(v.any()),
      numHandles: v.optional(v.number()),
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
