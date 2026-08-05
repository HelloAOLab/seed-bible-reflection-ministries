import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
import { createAskKenState, SIZE_MAP, type ModalSize } from "../managers";
import { ChatHistoryPanel } from "./ChatHistory";
import { VerseRenderer } from "./bibleVerseRenderer";
import { useAIBibleAction } from "../managers/aiActions";
import { useMemo } from "preact/hooks";

import { bibleRefrenceParser, parseTranslation } from "../managers/aiActions";
import "./askKen.css";
const APOLOGIST_LOGO_URL =
  "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png";

// AskKen.types.ts
import { useEffect, useRef } from "preact/hooks";
import { askKenContext, askKenOpen } from "../askKenService";

const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "5px",
  cursor: "pointer",
};

interface ActionModalProps {
  open: boolean;
  onClose: () => void;
  handleNewChat: () => void;
  handleChatHistory: () => void;
  handleClearChat: () => void;
}

const ActionModal = ({
  open,
  handleNewChat,
  handleChatHistory,
  handleClearChat,
  onClose,
}: ActionModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
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
        background: "var(--sb-background, #fff)",
        borderRadius: "12px",
        padding: "10px",
        right: "25px",
        bottom: "110px",
        width: "165px",
        position: "absolute",
        height: "138px",
        display: "flex",
        color: "var(--sb-secondary-font-color, #fff)",
        boxShadow: "0.0625rem 0.125rem 0.0625rem var(--sb-tertiary-color)",

        flexDirection: "column",
        gap: "4px",
      }}
    >
      <div style={itemStyle} onClick={handleNewChat}>
        <span style={itemStyle} className="material-symbols-outlined">
          edit_square
        </span>
        <span>New Chat</span>
      </div>

      <div style={itemStyle} onClick={handleClearChat}>
        <span className="material-symbols-outlined">clear_all</span>
        <span>Clear Chat</span>
      </div>

      <div style={itemStyle} onClick={handleChatHistory}>
        <span className="material-symbols-outlined">history</span>
        <span>Chat History</span>
      </div>
    </div>
  );
};

export function AskKen() {
  const context = askKenContext.value;
  if (!context) {
    return null;
  }

  const state = useMemo(() => createAskKenState(context), [context]);
  const { t } = useI18n("ext_askKen");
  const { handleAIAction } = useAIBibleAction({
    query: state.query.value,
    seedBibleContext: state.seedBibleContext,
  });
  console.log(handleAIAction, "action");

  return (
    <div
      style={{
        position: "fixed",
        fontFamily: "Satoshi, sans-serif",
        width: state.isMobile.value
          ? "100%"
          : `${state.askKenModalSize.value.width}vw`,
        height: state.isMobile.value
          ? "100%"
          : `${state.askKenModalSize.value.height}vh`,
        color: "var(--sb-secondary-font-color, #fff)",

        bottom: state.isMobile.value ? "0" : state.position.value.y,
        right: state.isMobile.value ? "0" : state.position.value.x,
        minWidth: "310px",
        minHeight: "410px",
        maxWidth: "700px",

        background: "var(--sb-background, #fff)",

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
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
              {!state.isMobile.value && (
                <>
                  {" "}
                  <div className="select-wrapper">
                    <span className="material-symbols-outlined icon">
                      drag_indicator
                    </span>

                    <span className="label" style={{ fontSize: "12px" }}>
                      {state.askKenSize.value === "mediumSlim"
                        ? "Medium, slim"
                        : state.askKenSize.value.charAt(0).toUpperCase() +
                          state.askKenSize.value.slice(1)}
                    </span>

                    <select
                      id="sizeSelect"
                      value={state.askKenSize.value}
                      onChange={(e) => {
                        const select = e.currentTarget as HTMLSelectElement;

                        const selectedSize = select.value as ModalSize;

                        state.askKenSize.value = selectedSize;

                        const selectedModalSize = SIZE_MAP[selectedSize];
                        state.askKenModalSize.value = selectedModalSize;

                        localStorage.setItem("askKenSize", selectedSize);

                        document.querySelector(".label")!.textContent =
                          select.options[select.selectedIndex]?.text ?? "";
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
                      if (state.resizing.value) return;

                      e.stopPropagation();

                      state.offsetRef.current = {
                        x: e.clientX + state.position.value.x,
                        y: e.clientY + state.position.value.y,
                      };

                      state.dragging.value = true;
                    }}
                  >
                    open_with
                  </span>{" "}
                </>
              )}
              <span
                className="material-symbols-outlined"
                style={{ cursor: "pointer", fontSize: "22px" }}
                onClick={() => (askKenOpen.value = false)}
              >
                expand_more
              </span>
            </div>
          </div>

          {state.showHistory.value && (
            <>
              <div
                className="askken-history-backdrop"
                onClick={() => (state.showHistory.value = false)}
              />
              <ChatHistoryPanel
                chatIndex={state.chatIndex.value}
                activeChatId={state.activeChatId.value}
                onSelect={state.handleSelectChat}
                onDelete={state.handleDeleteChat}
                onClose={() => (state.showHistory.value = false)}
                openActionModal={state.openActionModal}
              />
            </>
          )}

          {/* ── Messages area ── */}
          <div className="askken-messages">
            {state.messages.value.length === 0 &&
              !state.showHistory.value &&
              !state.isCleared.value && (
                <div className="askken-hero">
                  <p
                    className="askken-subtitle"
                    style={{
                      fontSize: state.currentFonts.value.subheading,
                    }}
                  >
                    {t("kenSubtitle")}
                  </p>
                  <h1
                    className="askken-heading"
                    style={{
                      fontSize: state.currentFonts.value.heading,
                    }}
                  >
                    {t("kenHeading")}
                  </h1>
                  <p
                    className="askken-description"
                    style={{
                      fontSize: state.currentFonts.value.description,
                    }}
                  >
                    {t("kenDescription")}
                  </p>
                </div>
              )}

            {state.messages.value.map((msg, i) =>
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
                            text={para}
                            seedBibleContext={state.seedBibleContext}
                          />
                        </p>
                      ))}

                    {msg.resources?.length && msg.resources?.length > 0 && (
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

                        {msg.resources &&
                          msg.resources
                            .filter(
                              (resource) =>
                                resource.url || resource.referral_url
                            )
                            .map((resource, index) => {
                              const url = resource.url || resource.referral_url;

                              if (resource.type === "youtube") {
                                let videoId = null;

                                try {
                                  if (!url) {
                                    return;
                                  }
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
                                    onClick={() =>
                                      state.handleOpenLink(resource)
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      display: "flex",
                                      alignItems: "flex-start",
                                      gap: "10px",
                                      padding: "10px",
                                      marginBottom: "8px",
                                      borderRadius: "10px",
                                      background: "var(--sb-background, #fff)",
                                      textDecoration: "none",
                                      color:
                                        "var(--sb-secondary-font-color, #fff)",
                                      border:
                                        "1px solid var(--sb-secondary-font-color, #fff)",
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
                                    ></span>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          fontSize: "13px",
                                          color:
                                            "var(--sb-secondary-font-color, #fff)",
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

            {state.isLoading.value && (
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

            {state.error.value && (
              <div className="askken-error">{state.error.value}</div>
            )}

            <div />
          </div>

          {/* ── Chat input ── */}
          <div className="askken-chat-area">
            <div className="askken-input-row">
              <input
                type="text"
                className="askken-input"
                placeholder={
                  state.promptForAskKen.value
                    ? state.promptForAskKen.value
                    : t("askQuestion")
                }
                value={state.query.value}
                onKeyDown={async (e) => {
                  if (e.key !== "Enter") {
                    return;
                  }

                  if (state.isLoading.value || !state.query.value.trim()) {
                    return;
                  }

                  const currentQuery = state.query.value.trim();

                  const handled = await handleAIAction();

                  if (handled) {
                    const refs = bibleRefrenceParser(currentQuery);
                    const translation = parseTranslation(currentQuery);

                    let ref;
                    if (refs.length > 0) {
                      ref = refs[0];
                    }

                    if ((!ref || !ref.book) && !translation) {
                      return;
                    }
                    if (!ref || !ref.book) {
                      state.messages.value = [
                        ...state.messages.value,
                        {
                          role: "assistant",
                          content: `Opened ${translation ? ` in ${translation.shortName}` : ""}.`,
                        },
                      ];
                      state.query.value = "";
                      return;
                    } else {
                      state.messages.value = [
                        ...state.messages.value,
                        {
                          role: "assistant",
                          content: `Opened ${
                            ref.book.charAt(0).toUpperCase() +
                            ref.book.slice(1).toLowerCase()
                          } ${ref.chapter}${
                            ref.verse
                              ? `:${ref.verse}${
                                  ref.endVerse ? `-${ref.endVerse}` : ""
                                }`
                              : ""
                          }${translation ? ` in ${translation.shortName}` : ""}.`,
                        },
                      ];

                      state.query.value = "";
                      return;
                    }
                  }
                  state.handleSubmit();
                }}
                onChange={(e) => {
                  state.query.value = e.currentTarget.value;
                }}
                disabled={state.isLoading.value}
              />
              <button
                className="askken-send-btn"
                onClick={async () => {
                  // Otherwise continue AI
                  if (state.isLoading.value || !state.query.value.trim()) {
                    return;
                  }

                  const currentQuery = state.query.value.trim();

                  const handled = await handleAIAction();

                  if (handled) {
                    const refs = bibleRefrenceParser(currentQuery);
                    const translation = parseTranslation(currentQuery);

                    let ref;
                    if (refs.length > 0) {
                      ref = refs[0];
                    }

                    if ((!ref || !ref.book) && !translation) {
                      return;
                    }
                    if (!ref || !ref.book) {
                      state.messages.value = [
                        ...state.messages.value,
                        {
                          role: "assistant",
                          content: `Opened ${translation ? ` in ${translation.shortName}` : ""}.`,
                        },
                      ];
                      state.query.value = "";
                      return;
                    } else {
                      state.messages.value = [
                        ...state.messages.value,
                        {
                          role: "assistant",
                          content: `Opened ${
                            ref.book.charAt(0).toUpperCase() +
                            ref.book.slice(1).toLowerCase()
                          } ${ref.chapter}${
                            ref.verse
                              ? `:${ref.verse}${
                                  ref.endVerse ? `-${ref.endVerse}` : ""
                                }`
                              : ""
                          }${translation ? ` in ${translation.shortName}` : ""}.`,
                        },
                      ];

                      state.query.value = "";
                      return;
                    }
                  }
                  state.handleSubmit();
                }}
                disabled={state.isLoading.value || !state.query.value.trim()}
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
                {state.openActionModal.value && (
                  <ActionModal
                    open={state.openActionModal.value}
                    onClose={state.onCloseActionModal}
                    handleNewChat={state.handleNewChat}
                    handleChatHistory={state.handleChatHistory}
                    handleClearChat={state.handleClearChat}
                  />
                )}

                <span
                  className="material-symbols-outlined"
                  style={{
                    cursor: "pointer",
                    fontSize: "24px",
                    color: "white",
                  }}
                  onClick={() =>
                    (state.openActionModal.value = !state.openActionModal.value)
                  }
                >
                  more_vert
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
