const { useSideBarContext } = await import("app.hooks.sideBar");
const { useEffect, useState, useMemo, useRef } = os.appHooks;
const getStyleOf = await thisBot.GetStyle();

function formatDateISO(s) {
  if (!s) return null;
  try {
    return new Date(s).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return null;
  }
}

// function Chips({ items }) {
//     if (!items || !items.length) return null;
//     return (
//         <div className="sg-chips">
//             {items.map((k, i) => <span className="sg-chip" key={`${k}-${i}`}>{k}</span>)}
//         </div>
//     );
// }

// function pill(text) { return text ? <span className="sg-pill">{text}</span> : null; }

function getDomain(u) {
  if (!u) return "";

  try {
    if (!/^https?:\/\//i.test(u)) {
      u = "http://" + u;
    }

    let hostname = new URL(u).hostname;

    // Remove leading "www."
    hostname = hostname.replace(/^www\./, "");

    return hostname;
  } catch {
    return "";
  }
}

function formatDomain(domain) {
  if (!domain) return "";

  // Map specific domains to friendly names
  if (domain.includes("tabletalkmagazine.com")) return "TableTalk Magazine";
  if (domain.includes("learn.ligonier.org")) return "Ligonier";

  // Return domain as-is for others
  return domain;
}

const TYPE_ORDER = {
  youtube: 0,
  episode: 10,
  url: 20,
  book: 30,
};

const SOURCE_PRIORITY = {
  youtube: 0,
  tabletalk: 1,
  ligonier: 2,
  default: 5,
};

const TITLE_WHITESPACE_REGEX = /\s+/g;

function normalizeTitleValue(value) {
  if (!value) return "";
  return value.trim().replace(TITLE_WHITESPACE_REGEX, " ").toLowerCase();
}

function getPrimaryUrl(item) {
  return item?.url || item?.referral_url || item?.listing_url || "";
}

function getResultDomain(item) {
  const domain = getDomain(getPrimaryUrl(item));
  return domain ? domain.toLowerCase() : "";
}

function computeResultRank(item) {
  const type = (item?.type || "").toLowerCase();
  if (type === "youtube") {
    return SOURCE_PRIORITY.youtube;
  }

  const domain = getResultDomain(item);
  if (domain.includes("tabletalkmagazine.com")) {
    return SOURCE_PRIORITY.tabletalk;
  }
  if (domain.includes("ligonier.org")) {
    return SOURCE_PRIORITY.ligonier;
  }

  return SOURCE_PRIORITY.default + (TYPE_ORDER[type] ?? 50);
}

function compareResults(a, b) {
  const rankDiff = computeResultRank(a) - computeResultRank(b);
  if (rankDiff !== 0) return rankDiff;

  const typeDiff =
    (TYPE_ORDER[(a?.type || "").toLowerCase()] ?? 100) -
    (TYPE_ORDER[(b?.type || "").toLowerCase()] ?? 100);
  if (typeDiff !== 0) return typeDiff;

  const titleA = normalizeTitleValue(a?.title || a?.Name || "");
  const titleB = normalizeTitleValue(b?.title || b?.Name || "");
  if (titleA < titleB) return -1;
  if (titleA > titleB) return 1;
  return 0;
}

function dedupeResults(results) {
  const seenIds = new Set();
  const seenTitles = new Map();
  const deduped = [];

  results.forEach((item) => {
    if (item?.id) {
      if (seenIds.has(item.id)) return;
      seenIds.add(item.id);
    }

    const normalizedTitle = normalizeTitleValue(
      item?.title || item?.Name || ""
    );

    if (!normalizedTitle) {
      deduped.push(item);
      return;
    }

    const candidatePriority = computeResultRank(item);

    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.set(normalizedTitle, {
        index: deduped.length,
        priority: candidatePriority,
      });
      deduped.push(item);
      return;
    }

    const existing = seenTitles.get(normalizedTitle);

    if (candidatePriority < existing.priority) {
      deduped[existing.index] = item;
      existing.priority = candidatePriority;
    }
  });

  return deduped;
}

function buildResultKey(item) {
  if (!item) return null;
  if (item.id) {
    return `id:${item.id}`;
  }
  const titleKey = normalizeTitleValue(item?.title || item?.Name || "");
  if (!titleKey) return null;
  const domain = getResultDomain(item);
  return `title:${titleKey}|domain:${domain}`;
}

// function getFavicon(u) {
//     const d = getDomain(u);
//     if (!d) return null;
//     // lightweight favicon service (works for most sites)
//     return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
// }

function toEmbeddableUrl(item) {
  const url = item?.url || "";
  if (!url) return "";
  if (
    item.type === "youtube" ||
    /youtube\.com\/watch\?v=|youtu\.be\//i.test(url)
  ) {
    const idMatch =
      url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?&]+)/);
    const vid = idMatch ? idMatch[1] : null;
    return vid ? `https://www.youtube.com/embed/${vid}` : url;
  }
  return url;
}

function SgCard({
  item,
  isOpen,

  isNowPlaying,

  setNowPlayingId,
  onClose,
  isPinned,
  isActive,
  setActiveCardId,
  setlinkOpenId,
  isLinkOpen,
  setcameFromDiscovery,
}) {
  const [previewH, setPreviewH] = useState(0);
  const previewRef = useMemo(() => ({ el: null }), []);
  const [frameKey, setFrameKey] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const date =
    formatDateISO(item.published_on) || formatDateISO(item.created_at) || null;

  const domain = useMemo(
    () => getDomain(item.referral_url),
    [item.referral_url]
  );
  const formattedDomain = useMemo(() => formatDomain(domain), [domain]);
  const icon = useMemo(() => item.image_url, [item.image_url]);

  const isBook = item.type === "book";
  const isUrl = item.type === "url";
  const isYoutube = item.type === "youtube";
  const isEpisode = item.type === "episode";
  const isTableTalk = domain?.includes("tabletalkmagazine.com") || false;

  // Helper to extract YouTube ID
  const getYouTubeId = (url) => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
    );
    return match ? match[1] : null;
  };

  const openInNewTab = (e) => {
    e.preventDefault();

    const previewUrl = item.url || item.referral_url || item.listing_url;

    if (item.type === "book") {
      window.open(previewUrl, "_blank", "noopener");
      return;
    }

    if (previewUrl && globalThis.ApologistOpenInMinistriesTab) {
      globalThis.ApologistOpenInMinistriesTab(
        previewUrl,
        item.title || "Preview"
      );
      setcameFromDiscovery?.(true);
      setlinkOpenId?.(item.id);
    } else {
      window.open(previewUrl, "_blank", "noopener");
    }
  };

  const embUrl = useMemo(
    () => toEmbeddableUrl(item),
    [item.listing_url, item.type, item.url]
  );
  const videoSrc = useMemo(() => {
    if (!isYoutube || !embUrl) return "";
    const separator = embUrl.includes("?") ? "&" : "?";
    return `${embUrl}${separator}autoplay=1&mute=1&rel=0`;
  }, [embUrl, isYoutube]);
  const canPreview = !isYoutube && (!!item.image_url || isUrl);

  const showBorder = isActive && !isYoutube;

  const renderYoutubePlayer = () => {
    // Show error state if video failed to load
    if (videoError) {
      return (
        <div className="sg-previewVideo">
          <div className="sg-media-unavailable">
            <span className="material-symbols-outlined">videocam_off</span>
            <span>Video unavailable</span>
          </div>
        </div>
      );
    }

    // Explicitly play this video if it is the "now playing" item
    if (isNowPlaying && videoSrc) {
      return (
        <div className="sg-previewVideo">
          <iframe
            key={frameKey}
            src={videoSrc}
            title={item.title || "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share;fu"
            referrerpolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onError={() => setVideoError(true)}
          />
        </div>
      );
    }

    // Otherwise show thumbnail with play overlay
    return (
      <div className="sg-previewVideo">
        <button
          className="sg-previewVideoButton"
          onClick={() => {
            setVideoError(false);
            setFrameKey((k) => k + 1);
            setNowPlayingId?.(item.id);
            setActiveCardId?.(null);
          }}
          aria-label={`Play ${item.title || "video"}`}
        >
          {(() => {
            let thumbUrl = item.image_url;
            // If item is youtube, try to get better thumb or fallback if missing
            if (isYoutube) {
              const ytId = getYouTubeId(item.url || item.referral_url);
              if (ytId)
                thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
            }

            if (thumbUrl) {
              return (
                <img className="sg-previewVideoThumb" src={thumbUrl} alt="" />
              );
            }
            return (
              <div
                className="sg-previewVideoThumb sg-previewVideoThumb--fallback"
                aria-hidden="true"
              />
            );
          })()}

          <span className="sg-videoPlayIcon">
            <svg
              width="60"
              height="60"
              viewBox="0 0 60 60"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="30" cy="30" r="30" fill="rgba(0,0,0,0.6)" />
              <path d="M40 30L25 39V21L40 30Z" fill="white" />
            </svg>
          </span>
        </button>
      </div>
    );
  };

  // short description (whatever exists in payload)
  const desc =
    item.description || item.summary || item.snippet || item.excerpt || "";

  useEffect(() => {
    if (previewRef.el) {
      const h = previewRef.el.scrollHeight || 0;
      setPreviewH(h > 8 ? h : 8);
    }
  }, [isOpen, frameKey, item.url]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) setFrameKey((k) => k + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const url = item.url || item.referral_url;

  // ── Book cover layout ──
  if (isBook) {
    return url ? (
      <article
        className={`sg-card sg-card-book-cover `}
        style={{ padding: "16px", height: "auto" }}
      >
        {item.image_url && (
          <div className="sg-book-cover-img-wrap">
            <img
              className="sg-book-cover-img"
              src={item.image_url}
              alt={item.title || "Book cover"}
            />
          </div>
        )}
        <div className="sg-book-cover-footer">
          {item.title && <h3 className="sg-book-cover-title">{item.title}</h3>}

          <a
            href={url}
            className="sg-book-cover-btn"
            onClick={openInNewTab}
            title="Open in Reflection Ministries"
            aria-label="Open in Reflection Ministries"
            style={{ color: "#fff", textDecoration: "none" }}
          >
            {t("Buy Book")}
            <svg
              width="14"
              height="14"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M1 12C0.733333 12 0.5 11.9 0.3 11.7C0.1 11.5 0 11.2667 0 11V1C0 0.733333 0.1 0.5 0.3 0.3C0.5 0.1 0.733333 0 1 0H5.65V1H1V11H11V6.35H12V11C12 11.2667 11.9 11.5 11.7 11.7C11.5 11.9 11.2667 12 11 12H1ZM4.36667 8.35L3.66667 7.63333L10.3 1H6.65V0H12V5.35H11V1.71667L4.36667 8.35Z"
                fill="currentColor"
                style={{ fill: "currentColor" }}
              />
            </svg>
          </a>
        </div>
      </article>
    ) : null;
  }

  // ── Standard (non-book) card layout ──
  return (
    <article
      className={`sg-card 
 
   ${isActive && !isYoutube ? "sg-open-bordered" : ""} 
  ${isOpen ? "is-open" : ""} 
  ${isNowPlaying && isPinned ? "sg-now-playing-card" : ""}
`}
    >
      <header className="sg2-head">
        <div className="sg2-headLeft">
          {icon ? (
            <img className="sg2-favicon" src={icon} alt="" />
          ) : (
            <span className="sg2-favicon sg2-fallback" />
          )}
          <span className="sg2-domain" title={domain}>
            {isYoutube
              ? "YouTube"
              : isEpisode
                ? "Episode"
                : formattedDomain || "external"}
          </span>
          {date && (
            <>
              <span className="sg2-dot" />
              <span className="sg2-calendar">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.25 10C1.05 10 0.875 9.925 0.725 9.775C0.575 9.625 0.5 9.45 0.5 9.25V1.5C0.5 1.3 0.575 1.125 0.725 0.975C0.875 0.825 1.05 0.75 1.25 0.75H2.0625V0H2.875V0.75H7.125V0H7.9375V0.75H8.75C8.95 0.75 9.125 0.825 9.275 0.975C9.425 1.125 9.5 1.3 9.5 1.5V9.25C9.5 9.45 9.425 9.625 9.275 9.775C9.125 9.925 8.95 10 8.75 10H1.25ZM1.25 9.25H8.75V3.875H1.25V9.25ZM1.25 3.125H8.75V1.5H1.25V3.125ZM5 6C4.85833 6 4.73958 5.95208 4.64375 5.85625C4.54792 5.76042 4.5 5.64167 4.5 5.5C4.5 5.35833 4.54792 5.23958 4.64375 5.14375C4.73958 5.04792 4.85833 5 5 5C5.14167 5 5.26042 5.04792 5.35625 5.14375C5.45208 5.23958 5.5 5.35833 5.5 5.5C5.5 5.64167 5.45208 5.76042 5.35625 5.85625C5.26042 5.95208 5.14167 6 5 6ZM3 6C2.85833 6 2.73957 5.95208 2.64375 5.85625C2.54792 5.76042 2.5 5.64167 2.5 5.5C2.5 5.35833 2.54792 5.23958 2.64375 5.14375C2.73957 5.04792 2.85833 5 3 5C3.14167 5 3.26042 5.04792 3.35625 5.14375C3.45207 5.23958 3.5 5.35833 3.5 5.5C3.5 5.64167 3.45207 5.76042 3.35625 5.85625C3.26042 5.95208 3.14167 6 3 6ZM7 6C6.85833 6 6.73958 5.95208 6.64375 5.85625C6.54792 5.76042 6.5 5.64167 6.5 5.5C6.5 5.35833 6.54792 5.23958 6.64375 5.14375C6.73958 5.04792 6.85833 5 7 5C7.14167 5 7.26042 5.04792 7.35625 5.14375C7.45208 5.23958 7.5 5.35833 7.5 5.5C7.5 5.64167 7.45208 5.76042 7.35625 5.85625C7.26042 5.95208 7.14167 6 7 6ZM5 8C4.85833 8 4.73958 7.95208 4.64375 7.85625C4.54792 7.76042 4.5 7.64167 4.5 7.5C4.5 7.35833 4.54792 7.23958 4.64375 7.14375C4.73958 7.04792 4.85833 7 5 7C5.14167 7 5.26042 7.04792 5.35625 7.14375C5.45208 7.23958 5.5 7.35833 5.5 7.5C5.5 7.64167 5.45208 7.76042 5.35625 7.85625C5.26042 7.95208 5.14167 8 5 8ZM3 8C2.85833 8 2.73957 7.95208 2.64375 7.85625C2.54792 7.76042 2.5 7.64167 2.5 7.5C2.5 7.35833 2.54792 7.23958 2.64375 7.14375C2.73957 7.04792 2.85833 7 3 7C3.14167 7 3.26042 7.04792 3.35625 7.14375C3.45207 7.23958 3.5 7.35833 3.5 7.5C3.5 7.64167 3.45207 7.76042 3.35625 7.85625C3.26042 7.95208 3.14167 8 3 8ZM7 8C6.85833 8 6.73958 7.95208 6.64375 7.85625C6.54792 7.76042 6.5 7.64167 6.5 7.5C6.5 7.35833 6.54792 7.23958 6.64375 7.14375C6.73958 7.04792 6.85833 7 7 7C7.14167 7 7.26042 7.04792 7.35625 7.14375C7.45208 7.23958 7.5 7.35833 7.5 7.5C7.5 7.64167 7.45208 7.76042 7.35625 7.85625C7.26042 7.95208 7.14167 8 7 8Z"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span className="sg2-date">{date}</span>
            </>
          )}
        </div>
        <div className="sg2-headRight">
          {url && !isYoutube && !isPinned && (
            <a
              className="sg2-open"
              href={url}
              onClick={(e) => {
                setActiveCardId?.(item.id);
                setNowPlayingId?.(null);
                openInNewTab(e);
              }}
              title="Open in Reflection Ministries"
              aria-label="Open in Reflection Ministries"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 12C0.733333 12 0.5 11.9 0.3 11.7C0.1 11.5 0 11.2667 0 11V1C0 0.733333 0.1 0.5 0.3 0.3C0.5 0.1 0.733333 0 1 0H5.65V1H1V11H11V6.35H12V11C12 11.2667 11.9 11.5 11.7 11.7C11.5 11.9 11.2667 12 11 12H1ZM4.36667 8.35L3.66667 7.63333L10.3 1H6.65V0H12V5.35H11V1.71667L4.36667 8.35Z"
                  fill="currentColor"
                  style={{ fill: "currentColor" }}
                />
              </svg>
            </a>
          )}
          {isPinned && onClose && (
            <button
              className="sg-now-playing-close"
              onClick={onClose}
              aria-label="Close Now Playing"
              title="Close Now Playing"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className="sg2-bodyTitle">
        {url && !isYoutube ? (
          <a
            className="sg2-title-link"
            href={url}
            onClick={(e) => {
              setActiveCardId?.(item.id);
              setNowPlayingId?.(null);
              openInNewTab(e);
            }}
            title="Open in Reflection Ministries"
            aria-label="Open in Reflection Ministries"
          >
            <h3 className="sg2-title" title={item.title}>
              {item.title}
            </h3>
          </a>
        ) : (
          <h3 className="sg2-title" title={item.title}>
            {item.title}
          </h3>
        )}
      </div>

      {desc ? <p className="sg2-desc">{desc}</p> : null}

      {/* Spacer for bottom alignment */}
      <div style={{ flex: 1 }}></div>

      {isYoutube && (
        <div className="sg-youtubeEmbed">{renderYoutubePlayer()}</div>
      )}

      {!isYoutube && (
        <div
          className="sg-previewAnim"
          style={{ "--sg-preview-h": `${previewH}px` }}
          aria-hidden={!isOpen}
        >
          {isOpen && canPreview && (
            <div className="sg-preview" ref={(n) => (previewRef.el = n)}>
              <div className="sg-previewImgContainer">
                <img
                  className="sg-previewImg"
                  src={item.image_url}
                  alt={item.title || `preview-${item.id}`}
                />
              </div>
              {url && (
                <a
                  href={url}
                  className="sg-preview-learnMoreLink"
                  onClick={openInNewTab}
                  title="Open in Reflection Ministries"
                  aria-label="Open in Reflection Ministries"
                  style={{ color: "#fff", textDecoration: "none" }}
                >
                  {t("earnMore")}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M1 12C0.733333 12 0.5 11.9 0.3 11.7C0.1 11.5 0 11.2667 0 11V1C0 0.733333 0.1 0.5 0.3 0.3C0.5 0.1 0.733333 0 1 0H5.65V1H1V11H11V6.35H12V11C12 11.2667 11.9 11.5 11.7 11.7C11.5 11.9 11.2667 12 11 12H1ZM4.36667 8.35L3.66667 7.63333L10.3 1H6.65V0H12V5.35H11V1.71667L4.36667 8.35Z"
                      fill="currentColor"
                      style={{ fill: "currentColor" }}
                    />
                  </svg>
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

// ── Lazy-loading wrapper for cards (IntersectionObserver) ──
function LazyCard({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
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

const DEFAULT_URL =
  "https://ken-boa-reflections-public.ministries.bot/api/v1/search?cache_ttl=300";

// ── In-memory result cache (5 min TTL) ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map(); // key → { data: [], timestamp: number }
const queryPlanCache = new Map(); // key → { data: string[], timestamp: number }

function getCachedResults(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResults(key, data) {
  // Store only the fields the UI actually uses to keep memory light
  const trimmed = data.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    Name: item.Name,
    url: item.url,
    referral_url: item.referral_url,
    listing_url: item.listing_url,
    image_url: item.image_url,
    description: item.description,
    summary: item.summary,
    snippet: item.snippet,
    excerpt: item.excerpt,
    published_on: item.published_on,
    created_at: item.created_at,
  }));
  resultCache.set(key, { data: trimmed, timestamp: Date.now() });
  // Evict oldest entries if cache grows too large (max 100 queries)
  if (resultCache.size > 100) {
    const oldest = resultCache.keys().next().value;
    resultCache.delete(oldest);
  }
}

function getCachedQueryPlan(key) {
  const entry = queryPlanCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    queryPlanCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedQueryPlan(key, data) {
  queryPlanCache.set(key, { data, timestamp: Date.now() });
  if (queryPlanCache.size > 200) {
    const oldest = queryPlanCache.keys().next().value;
    queryPlanCache.delete(oldest);
  }
}

function normalizeQueryValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueQueries(queries) {
  const seen = new Set();
  const normalized = [];
  queries.forEach((query) => {
    const value = normalizeQueryValue(query);
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });
  return normalized;
}

function truncateText(value, maxLength = 220) {
  const text = normalizeQueryValue(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function truncateQueryPhrase(value, maxLength = 30) {
  const text = normalizeQueryValue(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const words = text.split(/\s+/);
  let phrase = "";
  for (const word of words) {
    const next = phrase ? `${phrase} ${word}` : word;
    if (next.length > maxLength) break;
    phrase = next;
  }

  return phrase || text.slice(0, maxLength).trim();
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getResultSearchableText(item) {
  return normalizeQueryValue(
    [
      item?.title,
      item?.Name,
      item?.description,
      item?.summary,
      item?.snippet,
      item?.excerpt,
      item?.content,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

const CANONICAL_BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Psalm",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Song of Songs",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

const SIGNAL_STOPWORDS = new Set([
  "the",
  "then",
  "than",
  "into",
  "over",
  "under",
  "about",
  "through",
  "after",
  "before",
  "because",
  "these",
  "those",
  "such",
  "this",
  "and",
  "but",
  "not",
  "you",
  "your",
  "yours",
  "they",
  "them",
  "their",
  "there",
  "here",
  "have",
  "will",
  "would",
  "could",
  "should",
  "shall",
  "from",
  "with",
  "for",
  "that",
  "that",
  "what",
  "when",
  "where",
  "which",
  "were",
  "been",
  "being",
  "also",
  "does",
  "just",
  "with",
  "from",
  "chapter",
  "verse",
  "verses",
  "book",
  "bible",
  "apologetics",
  "theological",
  "themes",
  "doctrine",
  "study",
  "related",
  "resource",
  "resources",
  "unto",
  "said",
  "says",
  "say",
  "spoke",
  "called",
  "made",
  "make",
  "came",
  "come",
  "went",
  "take",
  "took",
  "seen",
  "gave",
  "give",
  "let",
  "upon",
  "every",
  "each",
  "many",
  "much",
  "very",
  "might",
  "must",
  "whose",
  "whom",
  "lord",
  "god",
  "gods",
  "man",
  "men",
  "woman",
  "women",
  "son",
  "sons",
  "daughter",
  "daughters",
  "children",
  "child",
  "people",
  "israel",
  "earth",
  "heaven",
  "heavens",
  "name",
  "day",
  "days",
  "night",
  "nights",
  "hand",
  "hands",
  "eyes",
  "voice",
  "house",
  "land",
  "waters",
  "water",
  "midst",
  "according",
  "behold",
  "therefore",
  "again",
  "indeed",
  "among",
  "within",
  "without",
  "whosever",
]);

function parseChapterLabel(label) {
  const normalizedLabel = normalizeQueryValue(label);
  if (!normalizedLabel) return null;

  const chapterMatch = normalizedLabel.match(/^(.*?)(\d+)\s*$/);
  if (!chapterMatch) return null;

  const bookName = normalizeQueryValue(chapterMatch[1]);
  const chapterNumber = parseInt(chapterMatch[2], 10);
  if (!bookName || Number.isNaN(chapterNumber)) return null;

  return {
    label: normalizedLabel,
    bookName,
    chapterNumber,
    escapedBookName: escapeRegExp(bookName),
    bookTokens: bookName.toLowerCase().split(/\s+/).filter(Boolean),
  };
}

function getExplicitChapterMatch(searchableText, chapterInfo) {
  if (!searchableText || !chapterInfo) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const exactRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+${chapterInfo.chapterNumber}\\b`,
    "i"
  );
  if (exactRegex.test(searchableText)) {
    return { isExplicit: true, chapterScore: 12, matchType: "exact" };
  }

  const rangeRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+(\\d+)\\s*[–-]\\s*(\\d+)\\b`,
    "i"
  );
  const rangeMatch = searchableText.match(rangeRegex);
  if (!rangeMatch) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const start = parseInt(rangeMatch[1], 10);
  const end = parseInt(rangeMatch[2], 10);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const isInRange =
    chapterInfo.chapterNumber >= Math.min(start, end) &&
    chapterInfo.chapterNumber <= Math.max(start, end);
  return {
    isExplicit: isInRange,
    chapterScore: isInRange ? 8 : 0,
    matchType: isInRange ? "range" : null,
  };
}

function getOtherBookReferenceCount(searchableText, chapterInfo) {
  if (!searchableText) return 0;

  let count = 0;
  CANONICAL_BOOK_NAMES.forEach((bookName) => {
    if (
      chapterInfo &&
      bookName.toLowerCase() === chapterInfo.bookName.toLowerCase()
    ) {
      return;
    }

    const regex = new RegExp(`\\b${escapeRegExp(bookName)}\\s+\\d+\\b`, "i");
    if (regex.test(searchableText)) {
      count += 1;
    }
  });
  return count;
}

function tokenizeSignalText(text, chapterInfo) {
  const normalizedText = normalizeQueryValue(text).toLowerCase();
  if (!normalizedText) return [];

  return normalizedText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => {
      if (!token || token.length < 4) return false;
      if (SIGNAL_STOPWORDS.has(token)) return false;
      if (chapterInfo?.bookTokens?.includes(token)) return false;
      if (!Number.isNaN(Number(token))) return false;
      return true;
    });
}

function extractSectionSignals(chapterData) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];

  const signals = [];
  chapterData.content.forEach((section) => {
    const heading = normalizeQueryValue(
      section?.heading || section?.title || section?.name || ""
    );
    if (heading) {
      signals.push(heading);
    }

    const firstVerse = Array.isArray(section?.verses)
      ? section.verses[0]
      : null;
    if (firstVerse?.text) {
      signals.push(truncateText(firstVerse.text, 120));
    }
  });

  return signals;
}

function extractSectionHeadings(chapterData) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];

  return uniqueQueries(
    chapterData.content.map((section) =>
      normalizeQueryValue(
        section?.heading || section?.title || section?.name || ""
      )
    )
  );
}

function extractKeywordsFromText(text, bookName) {
  const bookTokens = normalizeQueryValue(bookName)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const frequencies = new Map();

  normalizeQueryValue(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .forEach((token) => {
      if (!token || token.length < 4) return;
      if (SIGNAL_STOPWORDS.has(token)) return;
      if (bookTokens.includes(token)) return;
      if (!Number.isNaN(Number(token))) return;
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    });

  const topTerms = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([token]) => token);

  if (!topTerms.length) return "";
  return normalizeQueryValue([bookName, ...topTerms].filter(Boolean).join(" "));
}

function buildChapterSignalSet(chapterData, chapterInfo, queryResultPairs) {
  const signalTokens = new Set();
  const sources = [
    chapterData?.combinedText,
    ...extractSectionSignals(chapterData),
    ...(queryResultPairs || []).map((pair) => pair?.query || ""),
  ];

  sources.forEach((source) => {
    tokenizeSignalText(source, chapterInfo).forEach((token) =>
      signalTokens.add(token)
    );
  });

  return signalTokens;
}

function getResultTitle(item) {
  return normalizeQueryValue(item?.title || item?.Name || "");
}

function hasConflictingChapterInTitle(item, chapterInfo) {
  if (!chapterInfo) return false;
  const title = getResultTitle(item);
  if (!title) return false;

  // Match: same book + ANY chapter number in the title
  const anyChapterRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+(\\d+)`,
    "gi"
  );
  let match;
  while ((match = anyChapterRegex.exec(title)) !== null) {
    const mentionedChapter = parseInt(match[1], 10);
    if (
      !Number.isNaN(mentionedChapter) &&
      mentionedChapter !== chapterInfo.chapterNumber
    ) {
      return true;
    }
  }
  return false;
}

function classifyChapterResult(item, context) {
  const searchableText = getResultSearchableText(item);
  const resultKey = buildResultKey(item);
  const hitCount = resultKey ? context.hitCountByKey.get(resultKey) || 1 : 1;
  const explicit = getExplicitChapterMatch(searchableText, context.chapterInfo);
  const otherBookReferenceCount = getOtherBookReferenceCount(
    searchableText,
    context.chapterInfo
  );
  const resultTokens = new Set(
    tokenizeSignalText(searchableText, context.chapterInfo)
  );
  const sharedSignalCount = Array.from(context.signalTokens).filter((token) =>
    resultTokens.has(token)
  ).length;

  const sameBookMentionRegex = context.chapterInfo
    ? new RegExp(`\\b${context.chapterInfo.escapedBookName}\\b`, "i")
    : null;
  const hasSameBookMention = sameBookMentionRegex
    ? sameBookMentionRegex.test(searchableText)
    : false;

  if (explicit.isExplicit) {
    return {
      bucket: "explicitMatch",
      score:
        200 +
        explicit.chapterScore * 5 +
        hitCount * 12 +
        Math.max(0, 30 - computeResultRank(item)),
      explicit,
      sharedSignalCount,
      hitCount,
      otherBookReferenceCount,
    };
  }

  const implicitConfidence =
    hitCount * 16 +
    sharedSignalCount * 14 +
    (hasSameBookMention ? 16 : 0) -
    otherBookReferenceCount * 18;

  const isImplicitMatch =
    otherBookReferenceCount === 0 &&
    sharedSignalCount >= 2 &&
    (hasSameBookMention || hitCount >= 2);

  if (isImplicitMatch) {
    return {
      bucket: "implicitMatch",
      score:
        100 + implicitConfidence + Math.max(0, 20 - computeResultRank(item)),
      explicit,
      sharedSignalCount,
      hitCount,
      otherBookReferenceCount,
    };
  }

  return {
    bucket: "unrelated",
    score: implicitConfidence,
    explicit,
    sharedSignalCount,
    hitCount,
    otherBookReferenceCount,
  };
}

function prioritizeDiverseTopResults(results, topLimit = 10) {
  const selected = [];
  const deferred = [];
  const domainCount = new Map();

  results.forEach((item) => {
    const domain = getResultDomain(item) || "unknown";
    const count = domainCount.get(domain) || 0;
    if (selected.length < topLimit && count < 3) {
      selected.push(item);
      domainCount.set(domain, count + 1);
      return;
    }
    deferred.push(item);
  });

  if (!selected.some((item) => item?.type === "youtube")) {
    const youtubeCandidate = deferred.find((item) => item?.type === "youtube");
    if (youtubeCandidate) {
      const replacementIndex = selected.length ? selected.length - 1 : -1;
      if (replacementIndex >= 0) {
        deferred.push(selected[replacementIndex]);
        selected[replacementIndex] = youtubeCandidate;
      } else {
        selected.push(youtubeCandidate);
      }
    }
  }

  const hasArticleLike = selected.some((item) =>
    ["url", "episode", "book"].includes((item?.type || "").toLowerCase())
  );
  if (!hasArticleLike) {
    const articleCandidate = deferred.find((item) =>
      ["url", "episode", "book"].includes((item?.type || "").toLowerCase())
    );
    if (articleCandidate) {
      const replacementIndex = selected.length > 1 ? selected.length - 1 : 0;
      if (selected[replacementIndex]) {
        deferred.push(selected[replacementIndex]);
        selected[replacementIndex] = articleCandidate;
      } else {
        selected.push(articleCandidate);
      }
    }
  }

  const rebuiltSelectedKeys = new Set(
    selected
      .map((item) => buildResultKey(item))
      .filter(Boolean)
      .map((value) => String(value))
  );
  const orderedRemainder = [
    ...deferred.filter((item) => {
      const key = buildResultKey(item);
      if (!key) return true;
      return !rebuiltSelectedKeys.has(String(key));
    }),
    ...results.filter((item) => {
      const key = buildResultKey(item);
      if (!key) return false;
      return !rebuiltSelectedKeys.has(String(key));
    }),
  ];

  const seen = new Set();
  const final = [];

  [...selected, ...deferred].forEach((item) => {
    const key = buildResultKey(item);
    if (!key) return;

    if (seen.has(key)) return;

    seen.add(key);
    final.push(item);
  });

  return final;
}

function extractAnchorQueries(chapterData, fallbackLabel) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];
  const firstSection = chapterData.content.find(
    (section) => Array.isArray(section?.verses) && section.verses.length
  );
  const firstVerse = Array.isArray(firstSection?.verses)
    ? firstSection.verses[0]
    : null;

  if (firstVerse?.text) {
    const book = chapterData.book || "";
    const chapter = chapterData.chapter || "";
    const verseNumber = firstVerse?.number || firstVerse?.verseNumber || "";
    const verseLabel = `${book} ${chapter}:${verseNumber}`.trim();
    const anchorText = truncateQueryPhrase(firstVerse.text, 30);
    return uniqueQueries([`${verseLabel} ${anchorText}`]);
  }

  if (chapterData.combinedText) {
    return uniqueQueries([
      `${fallbackLabel} ${truncateQueryPhrase(chapterData.combinedText, 30)}`,
    ]);
  }

  return [];
}

async function generateChapterSearchQueries({
  chapterData,
  chapterLabel,
  chapterText,
}) {
  const normalizedLabel = normalizeQueryValue(chapterLabel);
  const normalizedText = normalizeQueryValue(
    chapterData?.combinedText || chapterText
  );
  const normalizedTranslation = normalizeQueryValue(chapterData?.translation);
  const cacheKey = `chapter-plan:${normalizedLabel.toLowerCase()}:${normalizedTranslation.toLowerCase()}`;
  const cachedPlan = getCachedQueryPlan(cacheKey);
  if (cachedPlan?.length) {
    return cachedPlan;
  }

  const queries = [normalizedLabel];
  const headings = extractSectionHeadings(chapterData);
  if (headings.length > 0) {
    queries.push(headings[0]);
  }
  if (headings.length > 1) {
    const middleHeading = headings[Math.floor(headings.length / 2)];
    if (
      middleHeading &&
      middleHeading.toLowerCase() !== headings[0]?.toLowerCase()
    ) {
      queries.push(middleHeading);
    }
  }

  if (normalizedText) {
    const keywordQuery = extractKeywordsFromText(
      normalizedText,
      chapterData?.book || ""
    );
    if (keywordQuery) {
      queries.push(keywordQuery);
    }
  }

  queries.push(...extractAnchorQueries(chapterData, normalizedLabel));

  const finalQueries = uniqueQueries(queries).slice(0, 5);
  setCachedQueryPlan(cacheKey, finalQueries);
  return finalQueries;
}

function buildHybridRankedResults(queryResultPairs, chapterLabel, chapterData) {
  const chapterInfo = parseChapterLabel(chapterLabel);
  const hitCountByKey = new Map();
  const allResults = [];

  const seenGlobal = new Set();

  queryResultPairs.forEach(({ results }) => {
    results.forEach((item) => {
      const key = buildResultKey(item);

      if (!key) {
        allResults.push(item);
        return;
      }

      if (seenGlobal.has(key)) return;

      seenGlobal.add(key);
      allResults.push(item);
    });
  });

  const allowedTypes = new Set(["youtube", "episode", "url", "book"]);
  const typed = allResults.filter((item) => {
    const isAllowedType = allowedTypes.has(item?.type);
    if (item?.type === "book") {
      const hasUrl = item?.url || item?.referral_url || item?.listing_url;
      return isAllowedType && !!hasUrl;
    }

    return isAllowedType;
  });
  const signalTokens = buildChapterSignalSet(
    chapterData,
    chapterInfo,
    queryResultPairs
  );
  const deduped = dedupeResults(typed).filter((item) => {
    const searchableText = getResultSearchableText(item);

    const hasConflict = hasConflictingChapterInTitle(item, chapterInfo);
    const otherBookRefs = getOtherBookReferenceCount(
      searchableText,
      chapterInfo
    );

    const resultTokens = new Set(
      tokenizeSignalText(searchableText, chapterInfo)
    );

    const sharedSignalCount = Array.from(signalTokens).filter((token) =>
      resultTokens.has(token)
    ).length;

    const isSameBookMention = chapterInfo
      ? new RegExp(`\\b${chapterInfo.escapedBookName}\\b`, "i").test(
          searchableText
        )
      : false;

    // ✅ MUCH LESS STRICT
    const isRelevant = sharedSignalCount >= 1 || isSameBookMention;

    return !hasConflict && otherBookRefs === 0 && isRelevant;
  });

  const classified = deduped.map((item) => ({
    item,
    ...classifyChapterResult(item, {
      chapterInfo,
      hitCountByKey,
      signalTokens,
    }),
  }));

  const explicitMatches = classified.filter(
    (entry) => entry.bucket === "explicitMatch"
  );
  const implicitMatches = classified.filter(
    (entry) => entry.bucket === "implicitMatch"
  );
  const fallbackMatches = classified.filter(
    (entry) => entry.bucket === "unrelated"
  );

  const sortEntries = (entries) =>
    entries
      .slice()
      .sort((a, b) => b.score - a.score || compareResults(a.item, b.item))
      .map((entry) => entry.item);

  const orderedResults = prioritizeDiverseTopResults(
    sortEntries([...explicitMatches, ...implicitMatches, ...fallbackMatches]),
    10
  );

  return orderedResults;
}

/**
 * Props:
 * - search: string (required)
 * - url?: string
 * - enabled?: boolean
 * - className?: string
 * - authHeader?: string
 * - cacheTtl?: number
 */
function Apologist({
  search,
  trigger = 0,
  authHeader = null,
  cacheTtl = null,
  url = DEFAULT_URL,
  enabled = true,
  className = "",
  level = "chapter",
  baselineQuery = "",
  label = "",
  chapterData = null,
  setCameFromDiscovery,
}) {
  const { t } = useSideBarContext();
  const { openOnMobile, isMobile } = useSideBarContext();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openIds, setOpenIds] = useState(new Set());
  const [searchParam, setSearchParam] = useState("");
  const [searchRunId, setSearchRunId] = useState(0);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(10);
  const [allData, setAllData] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);
  const [headerLabel, setHeaderLabel] = useState("");
  const [nowPlayingId, setNowPlayingId] = useState(null);
  const [linkOpenId, setLinkOpenId] = useState(null);
  const lastSearchKeyRef = useRef(null);
  const lastResultKeysRef = useRef(new Set());
  const baselineQueryRef = useRef(baselineQuery || "");
  const baselineResultKeysRef = useRef(new Set());
  const resolvedLevel = (level || "chapter").toLowerCase();
  const isVerseLevel = resolvedLevel === "verse";
  const currentBaselineQuery = baselineQuery || baselineQueryRef.current;
  const showResetControl = Boolean(isVerseLevel && currentBaselineQuery);

  const loadMoreRef = useRef(null);
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const trimmed = (search ?? "").trim();
    if (!trimmed) {
      setSearchParam("");
      setSearchRunId(trigger);
      return;
    }

    setSearchParam(trimmed);
    setSearchRunId(trigger);
  }, [search, trigger]);

  useEffect(() => {
    baselineQueryRef.current = baselineQuery || baselineQueryRef.current;
  }, [baselineQuery]);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setAllData([]);
      setErr("");
      setOpenIds(new Set());
      setHasMore(false);
      setDisplayedCount(10);
      setLoading(false);
      return;
    }

    if (!searchParam.trim()) {
      lastSearchKeyRef.current = null;
      lastResultKeysRef.current = new Set();
      if (resolvedLevel === "chapter") {
        baselineQueryRef.current = baselineQuery || "";
        baselineResultKeysRef.current = new Set();
      }
    }

    let cancelled = false;

    async function run() {
      if (!searchParam || !searchParam.trim()) {
        setData([]);
        setAllData([]);
        setErr("");
        setOpenIds(new Set());
        setHasMore(false);
        setDisplayedCount(10);

        return;
      }
      setLoading(true);
      setErr("");
      setData([]);
      setAllData([]);
      setOpenIds(new Set());
      setHasMore(false);
      setDisplayedCount(10);

      try {
        const trimmedQuery = searchParam.trim();

        // Build the API query based on level:
        // Chapter: use just the label (e.g., "Genesis 1")
        // Verse: prepend the label to the verse text
        const currentLabel = (
          label ||
          globalThis.GlobalSearchLabel ||
          ""
        ).trim();

        let apiQuery;

        if (resolvedLevel === "chapter") {
          apiQuery = currentLabel || trimmedQuery;
        } else {
          apiQuery = currentLabel
            ? `${currentLabel} ${trimmedQuery}`
            : trimmedQuery;
        }

        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader
            ? { Authorization: authHeader }
            : { Authorization: "Bearer apg_fw8aEJxwdpVkd7ctLLhWK3CbRlpN" }),
          ...(cacheTtl != null ? { "x-cache-ttl": String(cacheTtl) } : {}),
        };

        const fetchQueryResults = async (query) => {
          const normalizedQueryKey = normalizeQueryValue(query).toLowerCase();
          if (!normalizedQueryKey) return [];

          const cached = getCachedResults(normalizedQueryKey);
          if (cached) {
            return cached;
          }

          const payload = {
            query,
            limit: 100,
            filters: {
              team_ids: [160],
              types: ["article", "book", "url", "media", "youtube", "episode"],
            },
          };

          const MAX_RETRIES = 3;
          let res;
          let lastError;

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            if (cancelled) return [];
            try {
              res = await web.post(url, payload, { headers });
              if (res.status === 200) break;
              if (res.status >= 400 && res.status < 500) break;
              lastError = res?.error || `HTTP ${res.status}`;
            } catch (retryErr) {
              lastError = retryErr?.message || "Network error";
              res = null;
            }

            if (attempt < MAX_RETRIES - 1) {
              const delay = Math.pow(2, attempt) * 1000;
              await new Promise((r) => setTimeout(r, delay));
            }
          }

          if (!res || res.status !== 200) {
            throw new Error(
              lastError || res?.error || `HTTP ${res?.status || "unknown"}`
            );
          }

          const queryResults = Array.isArray(res?.data?.results)
            ? res.data.results
            : [];
          setCachedResults(normalizedQueryKey, queryResults);
          return queryResults;
        };

        const chapterContextData =
          chapterData || globalThis.GlobalSearchChapterData;
        let normalizedSearchKey = normalizeQueryValue(apiQuery).toLowerCase();
        let chapterFilteredResults = [];

        if (resolvedLevel === "chapter") {
          const chapterQueries = await generateChapterSearchQueries({
            chapterData: chapterContextData,
            chapterLabel: currentLabel || trimmedQuery,
            chapterText: trimmedQuery,
          });
          const queryPlan = uniqueQueries([
            currentLabel || trimmedQuery,
            ...chapterQueries,
          ]);

          normalizedSearchKey = `hybrid:${queryPlan.join("|").toLowerCase()}`;

          const queryResultPairs = await Promise.all(
            queryPlan.map(async (query) => {
              try {
                const results = await fetchQueryResults(query);
                return { query, results };
              } catch (queryError) {
                console.warn("[Apologist] query failed:", query, queryError);
                return { query, results: [] };
              }
            })
          );

          if (cancelled) return;
          const mergedResults = buildHybridRankedResults(
            queryResultPairs,
            currentLabel || trimmedQuery,
            chapterContextData
          );
          chapterFilteredResults = mergedResults;
        } else {
          const singleResults = await fetchQueryResults(apiQuery);
          const allowedTypes = new Set(["youtube", "episode", "url", "book"]);
          const filteredResults = singleResults.filter((item) =>
            allowedTypes.has(item?.type)
          );
          const sortedResults = filteredResults.slice().sort(compareResults);
          chapterFilteredResults = dedupeResults(sortedResults);
        }

        if (resolvedLevel === "chapter") {
          baselineQueryRef.current = trimmedQuery;
          baselineResultKeysRef.current = new Set();

          chapterFilteredResults.forEach((item) => {
            const key = buildResultKey(item);
            if (key) {
              baselineResultKeysRef.current.add(key);
            }
          });
        }

        let finalResults = chapterFilteredResults;
        const seenFinal = new Set();
        finalResults = finalResults.filter((item) => {
          const key = buildResultKey(item);
          if (!key) return true;

          if (seenFinal.has(key)) return false;
          seenFinal.add(key);
          return true;
        });

        if (resolvedLevel !== "chapter" && baselineResultKeysRef.current.size) {
          finalResults = finalResults.filter((item) => {
            const key = buildResultKey(item);
            if (!key) return true;
            return !baselineResultKeysRef.current.has(key);
          });
        }

        if (
          lastSearchKeyRef.current &&
          normalizedSearchKey &&
          normalizedSearchKey !== lastSearchKeyRef.current &&
          lastResultKeysRef.current.size
        ) {
          finalResults = finalResults.filter((item) => {
            const key = buildResultKey(item);
            if (!key) return true;
            return !lastResultKeysRef.current.has(key);
          });
        }

        setAllData(finalResults);
        setData(finalResults.slice(0, 10)); // Show first 10
        setHasMore(finalResults.length > 10); // Show "Load More" if there are more than 10 results
        // Open all book cards initially
        const bookIds = finalResults
          .filter((item) => item.type === "book" && item.id)
          .map((item) => item.id);
        const youtubeIds = finalResults
          .filter((item) => item.type === "youtube" && item.id)
          .map((item) => item.id);
        setOpenIds(new Set([...bookIds, ...youtubeIds]));
        // Update header label AFTER results are ready
        const computedLabel =
          globalThis.GlobalSearchLabel ||
          (isVerseLevel && currentBaselineQuery
            ? currentBaselineQuery
            : trimmedQuery);

        setHeaderLabel(computedLabel);

        lastSearchKeyRef.current = normalizedSearchKey || null;
        lastResultKeysRef.current = new Set();
        finalResults.forEach((item) => {
          const key = buildResultKey(item);
          if (key) {
            lastResultKeysRef.current.add(key);
          }
        });
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Network error");
          setData([]);
          setAllData([]);
          setOpenIds(new Set());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [
    searchParam,
    searchRunId,
    enabled,
    authHeader,
    cacheTtl,
    url,
    level,
    baselineQuery,
    label,
    chapterData,
  ]);

  const handleResetToBaseline = () => {
    if (!currentBaselineQuery) return;

    // Use the stored chapter-level label (not the current which may be verse-level)
    const chapterLabel =
      globalThis.GlobalSearchChapterLabel || globalThis.GlobalSearchLabel || "";

    // Always sync globals so polling stays consistent
    globalThis.GlobalSearch = currentBaselineQuery;
    globalThis.GlobalSearchLevel = "chapter";
    globalThis.GlobalSearchLabel = chapterLabel;

    const helper = globalThis.UpdateStudyNoteSearch;
    if (typeof helper === "function") {
      helper(currentBaselineQuery, {
        level: "chapter",
        label: chapterLabel,
        baseline: currentBaselineQuery,
        chapterData: globalThis.GlobalSearchChapterData || chapterData || null,
        forceRefresh: true,
      });
    }
  };

  const handleRetry = () => {
    setErr("");
    setSearchRunId((prev) => prev + 1);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    // Simulate loading delay for better UX
    setTimeout(() => {
      const newDisplayedCount = displayedCount + 10;
      const newData = allData.slice(0, newDisplayedCount);

      setData(newData);
      setDisplayedCount(newDisplayedCount);
      setHasMore(newDisplayedCount < allData.length);

      // Add new book IDs to openIds
      const newBookIds = newData
        .filter((item) => item.type === "book" && item.id)
        .map((item) => item.id);
      setOpenIds((prev) => {
        const merged = new Set(prev);
        newBookIds.forEach((id) => merged.add(id));
        return merged;
      });

      setLoadingMore(false);
    }, 300);
  };

  if (!search?.trim())
    return <div className="sg-muted">Type a search to begin…</div>;

  if (loading && data.length === 0) {
    return (
      <div className={`sg-searchWrap ${className}`}>
        <div className={`sg-results sg-list ${className}`}>
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
        <style>{getStyleOf("apologist.css")}</style>
        <style>{`
          .sg-skeleton-card {
            border-radius: 10px;
            background: var(--inputBackground, #1e1e1e);
            animation: sg-fadeInSkeleton 0.4s ease both;
          }
          .sg-skeleton-article {
            padding: 14px 16px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .sg-skeleton-book {
            padding: 20px 16px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 12px;
          }
          .sg-skeleton-row {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .sg-skeleton-circle {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--inputBorder, #333);
            animation: sg-shimmer 1.4s ease-in-out infinite;
            flex-shrink: 0;
          }
          .sg-skeleton-dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: var(--inputBorder, #333);
            opacity: 0.5;
            flex-shrink: 0;
          }
          .sg-skeleton-icon {
            width: 16px;
            height: 16px;
            border-radius: 3px;
            background: var(--inputBorder, #333);
            animation: sg-shimmer 1.4s ease-in-out infinite;
            flex-shrink: 0;
          }
          .sg-skeleton-bar {
            height: 12px;
            border-radius: 6px;
            background: var(--inputBorder, #333);
            animation: sg-shimmer 1.4s ease-in-out infinite;
          }
          .sg-skeleton-title {
            height: 16px;
            border-radius: 8px;
          }
          .sg-skeleton-cover {
            width: 65%;
            aspect-ratio: 2 / 3;
            border-radius: 6px;
            background: var(--inputBorder, #333);
            animation: sg-shimmer 1.4s ease-in-out infinite;
          }
          .sg-skeleton-pill {
            width: 100px;
            height: 32px;
            border-radius: 20px;
            background: var(--inputBorder, #333);
            animation: sg-shimmer 1.4s ease-in-out infinite;
          }
          @keyframes sg-shimmer {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
          @keyframes sg-fadeInSkeleton {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    );
  }

  if (err) {
    return (
      <div className="sg-error">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "36px", opacity: 0.7 }}
        >
          cloud_off
        </span>
        <b>Search error:</b> {err}
        <button className="sg-retry-btn" onClick={handleRetry}>
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
        <style>{getStyleOf("apologist.css")}</style>
        <style>{`
          .sg-error {
            color: #e57373;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            text-align: center;
          }
          .sg-error .sg-muted { color: var(--text2); }
          .sg-retry-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            padding: 8px 20px;
            border: 1px solid rgba(229, 115, 115, 0.4);
            border-radius: 20px;
            background: rgba(229, 115, 115, 0.1);
            color: #e57373;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
          }
          .sg-retry-btn:hover {
            background: rgba(229, 115, 115, 0.2);
            border-color: rgba(229, 115, 115, 0.6);
          }
        `}</style>
      </div>
    );
  }
  console.log(data, "final data to show");

  return (
    <div className={`sg-searchWrap ${className}`}>
      <div className="sg-header">
        {data && data.length > 0 && (
          <div className="sg-headerTop">
            {showResetControl && (
              <button
                type="button"
                className="sg-resetBtn"
                onClick={handleResetToBaseline}
                title={`Back to ${currentBaselineQuery}`}
                aria-label="Back to chapter search"
              >
                ×
              </button>
            )}
            <div className="sg-resultCount">
              {t(headerLabel)} | {data.length} {t("results")}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Now Playing Section */}

      <div
        className={`sg-results sg-list
         ${className}`}
      >
        {data && data.length > 0 ? (
          <>
            {data.map((item, index) => {
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
                      nowPlayingId === item.id ? true : openIds.has(item.id)
                    }
                    isNowPlaying={nowPlayingId === item.id}
                    setNowPlayingId={setNowPlayingId}
                    onClose={
                      nowPlayingId === item.id
                        ? () => setNowPlayingId(null)
                        : undefined
                    }
                    isPinned={nowPlayingId === item.id}
                    isActive={activeCardId === item.id}
                    isLinkOpen={linkOpenId === item.id}
                    setlinkOpenId={setLinkOpenId}
                    setActiveCardId={setActiveCardId}
                    setcameFromDiscovery={setCameFromDiscovery}
                  />
                </LazyCard>
              );
            })}
            {hasMore && (
              <div ref={loadMoreRef} className="sg-loadMore">
                {loadingMore && (
                  <>
                    <div className="sg-spinner"></div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          !loading && (
            <div className="sg-empty">
              <div className="sg-emptyIcon">🔎</div>
              <div className="sg-emptyTitle">No results</div>
              <div className="sg-emptyHint">
                No related resources found for this chapter
              </div>
            </div>
          )
        )}

        <style>{getStyleOf("apologist.css")}</style>
      </div>

      <style>{`
                .sg-searchWrap {
                    color: var(--text1, #e0e0e0);
                }

                .sg-results {
                    width: 100%;
                }

                .sg-results.sg-list {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .sg-results.sg-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                    gap: 12px;
                }
.sg-card.sg-open-bordered,
.sg-card.sg-open-bordered.is-open,
.sg-card.sg-open-bordered.sg-now-playing-card {
  border: 2px solid var(--activeTabBorder, #c03076) !important;
}

                /* ─── Book cover card ─── */
                .sg-card-book-cover {
                    position: relative;
                    overflow: hidden;
                    border-radius: 10px !important;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .sg-book-cover-img-wrap {
                    display: flex;
                    justify-content: center;
                    width: 100%;
                }

                .sg-book-cover-img {
                    max-width: 65%;
                    max-height: 300px;
                    height: auto;
                    display: block;
                    object-fit: contain;
                    border-radius: 4px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                }

                .sg-book-cover-footer {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    padding: 12px 8px 4px;
                    width: 100%;
                }

                .sg-book-cover-title {
                    color: var(--text1, #fff) !important;
                    font-size: 15px !important;
                    font-weight: 600 !important;
                    text-align: center;
                    margin: 0 0 12px 0 !important;
                    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
                    line-height: 1.3;
                }

                .sg-book-cover-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 20px;
                    border: 1px solid var(--accentColor);
                    border-radius: 20px;
                    background: var(--accentColor, rgba(0,0,0,0.45));
                    color: #fff !important;
                    font-size: 13px !important;
                    font-weight: 500;
                    text-decoration: none !important;
                    cursor: pointer;
                    transition: background 0.2s, border-color 0.2s, opacity 0.2s;
                    backdrop-filter: blur(4px);
                }

                .sg-book-cover-btn:hover {
                    opacity: 0.85;
                }

                .sg-book-cover-btn:visited,
                .sg-book-cover-btn:active,
                .sg-book-cover-btn:link {
                    color: #fff !important;
                    text-decoration: none !important;
                }

                .sg-book-cover-btn svg path {
                    fill: #fff !important;
                }
                
                .sg-loadMore {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px 0;
                    width: 100%;
                    grid-column: 1 / -1;
                    text-align: center;
                    margin-bottom: ${isMobile ? "40px" : "0px"};
                }
                
                .sg-loadMoreBtn {
                    padding: 12px 24px;
                    background: transparent;
                    color: var(--text1, #fff);
                    border-radius: 6px;
                    border: 1px solid var(--text1, #fff);
                    font-size: 14px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: background 0.2s, color 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .sg-loadMoreBtn:hover:not(:disabled) {
                    background: rgba(140, 164, 67, 0.15);
                    color: var(--accentColor, #a1bd4f);
                }
                
                .sg-loadMoreBtn:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }
                
                .sg-card {
                    background: var(--panelBackground, #1e1e1e);
                    border: 2px solid var(--inputBorder, #333);
                    border-radius: 12px;
                    
                    padding: 16px;
                    margin-bottom: 0px;
                    overflow: hidden;
                    
                    display: flex;
                    flex-direction: column;
                    box-sizing: border-box;
                    color: var(--text1, #e0e0e0);
                }

                .sg-card.sg-card-list {
                    padding: 12px 14px;
                }
                
                .sg-card.sg-card-grid {
                    padding: 16px;
                    height: auto;
                }

                .sg-card.sg-card-grid .sg-previewImgContainer {
                    max-height: 180px;
                    overflow: hidden;
                    border-radius: 8px;
                }

                .sg-card.sg-card-grid .sg-previewImg {
                    max-height: 180px;
                    width: 100%;
                    object-fit: cover;
                    border-radius: 8px;
                }

                .sg-card.sg-card-list .sg-previewImgContainer {
                    max-height: 300px;
                    overflow: hidden;
                }

                .sg-card.sg-card-list .sg-previewImg {
                    max-height: 300px;
                    width: 100%;
                    object-fit: contain;
                }

                .sg-card:hover {
                    border-color: var(--inputBorder, #444);
                    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.3);
                }

                .sg-card:active {
                    transform: translateY(1px);
                }

                .sg-card.is-open {
                    border: 2px solid var(--inputBorder, #444);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                }

                /* Only "Now Playing" card gets accent border */
                .sg-card.sg-now-playing-card,
                .sg-card.sg-now-playing-card:hover,
                .sg-card.sg-now-playing-card.is-open {
                    border: 2px solid var(--activeTabBorder, #fff);
                    box-shadow: 0 10px 30px rgba(140, 164, 67, 0.2);
                }
                
                .sg-header {
                    display: flex;
                    justify-content: flex-end;
                    align-items: center;
                    margin-bottom: 16px;
                }
                
                .sg-headerTop {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    gap: 12px;
                }
                
                .sg-resultCount {
                    font-size: 14px;
                    color: var(--text2, #999);
                    font-weight: 500;
                }
                
                .sg-viewToggle {
                    display: flex;
                    gap: 4px;
                }

                .sg-toggle-btn {
                    background: transparent;
                    border: 1px solid var(--inputBorder, #333);
                    border-radius: 4px;
                    padding: 4px 6px;
                    cursor: pointer;
                    color: var(--text2, #888);
                    transition: all 0.2s;
                }

                .sg-toggle-btn.active {
                    background: var(--panelBackground, #2a2a2a);
                    border-color: var(--inputBorder, #555);
                    color: var(--text1, #e0e0e0);
                }

                .sg-toggle-btn:hover {
                    border-color: var(--inputBorder, #555);
                    color: var(--text1, #ccc);
                }

                .sg-resetBtn {
                    border: none;
                    background: transparent;
                    color: var(--text1, #fff);
                    cursor: pointer;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    line-height: 1;
                }

                .sg-resetBtn:hover {
                    color: var(--accentColor, #a1bd4f);
                }

                .sg-now-playing-close {
                    background: transparent;
                    border: none;
                    font-size: 24px;
                    color: var(--text2, #777);
                    cursor: pointer;
                    padding: 4px 8px;
                    line-height: 1;
                    border-radius: 4px;
                    transition: background 0.2s, color 0.2s;
                }

                .sg-now-playing-close:hover {
                    background: rgba(255,255,255,0.05);
                    color: var(--text1, #ccc);
                }

                .sg-youtubeEmbed {
                    margin-top: 12px;
                }

                .sg-youtubeEmbed .sg-previewVideo {
                    border-radius: 12px;
                }

                .sg-previewVideo {
                    position: relative;
                    width: 600px;       
  max-width: 100%;    
  margin: 0 auto; 
                    aspect-ratio: 16 / 12;
                    background: #000;
                    border-radius: 10px;
                    overflow: hidden;
                }

                .sg-previewVideo iframe {
                    width: 100%;
                    height: 100%;
                    border: none;
                    display: block;
                }

                .sg-media-unavailable {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    height: 100%;
                    background: var(--panelBackground, #111);
                    color: var(--text2, #777);
                    font-size: 14px;
                }
                
                .sg-media-unavailable .material-symbols-outlined {
                    font-size: 24px;
                    color: var(--text2, #777);
                }

                .sg-previewVideoButton {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    border: none;
                    padding: 0;
                    cursor: pointer;
                    background: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .sg-previewVideoThumb {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .sg-previewVideoThumb--fallback {
                    background: linear-gradient(135deg, var(--panelBackground), var(--inputBorder));
                }

                .sg-previewVideoButton::after {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(180deg, rgba(0,0,0,0.2), rgba(0,0,0,0.45));
                    pointer-events: none;
                }

                .sg-videoPlayIcon {
                    position: absolute;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 70px;
                    height: 70px;
                    border-radius: 50%;
                    background: rgba(0,0,0,0.6);
                    color: #fff;
                }

                .sg-videoPlayIcon svg {
                    width: 34px;
                    height: 34px;
                }

                /* ── Theme-aware overrides for sg2 classes ── */
                .sg2-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 4px;
                    font-size: 12px;
                    color: var(--text2, #999);
                    margin-bottom: 6px;
                }

                .sg2-headLeft {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                    flex: 1;
                }

                .sg2-headRight {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }

                .sg2-favicon {
                    width: 16px;
                    height: 16px;
                    border-radius: 3px;
                    object-fit: cover;
                    flex-shrink: 0;
                }

                .sg2-fallback {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border-radius: 3px;
                    background: var(--inputBorder, #333);
                }

                .sg2-bodyTitle {
                    margin: 2px 0 4px;
                }

                .sg2-dot {
                    display: inline-block;
                    width: 3px;
                    height: 3px;
                    border-radius: 50%;
                    background: var(--text2, #555);
                    flex-shrink: 0;
                }

                .sg2-domain {
                    color: var(--text2, #999);
                }

                .sg2-date {
                    color: var(--text2, #777);
                }

                .sg2-dot {
                    color: var(--text2, #555);
                }

                .sg2-title {
                    color: var(--text1, #fff);
                }

                .sg2-title-link {
                    color: var(--text1, #fff);
                    text-decoration: none;
                }

                .sg2-title-link:hover {
                    color: var(--text1, #ccc);
                }

                .sg2-desc {
                    color: var(--text2, #999);
                }

                .sg2-open {
                    display: inline-flex;
                    align-items: center;
                    color: var(--text1, #fff) !important;
                    text-decoration: none;
                }

                .sg2-open:visited,
                .sg2-open:active,
                .sg2-open:link {
                    color: var(--text1, #fff) !important;
                }

                .sg2-open svg {
                    fill: currentColor !important;
                }

                .sg2-open svg path {
                    fill: currentColor !important;
                }

                .sg2-calendar svg path {
                    fill: currentColor;
                }

                .sg-preview-learnMoreLink {
                    color: var(--text1, #fff) !important;
                    text-decoration: none !important;
                }

                .sg-preview-learnMoreLink:visited,
                .sg-preview-learnMoreLink:active,
                .sg-preview-learnMoreLink:link {
                    color: var(--text1, #fff) !important;
                }

                .sg-preview-learnMoreLink:hover {
                    color: var(--text1, #ccc) !important;
                }

                .sg-preview-learnMoreLink svg {
                    fill: currentColor !important;
                }

                .sg-preview-learnMoreLink svg path {
                    fill: currentColor !important;
                }

                .sg-muted {
                    color: var(--text2, #777);
                    text-align: center;
                    padding: 2rem;
                }

                .sg-error {
                    color: #e57373;
                    padding: 1rem;
                }

                .sg-error .sg-muted {
                    color: var(--text2, #777);
                }

                .sg-empty {
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--text2, #777);
                }

                .sg-emptyTitle {
                    color: var(--text2, #999);
                    font-weight: 600;
                    margin-top: 0.5rem;
                }

                .sg-emptyHint {
                    color: var(--text2, #666);
                    font-size: 0.85rem;
                }

                .sg-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem;
                    color: var(--text2, #999);
                }

                .sg-spinner {
                    width: 32px;
                    height: 32px;
                    border: 3px solid var(--inputBorder, #333);
                    border-top-color: var(--accentColor, #fff);
                    border-radius: 50%;
                    animation: sg-spin 0.8s linear infinite;
                }

                .sg-spinner-small {
                    width: 16px;
                    height: 16px;
                    border: 2px solid var(--inputBorder, #333);
                    border-top-color: var(--accentColor, #fff);
                    border-radius: 50%;
                    animation: sg-spin 0.8s linear infinite;
                }

                @keyframes sg-spin {
                    to { transform: rotate(360deg); }
                }

                .sg-loading-text {
                    margin-top: 12px;
                    color: var(--text2, #999);
                    font-size: 14px;
                }
            `}</style>
    </div>
  );
}

globalThis.Apologist = Apologist;
globalThis.ApologistSearch = Apologist;

return Apologist;
