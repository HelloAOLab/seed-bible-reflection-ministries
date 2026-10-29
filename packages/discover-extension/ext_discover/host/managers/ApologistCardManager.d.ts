import type { Signal } from "@preact/signals";
export declare function getDomain(url?: string | null): string;
export declare function formatDateISO(
  dateString?: string | null
): string | null;
export declare function formatDomain(domain?: string | null): string;
export interface EmbeddableItem {
  url?: string | null;
  type?: string | null;
}
export declare function toEmbeddableUrl(item: EmbeddableItem): string;
export declare function getYouTubeId(url: string): string | null | undefined;
export interface ResourceItem {
  published_on?: string;
  created_at?: string;
  image_url?: string;
  type: "book" | "url" | "youtube" | "episode";
  url: string;
  id: string;
  referral_url: string;
  listing_url: string;
  title: string;
  description?: string;
  summary?: string;
  snippet?: string;
  excerpt?: string;
}
export interface SgCardProps {
  item: ResourceItem;
  isOpen: boolean;
  isNowPlaying: boolean;
  isActive: boolean;
  isLinkOpen: boolean;
  onClose?: () => void;
  linkOpenId: Signal<string | null>;
  nowPlayingId: Signal<string | null>;
  activeCardId: Signal<string | null>;
  cameFromDiscovery: Signal<boolean>;
  openInMinistriesTab: (url: string, title?: string) => void;
}
export interface CardState {
  previewH: Signal<number>;
  frameKey: Signal<number>;
  previewRef: ReturnType<typeof useRef<HTMLDivElement | null>>;
  date: string | null;
  domain: string;
  formattedDomain: string;
  icon: string;
  videoError: Signal<boolean>;
  embUrl: string;
  isBook: boolean;
  isYoutube: boolean;
  isUrl: boolean;
  isEpisode: boolean;
  videoSrc: string;
  canPreview: boolean;
  openInNewTab: (e: Event) => void;
  desc: string;
  url: string;
}
import { useRef } from "preact/hooks";
export declare function createCardState(props: SgCardProps): CardState;
