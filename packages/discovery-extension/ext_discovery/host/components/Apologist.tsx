import { createApologistState, type ChapterData } from "../managers";
import { SgCard } from "./ApologistCards";
import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
import type { ComponentChildren } from "preact";
import { useRef, useEffect, useState, useMemo } from "preact/hooks";
interface Props {
  children: ComponentChildren;
}

import { Signal } from "@preact/signals";
function LazyCard({ children }: Props) {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (isVisible) return children;

  return (
    <div
      ref={placeholderRef}
      className="sg-card-placeholder"
      style={{
        minHeight: "120px",
        borderRadius: "10px",
        background: "var(--inputBackground, #1e1e1e)",
        opacity: 0.4,
      }}
    />
  );
}

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

export function Apologist(props: ApologistProps) {
  const { t } = useI18n("ext_discovery");
  const state = useMemo(
    () => createApologistState(props),
    [
      props.searchQuery.value,
      props.searchTrigger.value,
      props.searchLevel.value,
      props.searchLabel.value,
    ]
  );

  const {
    data,
    loading,
    err,

    openIds,
    searchParam,

    hasMore,
    loadingMore,

    activeCardId,

    nowPlayingId,
    linkOpenId,
    handleResetToBaseline,
    loadMoreRef,
    buildResultKey,
    showResetControl,
    retry,
  } = state;

  if (loading.value && data.value.length === 0) {
    return (
      <div className={`sg-searchWrap `}>
        <div className={`sg-results sg-list`}>
          {/* Article-style skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={`a${i}`}
              className="sg-skeleton-card sg-skeleton-article"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="sg-skeleton-row">
                <div className="sg-skeleton-circle" />
                <div className="sg-skeleton-bar" style={{ width: "80px" }} />
                <div className="sg-skeleton-dot" />
                <div className="sg-skeleton-bar" style={{ width: "60px" }} />
                <div style={{ flex: 1 }} />
                <div className="sg-skeleton-icon" />
              </div>
              <div
                className="sg-skeleton-bar sg-skeleton-title"
                style={{ width: `${65 + i * 5}%` }}
              />
            </div>
          ))}
          {/* Book-style skeletons */}
          {[1, 2].map((i) => (
            <div
              key={`b${i}`}
              className="sg-skeleton-card sg-skeleton-book"
              style={{ animationDelay: `${(4 + i) * 0.1}s` }}
            >
              <div className="sg-skeleton-cover" />
              <div
                className="sg-skeleton-bar sg-skeleton-title"
                style={{ width: "60%", margin: "0 auto" }}
              />
              <div className="sg-skeleton-pill" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (err.value) {
    return (
      <div className="sg-error">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "36px", opacity: 0.7 }}
        >
          cloud_off
        </span>
        <b>Search error:</b> {err.value}
        <button className="sg-retry-btn" onClick={retry}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "16px" }}
          >
            refresh
          </span>
          Retry
        </button>
        <div className="sg-muted sg-small">
          If a preview is blocked, use "Open".
        </div>
      </div>
    );
  }

  return (
    <div className={`sg-searchWrap `}>
      <div className="sg-header">
        {data.value.length > 0 && (
          <div className="sg-headerTop">
            {showResetControl && (
              <button
                type="button"
                className="material-symbols-outlined sg-resetBtn"
                onClick={handleResetToBaseline}
              >
                arrow_back
              </button>
            )}

            <div className="sg-resultCount">
              {data.value.length} {t("results")}
            </div>
          </div>
        )}
      </div>

      <div className={`sg-results sg-list `}>
        {data.value.length > 0 ? (
          <>
            {data.value.map((item, index) => {
              const key =
                buildResultKey(item) ||
                item?.id ||
                item?.url ||
                `fallback-${index}`;

              return (
                <LazyCard key={key}>
                  <SgCard
                    item={item}
                    key={key}
                    isOpen={
                      nowPlayingId.value === item.id
                        ? true
                        : openIds.value.has(item.id)
                    }
                    isNowPlaying={nowPlayingId.value === item.id}
                    onClose={
                      nowPlayingId.value === item.id
                        ? () => (nowPlayingId.value = null)
                        : undefined
                    }
                    isActive={activeCardId.value === item.id}
                    isLinkOpen={linkOpenId.value === item.id}
                    linkOpenId={linkOpenId}
                    nowPlayingId={nowPlayingId}
                    activeCardId={activeCardId}
                    openInMinistriesTab={props.openInMinistriesTab}
                    cameFromDiscovery={props.cameFromDiscovery}
                  />
                </LazyCard>
              );
            })}

            {hasMore.value && (
              <div ref={loadMoreRef} className="sg-loadMore">
                {loadingMore.value && <div className="sg-spinner" />}
              </div>
            )}
          </>
        ) : (
          !loading.value &&
          searchParam.value &&
          data.value.length === 0 && (
            <div className="sg-empty">
              <div className="sg-emptyIcon">🔎</div>

              <div className="sg-emptyTitle">{t("noContent")}</div>

              <div className="sg-emptyHint">{t("noResources")}</div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
