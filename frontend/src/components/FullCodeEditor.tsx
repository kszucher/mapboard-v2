import { Annotation } from '@codemirror/state';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';

import { useSyncGraph } from '../store/hooks/useGraphMutations';
import { useGraphQuery } from '../store/hooks/useLaidOutGraph';
import { useGraphStore } from '../store/useGraphStore';
import { useCodeMirror } from './hooks/useCodeMirror';
import { useRuffLinter } from './hooks/useRuffLinter';

interface FullCodeEditorProps {
  isGraphSelected: boolean;
}

const systemUpdate = Annotation.define<boolean>();

const getErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === 'object') {
    if ('detail' in error) {
      if (typeof error.detail === 'string') {
        return error.detail;
      }
      if (Array.isArray(error.detail)) {
        return error.detail.map((d: any) => d.msg || JSON.stringify(d)).join('\n');
      }
      return JSON.stringify(error.detail);
    }
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const FullCodeEditor = ({ isGraphSelected }: FullCodeEditorProps) => {
  const graphId = useGraphStore(state => state.graphId) || '';
  const { data: graphFlow } = useGraphQuery(graphId);
  const variables = graphFlow?.variables || [];

  const code = useGraphStore(state => state.code);
  const selectedNodeId = useGraphStore(state => state.selectedNodeId);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  // Stable action references
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);

  const { mutate: syncGraph, isPending: isSaving, error: syncError, reset: resetSyncError } = useSyncGraph(graphId);
  const errorMessage = getErrorMessage(syncError);

  // Initialize Ruff WASM workspace using custom hook
  const workspace = useRuffLinter(variables);

  const { containerRef, viewRef, currentValue, setCurrentValue } = useCodeMirror({
    code,
    variables,
    selectedNodeId,
    selectedSlotId,
    workspace,
    clearErrorMessage: resetSyncError,
    setSelectedIds,
  });

  const isChanged = currentValue !== code;

  const handleApprove = () => {
    syncGraph(currentValue, {
      onSuccess: () => {
        useGraphStore.setState({ code: currentValue });
      }
    });
  };

  const handleDiscard = () => {
    setCurrentValue(code);
    resetSyncError();
    if (viewRef.current) {
      const state = viewRef.current.state;
      viewRef.current.dispatch({
        changes: { from: 0, to: state.doc.length, insert: code },
        annotations: systemUpdate.of(true),
      });
    }
  };

  return (
    <Flex direction="column" gap="3" style={{ flexGrow: 1, minHeight: 0 }}>
      {/* Editor viewport container */}
      <Box
        style={{
          flexGrow: 1,
          border: '1px solid var(--gray-6)',
          borderRadius: '4px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          ref={containerRef}
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
          }}
        />
      </Box>

      {/* Diagnostics / Error Panel */}
      {errorMessage && (
        <Card
          style={{
            padding: '8px',
            backgroundColor: 'var(--red-a2)',
            border: '1px solid var(--red-6)',
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        >
          <Flex direction="column" gap="1">
            <Text size="1" color="red" weight="bold">⚠️ Compilation / Syntax Error:</Text>
            <Text size="1" color="red" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {errorMessage}
            </Text>
          </Flex>
        </Card>
      )}

      {/* Actions */}
      <Flex gap="2" justify="end" style={{ flexShrink: 0 }}>
        <Button
          size="2"
          variant="soft"
          color="gray"
          disabled={!isChanged || !isGraphSelected || isSaving}
          onClick={handleDiscard}
          style={{ cursor: isChanged && isGraphSelected && !isSaving ? 'pointer' : 'default' }}
        >
          Discard
        </Button>
        <Button
          size="2"
          variant="solid"
          color="iris"
          disabled={!isChanged || !isGraphSelected || isSaving}
          onClick={handleApprove}
          style={{ cursor: isChanged && isGraphSelected && !isSaving ? 'pointer' : 'default' }}
        >
          {isSaving ? 'Saving...' : 'Approve Code'}
        </Button>
      </Flex>
    </Flex>
  );
};
