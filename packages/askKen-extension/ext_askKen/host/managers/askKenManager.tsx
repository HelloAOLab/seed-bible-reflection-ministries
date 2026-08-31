// AskKen.types.ts
import { useEffect, useRef, useCallback } from "preact/hooks";
import {
  getProfileConfigValue,
  saveProfileConfigValue,
  type SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";
import type { ReaderTab } from "@packages/seed-bible/seed-bible/managers";
import type { TranslationBook } from "@packages/seed-bible/seed-bible/managers";
import { DiscoverContent } from "@packages/discover-extension/ext_discover/host/components/App";
import { createDiscoverState } from "@packages/discover-extension/ext_discover/host/managers";
import type { BibleSelectedVerse } from "@packages/seed-bible/seed-bible/managers/BibleReadingManager";
interface ChatMeta {
  id: string;
  title: string;
  createdAt: number | string | Date;
  updatedAt: number | string | Date;
}
interface ChatItem {
  prompt: string;
  response: string;
}
interface modalHeightAndWidth {
  width: number;
  height: number;
}
interface ChatRequestBody {
  prompt: string;
  stream: boolean;
  metadata?: {
    session?: string | null;
    device?: string;
    conversation?: string;
    bible?: string;
  };
}
function extractUserMessage(prompt: string): string {
  const match = prompt.match(/User:\s*([\s\S]*?)\n\s*## SCRIPTURE/);

  if (match && match[1]) {
    return match[1].trim();
  }

  return prompt;
}
const PROFILE_ASKKEN_CONVERSATION_ID = "conversation_id";
const PROFILE_ASKKEN_SESSIONS = "sessions";

const DEFAULT_URL =
  "https://reflections-ministries.apologist.seedbible.io/api/v1/search?cache_ttl=300";
const KENBOA_DOMAIN =
  "https://reflections-ministries.apologist.seedbible.io/api/v1/chat/completions";
const loadConversationHistory = async (
  askKenConversationId: string | null,
  context: SeedBibleState,
  session: string
): Promise<ChatMessage[]> => {
  if (!context.login.profile.value || !askKenConversationId) {
    return [];
  }

  const response = await fetch(
    `${KENBOA_DOMAIN}?conversation_id=${encodeURIComponent(
      askKenConversationId
    )}&session_id=${session}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  const data = await response.json();
  return data.data.flatMap((item: ChatItem) => [
    {
      role: "user",
      content: extractUserMessage(item.prompt),
    },
    {
      role: "assistant",
      content: item.response,
    },
  ]);
};

export const SIZE_MAP = {
  small: { width: 20, height: 35 },
  medium: { width: 32, height: 65 },
  large: { width: 36, height: 83 },
  mediumSlim: { width: 21, height: 65 },
  largeSlim: { width: 21, height: 83 },
} as const;
export type ModalSize = keyof typeof SIZE_MAP;
export type ModalDimensions = (typeof SIZE_MAP)[ModalSize];

const chatCache = new Map<string, ChatData>();

async function deleteFullChat(chatId: string): Promise<void> {
  chatCache.delete(chatId);

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
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(cacheTtl != null ? { "x-cache-ttl": String(cacheTtl) } : {}),
    };

    const res = await axios.post(DEFAULT_URL, payload, { headers });

    return res?.data?.results || [];
  } catch (err) {
    console.error("Apologist search failed:", err);
    return [];
  }
};
export function buildExplainQuery(
  book: string,
  chapter: number,
  selectedVerses: BibleSelectedVerse[]
) {
  if (!selectedVerses.length) return "";

  const verses = [...new Set(selectedVerses.map((v) => v.verse.number))].sort(
    (a, b) => a - b
  );

  const ranges: string[] = [];

  let start = verses[0];
  let end = verses[0];

  for (let i = 1; i < verses.length; i++) {
    if (verses[i] === end! + 1) {
      end = verses[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = verses[i];
    }
  }

  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return `Explain ${book} ${chapter}:${ranges.join(", ")}`;
}

interface Position {
  x: number;
  y: number;
}

type MessageRole = "user" | "assistant";

interface Resource {
  id?: string;
  type: "url" | "book" | "youtube" | string;
  title: string;
  url: string;
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
interface FontSizeConfig {
  heading: string;
  subheading: string;
  description: string;
}
type FontModalSize = "small" | "medium" | "large" | "mediumSlim" | "largeSlim";

type FontSizeMap = Record<FontModalSize, FontSizeConfig>;
export const FONT_SIZE_MAP: FontSizeMap = {
  small: {
    heading: "clamp(16px, 1.5vw, 18px)",
    subheading: "clamp(8px, 1vw, 10px)",
    description: "clamp(8px, 1.2vw, 10px)",
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
type ResizeDirection =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | null;

export interface AskKenState {
  messages: Signal<ChatMessage[]>;

  query: Signal<string>;
  isLoading: Signal<boolean>;
  error: Signal<string | null>;

  chatIndex: Signal<ChatMeta[]>;
  activeChatId: Signal<string | null>;
  isMobile: Signal<boolean>;

  showHistory: Signal<boolean>;
  isLoggedIn: Signal<boolean>;
  historyLoaded: Signal<boolean>;
  isCleared: Signal<boolean>;

  promptForAskKen: Signal<string | undefined>;
  autoSend: Signal<boolean>;
  askKenSize: Signal<string>;
  askKenModalSize: Signal<modalHeightAndWidth>;
  resizing: Signal<boolean>;
  resizeDirection: Signal<ResizeDirection>;

  position: Signal<Position>;
  dragging: Signal<boolean>;
  offsetRef: {
    current: {
      x: number;
      y: number;
    };
  };
  currentFonts: Signal<FontSizeConfig>;

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

import { signal, type Signal, computed, effect } from "@preact/signals";
import axios from "axios";
import { askKenOpen } from "../askKenService";

export function createAskKenState(context: SeedBibleState): AskKenState {
  if (!context.app.currentReadingState.value) {
    throw new Error("Current reading state is not initialized.");
  }

  const readingState =
    context?.app?.currentReadingState?.value.tab.readingState;

  const seedBibleContext = context;
  const InitialQuery = buildExplainQuery(
    readingState.chapterData.value?.book.name ?? "",
    readingState.chapterData.value?.chapter.number ?? 1,
    readingState.selectedVerses.value
  );
  const askKenInitialQuery = signal(InitialQuery);
  const inMobile = context.app.isMobile.value;
  const isMobile = signal(inMobile);
  const historyInitialized = signal(false);

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
  const askKenConversationId = signal<string | null>(null);

  const messages = signal<ChatMessage[]>([]);

  const query = signal(askKenInitialQuery.value);
  const isLoading = signal(false);
  const error = signal<string | null>(null);

  const chatIndex = signal<ChatMeta[]>([]);
  const activeChatId = signal<string | null>(null);

  const showHistory = signal(false);
  const isLoggedIn = signal(false);
  const historyLoaded = signal(false);
  const isCleared = signal(false);
  const openActionModal = signal(false);
  const askKenSize: Signal<ModalSize> = signal(
    isMobile.value ? "large" : "mediumSlim"
  );
  const savedSize =
    (localStorage.getItem(askKenSize.value) as ModalSize) ?? "mediumSlim";

  const askKenModalSize = signal<modalHeightAndWidth>({
    width: SIZE_MAP[savedSize].width,
    height: SIZE_MAP[savedSize].height,
  });
  const resizing = signal(false);

  const promptForAskKen = signal<string | undefined>(undefined);
  const autoSend = signal(false);
  const askKenChatHistory = signal<ChatMessage[]>([]);
  const apologistBibleMap: Record<string, string> = {
    AAB: "bsb",

    BSB: "bsb",
    eng_webu: "webu",
    eng_net: "net",
    OEB: "oeb",
    eng_dra: "drb",
    ESV: "esv",
    NIV: "niv",
    eng_kjv: "kjv",
    eng_kja: "nkjv",
    NLT: "nlt",
    CSB: "csb",
    NASB95: "nasb1995",
    NASB2020: "nasb",
    LSB: "lsb",
    TLV: "tlv",
    CJB: "cjb",
  };

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

  const dragging = signal(false);
  const currentFonts = computed<FontSizeConfig>(() => {
    return FONT_SIZE_MAP[askKenSize.value as keyof FontSizeMap];
  });

  const resizeDirection = signal<ResizeDirection>(null);
  const resizeStartRef = useRef({
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
  });

  const handleMouseMove = (e: MouseEvent) => {
    if (resizing.value) {
      const dx = e.clientX - resizeStartRef.current.startX;

      const dy = e.clientY - resizeStartRef.current.startY;

      const MIN_WIDTH = 310;
      const MIN_HEIGHT = 410;

      const MAX_WIDTH = window.innerWidth - 20;

      const MAX_HEIGHT = window.innerHeight - 20;

      let width = resizeStartRef.current.startWidth;

      let height = resizeStartRef.current.startHeight;

      // RIGHT
      if (resizeDirection.value?.includes("right")) {
        width += dx;
      }

      // LEFT
      if (resizeDirection.value?.includes("left")) {
        width -= dx;
      }

      // BOTTOM
      if (resizeDirection.value?.includes("bottom")) {
        height += dy;
      }

      // TOP
      if (resizeDirection.value?.includes("top")) {
        height -= dy;
      }

      // LIMITS
      width = Math.max(MIN_WIDTH, Math.min(width, MAX_WIDTH));

      height = Math.max(MIN_HEIGHT, Math.min(height, MAX_HEIGHT));

      askKenModalSize.value = {
        width: (width / window.innerWidth) * 100,

        height: (height / window.innerHeight) * 100,
      };

      return;
    }

    // DRAGGING
    if (!dragging.value) return;

    const modalWidth = window.innerWidth * (askKenModalSize.value.width / 100);

    const modalHeight =
      window.innerHeight * (askKenModalSize.value.height / 100);

    let newX = offsetRef.current.x - e.clientX;

    let newY = offsetRef.current.y - e.clientY;

    newX = Math.max(0, Math.min(newX, window.innerWidth - modalWidth));

    newY = Math.max(0, Math.min(newY, window.innerHeight - modalHeight));

    position.value = {
      x: newX,
      y: newY,
    };
  };
  const handleMouseDown = (e: MouseEvent) => {
    dragging.value = true;
    offsetRef.current = {
      x: e.clientX + position.value.x,
      y: e.clientY + position.value.y,
    };
  };

  const onCloseActionModal = () => {
    openActionModal.value = true;
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    window.addEventListener("mousemove", move);

    return () => {
      window.removeEventListener("mousemove", move);
    };
  }, [dragging.value, resizing.value, resizeDirection.value, position.value]);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);
  effect(() => {
    const profile = context.login.profile.value;

    if (!profile) {
      askKenConversationId.value = null;
      askKenChatHistory.value = [];
      return;
    }

    if (historyInitialized.value) {
      return;
    }

    const conversationId = getProfileConfigValue(
      profile,
      PROFILE_ASKKEN_CONVERSATION_ID
    ) as string | null;

    askKenConversationId.value = conversationId ?? null;

    if (!conversationId) {
      askKenChatHistory.value = [];
      historyInitialized.value = true;
      return;
    }

    const sessions =
      (getProfileConfigValue(profile, PROFILE_ASKKEN_SESSIONS) as ChatMeta[]) ??
      [];

    chatIndex.value = sessions;

    if (sessions.length > 0) {
      const latestSession = [...sessions].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];

      activeChatId.value = latestSession?.id || null;

      (async () => {
        const history = await loadConversationHistory(
          askKenConversationId.value!,
          context,
          latestSession!.id
        );
        messages.value = history;
      })();
    }

    historyInitialized.value = true;
  });

  const handleChatHistory = () => {
    showHistory.value = !showHistory.value;
    openActionModal.value = false;
  };
  const handleClearChat = () => {
    messages.value = [];
    openActionModal.value = false;
  };
  const handleDeleteChat = async (chatId: string) => {
    const newIndex = chatIndex.value.filter((c) => c.id !== chatId);

    chatIndex.value = newIndex;

    if (context.login.profile.value) {
      saveProfileConfigValue(context.login, PROFILE_ASKKEN_SESSIONS, newIndex);
    }

    await deleteFullChat(chatId);

    if (chatId === activeChatId.value) {
      activeChatId.value = null;
      messages.value = [];
      error.value = null;

      if (newIndex.length > 0) {
        handleSelectChat(newIndex[0]!.id);
      }
    }
  };
  const handleMouseUp = () => {
    dragging.value = false;
    resizing.value = false;

    resizeDirection.value = null;
  };

  const handleNewChat = useCallback(() => {
    activeChatId.value = crypto.randomUUID();

    isCleared.value = false;
    messages.value = [];
    query.value = "";
    error.value = null;
    showHistory.value = false;
    openActionModal.value = false;
  }, []);
  function addChatToHistory(currentQuery: string, context: SeedBibleState) {
    if (!context.login.profile.value) {
      return;
    }

    const exists = chatIndex.value.some(
      (chat) => chat.id === activeChatId.value
    );

    if (!exists) {
      chatIndex.value = [
        {
          id: activeChatId.value!,
          title: generateChatTitle(currentQuery),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
        ...chatIndex.value,
      ];
    } else {
      chatIndex.value = chatIndex.value.map((chat) =>
        chat.id === activeChatId.value
          ? {
              ...chat,
              updatedAt: Date.now(),
            }
          : chat
      );
    }

    saveProfileConfigValue(
      context.login,
      PROFILE_ASKKEN_SESSIONS,
      chatIndex.value
    );
  }

  const handleSelectChat = useCallback(
    async (sessionId: string) => {
      showHistory.value = false;
      messages.value = [];
      error.value = null;
      isLoading.value = true;

      activeChatId.value = sessionId;

      if (askKenConversationId.value) {
        messages.value = await loadConversationHistory(
          askKenConversationId.value,
          context,
          sessionId
        );
      }

      isLoading.value = false;
    },
    [askKenConversationId.value]
  );
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

    const translationName = translation?.value?.id ?? "";

    const bible = apologistBibleMap[translationName] ?? "nasb1995";

    const systemPrompt = `
## SCRIPTURE (STRICT REQUIREMENT):

- ALWAYS use ONLY the {bible} translation when quoting Scripture.
- Every answer MUST include Scripture quoted in the {bible} wording.

## BIBLE VERSE HANDLING:

- Quote and reference at least 3 relevant Bible verses from the {bible} Bible.
- If the requested Bible translation is unavailable, use NASB 1995 instead.
- If the requested translation is AAB, use BSB as the fallback.
- Never use a different translation unless it is an explicitly defined fallback.
`;
    const prompt = `${contextPrefix} User: ${currentQuery}

${systemPrompt}`;
    if (context.login.profile.value && !askKenConversationId.value) {
      const newConversationId = crypto.randomUUID();

      askKenConversationId.value = newConversationId;

      saveProfileConfigValue(
        context.login,
        PROFILE_ASKKEN_CONVERSATION_ID,
        newConversationId
      );
    }

    const xhr = new XMLHttpRequest();
    xhr.open("POST", KENBOA_DOMAIN);
    xhr.setRequestHeader("Content-Type", "application/json");

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

          const assistantMessage: ChatMessage = {
            role: "assistant",
            content: assistantContent,
            resources: reflectionResources ?? [],
          };

          const finalMessages: ChatMessage[] = [
            ...newMessages,
            assistantMessage,
          ];

          messages.value = finalMessages;
          addChatToHistory(currentQuery, context);
          console.log(
            "[AskKen] Response complete, scheduling save for chat",
            currentChatId
          );
        }
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
    const body: ChatRequestBody = {
      prompt,
      stream: true,
      metadata: {
        bible: bible,
      },
    };

    if (context.login.profile.value) {
      body.metadata = {
        session: activeChatId.value,
        device: "web-1",
        bible: bible,
      };

      if (askKenConversationId.value) {
        body.metadata.conversation = askKenConversationId.value;
      }
    }
    xhr.send(JSON.stringify(body));

    askKenInitialQuery.value = "";
  };
  const handleOpenLink = (resource: Resource) => {
    if (resource.type === "url") {
      if (isMobile.value) {
        askKenOpen.value = false;
      }
      context.panes.openPane({
        placement: "side",
        title: "Disvovery",
        component: () => {
          const state = createDiscoverState(context);
          state.activeTab.value = "ministries";
          state.openInMinistriesTab(resource.url, resource.title);

          return <DiscoverContent state={state} context={context} />;
        },
      });
    } else if (resource.type === "book") {
      window.open(resource.url || resource.referral_url, "_blank", "noopener");
    }
  };

  effect(() => {
    const query = askKenInitialQuery.value;

    if (!query) return;

    handleSubmit();
  });
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
    askKenSize,
    askKenModalSize,
    resizing,
    resizeDirection,
    currentFonts,
    offsetRef,
    isMobile,

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
