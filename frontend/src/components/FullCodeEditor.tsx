import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { linter, lintGutter } from '@codemirror/lint';
import { Annotation, EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { createRuffWorkspace, initRuff, runRuffLint } from '../services/ruffLinter';
import { useGraphStore } from '../store/useGraphStore';

interface FullCodeEditorProps {
  isGraphSelected: boolean;
}

const systemUpdate = Annotation.define<boolean>();

export const FullCodeEditor = ({ isGraphSelected }: FullCodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const code = useGraphStore(state => state.code);
  const updateCode = useGraphStore(state => state.updateCode);
  const errorMessage = useGraphStore(state => state.errorMessage);
  const clearErrorMessage = useGraphStore(state => state.clearErrorMessage);
  const variables = useGraphStore(state => state.variables);

  const [currentValue, setCurrentValue] = useState(code);
  const [workspace, setWorkspace] = useState<any>(null);

  // Initialize Ruff WASM and Workspace
  useEffect(() => {
    let active = true;
    void initRuff().then(() => {
      if (!active) return;
      const ws = createRuffWorkspace(variables.map(v => v.name));
      setWorkspace(ws);
    });
    return () => {
      active = false;
    };
  }, [variables]);

  // Update editor content when store code changes (e.g. initial load or visual sync)
  useEffect(() => {
    setCurrentValue(code);
    if (viewRef.current) {
      const state = viewRef.current.state;
      if (state.doc.toString() !== code) {
        viewRef.current.dispatch({
          changes: { from: 0, to: state.doc.length, insert: code },
          annotations: systemUpdate.of(true),
        });
      }
    }
  }, [code]);

  // Create CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const val = update.state.doc.toString();
        setCurrentValue(val);
        clearErrorMessage();
      }
    });

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([
          { key: 'Tab', run: acceptCompletion },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        python(),
        drawSelection(),
        oneDark,
        autocompletion({
          override: [
            (context) => {
              // 1a. Context-aware autocomplete for state["key"] bracket access
              const stateMatch = context.matchBefore(/state\[\s*["']\w*/);
              if (stateMatch) {
                const quoteChar = stateMatch.text.includes('"') ? '"' : "'";
                const query = stateMatch.text.split(/["']/)[1] || '';
                const options = variables
                  .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
                  .map((v) => ({
                    label: v.name,
                    type: 'property',
                    detail: `(${v.type})`,
                    apply: `state[${quoteChar}${v.name}${quoteChar}]`
                  }));
                return {
                  from: stateMatch.from,
                  options,
                };
              }

              // 1b. Context-aware autocomplete for state.varname dot access
              const stateDotMatch = context.matchBefore(/state\.\w*/);
              if (stateDotMatch) {
                const query = stateDotMatch.text.slice('state.'.length);
                const options = variables
                  .filter((v) => v.name.toLowerCase().includes(query.toLowerCase()))
                  .map((v) => ({
                    label: `state.${v.name}`,
                    type: 'property',
                    detail: `(${v.type})`,
                    apply: `state.${v.name}`,
                  }));
                return {
                  from: stateDotMatch.from,
                  options,
                };
              }

              return null;
            }
          ]
        }),
        workspace ? linter((view) => runRuffLint(view.state, workspace)) : [],
        lintGutter(),
        updateListener,
        EditorState.tabSize.of(4),
        EditorState.transactionFilter.of(tr => {
          if (tr.docChanged) {
            if (tr.annotation(systemUpdate)) {
              return tr;
            }
            const docStr = tr.startState.doc.toString();
            const idx = docStr.indexOf('# Graph Definition');
            if (idx !== -1) {
              const graphDefIndex = Math.max(0, idx - 55);
              let isEditingGraphDef = false;
              tr.changes.iterChanges((_, toA) => {
                if (toA >= graphDefIndex) {
                  isEditingGraphDef = true;
                }
              });
              if (isEditingGraphDef) {
                return [];
              }
            }
          }
          return tr;
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            flexGrow: 1,
            fontSize: '13px',
            fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
            backgroundColor: '#1e1e1e !important',
          },
          '.cm-scroller': { overflow: 'auto' },
          '.cm-gutters': {
            backgroundColor: '#1e1e1e !important',
            borderRight: '1px solid var(--gray-5)',
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [workspace]); // Re-create view when workspace updates to reload linter builtin configurations

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
