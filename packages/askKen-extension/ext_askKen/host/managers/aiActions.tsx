import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import type { ChapterVerse } from "@packages/seed-bible/seed-bible/managers";
import type { BibleReadingState } from "@packages/seed-bible/seed-bible/managers";
import { askKenOpen } from "../askKenService";
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
    const isMobile = seedBibleContext.app.isMobile.value;
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
    if (isMobile) {
      askKenOpen.value = false;
    }

    return false;
  }

  return {
    handleAIAction,
  };
}

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
  const isMobile = seedBibleContext.app.isMobile.value;

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

export function bibleRefrenceParser(text: string) {
  const regex =
    /\b((?:[1-3]\s)?(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|(?:1|2)\s+samuel|(?:1|2)\s+kings|(?:1|2)\s+chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song of songs|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|(?:1|2)\s+corinthians|galatians|ephesians|philippians|colossians|(?:1|2)\s+thessalonians|(?:1|2)\s+timothy|titus|philemon|hebrews|james|(?:1|2)\s+peter|(?:1|2|3)\s+john|jude|revelation))\s+(\d+)(?::(\d+)(?:[-‐-‒–—](\d+))?)?/gi;

  return [...text.matchAll(regex)].map((match) => ({
    full: match[0],
    book: match[1]?.trim(),
    chapter: Number(match[2]),
    verse: match[3] ? Number(match[3]) : null,
    endVerse: match[4] ? Number(match[4]) : null,
  }));
}
export function parseTranslation(text: string) {
  const translations = [
    {
      id: "AAB",
      shortName: "AAB",
      fullName: "Accessible Ancients Bible",
    },
    {
      id: "eng_asv",
      shortName: "ASV",
      fullName: "American Standard Version (1901)",
    },
    {
      id: "AMP",
      shortName: "AMP",
      fullName: "Amplified Bible",
    },
    {
      id: "BSB",
      shortName: "BSB",
      fullName: "Berean Standard Bible",
    },
    {
      id: "eng_bbe",
      shortName: "BBE",
      fullName: "Bible in Basic English",
    },
    {
      id: "eng_dby",
      shortName: "DBY",
      fullName: "Darby Translation",
    },
    {
      id: "eng_dra",
      shortName: "DRA",
      fullName: "Douay-Rheims 1899",
    },
    {
      id: "eng_fbv",
      shortName: "FBV",
      fullName: "Free Bible Version",
    },
    {
      id: "eng_gnv",
      shortName: "GNV",
      fullName: "Geneva Bible 1599",
    },
    {
      id: "eng_kjv",
      shortName: "KJAV",
      fullName: "King James (Authorized) Version",
    },
    {
      id: "eng_kja",
      shortName: "KJVA",
      fullName: "King James Version + Apocrypha",
    },
    {
      id: "eng_cpb",
      shortName: "KJVCP",
      fullName: "KJV Cambridge Paragraph Bible",
    },
    {
      id: "eng_lsv",
      shortName: "LSV",
      fullName: "Literal Standard Version",
    },
    {
      id: "eng_msb",
      shortName: "MSB",
      fullName: "Majority Standard Bible",
    },
    {
      id: "eng_net",
      shortName: "NETB",
      fullName: "NET Bible",
    },
    {
      id: "NASB1995",
      shortName: "NASB95",
      fullName: "New American Standard Bible (1995)",
    },
    {
      id: "NASB2020",
      shortName: "NASB2020",
      fullName: "New American Standard Bible (2020)",
    },
    {
      id: "eng_wbs",
      shortName: "NWB",
      fullName: "Noah Webster Bible",
    },
    {
      id: "eng_rv5",
      shortName: "RVA",
      fullName: "Revised Version with Apocrypha (1895)",
    },
    {
      id: "eng_ojb",
      shortName: "TOJB",
      fullName: "The Orthodox Jewish Bible",
    },
  ];

  const upperText = text.toUpperCase();

  return translations.find(
    (translation) =>
      upperText.includes(translation.shortName.toUpperCase()) ||
      upperText.includes(translation.fullName.toUpperCase())
  );
}
