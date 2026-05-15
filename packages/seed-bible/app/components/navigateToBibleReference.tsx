import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";

let prevVerse = null;

export async function navigateToBibleReference({
  bookName,
  chapter,
  translationId,
  booksData,
  verseNumber,
  scrollToVerse,
}) {
  const bookData = booksData.find((book) =>
    book.commonName?.toLowerCase().includes(bookName.toLowerCase())
  );

  if (!bookData) {
    console.log("Book not found");
    return;
  }

  globalThis.ChangeTranslation(translationId);

  const chapterUrl = bookData.firstChapterApiLink.replace(
    "1.json",
    `${chapter}.json`
  );
  setTimeout(() => {
    globalThis.Open(bookData.id, chapter, translationId, chapterUrl);

    if (verseNumber) {
      setTimeout(() => {
        scrollToVerse(Number(verseNumber));
        globalThis.UnHighlightVerse?.();
        globalThis.HighlightVerse(Number(verseNumber), "#2e48791a");

        prevVerse = Number(verseNumber);
      }, 800);
    }
  }, 200);
}
