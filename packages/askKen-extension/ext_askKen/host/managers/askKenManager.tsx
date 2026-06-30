// AskKen.types.ts
const { useEffect, useRef, useCallback } = os.appHooks;
import type { SeedBibleState } from "seed-bible.app.api";
import type { ReaderTab } from "seed-bible.managers.TabsManager";
import type { TranslationBook } from "seed-bible.managers.FreeUseBibleAPI";
interface ChatMeta {
  id: string;
  title: string;
  createdAt: number | string | Date;
  updatedAt: number | string | Date;
}

const DEFAULT_URL =
  "https://ken-boa-reflections-public.ministries.bot/api/v1/search?cache_ttl=300";
const KENBOA_DOMAIN =
  "https://ken-boa-reflections-public.ministries.bot/api/v1/chat/completions";
const MAX_CHATS = 50;
const APOLOGIST_API_KEY = thisBot?.tags?.APOLOGIST_API_KEY;
const chatCache = new Map<string, ChatData>();

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[AskKen] localStorage write error:", e);
  }
}
function lsGet(key: string) {
  try {
    const raw = localStorage.getItem(key);
    console.log(raw, "raw");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
async function loadChatIndex() {
  // Try server first
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
  const cached: ChatMeta[] = [];
  chatCache.forEach((chat) => {
    cached.push({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    });
  });
  return { chats: cached, activeId: null };
}

async function saveChatIndex(
  chats: ChatMeta[],
  activeId: string | null
): Promise<void> {
  const trimmed = chats.slice(0, MAX_CHATS);

  const payload = {
    chats: trimmed,
    activeId,
  };

  lsSet("askken_chats", payload);

  console.log(
    "[AskKen] saveChatIndex saved to localStorage",
    trimmed.length,
    "chats"
  );
}
function lsRemove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    console.error("error");
  }
}
async function deleteFullChat(chatId: string): Promise<void> {
  chatCache.delete(chatId);

  lsRemove(`askken_chat_${chatId}`);

  console.log("[AskKen] deleted chat:", chatId);
}
function generateChatTitle(content?: string) {
  if (!content) return "New Chat";

  const clean = content.replace(/\s+/g, " ").trim();

  if (clean.length <= 40) return clean;

  const truncated = clean.substring(0, 40);
  const lastSpace = truncated.lastIndexOf(" ");

  return (lastSpace > 20 ? truncated.substring(0, lastSpace) : truncated) + "…";
}
async function saveFullChat(chat: ChatData): Promise<void> {
  chatCache.set(chat.id, chat);
  lsSet(`askken_chat_${chat.id}`, chat);
}
async function loadFullChat(chatId: string) {
  if (chatCache.has(chatId)) {
    console.log("[AskKen] loadFullChat from cache:", chatId);
    return chatCache.get(chatId);
  }
  const stored = lsGet("askken_chat_" + chatId);
  if (stored) {
    chatCache.set(chatId, stored);
    console.log("[AskKen] loadFullChat from localStorage:", chatId);
    return stored;
  }
  return null;
}
const apologistQuerySearch = async (userQuestion: string) => {
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

interface Position {
  x: number;
  y: number;
}

type MessageRole = "user" | "assistant";

interface Resource {
  id?: string;
  type: "url" | "book" | "youtube" | string;
  title: string;
  url?: string;
  referral_url?: string;
}

interface ChatMessage {
  role: MessageRole;
  content: string;
  resources?: Resource[];
}

interface ChatData extends ChatMeta {
  messages: ChatMessage[];
}

export interface AskKenState {
  messages: Signal<ChatMessage[]>;

  query: Signal<string>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;

  chatIndex: Signal<ChatMeta[]>;
  activeChatId: Signal<string | null>;

  showHistory: Signal<boolean>;
  isLoggedIn: Signal<boolean>;
  historyLoaded: Signal<boolean>;
  isCleared: Signal<boolean>;

  promptForAskKen: Signal<string | undefined>;
  autoSend: Signal<boolean>;

  position: Signal<Position>;
  dragging: Signal<boolean>;

  openActionModal: Signal<boolean>;
  scrollToVerse: Signal<number | null>;

  handleChatHistory: () => void;
  handleClearChat: () => void;
  handleDeleteChat: (chatId: string) => Promise<void>;
  handleMouseDown: (e: MouseEvent) => void;
  handleMouseMove: (e: MouseEvent) => void;
  handleMouseUp: () => void;
  handleNewChat: () => void;
  handleOpenLink: (resource: Resource) => void;
  handleSubmit: () => void;
  handleSelectChat: (chatId: string) => void;
  onCloseActionModal: () => void;
  tabs: ReaderTab[];
  books: TranslationBook[];
  seedBibleContext: SeedBibleState;
}

import { signal, type Signal, computed } from "@preact/signals";

export function createAskKenState(context: SeedBibleState): AskKenState {
  if (!context.app.currentReadingState.value) {
    throw new Error("Current reading state is not initialized.");
  }
  const readingState =
    context?.app?.currentReadingState?.value.tab.readingState;
  const seedBibleContext = context;
  const {
    bookId,
    translationBooks,
    chapterNumber,
    chapterData,
    scrollToVerse,
    translation,
  } = readingState;

  const currentBook = computed(
    () =>
      translationBooks.value?.books.find((book) => book.id === bookId.value) ??
      null
  );

  const chapterText = computed(() => {
    const content = chapterData.value?.chapter?.content || [];

    return content
      .filter((item) => item.type === "verse")
      .map((verse) =>
        verse.content
          .map((part) => {
            if (typeof part === "string") {
              return part;
            }

            if (part && typeof part === "object" && "text" in part) {
              return part.text;
            }

            return "";
          })
          .join("")
      )
      .join(" ");
  });

  const messages = signal<ChatMessage[]>([]);

  const query = signal("");
  const isLoading = signal(false);
  const error = signal<string | null>(null);

  const chatIndex = signal<ChatMeta[]>([]);
  const activeChatId = signal<string | null>(null);

  const showHistory = signal(false);
  const isLoggedIn = signal(false);
  const historyLoaded = signal(false);
  const isCleared = signal(false);
  const openActionModal = signal(false);

  const promptForAskKen = signal<string | undefined>(undefined);
  const autoSend = signal(false);

  const position = signal<Position>({
    x: 13,
    y: 106,
  });
  const tabs = context.tabs.tabs.value;
  if (!translationBooks.value) {
    throw new Error("Current reading state is not initialized.");
  }

  const books = translationBooks.value.books;
  const offsetRef = useRef({ x: 0, y: 0 });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragging = signal(false);
  const handleMouseDown = (e: MouseEvent) => {
    dragging.value = true;
    offsetRef.current = {
      x: e.clientX + position.value.x,
      y: e.clientY + position.value.y,
    };
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging.value) return;

    position.value = {
      x: e.clientX + position.value.x,
      y: e.clientY + position.value.y,
    };
  };
  const onCloseActionModal = () => {
    openActionModal.value = true;
  };

  useEffect(() => {
    (async () => {
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
      chatIndex.value = sorted;
      // Restore the last active chat
      if (activeId) {
        const fullChat = await loadFullChat(activeId);
        if (fullChat?.messages) {
          messages.value = fullChat.messages;
          activeChatId.value = activeId;
          console.log("[AskKen] Mount: restored active chat", activeId);
        }
      }
      historyLoaded.value = true;
    })();
  }, []);

  const handleChatHistory = () => {
    showHistory.value = !showHistory.value;
  };
  const handleClearChat = () => {
    messages.value = [];
    openActionModal.value = false;
  };
  const handleDeleteChat = async (chatId: string) => {
    const newIndex = chatIndex.value.filter((c) => c.id !== chatId);

    chatIndex.value = newIndex;

    await saveChatIndex(
      newIndex,
      activeChatId.value === chatId ? null : activeChatId.value
    );

    await deleteFullChat(chatId);

    if (chatId === activeChatId.value) {
      activeChatId.value = null;
      messages.value = [];
      error.value = null;
    }
  };
  const handleMouseUp = () => {
    dragging.value = false;
  };

  const persistCurrentChat = async (
    msgs: ChatMessage[],
    chatId: string | null
  ) => {
    if (!chatId || msgs.length === 0) return;
    const index = chatIndex.value;
    const chat: ChatData = {
      id: chatId,
      title: generateChatTitle(msgs.find((m) => m.role === "user")?.content),
      messages: msgs,
      createdAt: index.find((c) => c.id === chatId)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    await saveFullChat(chat);
    const meta: ChatMeta = {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };

    const newIndex = [meta, ...index.filter((c) => c.id !== chatId)].slice(
      0,
      MAX_CHATS
    );

    chatIndex.value = newIndex;

    await saveChatIndex(newIndex, chatId);
  };
  const handleNewChat = useCallback(() => {
    if (activeChatId.value && messages.value.length > 0) {
      persistCurrentChat(messages.value, activeChatId.value);
    }
    isCleared.value = false;
    activeChatId.value = null;
    messages.value = [];
    query.value = "";
    error.value = null;
    showHistory.value = false;
    openActionModal.value = false;
  }, [activeChatId.value, messages.value, persistCurrentChat]);
  const handleSelectChat = useCallback(
    async (chatId: string) => {
      if (activeChatId.value && messages.value.length > 0) {
        persistCurrentChat(messages.value, activeChatId.value);
      }
      showHistory.value = false;
      messages.value = [];
      error.value = null;
      isLoading.value = true;
      const fullChat = await loadFullChat(chatId);
      console.log("[AskKen] Loaded chat", chatId, fullChat);
      if (fullChat?.messages) {
        messages.value = fullChat.messages;
        activeChatId.value = chatId;
      }
      isLoading.value = false;
    },
    [activeChatId.value, messages.value, persistCurrentChat]
  );
  const scheduleSave = (msgs: ChatMessage[], chatId: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistCurrentChat(msgs, chatId);
    }, 1500);
  };
  const handleSubmit = async () => {
    if (!query.value.trim() || isLoading.value) return;
    const currentQuery = query.value.trim();
    const reflectionPromise = apologistQuerySearch(currentQuery);

    const userMessage: ChatMessage = {
      role: "user",
      content: currentQuery,
    };
    let newMessages: ChatMessage[] = [
      {
        role: "user",
        content: currentQuery,
      },
    ];
    newMessages = autoSend.value
      ? [userMessage]
      : [...messages.value, userMessage];
    messages.value = newMessages;
    query.value = "";
    isLoading.value = true;
    error.value = null;

    // Create a new chat if needed
    let currentChatId = activeChatId.value;
    if (!currentChatId) {
      currentChatId = Date.now().toString();
      activeChatId.value = currentChatId;
    }

    // Build prompt with Bible context + conversation history
    const currentContext = chapterText.value;
    const currentLabel = `${currentBook.value?.name ?? ""} ${chapterNumber.value}`;
    const contextPrefix = currentContext
      ? `[The user is currently reading: ${currentLabel || currentContext}]\n\n`
      : "";
    console.log(contextPrefix, "contextprefix");
    const recentMessages = newMessages.slice(-15);
    const chatHistory =
      recentMessages.length === 1
        ? recentMessages[0]!.content
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
    const currentTranslation = translation?.value?.name ?? "NASB95";
    console.log(currentTranslation, "currenttransl");

    const systemPromptTemplate = `
## SCRIPTURE (STRICT REQUIREMENT):
- ALWAYS use ONLY the {{translation}} translation when quoting Scripture.
- NEVER use any other translation unless explicitly requested.
- Every answer MUST include Scripture quoted in the {{translation}} wording.
-If book name is psalm make it psalms

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
            messages.value = [
              ...newMessages,
              { role: "assistant", content: assistantContent },
            ];
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (!assistantContent) {
          error.value = "No response received. Please try again.";
        } else {
          // Always attempt save — storage functions check auth internally
          const reflectionResources = await reflectionPromise;
          console.log(reflectionResources, "reflectionres");
          const assistantMessage: ChatMessage = {
            role: "assistant", // or MessageRole.Assistant if MessageRole is an enum
            content: assistantContent,
            resources: reflectionResources ?? [],
          };

          const finalMessages: ChatMessage[] = [
            ...newMessages,
            assistantMessage,
          ];

          messages.value = finalMessages;
          console.log(
            "[AskKen] Response complete, scheduling save for chat",
            currentChatId
          );
          scheduleSave(finalMessages, currentChatId);
        }
      } else {
        error.value = `Error: ${xhr.status}. Please try again.`;
      }
      isLoading.value = false;
    };

    xhr.onerror = () => {
      error.value = "Something went wrong. Please try again.";
      isLoading.value = false;
    };

    xhr.ontimeout = () => {
      error.value = "Request timed out. Please try again.";
      isLoading.value = false;
    };

    xhr.timeout = 120000;
    xhr.send(JSON.stringify({ prompt, stream: true }));
  };
  const handleOpenLink = () => {
    console.log("openlink");
  };

  return {
    messages,

    query,
    isLoading,
    error,

    chatIndex,
    activeChatId,

    showHistory,
    isLoggedIn,
    historyLoaded,
    isCleared,

    promptForAskKen,
    autoSend,

    position,
    dragging,

    openActionModal,

    handleChatHistory,
    handleClearChat,
    handleDeleteChat,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleNewChat,
    handleOpenLink,
    handleSubmit,
    handleSelectChat,
    onCloseActionModal,
    tabs,
    books,
    scrollToVerse,
    seedBibleContext,
  };
}
