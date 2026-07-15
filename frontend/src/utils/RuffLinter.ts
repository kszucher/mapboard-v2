import init, { Workspace, PositionEncoding } from '@astral-sh/ruff-wasm-web';
import { type Diagnostic } from '@codemirror/lint';
import { type EditorState } from '@codemirror/state';
import { type Variable } from '../components/types';

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

export function runTypeCheck(code: string, variables: Variable[], nodeType?: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split('\n');
  let currentOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Precisely check for assignment operator = (and exclude comparison operators ==, !=, <=, >=)
    const eqIndex = line.indexOf('=');
    if (eqIndex !== -1) {
      const nextChar = line[eqIndex + 1];
      const prevChar = line[eqIndex - 1];
      
      const isComparison = nextChar === '=' || prevChar === '!' || prevChar === '<' || prevChar === '>';
      if (!isComparison) {
        if (nodeType === 'SWITCH') {
          diagnostics.push({
            from: currentOffset,
            to: currentOffset + line.length,
            severity: 'error',
            message: 'Assignments are not allowed in decision slots.',
          });
          currentOffset += line.length + 1;
          continue;
        }

        const varName = line.substring(0, eqIndex).trim();
        const valueExpr = line.substring(eqIndex + 1).trim();

        if (/^[a-zA-Z_]\w*$/.test(varName)) {
          const variable = variables.find(v => v.name === varName);
          if (variable) {
            const valueIndex = line.indexOf(valueExpr, eqIndex + 1);
            const from = currentOffset + (valueIndex !== -1 ? valueIndex : eqIndex + 1);
            const to = currentOffset + line.length;

        let inferredType: 'string' | 'number' | 'boolean' | 'unknown' = 'unknown';

        // 1. String literal
        if ((valueExpr.startsWith('"') && valueExpr.endsWith('"')) || 
            (valueExpr.startsWith("'") && valueExpr.endsWith("'"))) {
          inferredType = 'string';
        }
        // 2. Boolean literal
        else if (valueExpr === 'True' || valueExpr === 'False') {
          inferredType = 'boolean';
        }
        // 3. Number literal (integer or float)
        else if (/^-?\d+(\.\d+)?$/.test(valueExpr)) {
          inferredType = 'number';
        }
        // 4. Reference to another variable
        else {
          const otherVar = variables.find(v => v.name === valueExpr);
          if (otherVar) {
            inferredType = otherVar.type;
          }
          // 5. Basic binary operations (e.g., mark_cntr + 1)
          else if (variable.type === 'number') {
            const binOpMatch = valueExpr.match(/^(\w+)\s*([\+\-\*\/])\s*(.+)$/);
            if (binOpMatch) {
              const leftOp = binOpMatch[1];
              const rightOp = binOpMatch[3].trim();
              
              const leftVar = variables.find(v => v.name === leftOp);
              const leftType = (leftOp === varName) ? 'number' : (leftVar ? leftVar.type : 'unknown');
              
              let rightType: 'string' | 'number' | 'boolean' | 'unknown' = 'unknown';
              if (/^-?\d+(\.\d+)?$/.test(rightOp)) {
                rightType = 'number';
              } else {
                const rightVar = variables.find(v => v.name === rightOp);
                if (rightVar) rightType = rightVar.type;
              }

              if (leftType === 'number' && rightType === 'number') {
                inferredType = 'number';
              }
            }
          }
        }

        // Emit diagnostic if types do not match
        if (inferredType !== 'unknown' && inferredType !== variable.type) {
          diagnostics.push({
            from,
            to,
            severity: 'error',
            message: `Type mismatch: Cannot assign type '${inferredType}' to variable '${varName}' of type '${variable.type}'`,
          });
        }
      }
    }
  }
}
    currentOffset += line.length + 1; // +1 for the newline
  }

  return diagnostics;
}

export function runRuffLint(state: EditorState, workspace: Workspace, variables: Variable[], nodeType?: string): Diagnostic[] {
  const code = state.doc.toString();
  const typeDiagnostics = runTypeCheck(code, variables, nodeType);

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
