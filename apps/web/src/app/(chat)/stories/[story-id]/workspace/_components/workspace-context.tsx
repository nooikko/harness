'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type WorkspaceSelection = {
  transcriptId: string | null;
  messageIndex: number | null;
  selectedText: string | null;
  messageContent: string | null;
};

type WorkspaceState = {
  selection: WorkspaceSelection;
  setSelection: (sel: Partial<WorkspaceSelection>) => void;
  clearSelection: () => void;
};

const EMPTY_SELECTION: WorkspaceSelection = {
  transcriptId: null,
  messageIndex: null,
  selectedText: null,
  messageContent: null,
};

const WorkspaceContext = createContext<WorkspaceState>({
  selection: EMPTY_SELECTION,
  setSelection: () => {},
  clearSelection: () => {},
});

type WorkspaceProviderProps = {
  children: React.ReactNode;
};

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const [selection, setSelectionState] = useState<WorkspaceSelection>(EMPTY_SELECTION);

  const setSelection = useCallback((sel: Partial<WorkspaceSelection>) => {
    setSelectionState((prev) => ({ ...prev, ...sel }));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(EMPTY_SELECTION);
  }, []);

  return <WorkspaceContext.Provider value={{ selection, setSelection, clearSelection }}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspaceSelection = () => useContext(WorkspaceContext);
