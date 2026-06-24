import { signal, type Signal, computed, effect } from "@preact/signals";
import type { SeedBibleState } from "seed-bible.app.api";
import { useI18n } from "seed-bible.i18n.I18nManager";

export interface UpdateSearchOptions {
  level?: string;
  label?: string;
  baseline?: string;
  chapterData?: any;
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

  baselineQuery: Signal<string>;
  chapterDataa: Signal<any>;

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

  const readingState = context.app.currentReadingState.value.tab.readingState;
  console.log(
    context.app.currentReadingState.value,
    " context.app.currentReadingState.value"
  );

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

  console.log(chapterText.value, "chaptertact");
  console.log(
    bookId.value,
    chapterNumber.value,
    translationBooks.value,
    currentBook.value.name,
    "currt"
  );

  const cameFromDiscovery = signal(false);

  const ministriesUrl = signal("https://www.kenboa.org/blog/");

  const ministriesTitle = signal("Ken Boa Blog");

  const searchQuery = signal(`${chapterText.value} ${chapterNumber.value}`);

  const searchLevel = signal("chapter");

  const searchLabel = signal(
    `${currentBook.value.name} ${chapterNumber.value}`
  );

  const baselineQuery = signal("");

  const chapterDataa = signal(null);

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
    const label = `${currentBook.value.name} ${chapterNumber.value}`;

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
      chapterDataa.value = options.chapterData || null;
    }

    if (options.forceRefresh) {
      searchTrigger.value++;
    }
  };
  console.log("rerendering");

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
    tabs,
    openInMinistriesTab,
    updateSearch,
  };
}
