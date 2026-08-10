import type { Signal } from "@preact/signals";
export function getDomain(url?: string | null): string {
  if (!url) {
    return "";
  }

  try {
    let normalizedUrl = url;

    if (!/^https?:\/\//i.test(normalizedUrl)) {
      normalizedUrl = "http://" + normalizedUrl;
    }

    let hostname = new URL(normalizedUrl).hostname;

    hostname = hostname.replace(/^www\./, "");

    return hostname;
  } catch {
    return "";
  }
}

export function formatDateISO(dateString?: string | null): string | null {
  if (!dateString) {
    return null;
  }

  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return null;
  }
}

export function formatDomain(domain?: string | null): string {
  if (!domain) {
    return "";
  }

  if (domain.includes("tabletalkmagazine.com")) {
    return "TableTalk Magazine";
  }

  if (domain.includes("learn.ligonier.org")) {
    return "Ligonier";
  }

  return domain;
}
export interface EmbeddableItem {
  url?: string | null;
  type?: string | null;
}
export function toEmbeddableUrl(item: EmbeddableItem): string {
  const url = item?.url || "";

  if (!url) {
    return "";
  }

  if (
    item.type === "youtube" ||
    /youtube\.com\/watch\?v=|youtu\.be\//i.test(url)
  ) {
    const idMatch =
      url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);

    const videoId = idMatch?.[1] || null;

    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  }

  return url;
}
export function getYouTubeId(url: string) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}
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
import { signal } from "@preact/signals";

import { useEffect, useRef } from "preact/hooks";

export function createCardState(props: SgCardProps): CardState {
  const previewH = signal(0);

  const frameKey = signal(0);

  const videoError = signal(false);

  const previewRef = useRef<HTMLDivElement | null>(null);

  const domain = getDomain(props.item.referral_url);

  const formattedDomain = formatDomain(domain);

  const date =
    formatDateISO(props.item.published_on) ||
    formatDateISO(props.item.created_at);

  const icon = props.item.image_url || "";

  const embUrl = toEmbeddableUrl(props.item);
  const isBook = props.item.type === "book";
  const isUrl = props.item.type === "url";
  const isYoutube = props.item.type === "youtube";
  const isEpisode = props.item.type === "episode";

  const videoSrc =
    props.item.type === "youtube" && embUrl
      ? `${embUrl}${embUrl.includes("?") ? "&" : "?"}autoplay=1&mute=1`
      : "";

  const openInNewTab = (e: Event) => {
    e.preventDefault();

    const previewUrl =
      props.item.url || props.item.referral_url || props.item.listing_url;

    if (previewUrl && props.openInMinistriesTab && !isBook) {
      props.cameFromDiscovery.value = true;

      props.openInMinistriesTab(previewUrl, props.item.title);

      props.linkOpenId.value = props.item.id;
    } else {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
      props.linkOpenId.value = props.item.id;
    }
  };
  const canPreview = !isYoutube && (!!props.item.image_url || isUrl);
  const desc =
    props.item?.description ??
    props.item?.summary ??
    props.item?.snippet ??
    props.item?.excerpt ??
    "";
  const url = props.item.url || props.item.referral_url;

  useEffect(() => {
    if (previewRef.current) {
      previewH.value = previewRef.current.scrollHeight || 0;
    }
  }, []);
  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        frameKey.value++;
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return {
    previewH,
    frameKey,
    videoError,
    previewRef,
    date,
    domain,
    formattedDomain,
    icon,
    embUrl,
    isBook,
    isYoutube,
    isUrl,
    isEpisode,
    videoSrc,
    canPreview,
    openInNewTab,
    desc,
    url,
  };
}
