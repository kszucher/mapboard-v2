import type { Workspace } from '@astral-sh/ruff-wasm-web';
import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { indentUnit, syntaxTree } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { Annotation, EditorState, Range, StateEffect, StateField } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DecorationSet } from '@codemirror/view';
import { Decoration, drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { createRuffWorkspace, initRuff, runRuffLint } from '../services/ruffLinter';
import { useGraphStore } from '../store/useGraphStore';

interface FullCodeEditorProps {
  isGraphSelected: boolean;
}

const systemUpdate = Annotation.define<boolean>();

// Helper to find a function definition enclosing a specific position
function findFunctionAt(state: EditorState, pos: number): { name: string; from: number; to: number } | null {
  let result: { name: string; from: number; to: number } | null = null;
  const docStr = state.doc.toString();
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FunctionDefinition') {
        if (pos >= node.from && pos <= node.to) {
          const nameNode = node.node.getChild('VariableName');
          if (nameNode) {
            result = {
              name: docStr.slice(nameNode.from, nameNode.to),
              from: node.from,
              to: node.to
            };
          }
        }
      }
    }
  });
  return result;
}

// Helper to find a function definition by name
function findFunctionByName(state: EditorState, name: string): { from: number; to: number } | null {
  let result: { from: number; to: number } | null = null;
  const docStr = state.doc.toString();
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'FunctionDefinition') {
        const nameNode = node.node.getChild('VariableName');
        if (nameNode && docStr.slice(nameNode.from, nameNode.to) === name) {
          result = { from: node.from, to: node.to };
        }
      }
    }
  });
  return result;
}

// Helper to statically scan AST and find allowed editable ranges
function getEditableRegions(state: EditorState): { from: number; to: number }[] {
  const regions: { from: number; to: number }[] = [];
  const docStr = state.doc.toString();

  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === 'ClassDefinition') {
        const name = node.node.getChild('VariableName');
        if (name && docStr.slice(name.from, name.to) === 'State') {
          const body = node.node.getChild('Body');
          if (body) {
            regions.push({ from: body.from + 1, to: body.to });
          }
        }
      }

      if (node.name === 'FunctionDefinition') {
        const body = node.node.getChild('Body');
        if (body) {
          regions.push({ from: body.from + 1, to: body.to });
        }
      }
    }
  });

  return regions;
}

const setSelectedNodeIdEffect = StateEffect.define<string | null>();

const selectedNodeIdField = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setSelectedNodeIdEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

// Build line-bracket decorations for editable areas
function buildDecorations(state: EditorState) {
  const selectedId = state.field(selectedNodeIdField);
  if (!selectedId) return Decoration.none;

  const fn = findFunctionByName(state, selectedId);
  if (!fn) return Decoration.none;

  const decorations: Range<Decoration>[] = [];
  const startLine = state.doc.lineAt(fn.from).number;
  const endLine = state.doc.lineAt(fn.to).number;

  for (let l = startLine; l <= endLine; l++) {
    const line = state.doc.line(l);
    const className = startLine === endLine ? 'cm-editable-line-single'
      : l === startLine ? 'cm-editable-line-start'
        : l === endLine ? 'cm-editable-line-end'
          : 'cm-editable-line-middle';

    decorations.push(
      Decoration.line({ attributes: { class: className } }).range(line.from)
    );
  }
  return Decoration.set(decorations, true);
}

const readOnlyField = StateField.define<DecorationSet>({
  create: (state) => buildDecorations(state),
  update: (value, tr) => {
    const oldId = tr.startState.field(selectedNodeIdField);
    const newId = tr.state.field(selectedNodeIdField);
    if (tr.docChanged || oldId !== newId) {
      return buildDecorations(tr.state);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const FullCodeEditor = ({ isGraphSelected }: FullCodeEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const code = useGraphStore(state => state.code);
  const updateCode = useGraphStore(state => state.updateCode);
  const errorMessage = useGraphStore(state => state.errorMessage);
  const clearErrorMessage = useGraphStore(state => state.clearErrorMessage);
  const variables = useGraphStore(state => state.variables);
  const selectedNodeId = useGraphStore(state => state.nodes.find(n => n.selected)?.id || null);

  const [currentValue, setCurrentValue] = useState(code);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

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

  useEffect(() => {
    if (viewRef.current) {
      const currentSelected = viewRef.current.state.field(selectedNodeIdField);
      if (currentSelected !== selectedNodeId) {
        viewRef.current.dispatch({
          effects: setSelectedNodeIdEffect.of(selectedNodeId),
        });
      }
    }
  }, [selectedNodeId]);

  // Create CodeMirror instance
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const val = update.state.doc.toString();
        setCurrentValue(val);
        clearErrorMessage();
      }

      if (update.selectionSet || update.docChanged) {
        const pos = update.state.selection.main.head;
        const activeFn = findFunctionAt(update.state, pos);
        const activeFnName = activeFn ? activeFn.name : null;

        const nodes = useGraphStore.getState().nodes;
        const targetNode = nodes.find(n => n.id === activeFnName && (n.data?.node?.node_type === 'STEP' || n.data?.node?.node_type === 'SWITCH'));
        const currentlySelectedNode = nodes.find(n => n.selected);

        if (targetNode) {
          if (!targetNode.selected) {
            useGraphStore.getState().updateNode(targetNode.id, { selected: true });
          }
        } else {
          if (currentlySelectedNode && (currentlySelectedNode.data?.node?.node_type === 'STEP' || currentlySelectedNode.data?.node?.node_type === 'SWITCH')) {
            useGraphStore.getState().updateNode(currentlySelectedNode.id, { selected: false });
          }
        }
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
        selectedNodeIdField,
        readOnlyField,
        updateListener,
        EditorState.tabSize.of(4),
        indentUnit.of('    '),
        EditorState.transactionFilter.of(tr => {
          if (tr.docChanged) {
            if (tr.annotation(systemUpdate)) {
              return tr;
            }
            const allowed = getEditableRegions(tr.startState);

            let isChangeAllowed = true;
            tr.changes.iterChanges((fromA, toA) => {
              const isContained = allowed.some(
                (range) => fromA >= range.from && toA <= range.to
              );
              if (!isContained) {
                isChangeAllowed = false;
              }
            });

            if (!isChangeAllowed) {
              return [];
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
          },
          '.cm-line': {
            borderLeft: '3px solid transparent',
            borderRight: '3px solid transparent',
            borderTop: '1px dashed transparent',
            borderBottom: '1px dashed transparent',
          },
          '.cm-editable-line-start, .cm-editable-line-middle, .cm-editable-line-end, .cm-editable-line-single': {
            borderLeftColor: 'var(--iris-9)',
            borderRightColor: 'var(--iris-9)',
            backgroundColor: 'rgba(59, 130, 246, 0.015) !important',
          },
          '.cm-editable-line-start, .cm-editable-line-single': {
            borderTopColor: 'rgba(99, 102, 241, 0.35)',
          },
          '.cm-editable-line-end, .cm-editable-line-single': {
            borderBottomColor: 'rgba(99, 102, 241, 0.35)',
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
