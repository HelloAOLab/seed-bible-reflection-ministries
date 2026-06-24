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
  seedBibleContext,
}: NavigationProps) {
  if (!seedBibleContext?.app?.currentReadingState.value) {
    return;
  }
  const currentReadingState = seedBibleContext.app.currentReadingState.value;

  const readingState = currentReadingState.tab.readingState;
  if (!readingState.translationBooks.value) {
    return;
  }
  const { selectTranslationAndChapter } = readingState;
  const { addTab, tabs } = seedBibleContext.tabs;
  const { selectTab } = seedBibleContext.app;

  const bookId =
    readingState.translationBooks.value.books.find((book) => {
      return book.name?.toLowerCase() === bookName.toLowerCase();
    })?.id ?? null;

  if (!bookId) {
    console.error("Book not found");
    return;
  }

  try {
    const currentBook = readingState.bookId.value;
    const targetBook = bookId;
    if (currentBook === targetBook) {
      await selectTranslationAndChapter(translationId, bookId, chapter);
    } else {
      let existingTab = tabs.value?.find(
        (tab) => tab.readingState.bookId.value === bookId
      );
      if (!existingTab) {
        existingTab = addTab(undefined, {
          initialTranslationId: translationId,
          initialBookId: bookId,
          initialChapterNumber: chapter,
        });
      } else {
        await existingTab.readingState.selectTranslationAndChapter(
          translationId,
          bookId,
          chapter
        );
      }

      selectTab(existingTab.id);
    }
  } catch (err) {
    console.error("Navigation error:", err);
  }
}
