import { bibleRefrenceParser } from "app.components.bibleRefrenceParser";

import { parseTranslation } from "app.components.bibleRefrenceParser";

import { navigateToBibleReference } from "app.components.navigateToBibleReference";

import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";

export function AIBibleActionHandler({ query, booksData, children }) {
  const { scrollToVerse } = useBibleContext();
  const { changeTranslation } = useBibleData();

  async function handleAIAction() {
    if (!query?.trim()) return;
    if (!query?.trim()) return false;
    const lowerQuery = query.toLowerCase().trim();
    const shouldNavigate =
      lowerQuery.startsWith("open ") ||
      lowerQuery.startsWith("go to ") ||
      lowerQuery.startsWith("show ") ||
      lowerQuery.startsWith("take me to ");
    if (!shouldNavigate) {
      return false;
    }

    const refs = bibleRefrenceParser(query);

    const translation = parseTranslation(query);

    if (translation) {
      globalThis.selectedTranslation = {
        id: translation.shortName,
        name: translation.fullName,
      };
    }

    // Navigate if reference exists
    if (refs.length > 0) {
      const ref = refs[0];
      const bookName = ref.book.charAt(0).toUpperCase() + ref.book.slice(1);
      console.log(bookName, "ref.book");

      navigateToBibleReference({
        bookName: bookName,
        chapter: ref.chapter,
        verseNumber: ref.verse,

        translationId:
          translation?.shortName ||
          globalThis.selectedTranslation?.id ||
          "NASB95",

        booksData,

        scrollToVerse,
      });

      console.log("Opened:", ref.book, ref.chapter, ref.verse);

      return true;
    }

    return false;
  }

  const renderChild = Array.isArray(children) ? children[0] : children;

  if (typeof renderChild !== "function") {
    return null;
  }

  return renderChild({
    handleAIAction,
  });
}
