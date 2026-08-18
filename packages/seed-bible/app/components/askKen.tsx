const { useSideBarContext } = await import("app.hooks.sideBar");
const { useTabsContext } = await import("app.hooks.tabs");
import { VerseRenderer } from "app.components.VerseRenderer";
import { useAIBibleAction } from "app.components.aiactions";
import { useBibleContext } from "app.hooks.bibleVariables";

const { useState, useEffect, useCallback, useRef } = os.appHooks;
const ChatHistoryPanel = await thisBot.AskKenChatHistory();
import { bibleRefrenceParser } from "app.components.bibleRefrenceParser";
import { parseTranslation } from "app.components.bibleRefrenceParser";
import { median } from "es-toolkit";
import { globalAPI } from "../controller/controllerBuilder";
const getStyleOf = await thisBot.GetStyle();
const DEFAULT_URL =
  "https://reflections-ministries.apologist.seedbible.io/api/v1/search?cache_ttl=300";
const APOLOGIST_API_KEY = thisBot?.tags?.APOLOGIST_API_KEY;

const apologistQuerySearch = async ({ userQuestion }) => {
  const authHeader = null;
  const cacheTtl = null;
  try {
    const payload = {
      query: userQuestion,
      limit: 5,
      filters: {
        team_ids: [160],
      },
    };

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(authHeader
        ? { Authorization: authHeader }
        : { Authorization: `Bearer ${APOLOGIST_API_KEY}` }),
      ...(cacheTtl != null ? { "x-cache-ttl": String(cacheTtl) } : {}),
    };

    const res = await web.post(DEFAULT_URL, payload, { headers });

    return res?.data?.results || [];
  } catch (err) {
    console.error("Apologist search failed:", err);
    return [];
  }
};
const getResourceIcon = (type) => {
  switch (type?.toLowerCase()) {
    case "youtube":
      return "smart_display";

    case "book":
      return "menu_book";

    case "url":
      return "link";

    case "article":
      return "article";

    case "episode":
      return "podcasts";

    case "media":
      return "video_library";

    default:
      return "description";
  }
};

const AskKen = () => {
  return (
    <div
      style={{
        alignItems: "center",
        justifyContent: "center",
        display: "flex",
        width: "32px",
        height: "32px",
        borderRadius: "60px",
        border: "0.5px solid black",
        backgroundColor: "white",
        color: "black",
        gap: "3px",
      }}
    >
      <img
        src="https://res.cloudinary.com/dpudrufae/image/upload/v1769591647/kenboa_clean_circle_b9zmpr.png"
        alt="askKen"
      />
    </div>
  );
};
const ActionModal = ({
  open,
  onClose,
  handleNewChat,
  handleChatHistory,
  handleClearChat,
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose(); // 👈 close when clicking outside
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onClose]);
  return (
    <div
      ref={modalRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "10px",
        right: "30px",
        bottom: "80px",
        width: "165px",
        position: "absolute",
        height: "138px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div onClick={handleNewChat} style={itemStyle}>
        <span className="material-symbols-outlined">edit_square</span>
        <span>New Chat</span>
      </div>

      <div style={itemStyle} onClick={handleClearChat}>
        <span className="material-symbols-outlined">clear_all</span>
        <span>Clear Chat</span>
      </div>

      <div onClick={handleChatHistory} style={itemStyle}>
        <span className="material-symbols-outlined">history</span>
        <span>Chat History</span>
      </div>
    </div>
  );
};

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "5px",
  cursor: "pointer",
};

// ── Logo URL (same icon used in the Apologist toolbar) ──
const APOLOGIST_LOGO_URL =
  "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png";

// ── Ask Ken AI Chat component ──
// Constants per official Apologist Fusion docs:
// https://apologistproject.org/documentation/apologist-fusion/chat-completion
const KENBOA_DOMAIN =
  "https://reflections-ministries.apologist.seedbible.io/api/v1/chat/completions";

const G = globalThis as any;
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

  lsRemove("askken_chat_" + chatId);
}
const SIZE_MAP = {
  small: { width: 20, height: 35 },
  medium: { width: 32, height: 65 },
  large: { width: 36, height: 83 },
  mediumSlim: { width: 21, height: 65 },
  largeSlim: { width: 21, height: 83 },
};

function AskKenModal({
  versePrompt,
  setVersePrompt,
  setAskKenOpen,
  context,
  label,
  askKenOpen,
}) {
  const [messages, setMessages] = useState([]);
  const { tools } = useBibleContext();

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { openOnMobile, isMobile } = useSideBarContext();

  // ── Multi-chat state ──
  const [chatIndex, setChatIndex] = useState([]);

  const [askKenSize, setAskKenSize] = useState(() => {
    return localStorage.getItem("askKenSize") || "mediumSlim";
  });

  const [askKenModalSize, setAskKenModalSize] = useState(() => {
    const savedSize = localStorage.getItem("askKenSize") || "mediumSlim";

    return SIZE_MAP[savedSize];
  });
  const [activeChatId, setActiveChatId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [autoSend, setAutoSend] = useState(false);
  const [showModal, setShowModal] = useState(true);
  const [isCleared, setIsCleared] = useState(false);
  const saveTimerRef = useRef(null);
  const chatIndexRef = useRef([]);
  const [position, setPosition] = useState({ x: 13, y: 106 });
  const [dragging, setDragging] = useState(false);
  const [openActionModal, setOpenActionModal] = useState(false);
  const [apologistResources, setApologistResources] = useState([]);

  const [resizing, setResizing] = useState(false);

  const [resizeDirection, setResizeDirection] = useState(null);
  const { tabs } = useTabsContext();

  const resizeStartRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const offsetRef = useRef({ x: 0, y: 0 });
  const selectRef = useRef(null);

  const startResize = (e, direction) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);

    setResizing(true);

    setResizeDirection(direction);

    resizeStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,

      startWidth: window.innerWidth * (askKenModalSize.width / 100),

      startHeight: window.innerHeight * (askKenModalSize.height / 100),
    };
  };

  const handleMouseMove = (e) => {
    if (resizing) {
      const dx = e.clientX - resizeStartRef.current.startX;

      const dy = e.clientY - resizeStartRef.current.startY;

      const MIN_WIDTH = 310;
      const MIN_HEIGHT = 410;

      const MAX_WIDTH = window.innerWidth - 20;

      const MAX_HEIGHT = window.innerHeight - 20;

      let width = resizeStartRef.current.startWidth;

      let height = resizeStartRef.current.startHeight;

      // RIGHT
      if (resizeDirection?.includes("right")) {
        width += dx;
      }

      // LEFT
      if (resizeDirection?.includes("left")) {
        width -= dx;
      }

      // BOTTOM
      if (resizeDirection?.includes("bottom")) {
        height += dy;
      }

      // TOP
      if (resizeDirection?.includes("top")) {
        height -= dy;
      }

      // LIMITS
      width = Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH));

      height = Math.max(MIN_HEIGHT, Math.min(height, MAX_HEIGHT));

      setAskKenModalSize({
        width: (width / window.innerWidth) * 100,

        height: (height / window.innerHeight) * 100,
      });

      return;
    }

    // DRAGGING
    if (!dragging) return;

    const modalWidth = window.innerWidth * (askKenModalSize.width / 100);

    const modalHeight = window.innerHeight * (askKenModalSize.height / 100);

    let newX = offsetRef.current.x - e.clientX;

    let newY = offsetRef.current.y - e.clientY;

    newX = Math.max(0, Math.min(newX, window.innerWidth - modalWidth));

    newY = Math.max(0, Math.min(newY, window.innerHeight - modalHeight));

    setPosition({
      x: newX,
      y: newY,
    });
  };

  const onClose = () => {
    setOpenActionModal(false);
  };

  const { handleAIAction } = useAIBibleAction({
    query,
    booksData: tags.booksData,
    tabs: tabs,
  });

  useEffect(() => {
    const move = (e) => {
      handleMouseMove(e);
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
    };
  }, [dragging, resizing, resizeDirection, askKenModalSize, position]);
  useEffect(() => {
    const up = () => {
      setDragging(false);

      setResizing(false);

      setResizeDirection(null);
    };

    window.addEventListener("mouseup", up);

    return () => {
      window.removeEventListener("mouseup", up);
    };
  }, []);
  useEffect(() => {
    globalThis.SetHighlighted({});
  }, [askKenOpen]);
  // Keep ref in sync with state to avoid stale closures in XHR callbacks
  useEffect(() => {
    chatIndexRef.current = chatIndex;
  }, [chatIndex]);
  useEffect(() => {
    if (versePrompt) {
      setQuery(versePrompt);
      setAutoSend(true);
    }
  }, [versePrompt]);

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

  useEffect(() => {
    const modalWidth = window.innerWidth * (askKenModalSize.width / 100);

    const modalHeight = window.innerHeight * (askKenModalSize.height / 100);

    setPosition((prev) => ({
      x: Math.max(0, Math.min(prev.x, window.innerWidth - modalWidth)),

      y: Math.max(0, Math.min(prev.y, window.innerHeight - modalHeight)),
    }));
  }, [askKenModalSize]);

  // ── Load chat index + restore active chat on mount ──

  const openSelect = () => {
    if (selectRef.current) {
      selectRef.current.focus(); // opens dropdown in most browsers
      selectRef.current.click(); // fallback
    }
  };

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
  const handleChatHistory = () => {
    setShowHistory((prev) => !prev);
  };

  // ── Handle new chat ──
  const handleNewChat = useCallback(() => {
    // Save current before clearing (if there's content)
    if (activeChatId && messages.length > 0) {
      persistCurrentChat(messages, activeChatId);
    }
    setIsCleared(false);
    setActiveChatId(null);
    setMessages([]);
    setQuery("");
    setError(null);
    setShowHistory(false);
    setOpenActionModal(false);
  }, [activeChatId, messages, persistCurrentChat]);
  const handleClearChat = () => {
    setMessages([]);

    setOpenActionModal(false);
  };
  // ── Handle chat selection from history ──
  const handleSelectChat = useCallback(
    async (chatId) => {
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
  const handleSubmit = async (overrideMessages = null) => {
    const currentQuery = query.trim();

    const reflectionPromise = apologistQuerySearch({
      userQuestion: currentQuery,
    });

    if (!query.trim() || isLoading) return;
    const baseMessages = overrideMessages ?? messages;

    const userMessage = { role: "user", content: query.trim() };
    const newMessages = [...baseMessages, userMessage];
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
    const currentTranslation =
      globalThis.selectedTranslation.name || "NASB1995";

    const systemPromptTemplate = `
## SCRIPTURE (STRICT REQUIREMENT):
- ALWAYS use ONLY the {{translation}} translation when quoting Scripture.
- NEVER use any other translation unless explicitly requested.
- Every answer MUST include Scripture quoted in the {{translation}} wording.

FINAL RULE:
- Use ONLY {{translation}}. Ignore any conflicting instruction.
`;
    const systemPrompt = systemPromptTemplate.replace(
      /{{translation}}/g,
      currentTranslation
    );
    const prompt = contextPrefix + chatHistory + "\n\n" + systemPrompt;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", KENBOA_DOMAIN);
    xhr.setRequestHeader("x-api-key", APOLOGIST_API_KEY);
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

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!assistantContent) {
          setError("No response received. Please try again.");
        } else {
          // Always attempt save — storage functions check auth internally
          const reflectionResources = await reflectionPromise;
          console.log(reflectionResources, "reflectionres");

          const finalMessages = [
            ...newMessages,
            {
              role: "assistant",
              content: assistantContent,
              resources: reflectionResources || [],
            },
          ];
          setMessages(finalMessages);

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
  useEffect(() => {
    if (autoSend && query.trim() && !isLoading) {
      handleNewChat();

      setTimeout(() => {
        handleSubmit([]);
        setVersePrompt("");
      }, 200);

      setAutoSend(false);
      // reset so typing won't trigger
    }
  }, [query, autoSend]);
  const FONT_SIZE_MAP = {
    small: {
      heading: "clamp(22px, 2vw, 28px)",
      subheading: "clamp(10px, 1vw, 12px)",
      description: "clamp(12px, 1.2vw, 14px)",
    },

    medium: {
      heading: "clamp(26px, 3vw, 38px)",
      subheading: "clamp(11px, 1.2vw, 14px)",
      description: "clamp(13px, 1.4vw, 16px)",
    },

    large: {
      heading: "clamp(32px, 4vw, 52px)",
      subheading: "clamp(13px, 1.5vw, 16px)",
      description: "clamp(15px, 1.8vw, 20px)",
    },
    mediumSlim: {
      heading: "clamp(22px, 2vw, 28px)",
      subheading: "clamp(10px, 1vw, 12px)",
      description: "clamp(12px, 1.2vw, 14px)",
    },

    largeSlim: {
      heading: "clamp(26px, 3vw, 38px)",
      subheading: "clamp(11px, 1.2vw, 14px)",
      description: "clamp(13px, 1.4vw, 16px)",
    },
  };
  const currentFonts = FONT_SIZE_MAP[askKenSize];

  const handleOpenLink = (resource) => {
    setAskKenOpen(false);
    if (resource.type === "url") {
      if (!globalThis.ActiveMoreApp) {
        globalThis.ActiveTab = "ministries";
        globalThis.SetActiveMoreApp("Discovery");
        globalThis.RefreshAskKen?.();
        tools.map((tool) => {
          if (tool.label === "Discovery") {
            tool.onClick();
          }
        });
        setTimeout(() => {
          globalThis.ApologistOpenInMinistriesTab(
            resource.url,
            resource.title || "Preview"
          );
        }, 200);
      } else {
        setTimeout(() => {
          globalThis.ApologistOpenInMinistriesTab(
            resource.url,
            resource.title || "Preview"
          );
        }, 200);
      }
    } else {
      if (resource.type === "book") {
        window.open(
          resource.url || resource.referral_url,
          "_blank",
          "noopener"
        );
      } else {
      }
    }
  };

  const hasMessages = messages.length > 0;
  return (
    <div>
      <div
        style={{
          position: "fixed",
          fontFamily: "Satoshi, sans-serif",

          width: `${askKenModalSize.width}vw`,
          height: `${askKenModalSize.height}vh`,

          bottom: position.y,
          right: position.x,
          minWidth: "310px",
          minHeight: "410px",
          maxWidth: "700px",

          background: "#fff",
          color: "black",

          borderRadius: "15px",

          boxShadow: `
    0 10px 30px rgba(0, 0, 0, 0.08),
    0 2px 6px rgba(0, 0, 0, 0.05)
  `,

          border: "1px solid rgba(0,0,0,0.06)",

          zIndex: 999999,
          userSelect: "none",
        }}
      >
        <div className="askken-container">
          <div className="askken-content">
            {/* ── Top action bar ── */}
            <div className="askken-topbar-actions">
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <img
                  src={APOLOGIST_LOGO_URL}
                  alt=""
                  className="askken-msg-avatar"
                />

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    lineHeight: 1.2,
                  }}
                >
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>
                    Ask Ken
                  </span>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <span
                      style={{
                        width: "5px",
                        height: "5px",
                        backgroundColor: "#22c55e",
                        borderRadius: "50%",
                      }}
                    />

                    <span style={{ fontSize: "10px", color: "#777" }}>
                      AI Bible Assistant
                    </span>
                  </div>
                </div>
              </div>
              <div
                className="askken-topbar-actions-btns"
                style={{ cursor: "pointer" }}
              >
                <div className="select-wrapper">
                  <span className="material-symbols-outlined icon">
                    drag_indicator
                  </span>

                  <span className="label" style={{ fontSize: "12px" }}>
                    {askKenSize === "mediumSlim"
                      ? "Medium, slim"
                      : askKenSize.charAt(0).toUpperCase() +
                        askKenSize.slice(1)}
                  </span>

                  <select
                    id="sizeSelect"
                    value={askKenSize}
                    onChange={(e) => {
                      const selectedSize = e.target.value;

                      setAskKenSize(selectedSize);

                      const selectedModalSize = SIZE_MAP[selectedSize];

                      setAskKenModalSize(selectedModalSize);

                      localStorage.setItem("askKenSize", selectedSize);
                      document.querySelector(".label").innerText =
                        e.target.options[e.target.selectedIndex].text;
                    }}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="mediumSlim">Medium, slim</option>
                    <option value="large">Large</option>
                    <option value="largeSlim">Large, slim</option>
                  </select>
                </div>
                <div
                  style={{
                    display: "inline-block",
                    width: "1px",
                    height: "20px",
                    backgroundColor: "black",
                    marginRight: "10px",
                  }}
                />

                <span
                  className="material-symbols-outlined"
                  style={{ cursor: "grab", fontSize: "22px" }}
                  onMouseDown={(e) => {
                    if (resizing) return;

                    e.stopPropagation();

                    offsetRef.current = {
                      x: e.clientX + position.x,
                      y: e.clientY + position.y,
                    };

                    setDragging(true);
                  }}
                >
                  open_with
                </span>
                <span
                  className="material-symbols-outlined"
                  style={{ cursor: "pointer", fontSize: "22px" }}
                  onClick={() => setAskKenOpen(false)}
                >
                  expand_more
                </span>
              </div>
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
              {!hasMessages && !showHistory && !isCleared && (
                <div className="askken-hero">
                  <p
                    className="askken-subtitle"
                    style={{
                      fontSize: currentFonts.subheading,
                    }}
                  >
                    {t("kenSubtitle")}
                  </p>
                  <h1
                    className="askken-heading"
                    style={{
                      fontSize: currentFonts.heading,
                    }}
                  >
                    {t("kenHeading")}
                  </h1>
                  <p
                    className="askken-description"
                    style={{
                      fontSize: currentFonts.description,
                    }}
                  >
                    {t("kenDescription")}
                  </p>
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
                            <VerseRenderer
                              tabs={tabs}
                              text={para}
                              booksData={tags.booksData}
                            />
                          </p>
                        ))}

                      {msg.resources?.length > 0 && (
                        <div
                          style={{
                            marginTop: "12px",
                            paddingTop: "12px",
                            borderTop: "1px solid #e5e7eb",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: "13px",
                              marginBottom: "8px",
                            }}
                          >
                            Resources
                          </div>

                          {msg.resources
                            .filter(
                              (resource) =>
                                resource.url || resource.referral_url
                            )
                            .map((resource, index) => {
                              const url = resource.url || resource.referral_url;

                              if (resource.type === "youtube") {
                                let videoId = "";

                                try {
                                  const parsedUrl = new URL(url);

                                  if (parsedUrl.hostname.includes("youtu.be")) {
                                    videoId = parsedUrl.pathname.slice(1);
                                  } else {
                                    videoId = parsedUrl.searchParams.get("v");
                                  }
                                } catch (e) {
                                  console.error("Invalid YouTube URL", e);
                                }

                                return (
                                  <div
                                    key={resource.id || index}
                                    style={{ marginBottom: "12px" }}
                                  >
                                    <iframe
                                      width="100%"
                                      height="220"
                                      src={`https://www.youtube.com/embed/${videoId}`}
                                      title={resource.title}
                                      frameBorder="0"
                                      referrerpolicy="strict-origin-when-cross-origin"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      style={{
                                        borderRadius: "12px",
                                        border: "1px solid #e5e7eb",
                                      }}
                                    />

                                    <div
                                      style={{
                                        marginTop: "8px",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {resource.title}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={resource.id || index}>
                                  <a
                                    onClick={() => handleOpenLink(resource)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "10px",
                                      padding: "10px",
                                      marginBottom: "8px",
                                      borderRadius: "10px",
                                      background: "#f8fafc",
                                      textDecoration: "none",
                                      color: "inherit",
                                      border: "1px solid #e5e7eb",
                                      transition: "all 0.15s ease",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span
                                      className="material-symbols-outlined"
                                      style={{
                                        fontSize: "20px",
                                        color: "#2E4879",
                                        marginTop: "2px",
                                      }}
                                    >
                                      {getResourceIcon(resource.type)}
                                    </span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "13px",
                                          color: "#111827",
                                          marginBottom: "2px",
                                        }}
                                      >
                                        {resource.title}
                                      </div>
                                    </div>

                                    <span
                                      className="material-symbols-outlined"
                                      style={{
                                        fontSize: "16px",
                                        color: "#9ca3af",
                                      }}
                                    >
                                      open_in_new
                                    </span>
                                  </a>
                                </div>
                              );
                            })}
                        </div>
                      )}
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
                  placeholder={versePrompt ? versePrompt : t("askQuestion")}
                  value={query}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      if (isLoading || !query.trim()) {
                        return;
                      }

                      const currentQuery = query.trim();

                      apologistQuerySearch({
                        userQuestion: currentQuery,
                      })
                        .then(setApologistResources)
                        .catch(console.error);

                      // start xhr immediately

                      const handled = await handleAIAction();

                      if (handled) {
                        const refs = bibleRefrenceParser(currentQuery);

                        const translation = parseTranslation(currentQuery);

                        if (refs.length > 0) {
                          const ref = refs[0];

                          setMessages((prev) => [
                            ...prev,
                            {
                              role: "assistant",
                              content: `Opened ${
                                ref.book.charAt(0).toUpperCase() +
                                ref.book.slice(1).toLowerCase()
                              } ${ref.chapter}${
                                ref.verse
                                  ? ":" +
                                    ref.verse +
                                    (ref.endVerse ? "-" + ref.endVerse : "")
                                  : ""
                              }${
                                translation
                                  ? " in " + translation.shortName
                                  : ""
                              }.`,
                            },
                          ]);
                        }

                        setQuery("");

                        return;
                      }

                      // Otherwise continue AI
                      handleSubmit();
                    }
                  }}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                />

                <button
                  className="askken-send-btn"
                  onClick={async () => {
                    if (isLoading || !query.trim()) {
                      return;
                    }

                    const currentQuery = query.trim();
                    apologistQuerySearch({
                      userQuestion: currentQuery,
                    })
                      .then(setApologistResources)
                      .catch(console.error);
                    console.log(apologistResources, "apologiit");

                    const handled = await handleAIAction();
                    console.log(handled, "handled");

                    // Bible navigation handled
                    if (handled) {
                      const refs = bibleRefrenceParser(currentQuery);

                      const translation = parseTranslation(currentQuery);

                      if (refs.length > 0) {
                        const ref = refs[0];

                        setMessages((prev) => [
                          ...prev,
                          {
                            role: "assistant",
                            content: `Opened ${
                              ref.book.charAt(0).toUpperCase() +
                              ref.book.slice(1).toLowerCase()
                            } ${ref.chapter}${
                              ref.verse
                                ? ":" +
                                  ref.verse +
                                  (ref.endVerse ? "-" + ref.endVerse : "")
                                : ""
                            }${
                              translation ? " in " + translation.shortName : ""
                            }.`,
                          },
                        ]);
                      }

                      setQuery("");

                      return;
                    }

                    // Otherwise continue AI
                    handleSubmit();
                  }}
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

                <div
                  style={{
                    backgroundColor: "rgb(107,114,128)",
                    width: "44px",
                    height: "44px",

                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "black",
                    fontSize: "12px",
                  }}
                >
                  {openActionModal && (
                    <ActionModal
                      open={openActionModal}
                      onClose={onClose}
                      handleNewChat={handleNewChat}
                      handleChatHistory={handleChatHistory}
                      handleClearChat={handleClearChat}
                    />
                  )}

                  <span
                    className="material-symbols-outlined"
                    style={{
                      cursor: "pointer",
                      fontSize: "24px",
                      color: "white",
                    }}
                    onClick={() => setOpenActionModal((prev) => !prev)}
                  >
                    more_vert
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div
          onMouseDown={(e) => startResize(e, "right")}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "6px",
            height: "100%",
            cursor: "ew-resize",
          }}
        />

        {/* LEFT */}
        <div
          onMouseDown={(e) => startResize(e, "left")}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "6px",
            height: "100%",
            cursor: "ew-resize",
          }}
        />

        {/* TOP */}
        <div
          onMouseDown={(e) => startResize(e, "top")}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "6px",
            cursor: "ns-resize",
          }}
        />

        {/* BOTTOM */}
        <div
          onMouseDown={(e) => startResize(e, "bottom")}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            height: "6px",
            cursor: "ns-resize",
          }}
        />

        {/* BOTTOM RIGHT */}
        <div
          onMouseDown={(e) => startResize(e, "bottom-right")}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: "14px",
            height: "14px",
            cursor: "nwse-resize",
          }}
        />

        <style>{getStyleOf("askken.css")}</style>

        <style>{getStyleOf("askken.css")}</style>
      </div>
    </div>
  );
}

export { AskKen, AskKenModal };
