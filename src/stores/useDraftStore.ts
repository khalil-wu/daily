import { create } from 'zustand';

import { clearDraft as clearStoredDraft, loadDraft, saveDraft as saveStoredDraft } from '@/src/storage/draftRepository';
import { hasDraftContent, normalizeMemoryDraft } from '@/src/storage/draftTypes';
import type { MemoryDraft } from '@/src/storage/draftTypes';

type DraftState = {
  draft: MemoryDraft | null;
  hydrated: boolean;
  hydrationError: string | null;
  hydrate: () => Promise<void>;
  saveDraft: (draft: MemoryDraft) => Promise<void>;
  clearDraft: () => Promise<void>;
};

export const useDraftStore = create<DraftState>((set, get) => ({
  draft: null,
  hydrated: false,
  hydrationError: null,
  hydrate: async () => {
    if (get().hydrated) return;

    try {
      const draft = await loadDraft();
      set({ draft, hydrated: true, hydrationError: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : '草稿读取失败';
      set({ draft: null, hydrated: true, hydrationError: message });
    }
  },
  saveDraft: async (draft) => {
    const normalized = normalizeMemoryDraft({ ...draft, updatedAt: new Date().toISOString() });
    if (!normalized || !hasDraftContent(normalized)) {
      await get().clearDraft();
      return;
    }

    set({ draft: normalized });
    try {
      await saveStoredDraft(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : '草稿保存失败';
      set({ hydrationError: message });
    }
  },
  clearDraft: async () => {
    set({ draft: null });
    try {
      await clearStoredDraft();
    } catch (error) {
      const message = error instanceof Error ? error.message : '草稿清除失败';
      set({ hydrationError: message });
    }
  },
}));
