import { type Signal, type ReadonlySignal } from "@preact/signals";
import type {
  Annotation,
  SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";
import type { ChapterData } from "./ApologistManager";
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
  annotationsForChapter: ReadonlySignal<Annotation[]>;
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
export declare function createDiscoverState(
  context: SeedBibleState
): DiscoverState;
export {};
