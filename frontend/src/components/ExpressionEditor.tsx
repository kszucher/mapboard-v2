import { useEffect, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { type Diagnostic } from '@codemirror/lint';
import { initRuff, createRuffWorkspace, runRuffLint } from '../utils/RuffLinter';
import { Workspace } from '@astral-sh/ruff-wasm-web';
import { Button, Flex, Card, Text } from '@radix-ui/themes';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, acceptCompletion } from '@codemirror/autocomplete';
import { useGraphStore } from '../store/useGraphStore';

interface ExpressionEditorProps {
  initialValue: string;
  onApprove: (value: string) => void;
  nodeId: string;
  slotId: string;
}

export const ExpressionEditor = ({ initialValue, onApprove, nodeId, slotId }: ExpressionEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [currentValue, setCurrentValue] = useState(initialValue);
  const [isWasmReady, setIsWasmReady] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const variables = useGraphStore(state => state.variables);
  const functions = useGraphStore(state => state.functions);

  const node = useGraphStore(state => state.nodes.find(n => n.id === nodeId));
  const nodeType = node?.data.node.node_type;

  // Initialize Ruff WASM
  useEffect(() => {
    let active = true;
    initRuff()
      .then(() => {
        if (active) {
          setIsWasmReady(true);
        }
      })
      .catch((err) => {
        console.error('Failed to initialize Ruff:', err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Recreate workspace when variables/functions change, WASM is ready, or nodeType changes
  useEffect(() => {
    if (!isWasmReady) return;

    // Only register function names as Ruff builtins so custom calls like my_func() are not
    // flagged as undefined. Variable names are intentionally excluded — they are only valid
    // via state["x"] or state.x access, so bare `x` should be an error.
    const builtinNames = functions.map(f => f.name);

    const ws = createRuffWorkspace(builtinNames, nodeType);
    setWorkspace(ws);

    return () => {
      ws.free();
    };
  }, [isWasmReady, variables, functions, nodeType]);
  // Update editor content when initialValue or slotId changes
  useEffect(() => {
    setCurrentValue(initialValue);
    if (viewRef.current) {
      const state = viewRef.current.state;
      if (state.doc.toString() !== initialValue) {
        viewRef.current.dispatch({
          changes: { from: 0, to: state.doc.length, insert: initialValue },
        });
      }
    }
  }, [initialValue, slotId]);

  // Compute diagnostics whenever value, workspace, or variables change
  useEffect(() => {
    if (!workspace) {
      setDiagnostics([]);
      return;
    }
    const tempState = EditorState.create({ doc: currentValue });
    const outputSlotLabels = node?.data.node.slots.map(s => s.raw_string) || [];
    const diags = runRuffLint(tempState, workspace, variables, functions, nodeType, outputSlotLabels);
    setDiagnostics(diags);
  }, [currentValue, workspace, variables, functions, nodeType, node]);

  // Create CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    // Create a listener to track document changes
    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        setCurrentValue(update.state.doc.toString());
      }
    });

    const autocompleteExtension = autocompletion({
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

          // 2. Context-aware autocomplete for return "slot_label" inside SWITCH nodes
          if (nodeType === 'SWITCH') {
            const returnMatch = context.matchBefore(/return\s+["']\w*/);
            if (returnMatch) {
              const quoteChar = returnMatch.text.includes('"') ? '"' : "'";
              const query = returnMatch.text.split(/["']/)[1] || '';
              const outputSlots = node?.data.node.slots || [];
              const options = outputSlots
                .filter((s) => s.raw_string.toLowerCase().includes(query.toLowerCase()))
                .map((s) => ({
                  label: s.raw_string,
                  type: 'keyword',
                  detail: '(routing slot)',
                  apply: `return ${quoteChar}${s.raw_string}${quoteChar}`
                }));
              return {
                from: returnMatch.from,
                options,
              };
            }
          }

          const word = context.matchBefore(/\w*/);
          if (!word || (word.from === word.to && !context.explicit)) return null;

          const query = word.text.toLowerCase();

          const variableOptions = variables
            .filter((v) => v.name.toLowerCase().includes(query))
            .map((v) => ({
              label: v.name,
              type: 'variable',
              detail: `(${v.type})`,
            }));

          const functionOptions = functions
            .filter((f) => f.name.toLowerCase().includes(query))
            .map((f) => ({
              label: f.name,
              type: 'function',
              detail: '(function)',
            }));

          return {
            from: word.from,
            options: [...variableOptions, ...functionOptions],
            filter: false,
          };
        },
      ],
    });

    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        history(),
        keymap.of([
          { key: 'Tab', run: acceptCompletion },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        python(),
        drawSelection(),
        oneDark,
        autocompleteExtension,
        updateListener,
        EditorState.tabSize.of(4),
        EditorView.theme({
          '&': {
            height: '180px',
            fontSize: '13px',
            fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
            borderRadius: '4px',
            overflow: 'hidden',
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
  }, [workspace, slotId, variables, functions]); // Recreate when workspace is initialized or slot selection changes

  const isChanged = currentValue !== initialValue;

  const handleApprove = () => {
    onApprove(currentValue);
  };

  const handleDiscard = () => {
    setCurrentValue(initialValue);
    if (viewRef.current) {
      const state = viewRef.current.state;
      viewRef.current.dispatch({
        changes: { from: 0, to: state.doc.length, insert: initialValue },
      });
    }
  };

  return (
    <Card style={{ backgroundColor: 'var(--gray-3)', border: '1px solid var(--gray-5)' }}>
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
            Node ID: {nodeId.slice(0, 8)}
          </Text>
          {!workspace && (
            <Text size="1" color="gray">
              Initializing Ruff...
            </Text>
          )}
        </Flex>

        <div
          ref={containerRef}
          style={{
            border: '1px solid var(--gray-6)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        />

        {/* Status / Issues Panel */}
        {workspace && (
          <Flex direction="column" gap="1" style={{
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: diagnostics.length === 0 ? 'var(--green-a2)' : 'var(--red-a2)',
            border: diagnostics.length === 0 ? '1px solid var(--green-6)' : '1px solid var(--red-6)',
          }}>
            {diagnostics.length === 0 ? (
              <Text size="1" color="green" weight="bold">✓ Valid code</Text>
            ) : (
              <Flex direction="column" gap="1">
                <Text size="1" color="red" weight="bold">⚠️ Issues detected:</Text>
                {diagnostics.map((diag, index) => {
                  let lineNum = 1;
                  try {
                    const tempState = EditorState.create({ doc: currentValue });
                    lineNum = tempState.doc.lineAt(diag.from).number;
                  } catch (e) {}
                  return (
                    <Text key={index} size="1" color="red" style={{ fontFamily: 'monospace' }}>
                      Line {lineNum}: {diag.message}
                    </Text>
                  );
                })}
              </Flex>
            )}
          </Flex>
        )}

        <Flex gap="2" justify="end">
          <Button
            size="1"
            variant="soft"
            color="gray"
            disabled={!isChanged}
            onClick={handleDiscard}
            style={{ cursor: isChanged ? 'pointer' : 'default' }}
          >
            Discard
          </Button>
          <Button
            size="1"
            variant="solid"
            color="iris"
            disabled={!isChanged}
            onClick={handleApprove}
            style={{ cursor: isChanged ? 'pointer' : 'default' }}
          >
            Approve
          </Button>
        </Flex>
      </Flex>
    </Card>
  );
};
