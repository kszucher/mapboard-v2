import init, { PositionEncoding, Workspace } from '@astral-sh/ruff-wasm-web';
import { type Diagnostic } from '@codemirror/lint';
import { type EditorState } from '@codemirror/state';

let initPromise: Promise<void> | null = null;

export async function initRuff(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await init();
    })();
  }
  await initPromise;
}

export function createRuffWorkspace(variableNames: string[]): Workspace {
  const ignore = ['W292'];
  return new Workspace({
    builtins: variableNames,
    lint: {
      select: ['E', 'F', 'W', 'B', 'C', 'I'],
      ignore,
    },
  }, PositionEncoding.Utf16);
}

export function runRuffLint(
  state: EditorState,
  workspace: Workspace
): Diagnostic[] {
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
