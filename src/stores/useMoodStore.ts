import { create } from 'zustand';

import { defaultMoods, type MoodDef } from '@/src/i18n/copy';
import { loadCustomMoods, saveCustomMoods } from '@/src/storage/moodRepository';

type MoodState = {
  moods: MoodDef[]; // default + custom 合并后的完整注册表
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addMood: (emoji: string, label: string) => MoodDef | null;
  removeMood: (id: string) => void;
};

function makeId(label: string): string {
  return `mood-${label}-${Date.now().toString(36)}`;
}

export const useMoodStore = create<MoodState>((set, get) => ({
  moods: defaultMoods,
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const custom = await loadCustomMoods();
      set({ moods: [...defaultMoods, ...custom], hydrated: true });
    } catch {
      set({ moods: defaultMoods, hydrated: true });
    }
  },
  addMood: (emoji, label) => {
    const trimmed = label.trim();
    if (!trimmed) return null;
    const id = makeId(trimmed);
    const next: MoodDef = { id, emoji: emoji.trim() || '⭐', label: trimmed, custom: true };
    const merged = [...get().moods, next];
    set({ moods: merged });
    const customOnly = merged.filter((m) => m.custom);
    void saveCustomMoods(customOnly);
    return next;
  },
  removeMood: (id) => {
    const merged = get().moods.filter((m) => m.id !== id);
    set({ moods: merged });
    void saveCustomMoods(merged.filter((m) => m.custom));
  },
}));
