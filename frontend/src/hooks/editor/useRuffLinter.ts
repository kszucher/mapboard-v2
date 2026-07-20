import init, { PositionEncoding, Workspace } from '@astral-sh/ruff-wasm-web';
import { useEffect, useState } from 'react';
import type { Variable } from '../../canvas/types';

let initPromise: Promise<void> | null = null;

async function initRuff(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      await init();
    })();
  }
  await initPromise;
}

function createRuffWorkspace(variableNames: string[]): Workspace {
  const ignore = ['W292'];
  return new Workspace({
    builtins: variableNames,
    lint: {
      select: ['E', 'F', 'W', 'B', 'C', 'I'],
      ignore,
    },
  }, PositionEncoding.Utf16);
}

export function useRuffLinter(variables: Variable[]): Workspace | null {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

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

  return workspace;
}
