import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { memo, useCallback, useMemo } from 'react';
import { NODE_PADDING } from '../../domain/graph/layout';
import { fromApiPayload } from '../../domain/graph/mappers';
import { Editor } from '../../editor/Editor.tsx';
import { useCreateSlot, useDeleteSlot, useMoveSlot, useUpdateSlot, } from '../../hooks/graph/useGraphMutations';
import { useGraphQuery } from '../../hooks/graph/useGraphQuery';
import { useGraphStore } from '../../store/graphStore';
import type { ApiSlot } from '../types';
import { FlowNodeSlotActions } from './FlowNodeSlotActions.tsx';

interface FlowNodeSlotProps {
  slotId: string;
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
}

export const FlowNodeSlot = memo(({
  slotId,
  disabled,
  isStart,
  isEnd,
  isSelected,
  onSelect,
  onNavigate,
}: FlowNodeSlotProps) => {
  const graphId = useGraphStore(state => state.graphId) || '';
  const { data } = useGraphQuery(graphId);
  const { nodes } = useMemo(() => {
    if (!data) return { nodes: [] };
    return fromApiPayload(data.nodes, []);
  }, [data]);

  const { mutateAsync: updateSlot } = useUpdateSlot(graphId);
  const { mutateAsync: moveSlot } = useMoveSlot(graphId);
  const { mutateAsync: createSlot } = useCreateSlot(graphId);
  const { mutateAsync: deleteSlot } = useDeleteSlot(graphId);

  const node = useMemo(() => {
    return nodes.find((n) => n.data.node.slots.some((s: ApiSlot) => s.id === slotId));
  }, [nodes, slotId]);

  const slot = useMemo(() => {
    return node?.data.node.slots.find((s: ApiSlot) => s.id === slotId);
  }, [node, slotId]);

  const indexInNode = useMemo(() => {
    if (!node) return -1;
    return node.data.node.slots.findIndex((s: ApiSlot) => s.id === slotId);
  }, [node, slotId]);

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateSlot({ slotId, rawString: newValue });
    },
    [slotId, updateSlot]
  );

  const handleMoveUp = useCallback(() => {
    void moveSlot({ slotId, direction: 'up' });
  }, [slotId, moveSlot]);

  const handleMoveDown = useCallback(() => {
    void moveSlot({ slotId, direction: 'down' });
  }, [slotId, moveSlot]);

  const handleAddAbove = useCallback(() => {
    if (!slot || !node || indexInNode === -1) return;
    void createSlot({ nodeId: node.id, index: indexInNode });
  }, [createSlot, node, slot, indexInNode]);

  const handleAddBelow = useCallback(() => {
    if (!slot || !node || indexInNode === -1) return;
    void createSlot({ nodeId: node.id, index: indexInNode + 1 });
  }, [createSlot, node, slot, indexInNode]);

  const handleDeleteSlot = useCallback(() => {
    void deleteSlot(slotId);
  }, [slotId, deleteSlot]);

  if (!slot) return null;

  const leftHandle = false;
  const rightHandle = true;

  const actions = !disabled ? (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        paddingRight: '2px',
        visibility: isSelected ? 'visible' : 'hidden',
      }}
    >
      <FlowNodeSlotActions
        slotId={slot.id}
      />
    </div>
  ) : null;

  const initialValue = (() => {
    if (isStart) return slot.raw_string || 'Start Node (Output)';
    if (isEnd) return slot.raw_string || 'End Node (Input)';
    return slot.raw_string;
  })();

  return (
    <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
      {leftHandle && (
        <Handle
          type="target"
          id={slot.id}
          position={Position.Left}
          style={{ left: -NODE_PADDING }}
        />
      )}
      <Flex
        className="nodrag nopan"
        flexGrow="1"
        align="center"
        height="100%"
      >
        <Editor
          initialValue={initialValue}
          onSave={handleUpdateItem}
          disabled={disabled}
          isSelected={isSelected}
          onSelect={onSelect}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onNavigate={onNavigate}
          onAddAbove={handleAddAbove}
          onAddBelow={handleAddBelow}
          onDelete={handleDeleteSlot}
        />
      </Flex>
      {actions}
      {rightHandle && (
        <Handle
          type="source"
          id={slot.id}
          position={Position.Right}
          style={{ right: -NODE_PADDING }}
        />
      )}
    </Flex>
  );
});
