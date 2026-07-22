import { create } from 'zustand';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set) => ({
  graphId: null,
  code: '',

  init: (graphId) => {
    set({
      graphId,
      code: '',
    });
  },
}));
