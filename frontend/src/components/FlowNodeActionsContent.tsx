import { PlusIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canShortcircuitNode,
  computeTraversalIndices,
  getAvailableConversions,
  getIncomingEdgeOptions,
  getOutgoingEdgeOptions
} from '../utils/flowUtils';
import type { InsertableNodeType, NodeType } from './types';

const INSERTABLE_NODE_TYPES: { type: InsertableNodeType; label: string }[] = [
  { type: 'STEP', label: 'Step' },
  { type: 'SWITCH', label: 'Switch' },
];

export interface FlowNodeActionsContentProps {
  nodeId: string;
}

export const FlowNodeActionsContent = ({ nodeId }: FlowNodeActionsContentProps) => {
  const deleteNode = useGraphStore(state => state.deleteNode);
  const shortcircuitNode = useGraphStore(state => state.shortcircuitNode);
  const convertNode = useGraphStore(state => state.convertNode);
  const updateNode = useGraphStore(state => state.updateNode);
  const insertNode = useGraphStore(state => state.insertNode);
  const deleteEdge = useGraphStore(state => state.deleteEdge);

  const edges = useGraphStore(useShallow(state => state.edges));
  const nodes = useGraphStore(useShallow(state => state.nodes));

  const nodeData = useMemo(() => {
    return nodes.find(n => n.id === nodeId)?.data?.node;
  }, [nodes, nodeId]);

  const mySlots = nodeData?.slots ?? [];
  const isInput = nodeData?.is_input ?? false;
  const isOutput = nodeData?.is_output ?? false;

  const traversalIndexMap = useMemo(() => {
    return computeTraversalIndices(nodes);
  }, [nodes]);

  const outgoingEdgeOptions = useMemo(() => {
    return getOutgoingEdgeOptions(nodeId, edges, nodes, traversalIndexMap);
  }, [nodeId, edges, nodes, traversalIndexMap]);

  const incomingEdgeOptions = useMemo(() => {
    return getIncomingEdgeOptions(nodeId, edges, nodes, traversalIndexMap);
  }, [nodeId, edges, nodes, traversalIndexMap]);

  const hasOutgoingEdges = useMemo(() => {
    return edges.some(e => e.sourceHandle === nodeId);
  }, [edges, nodeId]);

  const hasIncomingEdges = useMemo(() => {
    return edges.some(e => e.targetHandle === nodeId);
  }, [edges, nodeId]);

  const handleDelete = useCallback(() => {
    if (nodeData) void deleteNode(nodeData.id);
  }, [nodeData, deleteNode]);

  const handleShortcircuit = useCallback(() => {
    if (nodeData) void shortcircuitNode(nodeData.id);
  }, [nodeData, shortcircuitNode]);

  const conversions = useMemo(() => {
    return nodeData ? getAvailableConversions(nodeData.node_type) : [];
  }, [nodeData]);

  const handleConvert = useCallback((targetType: NodeType) => {
    if (nodeData) void convertNode(nodeData.id, targetType);
  }, [nodeData, convertNode]);

  const handleUpdateConnection = useCallback((isInputVal: boolean, isOutputVal: boolean) => {
    if (nodeData) void updateNode(nodeId, { is_input: isInputVal, is_output: isOutputVal });
  }, [nodeData, nodeId, updateNode]);

  const handleInsert = useCallback(
    (nodeType: InsertableNodeType, direction: 'before' | 'after') => {
      void insertNode(nodeId, nodeType, direction);
    },
    [insertNode, nodeId]
  );

  if (!nodeData) return null;

  const isStart = nodeData.node_type === 'START';
  const isEnd = nodeData.node_type === 'END';

  const canShortcircuit = canShortcircuitNode(mySlots);

  const renderInsertSubmenu = (direction: 'before' | 'after') => {
    const isAfter = direction === 'after';
    const label = isAfter ? 'Insert Node After' : 'Insert Node Before';
    const isAllowed = isAfter ? isOutput : isInput;
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={!isAllowed}>
          <PlusIcon style={{ marginRight: 8 }}/> {label}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {INSERTABLE_NODE_TYPES.map(item => (
            <DropdownMenu.Item key={item.type} onClick={() => handleInsert(item.type, direction)}>
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    );
  };

  const renderDeleteSubmenu = (direction: 'incoming' | 'outgoing') => {
    const isOutgoing = direction === 'outgoing';
    const label = isOutgoing ? 'Delete Outgoing Edge' : 'Delete Incoming Edge';
    const hasEdges = isOutgoing ? hasOutgoingEdges : hasIncomingEdges;
    const options = isOutgoing ? outgoingEdgeOptions : incomingEdgeOptions;
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={!hasEdges}>
          {label}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {options.map(opt => (
            <DropdownMenu.Item
              key={opt.edgeId}
              onClick={() => {
                void deleteEdge(opt.edgeId);
              }}
              color="red"
            >
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    );
  };

  return (
    <>
      {!isStart && !isEnd && (
        <>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              {'Type'}
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item onClick={() => handleUpdateConnection(true, true)}>
                {isInput && isOutput ? '✓ Input And Output' : '  Input And Output'}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => handleUpdateConnection(true, false)}>
                {isInput && !isOutput ? '✓ Input Only' : '  Input Only'}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => handleUpdateConnection(false, true)}>
                {!isInput && isOutput ? '✓ Output Only' : '  Output Only'}
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => handleUpdateConnection(false, false)}>
                {!isInput && !isOutput ? '✓ None' : '  None'}
              </DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>

          <DropdownMenu.Separator/>

          {renderInsertSubmenu('before')}
          {renderInsertSubmenu('after')}

          <DropdownMenu.Separator/>

          {renderDeleteSubmenu('incoming')}
          {renderDeleteSubmenu('outgoing')}

          <DropdownMenu.Separator/>
        </>
      )}

      {conversions.length > 0 && (
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger>
            {'Convert'}
          </DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            {conversions.map(c => (
              <DropdownMenu.Item key={c.targetType} onClick={() => handleConvert(c.targetType)}>
                {c.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.SubContent>
        </DropdownMenu.Sub>
      )}
      {!isStart && !isEnd && canShortcircuit && (
        <DropdownMenu.Item onClick={handleShortcircuit}>
          {'Shortcircuit'}
        </DropdownMenu.Item>
      )}
      <DropdownMenu.Item onClick={handleDelete}>
        {'Delete'}
      </DropdownMenu.Item>
    </>
  );
};
