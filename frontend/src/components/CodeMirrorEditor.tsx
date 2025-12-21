import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useEffect, useRef } from 'react';

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
  maxWidth = 600,
  singleLine = false,
}: CodeMirrorEditorProps & { singleLine?: boolean }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const internalValueRef = useRef(initialValue);
  const isFocusedRef = useRef(false);

  // Sync initialValue if it changes from outside
  useEffect(() => {
    if (isFocusedRef.current) return;
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
          onSave(newValue);
        }
      }),
      EditorView.baseTheme({

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

    const handleFocus = () => {
      isFocusedRef.current = true;
    };
    const handleBlur = () => {
      isFocusedRef.current = false;
    };
    view.dom.addEventListener('focus', handleFocus, true);
    view.dom.addEventListener('blur', handleBlur, true);

    editorRef.current = view;

    return () => {
      view.dom.removeEventListener('focus', handleFocus, true);
      view.dom.removeEventListener('blur', handleBlur, true);
      view.destroy();
      editorRef.current = null;
    };
  }, [singleLine, maxWidth, minWidth]);

  return (
    <div
      ref={containerRef}
      className="nodrag nowheel"
      style={{
        display: 'inline-block',
        minWidth: singleLine ? '100%' : minWidth,
        maxWidth,
        minHeight: singleLine ? '32px' : '60px',
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
