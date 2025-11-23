import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const ColorMode = v.union(v.literal("DARK"), v.literal("LIGHT"));
const Color = v.union(
  v.literal("gray"), v.literal("gold"), v.literal("bronze"), v.literal("brown"),
  v.literal("yellow"), v.literal("amber"), v.literal("orange"), v.literal("tomato"),
  v.literal("red"), v.literal("ruby"), v.literal("crimson"), v.literal("pink"),
  v.literal("plum"), v.literal("purple"), v.literal("violet"), v.literal("iris"),
  v.literal("indigo"), v.literal("blue"), v.literal("cyan"), v.literal("teal"),
  v.literal("jade"), v.literal("green"), v.literal("grass"), v.literal("lime"),
  v.literal("mint"), v.literal("sky")
);

export default defineSchema({
  users: defineTable({
    colorMode: ColorMode,
    name: v.string(),
  }),

  maps: defineTable({
    name: v.string(),
    userId: v.id("users"),
  })
    .index("by_userId", ["userId"]),

  nodes: defineTable({
    mapId: v.id("maps"),
    toolId: v.id("tools"),
    iid: v.int64(),
    offsetX: v.int64(),
    offsetY: v.int64(),
    isProcessing: v.boolean(),
    inputValue: v.optional(v.any()),
    outputValue: v.optional(v.any()),
  })
    .index("by_mapId", ["mapId"])
    .index("by_toolId", ["toolId"]),

  edges: defineTable({
    mapId: v.id("maps"),
    fromNodeId: v.id("nodes"),
    toNodeId: v.id("nodes"),
    schema: v.optional(v.any()),
  })
    .index("by_mapId", ["mapId"])
    .index("by_fromNodeId", ["fromNodeId"])
    .index("by_toNodeId", ["toNodeId"]),

  tools: defineTable({
    width: v.int64(),
    height: v.int64(),
    color: Color,
    label: v.string(),
    inputSchema: v.optional(v.any()),
    outputSchema: v.optional(v.any()),
  }),

  tabs: defineTable({
    userId: v.id("users"),
    mapIds: v.array(v.id("maps")),
  })
    .index("by_userId", ["userId"]),
});
