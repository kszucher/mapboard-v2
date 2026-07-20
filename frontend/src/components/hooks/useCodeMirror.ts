import type { Workspace } from '@astral-sh/ruff-wasm-web';
import { acceptCompletion } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { foldGutter, indentUnit } from '@codemirror/language';
import { type Diagnostic, linter, lintGutter } from '@codemirror/lint';
import { Annotation, EditorState, Range, StateEffect, StateField } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import type { DecorationSet } from '@codemirror/view';
import { Decoration, drawSelection, EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef, useState } from 'react';
import {
  buildAutocompletionExtension,
  findFunctionAt,
  getEditableRegions,
  getFoldEffectsForFunctions,
  resolveHighlightLineRange,
} from '../../domain/code/ast';
import type { Variable } from '../types';

const systemUpdate = Annotation.define<boolean>();

const setSelectedItemEffect = StateEffect.define<string | null>();

const selectionField = StateField.define<string | null>({
  create: () => null,
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setSelectedItemEffect)) {
        return effect.value;
      }
    }
    return value;
  }
});

// Build line-bracket decorations for editable areas
function buildDecorations(state: EditorState) {
  const nodeId = state.field(selectionField);
  if (!nodeId) return Decoration.none;

  const range = resolveHighlightLineRange(state, nodeId);
  if (!range) return Decoration.none;

  const { highlightStart, highlightEnd } = range;

  const decorations: Range<Decoration>[] = [];
  for (let l = highlightStart; l <= highlightEnd; l++) {
    const line = state.doc.line(l);
    const className = highlightStart === highlightEnd ? 'cm-editable-line-single'
      : l === highlightStart ? 'cm-editable-line-start'
        : l === highlightEnd ? 'cm-editable-line-end'
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
    const oldSelection = tr.startState.field(selectionField);
    const newSelection = tr.state.field(selectionField);
    if (tr.docChanged || oldSelection !== newSelection) {
      return buildDecorations(tr.state);
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Custom CodeMirror theme for the editor
const editorTheme = EditorView.theme({
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
});

// Transaction filter that locks non-editable regions
function buildTransactionFilter() {
  return EditorState.transactionFilter.of(tr => {
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
  });
}

export interface UseCodeMirrorProps {
  code: string;
  variables: Variable[];
  selectedNodeId: string | null;
  workspace: Workspace | null;
  clearErrorMessage: () => void;
  setSelectedIds: (nodeId: string | null, branchIndex: number | null) => void;
}

export function useCodeMirror({
  code,
  variables,
  selectedNodeId,
  workspace,
  clearErrorMessage,
  setSelectedIds,
}: UseCodeMirrorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [currentValue, setCurrentValue] = useState(code);

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

  // Sync component selection back to CodeMirror selection effects
  // Sync component selection back to CodeMirror selection effects and fold/unfold functions
  useEffect(() => {
    if (viewRef.current) {
      const currentSelection = viewRef.current.state.field(selectionField);

      if (currentSelection !== selectedNodeId) {
        viewRef.current.dispatch({
          effects: setSelectedItemEffect.of(selectedNodeId),
        });
      }

      const effects = getFoldEffectsForFunctions(viewRef.current.state, selectedNodeId);
      if (effects.length > 0) {
        viewRef.current.dispatch({ effects });
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

        setSelectedIds(activeFnName, null);
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
        foldGutter(),
        buildAutocompletionExtension(variables),
        workspace ? linter((view) => runRuffLint(view.state, workspace)) : [],
        lintGutter(),
        selectionField,
        readOnlyField,
        updateListener,
        EditorState.tabSize.of(4),
        indentUnit.of('    '),
        buildTransactionFilter(),
        editorTheme,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    // Apply initial fold state on mount
    const initialEffects = getFoldEffectsForFunctions(view.state, selectedNodeId);
    if (initialEffects.length > 0) {
      view.dispatch({ effects: initialEffects });
    }

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [workspace]);

  return {
    containerRef,
    viewRef,
    currentValue,
    setCurrentValue,
  };
}

function runRuffLint(state: EditorState, workspace: Workspace): Diagnostic[] {
  const code = state.doc.toString();
  if (!code.trim()) {
    return [];
  }

  try {
    const results = workspace.check(code);
    const diagnostics: Diagnostic[] = [];

    for (const d of results) {
      try {
        const startRow = Math.max(1, Math.min(d.start_location.row, state.doc.lines));
        const startLine = state.doc.line(startRow);
        const startCol = Math.max(0, Math.min(d.start_location.column - 1, startLine.length));
        const from = startLine.from + startCol;

        const endRow = Math.max(1, Math.min(d.end_location.row, state.doc.lines));
        const endLine = state.doc.line(endRow);
        const endCol = Math.max(0, Math.min(d.end_location.column - 1, endLine.length));
        const to = endLine.from + endCol;

        const severity: 'error' | 'warning' = d.code && (d.code.startsWith('E') || d.code.startsWith('F')) ? 'error' : 'warning';

        diagnostics.push({
          from,
          to: to > from ? to : from + 1,
          severity,
          message: d.code ? `[${d.code}] ${d.message}` : d.message,
        });
      } catch (err) {
        console.error('Error processing Ruff diagnostic coordinate', err, d);
      }
    }

    return diagnostics;
  } catch (error) {
    console.error('Ruff linting failed', error);
    return [];
  }
}
