import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";
const G = globalThis as any;

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
  console.log(booksData, "boook");
  const bookData = booksData.find((book) =>
    book.commonName?.toLowerCase().includes(bookName.toLowerCase())
  );
  console.log(bookData);

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
  const normalizeBook = (name) => name?.replace(/\s+/g, "").toLowerCase();

  const isSameBook =
    normalizeBook(bookName) === normalizeBook(globalThis.CurrentBookData?.book);

  if (isSameBook) {
    console.log("123");

    setTimeout(() => {
      globalThis.Open(
        bookData.id,
        chapter,
        translationId || bookData.translationId,
        chapterUrl
      );
    }, 100);
  } else {
    // find existing tab with same book
    const normalizeBook = (name) => name?.replace(/\s+/g, "").toLowerCase();

    const existingTab = tabs.find(
      (t) =>
        t?.data?.type === "book" &&
        normalizeBook(t?.data?.book) === normalizeBook(bookName)
    );

    console.log(
      existingTab,
      bookData.id,
      chapter,
      translationId,
      chapterUrl,
      "daata"
    );

    if (existingTab) {
      console.log("456");
      console.log(existingTab, "existingTab");

      const updatedTab = {
        ...existingTab,
        data: {
          ...existingTab.data,
          chapter,
          translation: translationId || bookData.translationId,
        },
      };
      console.log(updatedTab, "updatedtab");

      // switch to existing tab
      setTimeout(() => {
        globalThis.UpdateTab(updatedTab);
      }, 800);

      // VERY IMPORTANT FOR MOBILE

      setTimeout(() => {
        globalThis.Open(
          bookData.id,
          chapter,
          translationId || bookData.translationId,
          chapterUrl
        );
      }, 800);
    } else {
      console.log("789");

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
      setTimeout(() => {
        globalThis.AddTab(tab);
        globalThis.UpdateTab(tab);
      }, 800);

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
  if (G.ActiveMoreApp) {
    G.RemoveApplicationByLabel(G.ActiveMoreApp);
    G.makingApp = null;
    G.SetActiveMoreApp(null);
    G.ActiveMoreApp = null;
  }
}
