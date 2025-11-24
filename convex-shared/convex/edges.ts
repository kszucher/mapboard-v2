import { v } from "convex/values"
import { mutation, query } from "./_generated/server"

export const getEdgesOfMap = query({
  args: { mapId: v.id("maps") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("edges")
      .withIndex("by_mapId", (q) => q.eq("mapId", args.mapId))
      .collect()
  },
})

export const createEdge = mutation({
  args: {
    mapId: v.id("maps"),
    fromNodeId: v.id("nodes"),
    toNodeId: v.id("nodes"),
    schema: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("edges", args)
  },
})

export const deleteEdge = mutation({
  args: { edgeId: v.id("edges") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.edgeId)
  },
})
