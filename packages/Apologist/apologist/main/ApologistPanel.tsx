/**
 * ApologistPanelWrapper — Panel wrapper that bridges globalThis search state
 * to the Apologist component props.
 *
 * This is mounted inside an AddApplication() panel and manages:
 * - Reading initial search context from globalThis
 * - Exposing UpdateStudyNoteSearch for push-based updates from thePage
 * - Polling globalThis.GlobalSearch as a fallback sync
 */

const { useState, useEffect, useCallback, useRef } = os.appHooks;

function ApologistPanelWrapper({ id }) {
  // ── Local state, initialized from globalThis ──
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
  const [searchTrigger, setSearchTrigger] = useState(0);

  // ── Expose update function so the Bible reader can push new search context ──
  const updateSearch = useCallback((query, options = {}) => {
    console.log("[ApologistPanel updateSearch] called with:", {
      query: query?.substring(0, 50),
      level: options.level,
      label: options.label,
      forceRefresh: options.forceRefresh,
    });
    setSearchQuery(query || "");
    if (options.level) setSearchLevel(options.level);
    if (options.label) setSearchLabel(options.label);
    if (options.baseline) setBaselineQuery(options.baseline);
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
      if (gs && gs !== searchQuery) {
        console.log("[ApologistPanel Poll] OVERRIDING search!", {
          oldQuery: searchQuery?.substring(0, 50),
          newQuery: gs?.substring(0, 50),
          oldLevel: searchLevel,
          newLevel: gsLevel,
        });
        setSearchQuery(gs);
        setSearchLevel(gsLevel);
        setSearchLabel(globalThis.GlobalSearchLabel || "");
        setBaselineQuery(globalThis.StudyNoteParentSearch || "");
        setSearchTrigger((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [searchQuery]);

  // ── Get the Apologist component ──
  const Apologist = globalThis.Apologist;

  if (!Apologist) {
    return (
      <div className="apologist-not-loaded">
        <span className="material-symbols-outlined">extension_off</span>
        <p>Apologist component not loaded.</p>
        <p style={{ fontSize: "0.75rem", opacity: 0.6 }}>
          Ensure the Apologist package is active.
        </p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
      <Apologist
        search={searchQuery}
        trigger={searchTrigger}
        level={searchLevel}
        baselineQuery={baselineQuery}
        label={searchLabel}
      />
    </div>
  );
}

// ── Export globally so other packages can reference it ──
globalThis.ApologistPanelWrapper = ApologistPanelWrapper;

// Return the component so thisBot.ApologistPanel() works as a factory
return ApologistPanelWrapper;
