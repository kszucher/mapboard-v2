import { Annotation } from '@codemirror/state';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import { useCodeMirror } from './hooks/useCodeMirror';
import { useRuffLinter } from './hooks/useRuffLinter';

interface FullCodeEditorProps {
  isGraphSelected: boolean;
}

const systemUpdate = Annotation.define<boolean>();

export const FullCodeEditor = ({ isGraphSelected }: FullCodeEditorProps) => {
  // Unified reactive selectors
  const {
    code,
    errorMessage,
    variables,
    selectedNodeId,
    selectedSlotId
  } = useGraphStore(
    useShallow(state => ({
      code: state.code,
      errorMessage: state.errorMessage,
      variables: state.variables,
      selectedNodeId: state.selectedNodeId,
      selectedSlotId: state.selectedSlotId,
    }))
  );

  // Stable action references
  const updateCode = useGraphStore(state => state.updateCode);
  const clearErrorMessage = useGraphStore(state => state.clearErrorMessage);
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);

  // Initialize Ruff WASM workspace using custom hook
  const workspace = useRuffLinter(variables);

  const { containerRef, viewRef, currentValue, setCurrentValue } = useCodeMirror({
    code,
    variables,
    selectedNodeId,
    selectedSlotId,
    workspace,
    clearErrorMessage,
    setSelectedIds,
  });

  const isChanged = currentValue !== code;

  const handleApprove = async () => {
    try {
      await updateCode(currentValue);
    } catch (e) {
      // Error is set in store and displayed in panel
    }
  };

  const handleDiscard = () => {
    setCurrentValue(code);
    clearErrorMessage();
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
          disabled={!isChanged || !isGraphSelected}
          onClick={handleDiscard}
          style={{ cursor: isChanged && isGraphSelected ? 'pointer' : 'default' }}
        >
          Discard
        </Button>
        <Button
          size="2"
          variant="solid"
          color="iris"
          disabled={!isChanged || !isGraphSelected}
          onClick={handleApprove}
          style={{ cursor: isChanged && isGraphSelected ? 'pointer' : 'default' }}
        >
          Approve Code
        </Button>
      </Flex>
    </Flex>
  );
};
