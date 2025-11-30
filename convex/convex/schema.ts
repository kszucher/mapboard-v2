import { defineSchema, defineTable } from 'convex/server';
import { v, Infer } from "convex/values";

export const ColorMode = v.union(v.literal('DARK'), v.literal('LIGHT'));

export type ColorModeValue = Infer<typeof ColorMode>;

export const COLOR_MODES: ColorModeValue[] = ColorMode.members.map(m => m.value);

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

export type ColorValue = Infer<typeof Color>;

export const COLORS: ColorValue[] = Color.members.map(m => m.value);

export const NodeType = v.union(
  v.literal('START'),
  v.literal('LOGIC'),
  v.literal('AGENT'),
  v.literal('LOGICAL_SWITCH'),
  v.literal('AGENTIC_SWITCH')
);

export type NodeTypeValue = Infer<typeof NodeType>;

export const NODE_TYPES: NodeTypeValue[] = NodeType.members.map(m => m.value);

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
  width: v.number(),
  height: v.number(),
  offsetX: v.number(),
  offsetY: v.number(),
  color: Color,
  label: v.string(),
  numHandles: v.number(),
  nodeType: NodeType,
  isProcessing: v.boolean(),
  inputValue: v.optional(v.any()),
  outputValue: v.optional(v.any()),
  inputSchema: v.optional(v.any()),
  outputSchema: v.optional(v.any()),
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
