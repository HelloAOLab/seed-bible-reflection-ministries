import { useI18n } from "seed-bible.i18n.I18nManager";
import type { AskKenState } from "ext_askKen.host.managers.askKenManager";
import { ChatHistoryPanel } from "ext_askKen.host.components.ChatHistory";
import { VerseRenderer } from "ext_askKen.host.components.bibleVerseRenderer";
const APOLOGIST_LOGO_URL =
  "https://res.cloudinary.com/dpudrufae/image/upload/v1769365905/1e5a02da12f8dcd18f8c91d66970dced3990bf11_j3ejbt.png";

// AskKen.types.ts
const { useEffect, useRef } = os.appHooks;
const style = thisBot.tags["askKen.css"];
interface AskKenProps {
  state: AskKenState;
}
const itemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "5px",
  cursor: "pointer",
};

interface ActionModalProps {
  open: boolean;
  onCloseActionModal: () => void;
  handleNewChat: () => void;
  handleChatHistory: () => void;
  handleClearChat: () => void;
}

const ActionModal = ({
  open,
  onCloseActionModal,
  handleNewChat,
  handleChatHistory,
  handleClearChat,
}: ActionModalProps) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onCloseActionModal();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, onCloseActionModal]);
  return (
    <div
      ref={modalRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: "#fff",
        borderRadius: "12px",
        padding: "10px",
        right: "25px",
        bottom: "110px",
        width: "165px",
        position: "absolute",
        height: "138px",
        display: "flex",
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

export function AskKen({ state }: AskKenProps) {
  const { t } = useI18n("ext_askKen");

  return (
    <>
      <style>{style}</style>
      <div
        style={{
          height: "100%",
          width: "100%",
          fontFamily: "Satoshi, sans-serif",
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
            </div>

            {/* ── History drawer (slides from right) ── */}
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
                />
              </>
            )}

            {/* ── Messages area ── */}
            <div className="askken-messages">
              {state.messages.value.length !== 0 &&
                state.showHistory.value &&
                state.isCleared.value && (
                  <div className="askken-hero">
                    <p className="askken-subtitle">{t("kenSubtitle")}</p>
                    <h1 className="askken-heading">{t("kenHeading")}</h1>
                    <p className="askken-description">{t("kenDescription")}</p>
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
                              scrollToVerse={state.scrollToVerse}
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
                                const url =
                                  resource.url || resource.referral_url;

                                if (resource.type === "youtube") {
                                  let videoId = null;

                                  try {
                                    if (!url) {
                                      return;
                                    }
                                    const parsedUrl = new URL(url);

                                    if (
                                      parsedUrl.hostname.includes("youtu.be")
                                    ) {
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
                                      ></span>

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
                    if (e.key === "Enter") {
                      // Otherwise continue AI
                      state.handleSubmit();
                    }
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
                      (state.openActionModal.value =
                        !state.openActionModal.value)
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
    </>
  );
}
