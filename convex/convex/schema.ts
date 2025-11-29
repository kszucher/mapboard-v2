import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ColorMode = v.union(v.literal('DARK'), v.literal('LIGHT'));

export const Color = v.union(
  v.literal('gray'),
  v.literal('gold'),
  v.literal('bronze'),
  v.literal('brown'),
  v.literal('yellow'),
  v.literal('amber'),
  v.literal('orange'),
  v.literal('tomato'),
  v.literal('red'),
  v.literal('ruby'),
  v.literal('crimson'),
  v.literal('pink'),
  v.literal('plum'),
  v.literal('purple'),
  v.literal('violet'),
  v.literal('iris'),
  v.literal('indigo'),
  v.literal('blue'),
  v.literal('cyan'),
  v.literal('teal'),
  v.literal('jade'),
  v.literal('green'),
  v.literal('grass'),
  v.literal('lime'),
  v.literal('mint'),
  v.literal('sky')
);

export const userFields = {
  colorMode: ColorMode,
  name: v.string(),
};

export const mapFields = {
  name: v.string(),
  userId: v.id('users'),
};

export const nodeFields = {
  mapId: v.id('maps'),
  iid: v.number(),
  offsetX: v.number(),
  offsetY: v.number(),
  isProcessing: v.boolean(),
  inputValue: v.optional(v.any()),
  outputValue: v.optional(v.any()),
  width: v.number(),
  height: v.number(),
  color: Color,
  label: v.string(),
  inputSchema: v.optional(v.any()),
  outputSchema: v.optional(v.any()),
  numHandles: v.number(),
};

export const edgeFields = {
  mapId: v.id('maps'),
  fromNodeId: v.id('nodes'),
  toNodeId: v.id('nodes'),
  handleIndex: v.number(),
};

export const tabFields = {
  userId: v.id('users'),
  mapIds: v.array(v.id('maps')),
};

export default defineSchema({
  users: defineTable(userFields),

  maps: defineTable(mapFields).index('by_userId', ['userId']),

  nodes: defineTable(nodeFields).index('by_mapId', ['mapId']),

  edges: defineTable(edgeFields)
    .index('by_mapId', ['mapId'])
    .index('by_fromNodeId', ['fromNodeId'])
    .index('by_toNodeId', ['toNodeId']),

  tabs: defineTable(tabFields).index('by_userId', ['userId']),
});
