import {
  createCardState,
  type SgCardProps,
  getYouTubeId,
} from "../managers/ApologistCardManager";

import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
export function SgCard(props: SgCardProps) {
  const { t } = useI18n("ext_discovery");
  const state = createCardState(props);
  const renderYoutubePlayer = () => {
    if (state.videoError.value) {
      return (
        <div className="sg-previewVideo">
          <div className="sg-media-unavailable">
            <span className="material-symbols-outlined">videocam_off</span>
            <span>Video unavailable</span>
          </div>
        </div>
      );
    }
    if (props.isNowPlaying && state.videoSrc) {
      return (
        <div className="sg-previewVideo">
          <iframe
            key={state.frameKey.value}
            src={state.videoSrc}
            title={props.item.title || "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share;fu"
            referrerpolicy="strict-origin-when-cross-origin"
            allowFullScreen
            onError={() => (state.videoError.value = true)}
          />
        </div>
      );
    }
    return (
      <div className="sg-previewVideo">
        <button
          className="sg-previewVideoButton"
          onClick={() => {
            state.videoError.value = false;
            state.frameKey.value++;

            if (props.nowPlayingId) {
              props.nowPlayingId.value = props.item.id;
            }

            if (props.activeCardId) {
              props.activeCardId.value = null;
            }
          }}
          aria-label={`Play ${props.item.title || "video"}`}
        >
          {(() => {
            let thumbUrl = props.item.image_url;
            if (state.isYoutube) {
              const ytId = getYouTubeId(
                props.item.url || props.item.referral_url
              );
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

  // ── Book cover layout ──
  if (state.isBook) {
    return state.url ? (
      <article
        className={`sg-card sg-card-book-cover `}
        style={{ padding: "16px", height: "auto" }}
      >
        {props.item.image_url && (
          <div className="sg-book-cover-img-wrap">
            <img
              className="sg-book-cover-img"
              src={props.item.image_url}
              alt={props.item.title || "Book cover"}
            />
          </div>
        )}
        <div className="sg-book-cover-footer">
          {props.item.title && (
            <h3 className="sg-book-cover-title">{props.item.title}</h3>
          )}

          <a
            href={state.url}
            className="sg-book-cover-btn"
            onClick={state.openInNewTab}
            title="Open in Reflection Ministries"
            aria-label="Open in Reflection Ministries"
            style={{
              color: "var(--sb-background, #1a1a1a)",
              textDecoration: "none",
            }}
          >
            {t("buyBook")}
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

  return (
    <article
      className={`sg-card 
 
   ${props.isActive && !state.isYoutube ? "sg-open-bordered" : ""} 
  ${props.isOpen ? "is-open" : ""} 
  ${props.isNowPlaying ? "sg-now-playing-card" : ""}
`}
    >
      <header className="sg2-head">
        <div className="sg2-headLeft">
          {state.icon ? (
            <img className="sg2-favicon" src={state.icon} alt="" />
          ) : (
            <span className="sg2-favicon sg2-fallback" />
          )}
          <span className="sg2-domain" title={state.domain}>
            {state.isYoutube
              ? "YouTube"
              : state.isEpisode
                ? "Episode"
                : state.formattedDomain || "external"}
          </span>
          {state.date && (
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
              <span className="sg2-date">{state.date}</span>
            </>
          )}
        </div>
        <div className="sg2-headRight">
          {state.url && !state.isYoutube && (
            <a
              className="sg2-open"
              href={state.url}
              onClick={(e) => {
                props.activeCardId.value = props.item.id ?? null;

                props.nowPlayingId.value = null;

                state.openInNewTab(e);
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
          {props.onClose && (
            <button
              className="sg-now-playing-close"
              onClick={props.onClose}
              aria-label="Close Now Playing"
              title="Close Now Playing"
            >
              ×
            </button>
          )}
        </div>
      </header>

      <div className="sg2-bodyTitle">
        {state.url && !state.isYoutube ? (
          <a
            className="sg2-title-link"
            href={state.url}
            onClick={(e) => {
              props.activeCardId.value = props.item.id ?? null;

              props.nowPlayingId.value = null;

              state.openInNewTab(e);
            }}
            title="Open in Reflection Ministries"
            aria-label="Open in Reflection Ministries"
          >
            <h3 className="sg2-title" title={props.item.title}>
              {props.item.title}
            </h3>
          </a>
        ) : (
          <h3 className="sg2-title" title={props.item.title}>
            {props.item.title}
          </h3>
        )}
      </div>

      {state.desc ? <p className="sg2-desc">{state.desc}</p> : null}

      {/* Spacer for bottom alignment */}
      <div style={{ flex: 1 }}></div>

      {state.isYoutube && (
        <div className="sg-youtubeEmbed">{renderYoutubePlayer()}</div>
      )}

      {!state.isYoutube && (
        <div
          className="sg-previewAnim"
          style={{ "--sg-preview-h": `${state.previewH.value}px` }}
          aria-hidden={!props.isOpen}
        >
          {props.isOpen && state.canPreview && (
            <div
              className="sg-preview"
              ref={(n) => {
                state.previewRef.current = n;
              }}
            >
              <div className="sg-previewImgContainer">
                <img
                  className="sg-previewImg"
                  src={props.item.image_url}
                  alt={props.item.title || `preview-${props.item.id}`}
                />
              </div>
              {state.url && (
                <a
                  href={state.url}
                  className="sg-preview-learnMoreLink"
                  onClick={state.openInNewTab}
                  title="Open in Reflection Ministries"
                  aria-label="Open in Reflection Ministries"
                  style={{ color: "#fff", textDecoration: "none" }}
                >
                  {t("learnMore")}
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
