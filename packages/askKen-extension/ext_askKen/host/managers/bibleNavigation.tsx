import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import type { ChapterVerse } from "@packages/seed-bible/seed-bible/managers";
import type { BibleReadingState } from "@packages/seed-bible/seed-bible/managers";
import { askKenOpen } from "../askKenService";
interface NavigationProps {
  bookName: string | null;
  chapter: number | null;
  translationId: string;
  seedBibleContext: SeedBibleState;
  verseNumber: number | null;
  endVerseNumber: number | null;
}
const selectVerseRange = (
  readingState: BibleReadingState,
  bookId: string,
  chapter: number,
  translationId: string,

  startVerse: number,
  endVerse: number
) => {
  const versesToSelect =
    readingState.chapterData.value?.chapter.content.filter(
      (item): item is ChapterVerse =>
        item.type === "verse" &&
        item.number >= startVerse &&
        item.number <= endVerse
    ) ?? [];

  versesToSelect.forEach((verse) => {
    const selectedVerse = {
      bookId,
      chapterNumber: chapter,
      translationId,
      verse,
    };

    const isSelected = readingState.selectedVerses.value.some(
      (v) =>
        v.bookId === bookId &&
        v.chapterNumber === chapter &&
        v.translationId === translationId &&
        v.verse.number === verse.number
    );

    if (!isSelected) {
      // Select
      readingState.selectVerse(
        selectedVerse,
        window.innerWidth / 2,
        window.innerHeight / 2
      );

      // Auto-deselect after 10 seconds
      setTimeout(() => {
        const stillSelected = readingState.selectedVerses.value.some(
          (v) =>
            v.bookId === bookId &&
            v.chapterNumber === chapter &&
            v.translationId === translationId &&
            v.verse.number === verse.number
        );

        if (stillSelected) {
          readingState.selectVerse(selectedVerse, 0, 0);
        }
      }, 10000);
    }
  });
};

export async function navigateToBibleReference({
  bookName,
  chapter,
  translationId,

  seedBibleContext,
  verseNumber,

  endVerseNumber,
}: NavigationProps) {
  if (!seedBibleContext?.app?.currentReadingState.value) {
    return;
  }
  console.log("navigation");
  const isMobile = seedBibleContext.app.isMobile.value;
  console.log(isMobile, "ismob");

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
      return book.name?.toLowerCase() === bookName!.toLowerCase();
    })?.id ?? null;

  if (!bookId) {
    console.error("Book not found");
    return;
  }
  if (isMobile) {
    askKenOpen.value = false;
  }

  try {
    const startVerse = verseNumber ? Number(verseNumber) : 1;
    const endVerse = endVerseNumber ? Number(endVerseNumber) : startVerse;
    const currentBook = readingState.bookId.value;

    const targetBook = bookId;
    if (currentBook === targetBook) {
      await selectTranslationAndChapter(translationId, bookId, chapter!, {
        scrollToVerse: startVerse,
      });
      selectVerseRange(
        readingState,
        bookId,
        chapter!,
        translationId,
        startVerse,
        endVerse
      );
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
        selectTab(existingTab.id);
        await existingTab.readingState.selectTranslationAndChapter(
          translationId,
          bookId,
          chapter!,
          { scrollToVerse: startVerse }
        );
        selectVerseRange(
          existingTab.readingState,
          bookId,
          chapter!,
          translationId,
          startVerse,
          endVerse
        );
      } else {
        selectTab(existingTab.id);
        await existingTab.readingState.selectTranslationAndChapter(
          translationId,
          bookId,
          chapter!,
          { scrollToVerse: startVerse }
        );
        selectVerseRange(
          existingTab.readingState,
          bookId,
          chapter!,
          translationId,
          startVerse,
          endVerse
        );
      }
    }
  } catch (err) {
    console.error("Navigation error:", err);
  }
}
