import { type ChapterData } from "../managers";
import { Signal } from "@preact/signals";
interface ApologistProps {
  searchQuery: Signal<string>;
  searchTrigger: Signal<number>;
  searchLevel: Signal<string>;
  searchLabel: Signal<string>;
  baselineQuery: Signal<string>;
  chapterData: Signal<ChapterData | undefined>;
  cameFromDiscovery: Signal<boolean>;
  openInMinistriesTab: (url: string, title?: string) => void;
}
export declare function Apologist(
  props: ApologistProps
): import("preact").JSX.Element;
export {};
