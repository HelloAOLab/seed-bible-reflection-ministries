import type { SeedBibleState } from "seed-bible.app.api";
interface NavigationProps {
  bookName: string;
  chapter: number;
  translationId: string;
  booksData: [];
  seedBibleContext: SeedBibleState;
}

export async function navigateToBibleReference({
  bookName,
  chapter,
  translationId,
  booksData,

  seedBibleContext,
}: NavigationProps) {
  if (!seedBibleContext?.app?.currentReadingState) {
    return;
  }
  const currentReadingState = seedBibleContext.app.currentReadingState.value;
  if (!currentReadingState) {
    return;
  }

  const readingState = currentReadingState.tab.readingState;
  if (!readingState.translationBooks.value) {
    return;
  }
  const { selectTranslation, selectTranslationAndChapter } = readingState;
  const { selectTab, addTab, tabs } = seedBibleContext.tabs;

  const bookId =
    readingState.translationBooks.value.books.find((book) => {
      return book.name?.toLowerCase() === bookName.toLowerCase();
    })?.id ?? null;

  if (!bookId) {
    console.error("Book not found");
    return;
  }

  if (translationId) {
    selectTranslation(translationId);
  }
  const executeNavigation = () => {
    try {
      const currentBook =
        readingState.chapterData.value?.book.name?.toLowerCase();
      const targetBook = bookName?.toLowerCase();
      if (currentBook === targetBook) {
        selectTranslationAndChapter("AAB", bookId, chapter);
      } else {
        const existingTab = tabs.value?.find(
          (tab) =>
            tab.readingState.chapterData.value?.book.name?.toLowerCase() ===
            bookName.toLowerCase()
        );
        if (existingTab) {
          const tabId = existingTab?.id;
          selectTab(tabId);
          existingTab.readingState.selectTranslationAndChapter(
            "AAB",
            bookId,
            chapter
          );
        } else {
          addTab(undefined, {
            initialTranslationId: translationId,
            initialBookId: bookId,
            initialChapterNumber: chapter,
          });
          const addedTab = tabs.value.find(
            (tab) => tab.readingState.bookId.value === bookId
          );
          if (addedTab) {
            console.log(addedTab.readingState);
            console.log(bookId);

            addedTab.readingState.selectTranslationAndChapter(
              "AAB",
              bookId,
              chapter
            );
            selectTab(addedTab.id);
          }
        }
      }
    } catch (err) {
      console.error("Navigation error:", err);
    }
  };
  executeNavigation();
}
