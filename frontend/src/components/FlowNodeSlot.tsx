import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { memo, useCallback, useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { Editor } from './Editor.tsx';
import { FlowNodeSlotActions } from './FlowNodeSlotActions.tsx';
import { NODE_PADDING } from './layout.ts';

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
  // Subscribe to only this specific slot
  const slot = useGraphStore(
    useCallback(
      (state) => {
        for (const n of state.nodes) {
          const found = n.data.node.slots.find((s) => s.id === slotId);
          if (found) return found;
        }
        return undefined;
      },
      [slotId]
    )
  );

  const functions = useGraphStore((state) => state.functions);
  const updateSlot = useGraphStore((state) => state.updateSlot);
  const moveSlot = useGraphStore((state) => state.moveSlot);
  const createSlot = useGraphStore((state) => state.createSlot);
  const deleteSlot = useGraphStore((state) => state.deleteSlot);

  const node = useGraphStore(
    useCallback(
      (state) => state.nodes.find((n) => n.data.node.slots.some((s) => s.id === slotId)),
      [slotId]
    )
  );

  const indexInNode = useMemo(() => {
    if (!node) return -1;
    return node.data.node.slots.findIndex((s) => s.id === slotId);
  }, [node, slotId]);

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateSlot(slotId, { raw_string: newValue });
    },
    [slotId, updateSlot]
  );

  const handleIncreaseIndent = useCallback(() => {
    if (!slot) return;
    const currentIndent = slot.indent ?? 0;
    if (currentIndent < 3) {
      void updateSlot(slotId, { indent: currentIndent + 1 });
    }
  }, [slot, slotId, updateSlot]);

  const handleDecreaseIndent = useCallback(() => {
    if (!slot) return;
    const currentIndent = slot.indent ?? 0;
    if (currentIndent > 0) {
      void updateSlot(slotId, { indent: currentIndent - 1 });
    }
  }, [slot, slotId, updateSlot]);

  const handleMoveUp = useCallback(() => {
    void moveSlot(slotId, 'up');
  }, [slotId, moveSlot]);

  const handleMoveDown = useCallback(() => {
    void moveSlot(slotId, 'down');
  }, [slotId, moveSlot]);

  const handleAddAbove = useCallback(() => {
    if (!slot || !node || indexInNode === -1) return;
    void createSlot(node.id, slot.is_input, slot.is_output, indexInNode, slot.indent ?? 0);
  }, [createSlot, node, slot, indexInNode]);

  const handleAddBelow = useCallback(() => {
    if (!slot || !node || indexInNode === -1) return;
    void createSlot(node.id, slot.is_input, slot.is_output, indexInNode + 1, slot.indent ?? 0);
  }, [createSlot, node, slot, indexInNode]);

  const handleDeleteSlot = useCallback(() => {
    void deleteSlot(slotId);
  }, [slotId, deleteSlot]);

  const handleToggleInput = useCallback(() => {
    if (!slot) return;
    void updateSlot(slotId, { is_input: !slot.is_input });
  }, [slot, slotId, updateSlot]);

  const handleToggleOutput = useCallback(() => {
    if (!slot) return;
    void updateSlot(slotId, { is_output: !slot.is_output });
  }, [slot, slotId, updateSlot]);

  if (!slot) return null;

  const leftHandle = slot.is_input;
  const rightHandle = slot.is_output;

  const actions = !disabled ? (
    <div
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
    if (slot.function_id) {
      const func = functions.find(f => f.id === slot.function_id);
      return func ? func.name : 'Unknown Function';
    }
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
        style={{
          paddingLeft: `${(slot.indent ?? 0) * 24}px`,
        }}
      >
        <Editor
          initialValue={initialValue}
          onSave={handleUpdateItem}
          disabled={disabled}
          readOnly={!!slot.function_id}
          isSelected={isSelected}
          onSelect={onSelect}
          onIncreaseIndent={handleIncreaseIndent}
          onDecreaseIndent={handleDecreaseIndent}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onNavigate={onNavigate}
          onAddAbove={handleAddAbove}
          onAddBelow={handleAddBelow}
          onDelete={handleDeleteSlot}
          onToggleInput={handleToggleInput}
          onToggleOutput={handleToggleOutput}
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
