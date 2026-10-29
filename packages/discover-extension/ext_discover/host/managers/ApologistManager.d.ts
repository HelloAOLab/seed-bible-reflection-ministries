import { type Signal } from "@preact/signals";
interface ResourceItem {
  published_on?: string;
  created_at?: string;
  image_url?: string;
  type: "book" | "url" | "youtube" | "episode";
  url: string;
  id: string;
  referral_url: string;
  listing_url: string;
  title: string;
  Name: string;
  description?: string;
  summary?: string;
  snippet?: string;
  excerpt?: string;
}
interface Verse {
  text?: string;
  number?: number | string;
  verseNumber?: number | string;
}
interface Section {
  heading?: string;
  title?: string;
  name?: string;
  verses?: Verse[];
}
export interface ChapterData {
  content?: Section[];
  combinedText: string;
  book: string;
  chapter: number;
  number: number;
  translation: string;
}
export interface ApologistState {
  data: Signal<ResourceItem[]>;
  loading: Signal<boolean>;
  err: Signal<string>;
  openIds: Signal<Set<string>>;
  searchParam: Signal<string>;
  searchRunId: Signal<number>;
  hasMore: Signal<boolean>;
  loadingMore: Signal<boolean>;
  displayedCount: Signal<number>;
  allData: Signal<ResourceItem[]>;
  activeCardId: Signal<string | null>;
  headerLabel: Signal<string>;
  nowPlayingId: Signal<string | null>;
  linkOpenId: Signal<string | null>;
  lastSearchKeyRef: {
    current: string | null;
  };
  lastResultKeysRef: {
    current: Set<string>;
  };
  debounceRef: {
    current: ReturnType<typeof setTimeout> | null;
  };
  isFirstLoadRef: {
    current: boolean;
  };
  baselineQueryRef: {
    current: string;
  };
  baselineResultKeysRef: {
    current: Set<string>;
  };
  resolvedLevel: string;
  isVerseLevel: boolean;
  currentBaselineQuery: string;
  showResetControl: boolean;
  loadMoreRef: {
    current: HTMLDivElement | null;
  };
  fetchResults: () => Promise<void>;
  loadMore: () => void;
  handleResetToBaseline: () => void;
  buildResultKey: (item: ResourceItem) => string | null;
  retry: () => void;
}
export declare function createApologistState(props: {
  searchQuery: Signal<string>;
  searchTrigger: Signal<number>;
  searchLevel: Signal<string>;
  searchLabel: Signal<string>;
}): ApologistState;
export {};
