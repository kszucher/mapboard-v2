import type { Workspace } from '@astral-sh/ruff-wasm-web';
import { useEffect, useState } from 'react';
import { createRuffWorkspace, initRuff } from '../../services/ruffLinter';
import type { Variable } from '../types';

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
