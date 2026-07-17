import type { StateCreator } from 'zustand';
import { updateFlowState } from '../helpers';
import type { GraphStoreState, VariableFunctionSlice } from '../types';

export const createVariableFunctionSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  VariableFunctionSlice
> = (set, get) => ({
  addVariable: async (name, type) => {
    await updateFlowState(set, get, (state) => {
      const newVar = {
        id: crypto.randomUUID(),
        name,
        type,
        value: null,
      };
      return {
        ...state,
        variables: [...state.variables, newVar],
      };
    });
  },

  addFunction: async (name, inputVariableId, outputVariableId, rawString) => {
    await updateFlowState(set, get, (state) => {
      const newFunc = {
        id: crypto.randomUUID(),
        name,
        input_variable: inputVariableId,
        output_variable: outputVariableId,
        raw_string: rawString,
      };
      return {
        ...state,
        functions: [...state.functions, newFunc],
      };
    });
  },

  deleteFunction: async (functionId) => {
    await updateFlowState(set, get, (state) => {
      const nextFunctions = state.functions.filter(f => f.id !== functionId);

      return {
        ...state,
        functions: nextFunctions,
      };
    });
  },
});
