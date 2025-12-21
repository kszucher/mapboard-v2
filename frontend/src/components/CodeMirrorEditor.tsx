import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';

interface CodeMirrorEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
}

export const CodeMirrorEditor = ({
  initialValue,
  onSave,
  minWidth = 240,
  minHeight = 60,
  maxWidth = 600,
  singleLine = false,
}: CodeMirrorEditorProps & { singleLine?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const internalValueRef = useRef(initialValue);

  const debouncedSave = useDebouncedCallback((value: string) => {
    onSave(value);
  }, 500);

  // Sync initialValue if it changes from outside
  useEffect(() => {
    if (editorRef.current && initialValue !== internalValueRef.current) {
      const view = editorRef.current;
      internalValueRef.current = initialValue;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: initialValue }
      });
    }
  }, [initialValue]);

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      markdown(),
      oneDark,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newValue = update.state.doc.toString();
          internalValueRef.current = newValue;
          debouncedSave(newValue);
        }
      }),
      EditorView.baseTheme({
        '&': {
          height: (singleLine ? '32px' : 'auto') as string,
          minHeight: (singleLine ? '32px' : `${minHeight}px`) as string,
          maxHeight: (singleLine ? '32px' : 'none') as string,
          fontSize: '13px',
          cursor: 'text',
        },
        '.cm-scroller': {
          overflow: singleLine ? 'hidden' : 'visible',
          fontFamily: 'var(--font-mono, monospace)',
          cursor: 'text',
          lineHeight: (singleLine ? '32px' : 'inherit') as string,
          display: singleLine ? 'flex' : 'block',
          alignItems: singleLine ? 'center' : 'unset',
        },
        '.cm-content': {
          minHeight: (singleLine ? '32px' : `${minHeight}px`) as string,
          whiteSpace: (singleLine ? 'pre' : 'pre-wrap') as string,
          padding: (singleLine ? '0 8px' : '8px 4px') as string,
          cursor: 'text',
          display: singleLine ? 'flex' : 'block',
          alignItems: singleLine ? 'center' : 'unset',
        },
        '.cm-line': {
          padding: '0 4px',
          cursor: 'text',
          display: singleLine ? 'flex' : 'block',
          alignItems: singleLine ? 'center' : 'unset',
        },
      }),
    ];

    if (!singleLine) {
      extensions.push(lineNumbers());
      extensions.push(EditorView.lineWrapping);
    } else {
      // Filter out newline transactions
      extensions.push(EditorState.transactionFilter.of(tr => {
        return tr.newDoc.lines > 1 ? [] : tr;
      }));
    }

    const startState = EditorState.create({
      doc: initialValue,
      extensions,
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    editorRef.current = view;

    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, [singleLine, minHeight, maxWidth, minWidth]);

  return (
    <div
      ref={containerRef}
      className="nodrag nowheel"
      style={{
        display: 'inline-block',
        minWidth: singleLine ? '100%' : minWidth,
        maxWidth,
        minHeight: singleLine ? '32px' : minHeight,
        height: singleLine ? '32px' : 'auto',
        maxHeight: singleLine ? '32px' : 'none',
        width: 'fit-content',
        border: '1px solid var(--gray-5)',
        borderRadius: 'var(--radius-2)',
        backgroundColor: 'var(--color-panel-solid)',
        boxSizing: 'border-box',
      }}
    />
  );
};
