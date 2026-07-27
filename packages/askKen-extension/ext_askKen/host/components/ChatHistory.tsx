import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
import type { Signal } from "@preact/signals";
interface ChatMeta {
  id: string;
  title: string;
  updatedAt: number | string | Date;
}

function formatRelativeTime(timestamp: string | number | Date): string {
  const time =
    timestamp instanceof Date
      ? timestamp.getTime()
      : typeof timestamp === "string"
        ? new Date(timestamp).getTime()
        : timestamp;

  const diff = Math.floor((Date.now() - time) / 1000);

  if (diff < 60) {
    return "Just now";
  }

  if (diff < 3600) {
    return `${Math.floor(diff / 60)} min ago`;
  }

  if (diff < 86400) {
    return `${Math.floor(diff / 3600)}h ago`;
  }

  return `${Math.floor(diff / 86400)}d ago`;
}
interface ChatHistoryPanelProps {
  chatIndex: ChatMeta[]; // or your actual ChatIndex type
  activeChatId: string | null;

  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onClose: () => void;
  openActionModal: Signal<boolean>;
}

export function ChatHistoryPanel({
  chatIndex,
  activeChatId,
  onSelect,
  onDelete,
  onClose,
  openActionModal,
}: ChatHistoryPanelProps) {
  const { t } = useI18n("ext_askKen");
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
              onClick={() => {
                openActionModal.value = false;
                onSelect(chat.id);
              }}
            >
              <div className="askken-history-item-content">
                <span className="askken-history-item-title">
                  {chat.title || "New Chat"}
                </span>
                <span className="askken-history-item-time">
                  {formatRelativeTime(chat.updatedAt)}
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
