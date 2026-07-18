import type { ApologistPanelState } from "../managers";
import { Signal } from "@preact/signals";

interface MinistriesTabProps {
  state: ApologistPanelState;
  cameFromDiscovery: Signal<boolean>;
}

export function MinistriesTab({ state }: MinistriesTabProps) {
  if (!state.ministriesUrl.value) {
    return <div>No URL</div>;
  }

  return (
    <div className="ministries-viewer" style={{ height: "100%" }}>
      <div className="ministries-toolbar">
        {state.cameFromDiscovery.value && (
          <span
            className="material-symbols-outlined sg-back-icon"
            onClick={() => {
              state.activeTab.value = "discovery";
              state.cameFromDiscovery.value = false;
            }}
          >
            arrow_back
          </span>
        )}

        <span className="ministries-title" title={state.ministriesTitle.value}>
          {state.ministriesTitle.value}
        </span>

        <a
          href={state.ministriesUrl.value}
          target="_blank"
          className="ministries-external-link"
          rel="noopener noreferrer"
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
        style={{ paddingBottom: state.isMobile.value ? "80px" : "40px" }}
        className="ministries-iframe"
        src={state.ministriesUrl.value}
        title={state.ministriesTitle.value}
        referrerpolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
    </div>
  );
}
