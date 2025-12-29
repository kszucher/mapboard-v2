import type { Edge, Node } from '@xyflow/react'
import type { components } from '../api/generated/schema'

export type ApiNode = components['schemas']['NodeRead'];
export type ApiEdge = components['schemas']['EdgeRead'];

export type AppFlowNode = Node<{ node: ApiNode }, 'custom'>;
export type AppFlowEdge = Edge<{ edge?: ApiEdge }, 'custom'>;
