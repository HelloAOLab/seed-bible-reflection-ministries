import {
  bibleRefrenceParser,
  parseTranslation,
} from "ext_askKen.host.managers.bibleReferenceParser";
import { navigateToBibleReference } from "ext_askKen.host.managers.bibleNavigation";
import type { SeedBibleState } from "seed-bible.app.api";

interface UseAIBibleAction {
  query: string;
  seedBibleContext: SeedBibleState;
}

export function useAIBibleAction({
  query,
  seedBibleContext,
}: UseAIBibleAction) {
  async function handleAIAction() {
    if (!query?.trim()) {
      return false;
    }
    if (!seedBibleContext?.app?.currentReadingState.value) {
      return;
    }
    const currentReadingState = seedBibleContext.app.currentReadingState.value;

    const readingState = currentReadingState.tab.readingState;
    if (!readingState.translationBooks.value) {
      return;
    }
    const { selectTranslation } = readingState;

    const lowerQuery = query.toLowerCase().trim();

    const shouldNavigate =
      lowerQuery.startsWith("open") ||
      lowerQuery.startsWith("go to") ||
      lowerQuery.startsWith("show") ||
      lowerQuery.startsWith("take me to") ||
      lowerQuery.startsWith("navigate") ||
      lowerQuery.startsWith("take to") ||
      lowerQuery.startsWith("change");

    if (!shouldNavigate) {
      return false;
    }

    const refs = bibleRefrenceParser(query);

    const translation = parseTranslation(query);
    if (refs.length < 0) {
      return;
    }

    if (refs.length > 0) {
      const ref = refs[0];

      await navigateToBibleReference({
        bookName: ref!.book ?? null,
        chapter: ref!.chapter ?? null,
        verseNumber: ref!.verse ?? null,
        endVerseNumber: ref!.endVerse ?? ref!.verse ?? null,
        translationId: translation?.shortName ?? "NASB95",

        seedBibleContext: seedBibleContext,
      });

      return true;
    }
    if (translation && refs.length === 0) {
      selectTranslation(translation.id);
      return true;
    }

    return false;
  }

  return {
    handleAIAction,
  };
}
