import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { memo, useCallback } from 'react';
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
  onClearSelect: () => void;
  onNavigate: (direction: 'up' | 'down') => void;
}

export const FlowNodeSlot = memo(({
  slotId,
  disabled,
  isStart,
  isEnd,
  isSelected,
  onSelect,
  onClearSelect,
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

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateSlot(slotId, { raw_string: newValue });
    },
    [slotId, updateSlot]
  );

  const handleIncreaseIndent = useCallback(() => {
    if (!slot) return;
    const currentIndent = slot.indent ?? 0;
    if (currentIndent < 2) {
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
          paddingLeft: slot.indent === 1 ? '24px' : slot.indent === 2 ? '48px' : '0px',
        }}
      >
        <Editor
          initialValue={initialValue}
          onSave={handleUpdateItem}
          disabled={disabled || !!slot.function_id}
          isSelected={isSelected}
          onSelect={onSelect}
          onClearSelect={onClearSelect}
          onIncreaseIndent={handleIncreaseIndent}
          onDecreaseIndent={handleDecreaseIndent}
          onMoveUp={handleMoveUp}
          onMoveDown={handleMoveDown}
          onNavigate={onNavigate}
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
