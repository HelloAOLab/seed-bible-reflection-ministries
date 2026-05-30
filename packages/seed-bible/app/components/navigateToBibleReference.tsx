import { useBibleContext } from "app.hooks.bibleVariables";
import useBibleData from "app.hooks.bibleData";

let prevVerse = null;

const G = globalThis;

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
  if (G.IsMobileNow?.() && G.BibleNavigationInProgress) {
    return;
  }

  G.BibleNavigationInProgress = true;

  const bookData = booksData.find((book) =>
    book.commonName?.toLowerCase().includes(bookName.toLowerCase())
  );

  if (!bookData) {
    console.log("Book not found");
    G.BibleNavigationInProgress = false;
    return;
  }

  if (translationId) {
    G.ChangeTranslation(translationId);
  }

  const chapterUrl = bookData.firstChapterApiLink.replace(
    "1.json",
    `${chapter}.json`
  );

  const executeNavigation = () => {
    try {
      const currentBook = G.CurrentBookData?.book?.slice(0, 4)?.toLowerCase();

      const targetBook = bookName?.slice(0, 4)?.toLowerCase();

      if (currentBook === targetBook) {
        G.Open(bookData.id, chapter, translationId, chapterUrl);
      } else {
        const existingTab = tabs.find(
          (t) =>
            t?.data?.type === "book" &&
            t?.data?.book?.slice(0, 4)?.toLowerCase() === targetBook
        );

        if (existingTab) {
          const updatedTab = {
            ...existingTab,
            data: {
              ...existingTab.data,
              chapter,
              translation: translationId || bookData.translationId,
            },
          };

          G.UpdateTab(updatedTab);
        } else {
          const tab = {
            id: uuid(),
            taken: false,
            data: {
              use: "thePage",
              type: "book",
              book: bookName,
              bookId: bookData.id,
              chapter,
              translation: translationId || bookData.translationId,
              shortName: G.CurrentBookData?.shortName || "",
            },
          };

          G.AddTab(tab);
          G.UpdateTab(tab);
        }

        G.Open(bookData.id, chapter, translationId, chapterUrl);
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

          if (prevVerse) {
            G.SetHighlighted((prev) => {
              const updated = { ...prev };

              for (let i = prevVerse.start; i <= prevVerse.end; i++) {
                delete updated[
                  `${G.CurrentBookData.book}-${G.CurrentBookData.chapter}-${i}`
                ];
              }

              return updated;
            });
          }

          G.HighlightVerse(verses, "#2E48791A");

          prevVerse = {
            start: startVerse,
            end: endVerse,
          };
        }, 1200);
      }

      // Close Ask Ken app
      setTimeout(() => {
        const activeApp = G.ActiveMoreApp;

        console.log("ActiveMoreApp before remove:", activeApp);
      }, 100);
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => {
        G.BibleNavigationInProgress = false;
      }, 500);
    }
  };

  if (G.IsMobileNow?.()) {
    if (G.ActiveMoreApp) {
      G.RemoveApplicationByLabel(G.ActiveMoreApp);
      G.makingApp = null;
      G.SetActiveMoreApp?.(null);
      G.ActiveMoreApp = null;
    } else {
      G.RemoveApplicationByLabel("ask Ken!");
    }
    setTimeout(executeNavigation, 500);
  } else {
    executeNavigation();
  }
}
