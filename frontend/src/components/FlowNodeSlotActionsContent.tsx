import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canMoveSlotDown,
  canMoveSlotUp,
  computeTraversalIndices,
  getIncomingEdgeOptions,
  getOutgoingEdgeOptions
} from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

const INSERTABLE_NODE_TYPES: { type: InsertableNodeType; label: string }[] = [
  { type: 'STEP', label: 'Step' },
  { type: 'SWITCH', label: 'Switch' },
  { type: 'JOIN', label: 'Join' },
];

export interface SlotActionsContentProps {
  slotId: string;
}

export const FlowNodeSlotActionsContent = ({
  slotId,
}: SlotActionsContentProps) => {
  const createSlot = useGraphStore(state => state.createSlot);
  const deleteSlot = useGraphStore(state => state.deleteSlot);
  const updateSlot = useGraphStore(state => state.updateSlot);
  const moveSlot = useGraphStore(state => state.moveSlot);
  const insertNode = useGraphStore(state => state.insertNode);
  const deleteEdge = useGraphStore(state => state.deleteEdge);

  const edges = useGraphStore(useShallow(state => state.edges));
  const nodes = useGraphStore(useShallow(state => state.nodes));

  const node = useMemo(() => {
    return nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
  }, [nodes, slotId]);

  const slot = useMemo(() => {
    return node?.data.node.slots.find(s => s.id === slotId);
  }, [node, slotId]);

  const isInput = slot?.is_input ?? false;
  const isOutput = slot?.is_output ?? false;

  const mySlots = useMemo(() => {
    return node ? node.data.node.slots : [];
  }, [node]);

  const indexInNode = useMemo(() => {
    if (!slot) return -1;
    return mySlots.findIndex(s => s.id === slotId);
  }, [mySlots, slotId, slot]);

  const canMoveUp = useMemo(() => {
    if (indexInNode === -1) return false;
    return canMoveSlotUp(indexInNode);
  }, [indexInNode]);

  const canMoveDown = useMemo(() => {
    if (indexInNode === -1) return false;
    return canMoveSlotDown(indexInNode, mySlots.length);
  }, [indexInNode, mySlots.length]);

  const canDelete = useMemo(() => {
    return mySlots.length > 1;
  }, [mySlots]);

  const traversalIndexMap = useMemo(() => {
    return computeTraversalIndices(nodes);
  }, [nodes]);

  const outgoingEdgeOptions = useMemo(() => {
    return getOutgoingEdgeOptions(slotId, edges, nodes, traversalIndexMap);
  }, [slotId, edges, nodes, traversalIndexMap]);

  const incomingEdgeOptions = useMemo(() => {
    return getIncomingEdgeOptions(slotId, edges, nodes, traversalIndexMap);
  }, [slotId, edges, nodes, traversalIndexMap]);

  const hasOutgoingEdges = useMemo(() => {
    return edges.some(e => e.sourceHandle === slotId);
  }, [edges, slotId]);

  const hasIncomingEdges = useMemo(() => {
    return edges.some(e => e.targetHandle === slotId);
  }, [edges, slotId]);

  const handleInsert = useCallback(
    (nodeType: InsertableNodeType, direction: 'before' | 'after') => {
      void insertNode(slotId, nodeType, direction);
    },
    [insertNode, slotId]
  );

  const handleUpdateConnection = useCallback((isInputVal: boolean, isOutputVal: boolean) => {
    void updateSlot(slotId, { is_input: isInputVal, is_output: isOutputVal });
  }, [slotId, updateSlot]);

  const handleMoveTop = useCallback(() => {
    void moveSlot(slotId, 'top');
  }, [slotId, moveSlot]);

  const handleMoveUp = useCallback(() => {
    void moveSlot(slotId, 'up');
  }, [slotId, moveSlot]);

  const handleMoveDown = useCallback(() => {
    void moveSlot(slotId, 'down');
  }, [slotId, moveSlot]);

  const handleMoveBottom = useCallback(() => {
    void moveSlot(slotId, 'bottom');
  }, [slotId, moveSlot]);

  const handleDeleteItem = useCallback(() => {
    void deleteSlot(slotId);
  }, [slotId, deleteSlot]);

  const handleAddAbove = useCallback(() => {
    if (!slot || !node) return;
    void createSlot(node.id, false, false, indexInNode);
  }, [createSlot, node, slot, indexInNode]);

  const handleAddBelow = useCallback(() => {
    if (!slot || !node) return;
    void createSlot(node.id, false, false, indexInNode + 1);
  }, [createSlot, node, slot, indexInNode]);

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

      <DropdownMenu.Item onClick={handleAddAbove}>
        <PlusIcon style={{ marginRight: 8 }}/> Add Slot Above
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleAddBelow}>
        <PlusIcon style={{ marginRight: 8 }}/> Add Slot Below
      </DropdownMenu.Item>
      <DropdownMenu.Separator/>

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
          {'Move'}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.Item onClick={handleMoveTop} disabled={!canMoveUp}>
            <ArrowUpIcon style={{ marginRight: 8 }}/> Move to Top
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={handleMoveUp} disabled={!canMoveUp}>
            <ArrowUpIcon style={{ marginRight: 8 }}/> Move Up
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={handleMoveDown} disabled={!canMoveDown}>
            <ArrowDownIcon style={{ marginRight: 8 }}/> Move Down
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={handleMoveBottom} disabled={!canMoveDown}>
            <ArrowDownIcon style={{ marginRight: 8 }}/> Move to Bottom
          </DropdownMenu.Item>
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>

      <DropdownMenu.Separator/>
      {renderInsertSubmenu('after')}
      {renderInsertSubmenu('before')}

      <DropdownMenu.Separator/>
      {renderDeleteSubmenu('outgoing')}
      {renderDeleteSubmenu('incoming')}

      <DropdownMenu.Separator/>
      <DropdownMenu.Item onClick={handleDeleteItem} color="red" disabled={!canDelete}>
        <TrashIcon style={{ marginRight: 8 }}/> Delete Slot
      </DropdownMenu.Item>
    </>
  );
};
