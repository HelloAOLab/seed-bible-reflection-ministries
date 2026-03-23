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
const G = globalThis as any;

// ── Chat persistence helpers (CasualOS Records API + localStorage fallback) ──
const MAX_CHATS = 50;
const chatCache = new Map(); // in-memory cache: chatId → full chat object

// ── localStorage helpers (for anonymous users) ──
function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[AskKen] localStorage write error:", e);
  }
}
function lsRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

function generateChatTitle(content) {
  if (!content) return "New Chat";
  const clean = content.replace(/\s+/g, " ").trim();
  if (clean.length <= 40) return clean;
  const truncated = clean.substring(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "…";
}

function formatRelativeTime(timestamp, t) {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return t("justNow");
  if (diff < 3600)
    return t("minutesAgo").replace("{{count}}", Math.floor(diff / 60));
  if (diff < 86400)
    return t("hoursAgo").replace("{{count}}", Math.floor(diff / 3600));
  return t("daysAgo").replace("{{count}}", Math.floor(diff / 86400));
}

async function getAuthBot() {
  try {
    const authBot = await os.requestAuthBotInBackground();
    console.log("[AskKen] getAuthBot result:", authBot?.id || "NOT LOGGED IN");
    return authBot;
  } catch (e) {
    console.log("[AskKen] getAuthBot ERROR:", e);
    return null;
  }
}

async function loadChatIndex() {
  // Try server first
  const authBot = await getAuthBot();
  if (authBot?.id) {
    try {
      const result = await os.getData(authBot.id, "askken_chats");
      console.log("[AskKen] loadChatIndex server result:", result);
      return {
        chats: result?.data?.chats || [],
        activeId: result?.data?.activeId || null,
      };
    } catch (e) {
      console.log("[AskKen] loadChatIndex server ERROR:", e);
    }
  }
  // Fallback: localStorage
  const stored = lsGet("askken_chats");
  if (stored?.chats) {
    console.log(
      "[AskKen] loadChatIndex from localStorage:",
      stored.chats.length,
      "chats"
    );
    return { chats: stored.chats, activeId: stored.activeId || null };
  }
  // Final fallback: build from in-memory cache
  const cached = [];
  chatCache.forEach((chat) => {
    cached.push({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });
  });
  console.log("[AskKen] loadChatIndex from cache:", cached.length, "chats");
  return { chats: cached, activeId: null };
}

async function saveChatIndex(chats, activeId) {
  const trimmed = chats.slice(0, MAX_CHATS);
  const payload = { chats: trimmed, activeId: activeId || null };
  // Try server save
  const authBot = await getAuthBot();
  if (authBot?.id) {
    try {
      console.log(
        "[AskKen] saveChatIndex: saving",
        trimmed.length,
        "chats to server"
      );
      const res = await os.recordData(authBot.id, "askken_chats", payload, {
        marker: "bookmarks",
      });
      console.log("[AskKen] saveChatIndex result:", res);
      return;
    } catch (e) {
      console.warn("[AskKen] saveChatIndex server ERROR:", e);
    }
  }
  // Fallback: localStorage
  lsSet("askken_chats", payload);
  console.log("[AskKen] saveChatIndex saved to localStorage");
}

async function loadFullChat(chatId) {
  // Check in-memory cache first
  if (chatCache.has(chatId)) {
    console.log("[AskKen] loadFullChat from cache:", chatId);
    return chatCache.get(chatId);
  }
  // Try server
  const authBot = await getAuthBot();
  if (authBot?.id) {
    try {
      const result = await os.getData(authBot.id, "askken_chat_" + chatId);
      if (result?.data) {
        chatCache.set(chatId, result.data);
        return result.data;
      }
    } catch (e) {
      console.log("[AskKen] loadFullChat server ERROR:", e);
    }
  }
  // Fallback: localStorage
  const stored = lsGet("askken_chat_" + chatId);
  if (stored) {
    chatCache.set(chatId, stored);
    console.log("[AskKen] loadFullChat from localStorage:", chatId);
    return stored;
  }
  return null;
}

async function saveFullChat(chat) {
  // Always save to in-memory cache
  chatCache.set(chat.id, chat);
  console.log("[AskKen] saveFullChat cached:", chat.id);
  // Attempt server save
  const authBot = await getAuthBot();
  if (authBot?.id) {
    try {
      const res = await os.recordData(
        authBot.id,
        "askken_chat_" + chat.id,
        chat,
        { marker: "bookmarks" }
      );
      console.log("[AskKen] saveFullChat server result:", res);
      return;
    } catch (e) {
      console.warn("[AskKen] saveFullChat server ERROR:", e);
    }
  }
  // Fallback: localStorage
  lsSet("askken_chat_" + chat.id, chat);
  console.log("[AskKen] saveFullChat saved to localStorage:", chat.id);
}

async function deleteFullChat(chatId) {
  chatCache.delete(chatId);
  const authBot = await getAuthBot();
  if (authBot?.id) {
    try {
      await os.recordData(authBot.id, "askken_chat_" + chatId, null, {
        marker: "bookmarks",
      });
      return;
    } catch (e) {
      console.warn("[AskKen] deleteFullChat server ERROR:", e);
    }
  }
  // Fallback: localStorage
  lsRemove("askken_chat_" + chatId);
}

// ── History sidebar sub-component ──
function ChatHistoryPanel({
  chatIndex,
  activeChatId,
  onSelect,
  onDelete,
  onClose,
  t,
}) {
  return (
    <div className="askken-history-panel">
      <div className="askken-history-header">
        <span className="askken-history-title">{t("chatHistory")}</span>
        <button
          className="askken-history-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
      <div className="askken-history-list">
        {chatIndex.length === 0 ? (
          <div className="askken-history-empty">
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "32px", opacity: 0.4 }}
            >
              forum
            </span>
            <p>{t("noChatsYet")}</p>
          </div>
        ) : (
          chatIndex.map((chat) => (
            <div
              key={chat.id}
              className={`askken-history-item ${chat.id === activeChatId ? "askken-history-item--active" : ""}`}
              onClick={() => onSelect(chat.id)}
            >
              <div className="askken-history-item-content">
                <span className="askken-history-item-title">
                  {chat.title || "New Chat"}
                </span>
                <span className="askken-history-item-time">
                  {formatRelativeTime(chat.updatedAt, t)}
                </span>
              </div>
              <button
                className="askken-history-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(chat.id);
                }}
                aria-label={t("deleteChat")}
                title={t("deleteChat")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Main AskKenTab component ──
function AskKenTab({ context, label }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { openOnMobile, isMobile } = useSideBarContext();

  // ── Multi-chat state ──
  const [chatIndex, setChatIndex] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const saveTimerRef = useRef(null);
  const chatIndexRef = useRef([]);

  // Keep ref in sync with state to avoid stale closures in XHR callbacks
  useEffect(() => {
    chatIndexRef.current = chatIndex;
  }, [chatIndex]);

  // ── Load chat index + restore active chat on mount ──
  useEffect(() => {
    (async () => {
      console.log("[AskKen] Mount: checking auth...");
      const authBot = await getAuthBot();
      const loggedIn = !!authBot?.id;
      console.log("[AskKen] Mount: loggedIn =", loggedIn, "authBot =", authBot);
      setIsLoggedIn(loggedIn);
      // Load index (works for both logged-in and anonymous)
      const { chats: index, activeId } = await loadChatIndex();
      console.log(
        "[AskKen] Mount: loaded index with",
        index.length,
        "chats, activeId:",
        activeId
      );
      const sorted = [...index].sort(
        (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
      );
      setChatIndex(sorted);
      // Restore the last active chat
      if (activeId) {
        const fullChat = await loadFullChat(activeId);
        if (fullChat?.messages) {
          setMessages(fullChat.messages);
          setActiveChatId(activeId);
          console.log("[AskKen] Mount: restored active chat", activeId);
        }
      }
      setHistoryLoaded(true);
    })();
  }, []);

  // Auto-scroll to bottom on new messages
  /* useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);*/

  // ── Debounced save after messages change ──
  const persistCurrentChat = useCallback(async (msgs, chatId) => {
    if (!chatId || msgs.length === 0) return;
    const index = chatIndexRef.current; // always fresh via ref
    console.log("[AskKen] Persisting chat", chatId, "msgs:", msgs.length);
    const chat = {
      id: chatId,
      title: generateChatTitle(msgs.find((m) => m.role === "user")?.content),
      messages: msgs,
      createdAt: index.find((c) => c.id === chatId)?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };
    await saveFullChat(chat);
    // Update index
    const meta = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
    const newIndex = [meta, ...index.filter((c) => c.id !== chatId)].slice(
      0,
      MAX_CHATS
    );
    setChatIndex(newIndex);
    await saveChatIndex(newIndex, chatId);
    console.log("[AskKen] Saved. Index now has", newIndex.length, "chats");
  }, []);

  const scheduleSave = useCallback(
    (msgs, chatId) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        persistCurrentChat(msgs, chatId);
      }, 1500);
    },
    [persistCurrentChat]
  );

  // ── Handle new chat ──
  const handleNewChat = useCallback(() => {
    // Save current before clearing (if there's content)
    if (activeChatId && messages.length > 0) {
      persistCurrentChat(messages, activeChatId);
    }
    setActiveChatId(null);
    setMessages([]);
    setQuery("");
    setError(null);
    setShowHistory(false);
  }, [activeChatId, messages, persistCurrentChat]);

  // ── Handle chat selection from history ──
  const handleSelectChat = useCallback(
    async (chatId) => {
      // Save current first
      if (activeChatId && messages.length > 0) {
        persistCurrentChat(messages, activeChatId);
      }
      setShowHistory(false);
      setMessages([]);
      setError(null);
      setIsLoading(true);
      const fullChat = await loadFullChat(chatId);
      console.log("[AskKen] Loaded chat", chatId, fullChat);
      if (fullChat?.messages) {
        setMessages(fullChat.messages);
        setActiveChatId(chatId);
      }
      setIsLoading(false);
    },
    [activeChatId, messages, persistCurrentChat]
  );

  // ── Handle chat deletion ──
  const handleDeleteChat = useCallback(
    async (chatId) => {
      const newIndex = chatIndex.filter((c) => c.id !== chatId);
      setChatIndex(newIndex);
      await saveChatIndex(
        newIndex,
        activeChatId === chatId ? null : activeChatId
      );
      await deleteFullChat(chatId);
      if (chatId === activeChatId) {
        setActiveChatId(null);
        setMessages([]);
        setError(null);
      }
    },
    [chatIndex, activeChatId]
  );

  // ── Submit message ──
  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    const userMessage = { role: "user", content: query.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setQuery("");
    setIsLoading(true);
    setError(null);

    // Create a new chat if needed
    let currentChatId = activeChatId;
    if (!currentChatId) {
      currentChatId = Date.now().toString();
      setActiveChatId(currentChatId);
    }

    // Build prompt with Bible context + conversation history
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
        } else {
          // Always attempt save — storage functions check auth internally
          const finalMessages = [
            ...newMessages,
            { role: "assistant", content: assistantContent },
          ];
          console.log(
            "[AskKen] Response complete, scheduling save for chat",
            currentChatId
          );
          scheduleSave(finalMessages, currentChatId);
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

  const hasMessages = messages.length > 0;

  return (
    <div className="askken-container">
      <div className="askken-content">
        {/* ── Top action bar ── */}
        <div className="askken-topbar-actions">
          <button
            className="askken-topbar-icon-btn"
            onClick={handleNewChat}
            title={t("newChat")}
            aria-label={t("newChat")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M14.06 9.02l.92.92L5.92 19H5v-.92l9.06-9.06M17.66 3c-.25 0-.51.1-.7.29l-1.83 1.83 3.75 3.75 1.83-1.83a.996.996 0 0 0 0-1.41l-2.34-2.34c-.2-.2-.45-.29-.71-.29zm-3.6 3.19L3 17.25V21h3.75L17.81 9.94l-3.75-3.75z"
                fill="currentColor"
              />
              <path d="M3 21h18v2H3v-2z" fill="currentColor" />
            </svg>
          </button>
          <button
            className="askken-topbar-icon-btn"
            onClick={() => setShowHistory(!showHistory)}
            title={t("chatHistory")}
            aria-label={t("chatHistory")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>

        {/* ── History drawer (slides from right) ── */}
        {showHistory && (
          <>
            <div
              className="askken-history-backdrop"
              onClick={() => setShowHistory(false)}
            />
            <ChatHistoryPanel
              chatIndex={chatIndex}
              activeChatId={activeChatId}
              onSelect={handleSelectChat}
              onDelete={handleDeleteChat}
              onClose={() => setShowHistory(false)}
              t={t}
            />
          </>
        )}

        {/* ── Messages area ── */}
        <div className="askken-messages">
          {!hasMessages && !showHistory && (
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

          <div />
        </div>

        {/* ── Chat input ── */}
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
        title={title || "Preview"}
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

function ApologistPanelWrapper({ id }) {
  const { t } = useSideBarContext();
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
        if (!vc || !vc.text) return;

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
        <span
          title="Close"
          className="material-symbols-outlined apologist-close"
          onClick={() => {
            G.RemoveApplicationByLabel(G.ActiveMoreApp);
            G.makingApp = null;
            G.SetActiveMoreApp(null);
            G.ActiveMoreApp = null;
          }}
        >
          arrow_back
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
          }}
        >
          <Apologist
            search={searchQuery}
            trigger={searchTrigger}
            level={searchLevel}
            baselineQuery={baselineQuery}
            label={searchLabel}
            chapterData={chapterData}
            setCameFromDiscovery={setCameFromDiscovery}
          />
        </div>

        {/* ── Ministries ── */}
        <div
          style={{
            display: activeTab === "ministries" ? "block" : "none",
            height: "100%",
          }}
        >
          <MinistriesTab
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
        <div
          style={{
            display: activeTab === "askken" ? "block" : "none",
            height: "100%",
          }}
        >
          <AskKenTab context={searchQuery} label={searchLabel} />
        </div>
      </div>

      {/* ── Styles ── */}
      <style>{`
        /* ── Tab Bar ── */
  .apologist-tab-bar {
  padding-right: 45px;

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
  padding: 6px 8px;
  height: 100%;
  margin-left: 5px;

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
 .apologist-close {
  position: absolute;

  top: 14px;
  
  left:6px;
  font-size: 12px;
  color: var(--text2, #aaa);
  cursor: pointer;
  transition: all 0.2s ease;

  z-index: 5;
}
.material-symbols-outlined.apologist-close {
  font-size: 20px;
}
/* Hover — soft themed glow */
.apologist-close:hover {
 
  background: rgba(161, 189, 79, 0.12);
}

/* Active — tactile press */
.apologist-close:active {
  transform: scale(0.92);
  background: rgba(161, 189, 79, 0.2);
}

/* Optional: subtle border for depth */
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
  padding-bottom: 40px;
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
        .sg-back-icon {
         display: inline-flex;
          align-items: center;
          padding: 4px;
          color: var(--text2, #888);
          text-decoration: none;
          border-radius: 4px;
          transition: background 0.2s;
        }
          .sg-back-icon:hover {
          background: rgba(128, 128, 128, 0.12);
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

        /* ── Top action bar ── */
        .askken-topbar-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 10px 10px 6px;
          gap: 12px;
          flex-shrink: 0;
        }

        .askken-topbar-icon-btn {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          border: 1.5px solid var(--inputBorder, #3a3a3a);
          background: transparent;
          color: var(--text2, #888);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }

        .askken-topbar-icon-btn:hover {
          background: rgba(128, 128, 128, 0.12);
          color: var(--text1, #ddd);
          border-color: var(--text2, #666);
        }

        .askken-topbar-icon-btn:active {
          background: rgba(128, 128, 128, 0.2);
        }

        /* ── Chat History Drawer (slides from right) ── */
        .askken-history-backdrop {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.35);
          z-index: 19;
          animation: askken-fadeBackdrop 0.25s ease;
        }

        @keyframes askken-fadeBackdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .askken-history-panel {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 85%;
          max-width: 320px;
          background: var(--panelBackground, #fafafa);
          z-index: 20;
          display: flex;
          flex-direction: column;
          box-shadow: -4px 0 16px rgba(0, 0, 0, 0.15);
          animation: askken-slideRight 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        @keyframes askken-slideRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .askken-history-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--inputBorder, #e5e5e5);
          flex-shrink: 0;
        }

        .askken-history-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text1, #222);
        }

        .askken-history-close {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text2, #888);
          padding: 4px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }

        .askken-history-close:hover {
          background: var(--inputBackground, #f0f0f0);
          color: var(--text1, #222);
        }

        .askken-history-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .askken-history-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          cursor: pointer;
          transition: background 0.15s;
          gap: 8px;
        }

        .askken-history-item:hover {
          background: var(--inputBackground, #f0f0f0);
        }

        .askken-history-item--active {
          background: rgba(107, 58, 42, 0.08);
          border-left: 3px solid var(--accentColor, #6b3a2a);
        }

        .askken-history-item-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .askken-history-item-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text1, #222);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .askken-history-item-time {
          font-size: 11px;
          color: var(--text2, #999);
        }

        .askken-history-delete {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text2, #bbb);
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
        }

        .askken-history-item:hover .askken-history-delete {
          opacity: 1;
        }

        .askken-history-delete:hover {
          color: #e57373;
          background: rgba(229, 115, 115, 0.1);
        }

        .askken-history-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          color: var(--text2, #999);
          gap: 8px;
        }

        .askken-history-empty p {
          margin: 0;
          font-size: 13px;
        }

        /* ── Sign-in hint ── */
        .askken-signin-hint {
          margin-top: 16px;
          font-size: 12px;
          color: var(--text2, #aaa);
          font-style: italic;
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
