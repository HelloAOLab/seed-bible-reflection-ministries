function MinistriesTab({
  url,
  title,
  onTouchEnd,
  onTouchStart,
  cameFromDiscovery,
  setCameFromDiscovery,
  setActiveTab,
}) {
  if (!url) {
    return (
      <div className="ministries-empty">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "48px", color: "var(--text2, #555)" }}
        >
          web
        </span>
        <p
          style={{
            color: "var(--text2, #999)",
            marginTop: "12px",
            fontSize: "15px",
          }}
        >
          {t("openResourceFromDiscovery")}
        </p>
      </div>
    );
  }

  return (
    <div className="ministries-viewer">
      <div className="ministries-toolbar">
        {cameFromDiscovery && (
          <span
            title="Discovery"
            className="material-symbols-outlined sg-back-icon"
            onClick={() => {
              setActiveTab("discovery");
              setCameFromDiscovery(false);
            }}
          >
            arrow_back
          </span>
        )}
        <span className="ministries-title" title={title}>
          {title || "Preview"}
        </span>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ministries-external-link"
          title="Open in new tab"
        >
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
            <path
              d="M1 12C0.733333 12 0.5 11.9 0.3 11.7C0.1 11.5 0 11.2667 0 11V1C0 0.733333 0.1 0.5 0.3 0.3C0.5 0.1 0.733333 0 1 0H5.65V1H1V11H11V6.35H12V11C12 11.2667 11.9 11.5 11.7 11.7C11.5 11.9 11.2667 12 11 12H1ZM4.36667 8.35L3.66667 7.63333L10.3 1H6.65V0H12V5.35H11V1.71667L4.36667 8.35Z"
              fill="currentColor"
            />
          </svg>
        </a>
      </div>

      <iframe
        className="ministries-iframe"
        src={url}
        style={{ pointerEvents: globalThis.IsDragging ? "none" : "auto" }}
        title={title || "Preview"}
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
      {/* TODO: Determine what this is for and how to not break scrolling in the ministries iframe */}
      {/* <div
        className="ministries-swipe-layer"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      /> */}
    </div>
  );
}
globalThis.MinistriesTab = MinistriesTab;
return MinistriesTab;
