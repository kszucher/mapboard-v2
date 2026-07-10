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
}

export const FlowNodeSlot = memo(({
  slotId,
  disabled,
  isStart,
  isEnd,
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

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateSlot(slotId, { raw_string: newValue });
    },
    [slotId, updateSlot]
  );

  if (!slot) return null;

  const leftHandle = slot.is_input;
  const rightHandle = slot.is_output;

  const actions = !disabled ? (
    <FlowNodeSlotActions
      slotId={slot.id}
    />
  ) : undefined;

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
        />
      </Flex>
      {actions && (
        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          {actions}
        </div>
      )}
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
