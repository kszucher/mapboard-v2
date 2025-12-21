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
                                 }: CodeMirrorEditorProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const internalValueRef = useRef(initialValue);

  const debouncedSave = useDebouncedCallback((value: string) => {
    onSave(value);
  }, 500);

  useEffect(() => {
    if (!containerRef.current) return;

    const startState = EditorState.create({
      doc: initialValue,
      extensions: [
        keymap.of([...defaultKeymap, ...historyKeymap]),
        history(),
        lineNumbers(),
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
            height: 'auto',
            minHeight: `${minHeight}px`,
            fontSize: '13px',
            cursor: 'text',
          },
          '.cm-scroller': {
            overflow: 'hidden',
            fontFamily: 'var(--font-mono, monospace)',
            cursor: 'text',
          },
          '.cm-content': {
            minHeight: `${minHeight}px`,
            whiteSpace: 'pre-wrap',
            padding: '8px 4px',
            cursor: 'text',
          },
          '.cm-line': {
            padding: '0 4px',
            cursor: 'text',
          },
        }),
      ],
    });

    const view = new EditorView({
      state: startState,
      parent: containerRef.current,
    });

    editorRef.current = view;

    return () => {
      view.destroy();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="nodrag nowheel"
      style={{
        display: 'inline-block',
        minWidth,
        maxWidth,
        minHeight,
        width: 'fit-content', // This enables the horizontal auto-sizing!
        border: '1px solid var(--gray-5)',
        borderRadius: 'var(--radius-2)',
        backgroundColor: 'var(--color-panel-solid)',
      }}
    />
  );
};
