import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { useGraphQuery } from '../store/hooks/useLaidOutGraph';
import { fromApiPayload } from '../store/mappers';
import {
  useCreateSlot,
  useDeleteSlot,
  useMoveSlot,
  useInsertNode,
  useDeleteEdge,
} from '../store/hooks/useGraphMutations';
import type { InsertableNodeType } from './types';
import type { AppFlowEdge } from './types';

const INSERTABLE_NODE_TYPES: { type: InsertableNodeType; label: string }[] = [
  { type: 'STEP', label: 'Step' },
  { type: 'SWITCH', label: 'Switch' },
];

export interface SlotActionsContentProps {
  slotId: string;
}

export const FlowNodeSlotActionsContent = ({
  slotId,
}: SlotActionsContentProps) => {
  const graphId = useGraphStore(state => state.graphId) || '';
  const { data } = useGraphQuery(graphId);
  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return fromApiPayload(data.nodes, data.edges);
  }, [data]);

  const { mutateAsync: createSlot } = useCreateSlot(graphId);
  const { mutateAsync: deleteSlot } = useDeleteSlot(graphId);
  const { mutateAsync: moveSlot } = useMoveSlot(graphId);
  const { mutateAsync: insertNode } = useInsertNode(graphId);
  const { mutateAsync: deleteEdge } = useDeleteEdge(graphId);

  const node = useMemo(() => {
    return nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
  }, [nodes, slotId]);

  const slot = useMemo(() => {
    return node?.data.node.slots.find(s => s.id === slotId);
  }, [node, slotId]);

  const isInput = false;
  const isOutput = true;

  const mySlots = useMemo(() => {
    return node ? node.data.node.slots : [];
  }, [node]);

  const indexInNode = useMemo(() => {
    if (!slot) return -1;
    return mySlots.findIndex(s => s.id === slotId);
  }, [mySlots, slotId, slot]);

  const canMoveUp = useMemo(() => {
    if (indexInNode === -1) return false;
    return indexInNode > 0;
  }, [indexInNode]);

  const canMoveDown = useMemo(() => {
    if (indexInNode === -1) return false;
    return indexInNode < mySlots.length - 1;
  }, [indexInNode, mySlots.length]);

  const canDelete = useMemo(() => {
    return mySlots.length > 1;
  }, [mySlots]);

  const outgoingEdgeOptions = useMemo(() => {
    // Custom traversal selector using react hooks or traversal utilities
    return getOutgoingEdgeOptions(slotId, edges, nodes);
  }, [slotId, edges, nodes]);

  const incomingEdgeOptions = useMemo(() => {
    return getIncomingEdgeOptions(slotId, edges, nodes);
  }, [slotId, edges, nodes]);

  const hasOutgoingEdges = useMemo(() => {
    return edges.some(e => e.sourceHandle === slotId);
  }, [edges, slotId]);

  const hasIncomingEdges = useMemo(() => {
    return edges.some(e => e.targetHandle === slotId);
  }, [edges, slotId]);

  const handleInsert = useCallback(
    (nodeType: InsertableNodeType, direction: 'before' | 'after') => {
      void insertNode({ connectorId: slotId, nodeType, direction });
    },
    [insertNode, slotId]
  );

  const handleMoveTop = useCallback(() => {
    void moveSlot({ slotId, direction: 'top' });
  }, [slotId, moveSlot]);

  const handleMoveUp = useCallback(() => {
    void moveSlot({ slotId, direction: 'up' });
  }, [slotId, moveSlot]);

  const handleMoveDown = useCallback(() => {
    void moveSlot({ slotId, direction: 'down' });
  }, [slotId, moveSlot]);

  const handleMoveBottom = useCallback(() => {
    void moveSlot({ slotId, direction: 'bottom' });
  }, [slotId, moveSlot]);

  const handleDeleteItem = useCallback(() => {
    void deleteSlot(slotId);
  }, [slotId, deleteSlot]);

  const handleAddAbove = useCallback(() => {
    if (!slot || !node) return;
    void createSlot({ nodeId: node.id, index: indexInNode });
  }, [createSlot, node, slot, indexInNode]);

  const handleAddBelow = useCallback(() => {
    if (!slot || !node) return;
    void createSlot({ nodeId: node.id, index: indexInNode + 1 });
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

// Traversal helper wrappers
function getOutgoingEdgeOptions(slotId: string, edges: AppFlowEdge[], nodes: any[]) {
  const outgoing = edges.filter(e => e.sourceHandle === slotId);
  return outgoing.map(e => {
    const targetNode = nodes.find(n => n.id === e.target);
    return {
      edgeId: e.id,
      label: `To ${targetNode?.data?.node?.id || e.target}`,
    };
  });
}

function getIncomingEdgeOptions(slotId: string, edges: AppFlowEdge[], nodes: any[]) {
  const incoming = edges.filter(e => e.targetHandle === slotId);
  return incoming.map(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return {
      edgeId: e.id,
      label: `From ${sourceNode?.data?.node?.id || e.source}`,
    };
  });
}
