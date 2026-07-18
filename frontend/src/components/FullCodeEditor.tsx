import { acceptCompletion, autocompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { syntaxTree } from '@codemirror/language';
import { linter, lintGutter } from '@codemirror/lint';
import { Annotation, EditorState, StateField } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { Decoration, drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';
import { createRuffWorkspace, initRuff, runRuffLint } from '../services/ruffLinter';
import { useGraphStore } from '../store/useGraphStore';

interface FullCodeEditorProps {
  isGraphSelected: boolean;
}

const systemUpdate = Annotation.define<boolean>();

// Helper to statically scan AST and find allowed editable ranges
function getEditableRegions(state: EditorState, switchNodeNames: string[]): { from: number; to: number }[] {
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
        const nameNode = node.node.getChild('VariableName');
        const bodyNode = node.node.getChild('Body');
        if (nameNode && bodyNode) {
          const fnName = docStr.slice(nameNode.from, nameNode.to);
          if (!switchNodeNames.includes(fnName)) {
            // Step function: full body is editable
            regions.push({ from: bodyNode.from + 1, to: bodyNode.to });
          } else {
            // Switch function: only condition expressions are editable
            const bodyText = docStr.slice(bodyNode.from, bodyNode.to);
            let currentOffset = bodyNode.from;
            for (const line of bodyText.split('\n')) {
              const trimmed = line.trimStart();
              const match = trimmed.match(/^(?:if|elif)\s+/);
              if (match) {
                const start = currentOffset + (line.length - trimmed.length) + match[0].length;
                const colon = line.indexOf(':');
                if (colon !== -1) {
                  regions.push({ from: start, to: currentOffset + colon });
                }
              }
              currentOffset += line.length + 1;
            }
          }
        }
      }
    }
  });

  return regions;
}

// Build line-bracket decorations for editable areas
function buildDecorations(state: EditorState) {
  const switchNodeNames = useGraphStore.getState().nodes
    .filter((n) => n.data?.node?.node_type === 'SWITCH')
    .map((n) => n.id);
  const allowed = getEditableRegions(state, switchNodeNames);
  const decorations: any[] = [];
  const docStr = state.doc.toString();

  for (const r of allowed) {
    let regionFrom = r.from;
    let regionTo = r.to;
    const text = docStr.slice(regionFrom, regionTo);
    const leadingSpaces = text.match(/^\s*/)?.[0].length || 0;
    const trailingSpaces = text.match(/\s*$/)?.[0].length || 0;

    regionFrom += leadingSpaces;
    regionTo -= trailingSpaces;

    if (regionTo > regionFrom) {
      const startLine = state.doc.lineAt(regionFrom).number;
      const endLine = state.doc.lineAt(regionTo).number;
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
    }
  }
  return Decoration.set(decorations, true);
}

const readOnlyField = StateField.define<any>({
  create: (state) => buildDecorations(state),
  update: (value, tr) => tr.docChanged ? buildDecorations(tr.state) : value.map(tr.changes),
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
        readOnlyField,
        updateListener,
        EditorState.tabSize.of(4),
        EditorState.transactionFilter.of(tr => {
          if (tr.docChanged) {
            if (tr.annotation(systemUpdate)) {
              return tr;
            }
            const switchNodeNames = useGraphStore.getState().nodes
              .filter((n) => n.data?.node?.node_type === 'SWITCH')
              .map((n) => n.id);
            const allowed = getEditableRegions(tr.startState, switchNodeNames);

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
          '.cm-editable-line-start, .cm-editable-line-middle, .cm-editable-line-end, .cm-editable-line-single': {
            borderLeft: '3px solid var(--iris-9)',
            borderRight: '3px solid var(--iris-9)',
            backgroundColor: 'rgba(59, 130, 246, 0.015) !important',
          },
          '.cm-editable-line-start, .cm-editable-line-single': {
            borderTop: '1px dashed rgba(99, 102, 241, 0.35)',
          },
          '.cm-editable-line-end, .cm-editable-line-single': {
            borderBottom: '1px dashed rgba(99, 102, 241, 0.35)',
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
