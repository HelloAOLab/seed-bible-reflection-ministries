import { bibleRefrenceParser } from "app.components.bibleRefrenceParser";

import { parseTranslation } from "app.components.bibleRefrenceParser";

import { navigateToBibleReference } from "app.components.navigateToBibleReference";

import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";

export function useAIBibleAction({ query, booksData, tabs }) {
  const { scrollToVerse } = useBibleContext();

  async function handleAIAction() {
    if (!query?.trim()) {
      return false;
    }

    const lowerQuery = query.toLowerCase().trim();

    const shouldNavigate =
      lowerQuery.startsWith("open") ||
      lowerQuery.startsWith("go to") ||
      lowerQuery.startsWith("show") ||
      lowerQuery.startsWith("take me to") ||
      lowerQuery.startsWith("navigate") ||
      lowerQuery.startsWith("take to");

    if (!shouldNavigate) {
      return false;
    }

    const refs = bibleRefrenceParser(query);

    const translation = parseTranslation(query);

    if (refs.length > 0) {
      const ref = refs[0];

      await navigateToBibleReference({
        bookName: ref.book,
        chapter: ref.chapter,
        verseNumber: ref.verse,

        translationId: translation?.shortName || "NASB95",

        booksData,
        scrollToVerse,
        tabs,
      });

      return true;
    }

    return false;
  }

  return {
    handleAIAction,
  };
}
