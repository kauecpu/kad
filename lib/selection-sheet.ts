export type SelectionSheetSearchState = {
  context: string;
  query: string;
  visible: boolean;
};

export type SelectionSheetSearchAction =
  | { type: 'sync'; context: string; visible: boolean }
  | { type: 'query'; query: string }
  | { type: 'close' };

export const INITIAL_SELECTION_SHEET_SEARCH: SelectionSheetSearchState = {
  context: '',
  query: '',
  visible: false,
};

/** Mantém a busca isolada por seletor e sempre a limpa ao fechar. */
export function selectionSheetSearchReducer(
  state: SelectionSheetSearchState,
  action: SelectionSheetSearchAction
): SelectionSheetSearchState {
  if (action.type === 'query') {
    return { ...state, query: action.query };
  }

  if (action.type === 'close') {
    return { ...state, query: '', visible: false };
  }

  const contextChanged = state.context !== action.context;
  const opened = action.visible && !state.visible;
  const closed = !action.visible;
  return {
    context: action.context,
    visible: action.visible,
    query: contextChanged || opened || closed ? '' : state.query,
  };
}
