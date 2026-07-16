import { signal, type Signal, computed, effect } from "@preact/signals";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
import type { ChapterData } from "./ApologistManager";
import { useEffect } from "preact/hooks";
import { isDiscoveryOpen } from "../extraServices";

export interface UpdateSearchOptions {
  level?: string;
  label?: string;
  baseline?: string;
  chapterData?: ChapterData;
  forceRefresh?: boolean;
}
interface ApologistTab {
  key: "discovery" | "ministries";
  label: string;
  icon: string;
}

export interface ApologistPanelState {
  activeTab: Signal<string>;

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

  tabs: ApologistTab[];

  openInMinistriesTab: (url: string, title?: string) => void;

  updateSearch: (query: string, options?: UpdateSearchOptions) => void;
}

export function CreateApologistState(
  context: SeedBibleState
): ApologistPanelState {
  const activeTab = signal("discovery");
  const { t } = useI18n("ext_discovery");
  if (!context.app.currentReadingState.value) {
    throw new Error("Current reading state is not initialized.");
  }
  const inMobile = context.app.isMobile.value;

  const readingState = context.app.currentReadingState.value.tab.readingState;

  // eslint-disable-next-line no-unsafe-optional-chaining
  const { bookId, translationBooks, chapterNumber, chapterData } = readingState;
  const currentBook = computed(
    () =>
      translationBooks.value?.books.find((book) => book.id === bookId.value) ??
      null
  );
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
  useEffect(() => {
    isDiscoveryOpen.value = true;

    return () => {
      isDiscoveryOpen.value = false;
    };
  }, []);
  const cameFromDiscovery = signal(false);

  const ministriesUrl = signal("https://www.kenboa.org/blog/");

  const ministriesTitle = signal("Ken Boa Blog");

  const searchQuery = signal(`${chapterText.value} ${chapterNumber.value}`);

  const searchLevel = signal("chapter");

  const searchLabel = signal(
    `${currentBook.value?.name ?? ""} ${chapterNumber.value}`
  );

  const baselineQuery = signal("");
  const isMobile = signal(inMobile);

  const chapterDataa = signal<ChapterData | undefined>(undefined);

  const searchTrigger = signal(0);
  const tabs: ApologistTab[] = [
    {
      key: "discovery",
      label: t("discovery"),
      icon: "explore",
    },
    {
      key: "ministries",
      label: t("reflectionMinistries"),
      icon: "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png",
    },
  ];
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
