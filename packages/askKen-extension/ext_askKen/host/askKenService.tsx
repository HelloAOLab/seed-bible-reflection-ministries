import { signal } from "@preact/signals";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";

export const askKenContext = signal<SeedBibleState | null>(null);
export const askKenShouldSubmit = signal(false);

export const askKenOpen = signal(false);

export const askKenInitialQuery = signal("");

export function toggleAskKen() {
  askKenOpen.value = !askKenOpen.value;
}
export const isOpenedFromVerse = signal(false);
export function openAskKen() {
  askKenOpen.value = false;

  setTimeout(() => (askKenOpen.value = true), 200);
}
