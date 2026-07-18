import { syntaxTree } from '@codemirror/language';
import { EditorState } from '@codemirror/state';

// Helper to find a function definition enclosing a specific position
export function findFunctionAt(state: EditorState, pos: number): { name: string; from: number; to: number } | null {
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
export function findFunctionByName(state: EditorState, name: string): { from: number; to: number } | null {
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
export function getEditableRegions(state: EditorState): { from: number; to: number }[] {
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

// Helper to resolve the target branch index if inside a SWITCH block at the current cursor position
export function resolveBranchIndexAtPosition(
  state: EditorState,
  pos: number,
  activeFn: { from: number; to: number }
): number {
  const clickLineNum = state.doc.lineAt(pos).number;
  const startLineNum = state.doc.lineAt(activeFn.from).number;
  const endLineNum = state.doc.lineAt(activeFn.to).number;

  const branchLines: number[] = [];
  for (let l = startLineNum; l <= endLineNum; l++) {
    const lineText = state.doc.line(l).text.trim();
    const isBranchStart =
      lineText.startsWith('if ') ||
      lineText.startsWith('elif ') ||
      lineText.startsWith('if(') ||
      lineText.startsWith('elif(');
    if (isBranchStart) {
      branchLines.push(l);
    }
  }

  const clickedLineText = state.doc.line(clickLineNum).text;
  const isFallbackReturn =
    clickedLineText.trim().startsWith('return') &&
    clickedLineText.length - clickedLineText.trimStart().length <= 4;

  if (clickLineNum !== endLineNum && !isFallbackReturn) {
    for (let i = branchLines.length - 1; i >= 0; i--) {
      if (branchLines[i] <= clickLineNum) {
        return i;
      }
    }
  }

  return -1;
}
