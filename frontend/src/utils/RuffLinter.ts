import init, { PositionEncoding, Workspace } from '@astral-sh/ruff-wasm-web';
import { type Diagnostic } from '@codemirror/lint';
import { type EditorState } from '@codemirror/state';
import { type FunctionEntity, type Variable } from '../components/types';

let initPromise: Promise<void> | null = null;

export async function initRuff(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await init();
    })();
  }
  await initPromise;
}

export function createRuffWorkspace(variableNames: string[], nodeType?: string): Workspace {
  const ignore = ['W292'];
  if (nodeType === 'SWITCH') {
    ignore.push('B015', 'B018');
  }

  return new Workspace({
    builtins: variableNames,
    lint: {
      select: ['E', 'F', 'W', 'B', 'C', 'I'],
      ignore,
    },
  }, PositionEncoding.Utf16);
}

export function runTypeCheck(_code: string, _variables: Variable[], _functions: FunctionEntity[], _nodeType?: string): Diagnostic[] {
  return [];
}

export function runStateDiagnostics(code: string, variables: Variable[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const registeredNames = new Set(variables.map(v => v.name));

  // Regex to match: state["var"] or state['var']
  const stateAccessRegex = /state\[\s*(["'])(.*?)\1\s*\]/g;
  let match;

  while ((match = stateAccessRegex.exec(code)) !== null) {
    const varName = match[2];
    const fullMatch = match[0];

    if (!registeredNames.has(varName)) {
      const from = match.index;
      const to = match.index + fullMatch.length;

      diagnostics.push({
        from,
        to,
        severity: 'error',
        message: `Key '${varName}' does not exist in Graph State.`,
      });
    }
  }

  // Regex to match: state.varname dot-access
  const stateDotAccessRegex = /state\.([A-Za-z_]\w*)/g;

  while ((match = stateDotAccessRegex.exec(code)) !== null) {
    const varName = match[1];
    const fullMatch = match[0];

    if (!registeredNames.has(varName)) {
      const from = match.index;
      const to = match.index + fullMatch.length;

      diagnostics.push({
        from,
        to,
        severity: 'error',
        message: `Attribute '${varName}' does not exist in Graph State.`,
      });
    }
  }

  return diagnostics;
}

export function runSwitchRouteDiagnostics(code: string, outputSlotLabels: string[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const validLabels = new Set(outputSlotLabels);

  // Regex to match: return "label" or return 'label'
  const returnRegex = /return\s+(["'])(.*?)\1/g;
  let match;

  while ((match = returnRegex.exec(code)) !== null) {
    const returnedValue = match[2];
    const fullMatch = match[0];

    if (returnedValue !== "" && !validLabels.has(returnedValue)) {
      const from = match.index;
      const to = match.index + fullMatch.length;

      diagnostics.push({
        from,
        to,
        severity: 'error',
        message: `Returned route '${returnedValue}' does not match any of the node's outgoing slots.`,
      });
    }
  }

  return diagnostics;
}

export function runRuffLint(
  state: EditorState,
  workspace: Workspace,
  variables: Variable[],
  _functions: FunctionEntity[],
  nodeType?: string,
  outputSlotLabels: string[] = []
): Diagnostic[] {
  const code = state.doc.toString();
  const typeDiagnostics = [
    ...runStateDiagnostics(code, variables),
    ...(nodeType === 'SWITCH' ? runSwitchRouteDiagnostics(code, outputSlotLabels) : [])
  ];

  if (!code.trim()) {
    return typeDiagnostics;
  }

  try {
    const results = workspace.check(code);
    const diagnostics: Diagnostic[] = [...typeDiagnostics];

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
    return typeDiagnostics;
  }
}
