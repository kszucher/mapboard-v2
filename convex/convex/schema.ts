import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ColorMode = {
  DARK: 'DARK',
  LIGHT: 'LIGHT',
} as const;

export type ColorMode = (typeof ColorMode)[keyof typeof ColorMode];

export const ColorModes = v.union(...Object.values(ColorMode).map(v.literal));

export const Color = {
  gray: 'gray',
  gold: 'gold',
  bronze: 'bronze',
  brown: 'brown',
  yellow: 'yellow',
  amber: 'amber',
  orange: 'orange',
  tomato: 'tomato',
  red: 'red',
  ruby: 'ruby',
  crimson: 'crimson',
  pink: 'pink',
  plum: 'plum',
  purple: 'purple',
  violet: 'violet',
  iris: 'iris',
  indigo: 'indigo',
  blue: 'blue',
  cyan: 'cyan',
  teal: 'teal',
  jade: 'jade',
  green: 'green',
  grass: 'grass',
  lime: 'lime',
  mint: 'mint',
  sky: 'sky',
} as const;

export type Color = (typeof Color)[keyof typeof Color];

export const Colors = v.union(...Object.values(Color).map(v.literal));

export const NodeType = {
  START: 'START',
  LOGIC: 'LOGIC',
  AGENT: 'AGENT',
  LOGICAL_SWITCH: 'LOGICAL_SWITCH',
  AGENTIC_SWITCH: 'AGENTIC_SWITCH',
};

export type NodeType = (typeof NodeType)[keyof typeof NodeType];

export const NodeTypes = v.union(...Object.values(NodeType).map(v.literal));

export const userFields = {
  colorMode: ColorModes,
  name: v.string(),
  selectedGraphId: v.optional(v.id('graphs')),
};

export const graphFields = {
  name: v.string(),
  userId: v.id('users'),
};

export const nodeFields = {
  graphId: v.id('graphs'),
  iid: v.number(),
  width: v.number(),
  height: v.number(),
  offsetX: v.number(),
  offsetY: v.number(),
  color: Colors,
  label: v.string(),
  numHandles: v.number(),
  nodeType: NodeTypes,
  isProcessing: v.boolean(),
  nodeTypeLogicalSwitchInput: v.optional(
    v.object({
      inputTextPrimary: v.optional(v.string()),
      inputTextsSecondary: v.optional(v.array(v.string())),
    })
  ),
  nodeTypeLogicInput: v.optional(v.any()),
  nodeTypeAgentInput: v.optional(v.any()), // Refine later
  nodeTypeAgenticSwitchInput: v.optional(v.any()), // Refine later
  inputValue: v.optional(v.any()),
  inputTextPrimary: v.optional(v.string()),
  inputTextsSecondary: v.optional(v.any()),
  outputValue: v.optional(v.any()),
  inputSchema: v.optional(v.any()),
  outputSchema: v.optional(v.any()),
};

export const edgeFields = {
  graphId: v.id('graphs'),
  fromNodeId: v.id('nodes'),
  toNodeId: v.id('nodes'),
  handleIndex: v.number(),
};

export default defineSchema({
  users: defineTable(userFields),

  graphs: defineTable(graphFields).index('by_userId', ['userId']),

  nodes: defineTable(nodeFields).index('by_graphId', ['graphId']),

  edges: defineTable(edgeFields)
    .index('by_graphId', ['graphId'])
    .index('by_fromNodeId', ['fromNodeId'])
    .index('by_toNodeId', ['toNodeId']),
});
