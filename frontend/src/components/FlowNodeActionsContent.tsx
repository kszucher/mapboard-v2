import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { canShortcircuitNode, getAvailableConversions } from '../utils/flowUtils';
import type { NodeType } from './types';

export interface FlowNodeActionsContentProps {
  nodeId: string;
}

export const FlowNodeActionsContent = ({ nodeId }: FlowNodeActionsContentProps) => {
  const deleteNode = useGraphStore(state => state.deleteNode);
  const shortcircuitNode = useGraphStore(state => state.shortcircuitNode);
  const convertNode = useGraphStore(state => state.convertNode);
  const createExpression = useGraphStore(state => state.createExpression);
  const functions = useGraphStore(state => state.functions);

  const nodeData = useGraphStore(
    useCallback(state => state.nodes.find(n => n.id === nodeId)?.data?.node, [nodeId])
  );

  const myExpressions = nodeData?.expressions ?? [];

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

  if (!nodeData) return null;

  const isStart = nodeData.node_type === 'START';
  const isEnd = nodeData.node_type === 'END';

  const canShortcircuit = canShortcircuitNode(myExpressions);

  return (
    <>
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
      {!isStart && !isEnd && (
        <DropdownMenu.Sub>
          <DropdownMenu.SubTrigger disabled={functions.length === 0}>
            {'Link Function'}
          </DropdownMenu.SubTrigger>
          <DropdownMenu.SubContent>
            {functions.map(f => (
              <DropdownMenu.Item
                key={f.id}
                onClick={() => {
                  const outputIdx = myExpressions.findIndex(e => e.is_output && !e.is_input);
                  const insertIdx = outputIdx !== -1 ? outputIdx : myExpressions.length;
                  void createExpression(nodeData.id, false, false, insertIdx, f.id);
                }}
              >
                {f.name}
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
