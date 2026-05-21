import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";

let prevVerse = null;

export async function navigateToBibleReference({
  bookName,
  chapter,
  translationId,
  booksData,
  verseNumber,
  endVerseNumber,
  scrollToVerse,
  tabs,
}) {
  const bookData = booksData.find((book) =>
    book.commonName?.toLowerCase().includes(bookName.toLowerCase())
  );
  console.log(bookData, "bookdata");

  if (!bookData) {
    console.log("Book not found");
    return;
  }

  globalThis.ChangeTranslation(translationId);

  const chapterUrl = bookData.firstChapterApiLink.replace(
    "1.json",
    `${chapter}.json`
  );

  if (bookName?.slice(0, 4) === globalThis.CurrentBookData.book?.slice(0, 4)) {
    globalThis.Open(bookData.id, chapter, translationId, chapterUrl);
  } else {
    // find existing tab with same book
    const existingTab = tabs.find(
      (t) =>
        t?.data?.type === "book" &&
        t?.data?.book?.slice(0, 4)?.toLowerCase() ===
          bookName?.slice(0, 4)?.toLowerCase()
    );

    if (existingTab) {
      // update existing tab
      existingTab.data.chapter = chapter;
      existingTab.data.translation = translationId || bookData.translationId;

      globalThis.UpdateTab(existingTab);

      globalThis.Open(bookData.id, chapter, translationId, chapterUrl);
    } else {
      // create new tab
      const tab = {
        id: uuid(),
        taken: false,
        data: {
          use: "thePage",
          type: "book",
          book: bookName,
          bookId: bookData.id,
          chapter: chapter,
          translation: translationId || bookData.translationId,
          shortName: globalThis.CurrentBookData.shortName || "",
        },
      };

      globalThis.AddTab(tab);
      globalThis.UpdateTab(tab);

      globalThis.Open(bookData.id, chapter, translationId, chapterUrl);
    }
  }

  if (verseNumber) {
    setTimeout(() => {
      const startVerse = Number(verseNumber);
      const endVerse = Number(endVerseNumber || verseNumber);

      const verses = [];

      for (let i = startVerse; i <= endVerse; i++) {
        verses.push(i);
      }

      scrollToVerse(startVerse);

      if (prevVerse !== null) {
        globalThis.SetHighlighted((prev) => {
          const updated = { ...prev };

          for (let i = prevVerse.start; i <= prevVerse.end; i++) {
            delete updated[
              `${globalThis.CurrentBookData.book}-${globalThis.CurrentBookData.chapter}-${i}`
            ];
          }

          return updated;
        });
      }

      globalThis.HighlightVerse(verses, "#2E48791A");

      prevVerse = {
        start: startVerse,
        end: endVerse,
        chapter: globalThis.CurrentBookData.chapter,
        book: globalThis.CurrentBookData.book,
      };

      setTimeout(() => {
        globalThis.SetHighlighted((prev) => {
          const updated = { ...prev };

          for (let i = startVerse; i <= endVerse; i++) {
            delete updated[
              `${globalThis.CurrentBookData.book}-${globalThis.CurrentBookData.chapter}-${i}`
            ];
          }

          return updated;
        });

        prevVerse = null;
      }, 10000);
    }, 1200);
  }
}
