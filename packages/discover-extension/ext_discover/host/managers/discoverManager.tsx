import { signal, type Signal, computed, effect } from "@preact/signals";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import type { ChapterData } from "./ApologistManager";
import { isDiscoveryOpen } from "../extraServices";

export interface UpdateSearchOptions {
  level?: string;
  label?: string;
  baseline?: string;
  chapterData?: ChapterData;
  forceRefresh?: boolean;
}

export interface DiscoverTab {
  key: "media" | "ministries";
  labelKey: string;
}
type DiscoverFilter = "all" | "annotations" | "playlists";

export interface DiscoverState {
  activeTab: Signal<DiscoverTab["key"]>;
  activeFilter: Signal<DiscoverFilter>;

  cameFromDiscovery: Signal<boolean>;

  ministriesUrl: Signal<string>;
  ministriesTitle: Signal<string>;

  searchQuery: Signal<string>;
  searchLevel: Signal<string>;
  searchLabel: Signal<string>;
  isMobile: Signal<boolean>;

  baselineQuery: Signal<string>;
  chapterDataa: Signal<ChapterData | undefined>;

  searchTrigger: Signal<number>;

  tabs: DiscoverTab[];

  openInMinistriesTab: (url: string, title?: string) => void;

  updateSearch: (query: string, options?: UpdateSearchOptions) => void;
}

export function createDiscoverState(context: SeedBibleState): DiscoverState {
  const activeTab = signal<DiscoverTab["key"]>("media");
  const activeFilter = signal<DiscoverFilter>("all");

  if (!context.app.currentReadingState.value) {
    throw new Error("Current reading state is not initialized.");
  }

  const selectedTab = computed(() =>
    context.tabs.tabs.value.find(
      (tab) => tab.id === context.tabs.selectedTabId.value
    )
  );

  const inMobile = context.app.isMobile.value;

  if (!selectedTab) {
    throw new Error("Selected tab not found.");
  }

  const readingState = computed(() => selectedTab.value?.readingState ?? null);
  const currentBook = computed(() => {
    const state = readingState.value;

    if (!state) return null;

    return (
      state.translationBooks.value?.books.find(
        (book) => book.id === state.bookId.value
      ) ?? null
    );
  });

  const chapterNumber = computed(() => {
    return readingState.value?.chapterNumber.value ?? null;
  });

  const chapterData = computed(() => {
    return readingState.value?.chapterData.value ?? null;
  });

  const chapterText = computed(() => {
    const content = chapterData.value?.chapter?.content || [];

    return content
      .filter((item) => item.type === "verse")
      .map((verse) =>
        verse.content
          .map((part) => {
            if (typeof part === "string") {
              return part;
            }

            if (part && typeof part === "object" && "text" in part) {
              return part.text;
            }

            return "";
          })
          .join("")
      )
      .join(" ");
  });

  const cameFromDiscovery = signal(false);

  const ministriesUrl = signal("https://www.kenboa.org/blog/");
  const ministriesTitle = signal("kenBoaBlog");

  const searchQuery = signal(`${chapterText.value} ${chapterNumber.value}`);

  const searchLevel = signal("chapter");

  const searchLabel = signal(
    `${currentBook.value?.name ?? ""} ${chapterNumber.value}`
  );

  const baselineQuery = signal("");
  const isMobile = signal(inMobile);
  const chapterDataa = signal<ChapterData | undefined>(undefined);
  const searchTrigger = signal(0);

  const tabs: DiscoverTab[] = [
    {
      key: "media",
      labelKey: "media",
    },
    {
      key: "ministries",
      labelKey: "reflectionMinistries",
    },
  ];
  effect(() => {
    isDiscoveryOpen.value = true;

    return () => {
      isDiscoveryOpen.value = false;
    };
  });

  effect(() => {
    const text = chapterText.value;
    const label = `${currentBook.value?.name ?? ""} ${chapterNumber.value}`;

    if (text !== searchQuery.value || label !== searchLabel.value) {
      searchQuery.value = text;
      searchLabel.value = label;
      searchTrigger.value++;
    }
  });

  const openInMinistriesTab = (url: string, title?: string) => {
    ministriesUrl.value = url || "";
    ministriesTitle.value = title || "Preview";
    activeTab.value = "ministries";
  };

  const updateSearch = (query: string, options: UpdateSearchOptions = {}) => {
    searchQuery.value = query || "";

    if (options.level) {
      searchLevel.value = options.level;
    }

    if (options.label) {
      searchLabel.value = options.label;
    }

    if (options.baseline) {
      baselineQuery.value = options.baseline;
    }

    if ("chapterData" in options) {
      chapterDataa.value = options.chapterData ?? undefined;
    }

    if (options.forceRefresh) {
      searchTrigger.value++;
    }
  };

  return {
    activeTab,
    activeFilter,
    cameFromDiscovery,
    ministriesUrl,
    ministriesTitle,
    searchQuery,
    searchLevel,
    searchLabel,
    baselineQuery,
    chapterDataa,
    searchTrigger,
    isMobile,
    tabs,
    openInMinistriesTab,
    updateSearch,
  };
}
