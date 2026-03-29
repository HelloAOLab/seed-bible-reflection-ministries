const { useEffect, useState, useMemo, useRef } = os.appHooks;
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
function formatDomain(domain) {
  if (!domain) return "";

  // Map specific domains to friendly names
  if (domain.includes("tabletalkmagazine.com")) return "TableTalk Magazine";
  if (domain.includes("learn.ligonier.org")) return "Ligonier";

  // Return domain as-is for others
  return domain;
}
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
return SgCard;
