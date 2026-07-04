import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import type { BadgeProps } from '@radix-ui/themes';
import { Badge, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canMoveExpressionDown,
  canMoveExpressionUp,
  canShortcircuitNode,
  NODE_CONVERSIONS,
} from '../utils/flowUtils';
import { FlowNodeExpressionRow } from './FlowNodeExpressionRow.tsx';
import { NODE_PADDING } from './layout.ts';
import { type AppFlowNode, type NodeType } from './types.ts';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
  LOGICAL_JOIN: 'teal',
  AGENTIC_JOIN: 'indigo',
  TRANSFORM_AGENT_TO_LOGICAL: 'ruby',
  TRANSFORM_LOGICAL_TO_AGENT: 'plum',
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNode = useGraphStore(state => state.deleteNode);
  const shortcircuitNode = useGraphStore(state => state.shortcircuitNode);
  const convertNode = useGraphStore(state => state.convertNode);

  const updateNodeInternals = useUpdateNodeInternals();

  const myExpressions = useGraphStore(
    useShallow(state => state.expressions.filter(e => e.node_id === id))
  );

  const myExpressionsHash = useMemo(() => {
    const sorted = [...myExpressions].sort((a, b) => a.idx - b.idx);
    return sorted.map(e => `${e.id}:${e.idx}:${e.is_input}:${e.is_output}`).join(',');
  }, [myExpressions]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [myExpressionsHash, data.node.node_type, id, updateNodeInternals]);

  const handleDelete = useCallback(() => {
    void deleteNode(data.node.id);
  }, [data.node.id, deleteNode]);

  const handleShortcircuit = useCallback(() => {
    void shortcircuitNode(data.node.id);
  }, [data.node.id, shortcircuitNode]);

  const conversionConfig = NODE_CONVERSIONS[data.node.node_type];

  const handleConvert = useCallback((targetType: NodeType) => {
    void convertNode(data.node.id, targetType);
  }, [data.node.id, convertNode]);

  const { node } = data;
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';

  const canShortcircuit = useMemo(() => {
    return canShortcircuitNode(myExpressions);
  }, [myExpressions]);

  if (!data) return null;

  return (
    <Flex
      direction="column"
      style={{
        width: 'max-content',
        background: 'var(--gray-3)',
        borderRadius: 'var(--radius-3)',
        padding: NODE_PADDING,
        gap: NODE_PADDING,
        opacity: data.isPositioned ?? true ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
        <Flex direction="row" gap="1" align="center" flexGrow="1">
          <Badge color="gray" size="1" style={{ height: 'var(--space-5)' }}>
            {'N' + data.node.iid}
          </Badge>
          <Badge color={NODE_COLORS[data.node.node_type]} size="1" style={{ height: 'var(--space-5)' }}>
            {data.node.label}
          </Badge>
        </Flex>

        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1" color="gray" style={{ pointerEvents: 'auto' }}>
                <DotsHorizontalIcon/>
              </IconButton>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
              {conversionConfig && (
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger>
                    {'Convert'}
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent>
                    <DropdownMenu.Item onClick={() => handleConvert(conversionConfig.targetType)}>
                      {conversionConfig.label}
                    </DropdownMenu.Item>
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
            </DropdownMenu.Content>
          </DropdownMenu.Root>
        </div>
      </Flex>

      {myExpressions.map((expr, index) => {
        // Same type expressions relative index calculations for sub expressions
        const canMoveUp = canMoveExpressionUp(index, myExpressions);
        const canMoveDown = canMoveExpressionDown(index, myExpressions);

        const canDelete = myExpressions.length > 1;
        const disabled = isStart || isEnd;

        return (
          <FlowNodeExpressionRow
            key={expr.id}
            expressionId={expr.id}
            nodeId={node.id}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            canDelete={canDelete}
            disabled={disabled}
            isStart={isStart}
            isEnd={isEnd}
          />
        );
      })}
    </Flex>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data === nextProps.data
  );
});
