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

// ── Logo URL (same icon used in the Apologist toolbar) ──
const APOLOGIST_LOGO_URL =
  "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png";

// ── Ask Ken AI Chat component ──
// Constants per official Apologist Fusion docs:
// https://apologistproject.org/documentation/apologist-fusion/chat-completion
const KENBOA_DOMAIN =
  "https://ken-boa-reflections-public.ministries.bot/api/v1/chat/completions";
const KENBOA_API_KEY = "apg_fw8aEJxwdpVkd7ctLLhWK3CbRlpN";

function AskKenTab({ context, label }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);
  const { openOnMobile, isMobile } = useSideBarContext();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage = { role: "user", content: query.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);
    setError(null);

    // Build prompt with Bible context + conversation history
    // Max 15 messages, truncate assistant replies to keep prompt lean
    // Read context directly from globalThis for the freshest value
    const currentContext = globalThis.GlobalSearch || context || "";
    const currentLabel = globalThis.GlobalSearchLabel || label || "";
    const contextPrefix = currentContext
      ? `[The user is currently reading: ${currentLabel || currentContext}]\n\n`
      : "";
    const recentMessages = newMessages.slice(-15);
    const chatHistory =
      recentMessages.length === 1
        ? recentMessages[0].content
        : recentMessages
            .map((m) => {
              if (m.role === "user") return `User: ${m.content}`;
              const short =
                m.content.length > 200
                  ? m.content.substring(0, 200) + "..."
                  : m.content;
              return `Assistant: ${short}`;
            })
            .join("\n");
    const prompt = contextPrefix + chatHistory;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", KENBOA_DOMAIN);
    xhr.setRequestHeader("x-api-key", KENBOA_API_KEY);
    xhr.setRequestHeader("Content-Type", "text/plain");

    let assistantContent = "";
    let lastParsedLength = 0;

    // Parse SSE chunks progressively as they arrive
    xhr.onprogress = () => {
      const newText = xhr.responseText.substring(lastParsedLength);
      lastParsedLength = xhr.responseText.length;

      const lines = newText.split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            assistantContent += delta;
            setMessages([
              ...newMessages,
              { role: "assistant", content: assistantContent },
            ]);
          }
        } catch {}
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!assistantContent) {
          setError("No response received. Please try again.");
        }
      } else {
        setError(`Error: ${xhr.status}. Please try again.`);
      }
      setIsLoading(false);
    };

    xhr.onerror = () => {
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    };

    xhr.ontimeout = () => {
      setError("Request timed out. Please try again.");
      setIsLoading(false);
    };

    xhr.timeout = 120000;

    xhr.send(JSON.stringify({ prompt, stream: true }));
  };

  const handleNewChat = () => {
    setMessages([]);
    setQuery("");
    setError(null);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="askken-container">
      <div className="askken-content">
        {/* Top bar */}

        {hasMessages && (
          <button className="askken-newchat-btn" onClick={handleNewChat}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
                fill="currentColor"
              />
            </svg>
            {t("newChat")}
          </button>
        )}

        {/* Messages area */}
        <div className="askken-messages">
          {!hasMessages && (
            <div className="askken-hero">
              <p className="askken-subtitle">{t("kenSubtitle")}</p>
              <h1 className="askken-heading">{t("kenHeading")}</h1>
              <p className="askken-description">{t("kenDescription")}</p>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="askken-msg askken-msg-user">
                <div className="askken-bubble askken-bubble-user">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="askken-msg askken-msg-assistant">
                <img
                  src={APOLOGIST_LOGO_URL}
                  alt=""
                  className="askken-msg-avatar"
                />
                <div className="askken-bubble askken-bubble-assistant">
                  {(msg.content || "")
                    .trim()
                    .split(/\n+/)
                    .map((para, idx) => (
                      <p
                        key={idx}
                        style={{ margin: idx === 0 ? 0 : "0.4em 0 0" }}
                      >
                        {para}
                      </p>
                    ))}
                </div>
              </div>
            )
          )}

          {isLoading && (
            <div className="askken-msg askken-msg-assistant">
              <img
                src={APOLOGIST_LOGO_URL}
                alt=""
                className="askken-msg-avatar"
              />
              <div className="askken-bubble askken-bubble-assistant askken-thinking">
                <span className="askken-dot" />
                <span className="askken-dot" />
                <span className="askken-dot" />
              </div>
            </div>
          )}

          {error && <div className="askken-error">{error}</div>}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        <div className="askken-chat-area">
          <div className="askken-input-row">
            <input
              type="text"
              className="askken-input"
              placeholder={t("askQuestion")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              disabled={isLoading}
            />
            <button
              className="askken-send-btn"
              onClick={handleSubmit}
              disabled={isLoading || !query.trim()}
              aria-label="Send"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        {!isMobile && (
          <p className="askken-footer">{t("reflectionCopyRight")}</p>
        )}
      </div>
    </div>
  );
}

// ── Reflection Ministries iframe viewer ──
function MinistriesTab({ url, title, onTouchEnd, onTouchStart }) {
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
        title={title || "Preview"}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
      <div
        className="ministries-swipe-layer"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      />
    </div>
  );
}

function ApologistPanelWrapper({ id }) {
  const { t } = useSideBarContext();
  // ── Tab state ──
  const [activeTab, setActiveTab] = useState("discovery");
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
  const [searchTrigger, setSearchTrigger] = useState(0);

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
      const gsLabel = globalThis.GlobalSearchLabel || "";

      // Detect change in search text, OR level, OR label
      const hasChanged =
        (gs && gs !== searchQuery) ||
        gsLevel !== searchLevel ||
        gsLabel !== searchLabel;

      if (gs && hasChanged) {
        console.log("[ApologistPanel Poll] OVERRIDING search!", {
          oldQuery: searchQuery?.substring(0, 50),
          newQuery: gs?.substring(0, 50),
          oldLevel: searchLevel,
          newLevel: gsLevel,
          oldLabel: searchLabel,
          newLabel: gsLabel,
        });
        setSearchQuery(gs);
        setSearchLevel(gsLevel);
        setSearchLabel(gsLabel);
        setBaselineQuery(globalThis.StudyNoteParentSearch || "");
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
        if (!vc || !vc.text) return;

        // Build a unique key to detect changes
        const key = `${vc.book}-${vc.chapter}-${vc.verseNumber}`;
        if (key === lastVerseKey) return;
        lastVerseKey = key;

        const verseLabel = `${vc.book || ""} ${vc.chapter || ""}:${vc.verseNumber || ""}`;

        console.log(
          "[ApologistPanel] VERSE CLICK detected via ON_VERSE_CLICK!",
          {
            verseLabel,
            textSnippet: vc.text?.substring(0, 50),
          }
        );

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

  const tabs = [
    { key: "discovery", label: "discovery", icon: "explore" },
    { key: "askken", label: "askKen", icon: "chat" },
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
            title={tab.label}
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
      </div>

      {/* ── Tab Content ── */}
      <div
        style={{ flex: 1, overflow: "auto", position: "relative" }}
        onTouchStart={activeTab !== "ministries" ? handleTouchStart : undefined}
        onTouchEnd={activeTab !== "ministries" ? handleTouchEnd : undefined}
      >
        {activeTab === "discovery" && (
          <Apologist
            search={searchQuery}
            trigger={searchTrigger}
            level={searchLevel}
            baselineQuery={baselineQuery}
            label={searchLabel}
          />
        )}
        {activeTab === "ministries" && (
          <MinistriesTab
            url={ministriesUrl}
            title={ministriesTitle}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          />
        )}
        {activeTab === "askken" && (
          <AskKenTab context={searchQuery} label={searchLabel} />
        )}
      </div>

      {/* ── Styles ── */}
      <style>{`
        /* ── Tab Bar ── */
  .apologist-tab-bar {
  display: grid;
  
  grid-template-columns: repeat(3, 1fr);
  gap: 2px; /* always > 3px */
  padding: 4px 4px 0px 4px;
  border-bottom: 1px solid var(--inputBorder, #2d2d2d);
  background: var(--panelBackground, #161616);
}
 


        .apologist-tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px 6px;
  height: 100%;

  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;

  color: var(--text2, #777);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;

  transition: all 0.2s ease;

  min-width: 0;          /* IMPORTANT */
  overflow: hidden;      /* prevent overflow */
}

        .apologist-tab:hover {
          color: var(--text1, #bbb);
          background: rgba(128, 128, 128, 0.06);
        }

        .apologist-tab--active {
          color: var(--text1, #fff);
          border-bottom-color: var(--accentColor, #a1bd4f);
        }

        .apologist-tab--active:hover {
          color: var(--text1, #fff);
        }

        .apologist-tab-icon {
          font-size: 18px;
      }
        .apologist-tab-image-icon {
        width: 28px !important;
        height: 28px !important;
        object-fit: contain;
          
          }

        .apologist-tab-label {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

        /* ── Reflection Ministries Tab ── */
        .ministries-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 300px;
          padding: 2rem;
          text-align: center;
          color: var(--text2, #999);
        }
          .ministries-viewer {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.ministries-iframe {
  flex: 1;
  width: 100%;
  border: none;
  background: #fff;
}

.ministries-swipe-layer {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  z-index: 10;
}

      

        .ministries-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--panelBackground, #1a1a1a);
          border-bottom: 1px solid var(--inputBorder, #2d2d2d);
          flex-shrink: 0;
        }

        .ministries-title {
          color: var(--text1, #ccc);
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 80%;
        }

        .ministries-external-link {
          display: inline-flex;
          align-items: center;
          padding: 4px;
          color: var(--text2, #888);
          text-decoration: none;
          border-radius: 4px;
          transition: background 0.2s;
        }

        .ministries-external-link:hover {
          background: rgba(128, 128, 128, 0.12);
        }

       

        /* ── Ask Ken Tab ── */
        .askken-container {
          height: 100%;
          
          background: var(--panelBackground, #fafafa);

        }
        .askken-content {
          display: flex;
          flex-direction: column;
          height:92.8%;
          padding: 8px 0px;
        }

        


        .askken-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          background: var(--panelBackground, #fff);
          border-bottom: 3px solid var(--accentColor, #6b3a2a);
        }

        .askken-logo-group {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .askken-logo {
          width: 36px;
          height: 36px;
          object-fit: contain;
        }

        .askken-logo-text {
          display: flex;
          flex-direction: column;
          line-height: 1.1;
        }

        .askken-logo-name {
          font-size: 14px;
          font-weight: 700;
          color: var(--text1, #222);
          letter-spacing: 2px;
        }

        .askken-logo-sub {
          font-size: 9px;
          font-weight: 500;
          color: var(--text2, #666);
          letter-spacing: 3px;
          text-transform: uppercase;
        }

        .askken-hero {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px 16px;
          text-align: center;
        }

        .askken-subtitle {
          font-size: 16px;
          color: var(--text2, #888);
          margin: 0 0 8px;
          font-weight: 400;
        }

        .askken-heading {
          font-size: 36px;
          font-weight: 700;
          color: var(--text1, #1a1a1a);
          margin: 0 0 24px;
          font-family: Georgia, "Times New Roman", serif;
          line-height: 1.2;
        }

        .askken-description {
          font-size: 14px;
          color: var(--text2, #777);
          line-height: 1.7;
          max-width: 420px;
          margin: 0;
        }

        .askken-chat-area {
          padding: 10px 12px;
          background: var(--panelBackground, #fff);
          border-top: 1px solid var(--inputBorder, #e5e5e5);
        }

        .askken-input-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .askken-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid var(--inputBorder, #ddd);
          border-radius: 24px;
          font-size: 14px;
          color: var(--text1, #333);
          background: var(--panelBackground, #fff);
          outline: none;
          font-family: inherit;
        }

        .askken-input::placeholder {
          color: var(--text2, #aaa);
        }

        .askken-input:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .askken-send-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: var(--accentColor, #222);
          color: var(--panelBackground, #fff);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }

        .askken-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .askken-send-btn:hover:not(:disabled) {
          opacity: 0.8;
        }

        .askken-more-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: none;
          background: var(--text2, #888);
          color: var(--panelBackground, #fff);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: opacity 0.2s;
          flex-shrink: 0;
        }

        .askken-more-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .askken-more-btn:hover:not(:disabled) {
          opacity: 0.8;
        }

        .askken-footer {
          text-align: center;
          font-size: 11px;
          color: var(--text2, #aaa);
          margin-bottom: -30px;
          
        }

        /* ── Chat messages ── */
        .askken-messages {
          flex: 1;
          overflow-y: auto;
          padding: 4px 10px 8px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .askken-msg {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          max-width: 90%;
          animation: askken-fadeIn 0.3s ease;
        }

        .askken-msg-user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .askken-msg-assistant {
          align-self: flex-start;
        }

        .askken-msg-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          object-fit: contain;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .askken-bubble {
          padding: 4px 12px 8px;
          border-radius: 16px;
          font-size: 14px;
          line-height: 1.5;
          word-wrap: break-word;
          white-space: normal;
          text-indent: 0;
        }

        .askken-bubble-user {
          background: var(--accentColor, #222);
          color: var(--panelBackground, #fff);
          border-bottom-right-radius: 4px;
        }

        .askken-bubble-assistant {
          background: var(--inputBackground, #f0f0f0);
          color: var(--text1, #222);
          border-bottom-left-radius: 4px;
        }

        /* ── Thinking dots ── */
        .askken-thinking {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 18px;
        }

        .askken-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text2, #888);
          animation: askken-bounce 1.4s ease-in-out infinite;
        }

        .askken-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .askken-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes askken-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        @keyframes askken-fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ── New Chat button ── */
        .askken-newchat-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 16px;
          border: 1px solid var(--inputBorder, #ddd);
          background: transparent;
          color: var(--text2, #666);
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }

        .askken-newchat-btn:hover {
          background: var(--inputBackground, #f0f0f0);
          color: var(--text1, #222);
        }

        /* ── Error display ── */
        .askken-error {
          text-align: center;
          padding: 8px 16px;
          margin: 4px 0;
          font-size: 13px;
          color: #e57373;
          background: rgba(229, 115, 115, 0.08);
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}

// ── Export globally so other packages can reference it ──
globalThis.ApologistPanelWrapper = ApologistPanelWrapper;

// Return the component so thisBot.ApologistPanel() works as a factory
return ApologistPanelWrapper;
