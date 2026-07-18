import init, { PositionEncoding, Workspace } from '@astral-sh/ruff-wasm-web';

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
