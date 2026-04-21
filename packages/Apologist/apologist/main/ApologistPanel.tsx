/**
 * ApologistPanelWrapper — Tabbed panel wrapper with three tabs:
 *   1. Discovery — existing Apologist search results
 *   2. Reflection Ministries — iframe content viewer for opened links
 *   3. Ask Ken — themed placeholder (kenboa.org style)
 *
 * This is mounted inside an AddApplication() panel and manages:
 * - Reading initial search context from globalThis
 * - Exposing UpdateStudyNoteSearch for push-based updates from thePage
 * - Polling globalThis.GlobalSearch as a fallback sync
 * - Tab navigation and inter-tab communication
 */
const { useSideBarContext } = await import("app.hooks.sideBar");
const { useState, useEffect, useCallback, useRef } = os.appHooks;
const getStyleOf = await thisBot.GetStyle();

const G = globalThis as any;

// ── Logo URL (same icon used in the Apologist toolbar) ──
// Fallback: localStorage
// ── Reflection Ministries iframe viewer ──

function ApologistPanelWrapper({ id }) {
  const { t, openOnMobile, isMobile } = useSideBarContext();
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState("discovery");

  const [cameFromDiscovery, setCameFromDiscovery] = useState(false);
  const [ministriesUrl, setMinistriesUrl] = useState(
    "https://www.kenboa.org/blog/"
  );
  const [ministriesTitle, setMinistriesTitle] = useState("Ken Boa Blog");

  // ── Search state, initialized from globalThis ──
  const [searchQuery, setSearchQuery] = useState(globalThis.GlobalSearch || "");
  const [searchLevel, setSearchLevel] = useState(
    globalThis.GlobalSearchLevel || "chapter"
  );
  const [searchLabel, setSearchLabel] = useState(
    globalThis.GlobalSearchLabel || ""
  );
  const [baselineQuery, setBaselineQuery] = useState(
    globalThis.StudyNoteParentSearch || ""
  );
  const [chapterData, setChapterData] = useState(
    globalThis.GlobalSearchChapterData || null
  );

  const [searchTrigger, setSearchTrigger] = useState(0);
  const isNothingReady = !globalThis.MinistriesTab || !globalThis.Apologist;

  // ── Expose open-in-ministries-tab function ──
  const openInMinistriesTab = useCallback((url, title) => {
    setMinistriesUrl(url || "");
    setMinistriesTitle(title || "Preview");
    setActiveTab("ministries");
  }, []);

  useEffect(() => {
    globalThis.ApologistOpenInMinistriesTab = openInMinistriesTab;
    return () => {
      if (globalThis.ApologistOpenInMinistriesTab === openInMinistriesTab) {
        globalThis.ApologistOpenInMinistriesTab = null;
      }
    };
  }, [openInMinistriesTab]);

  // ── Expose update function so the Bible reader can push new search context ──
  const updateSearch = useCallback((query, options = {}) => {
    setSearchQuery(query || "");
    if (options.level) setSearchLevel(options.level);
    if (options.label) setSearchLabel(options.label);
    if (options.baseline) setBaselineQuery(options.baseline);
    if (Object.prototype.hasOwnProperty.call(options, "chapterData")) {
      setChapterData(options.chapterData || null);
    }
    if (options.forceRefresh) setSearchTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    globalThis.UpdateStudyNoteSearch = updateSearch;
    return () => {
      if (globalThis.UpdateStudyNoteSearch === updateSearch) {
        globalThis.UpdateStudyNoteSearch = null;
      }
    };
  }, [updateSearch]);

  // ── Poll for globalThis changes (fallback sync) ──
  useEffect(() => {
    const interval = setInterval(() => {
      const gs = globalThis.GlobalSearch || "";
      const gsLevel = globalThis.GlobalSearchLevel || "chapter";
      const gsLabel = globalThis.GlobalSearchLabel || "";

      // Detect change in search text, OR level, OR label
      const hasChanged =
        (gs && gs !== searchQuery) ||
        gsLevel !== searchLevel ||
        gsLabel !== searchLabel;

      if (gs && hasChanged) {
        setSearchQuery(gs);
        setSearchLevel(gsLevel);
        setSearchLabel(gsLabel);
        setBaselineQuery(globalThis.StudyNoteParentSearch || "");
        setChapterData(globalThis.GlobalSearchChapterData || null);
        setSearchTrigger((prev) => prev + 1);
      }
    }, 200);
    return () => clearInterval(interval);
  }, [searchQuery, searchLevel, searchLabel]);

  // ── Detect verse clicks by polling globalThis.ON_VERSE_CLICK ──
  // onVerseClick.tsx sets globalThis.ON_VERSE_CLICK = { verseNumber, text, chapter, book }
  // on every verse click. We poll this to detect verse-level searches.
  useEffect(() => {
    let lastVerseKey = "";

    const interval = setInterval(() => {
      try {
        const vc = globalThis.ON_VERSE_CLICK;
        if (
          !vc ||
          !vc.text ||
          (!globalThis.IsVerseClicked && !globalThis.IsVerseClickedOnDesktop)
        )
          return;

        // Build a unique key to detect changes
        const key = `${vc.book}-${vc.chapter}-${vc.verseNumber}`;
        if (key === lastVerseKey) return;
        lastVerseKey = key;

        const verseLabel = `${vc.book || ""} ${vc.chapter || ""}:${vc.verseNumber || ""}`;

        // Update globals
        globalThis.GlobalSearch = vc.text;
        globalThis.GlobalSearchLevel = "verse";
        globalThis.GlobalSearchLabel = verseLabel;

        // Update state directly
        setSearchQuery(vc.text);
        setSearchLevel("verse");
        setSearchLabel(verseLabel);
        setSearchTrigger((prev) => prev + 1);
      } catch (e) {
        console.warn("[ApologistPanel] verse click poll error:", e);
      }
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // ── Get the Apologist component ──
  if (isNothingReady) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div className="sg-spinner" />
          <div style={{ marginTop: 10 }}>Opening panel...</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "discovery", label: "discovery", icon: "explore" },
    {
      key: "ministries",
      label: "reflectionMinistries",
      icon: "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png",
    },
  ];
  // ── Swipe handling ──
  // ── Swipe handling ──
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const getClientX = (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      return e.changedTouches[0].clientX;
    }
    return e.clientX;
  };

  const handleTouchStart = (e) => {
    touchStartX.current = getClientX(e);
  };

  const handleTouchEnd = (e) => {
    touchEndX.current = getClientX(e);

    const deltaX = touchEndX.current - touchStartX.current;
    const threshold = 50;

    const currentIndex = tabs.findIndex((t) => t.key === activeTab);

    // Swipe Right → go to previous tab
    if (deltaX > threshold && currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1].key);
    }

    // Swipe Left → go to next tab
    if (deltaX < -threshold && currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1].key);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── Tab Bar ── */}
      <div className="apologist-tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`apologist-tab ${activeTab === tab.key ? "apologist-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            title={t(tab.label)}
          >
            {tab.icon.startsWith("http") ? (
              <img
                src={tab.icon}
                alt={tab.label}
                className="apologist-tab-image-icon"
              />
            ) : (
              <span className="material-symbols-outlined apologist-tab-icon">
                {tab.icon}
              </span>
            )}
            <span className="apologist-tab-label">{t(tab.label)}</span>
          </button>
        ))}

        <span
          title="Close"
          className="material-symbols-outlined apologist-close"
          onClick={() => {
            globalThis.IsVerseClicked = false;
            globalThis.ShowDiscoveryButton = true;
            const appToClose = G.ActiveMoreApp || "Discovery";

            G.RemoveApplicationByLabel(appToClose);

            G.makingApp = null;
            G.SetActiveMoreApp(null);
            G.ActiveMoreApp = null;
          }}
        >
          close
        </span>
      </div>

      {/* ── Tab Content ── */}

      <div
        style={{ flex: 1, overflow: "auto", position: "relative" }}
        onTouchStart={activeTab !== "ministries" ? handleTouchStart : undefined}
        onTouchEnd={activeTab !== "ministries" ? handleTouchEnd : undefined}
      >
        {/* ── Discovery ── */}
        <div
          style={{
            display: activeTab === "discovery" ? "block" : "none",
            height: "100%",
            marginBottom: isMobile ? "50px" : "0px",
            position: "relative",
          }}
        >
          {/* 🔥 Fallback UI (mobile only) */}

          <globalThis.Apologist
            search={searchQuery}
            trigger={searchTrigger}
            level={searchLevel}
            baselineQuery={baselineQuery}
            label={searchLabel}
            chapterData={chapterData}
            setCameFromDiscovery={setCameFromDiscovery}
            // 👇 ADD THIS LINE
          />
        </div>

        {/* ── Ministries ── */}
        <div
          style={{
            display: activeTab === "ministries" ? "block" : "none",
            height: "100%",
          }}
        >
          <globalThis.MinistriesTab
            url={ministriesUrl}
            title={ministriesTitle}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            cameFromDiscovery={cameFromDiscovery}
            setCameFromDiscovery={setCameFromDiscovery}
            setActiveTab={setActiveTab}
          />
        </div>

        {/* ── Ask Ken ── */}
      </div>

      {/* ── Styles ── */}
      <style>{getStyleOf("apologistPanel.css")}</style>
    </div>
  );
}

// ── Export globally so other packages can reference it ──
globalThis.ApologistPanelWrapper = ApologistPanelWrapper;

// Return the component so thisBot.ApologistPanel() works as a factory
return ApologistPanelWrapper;
