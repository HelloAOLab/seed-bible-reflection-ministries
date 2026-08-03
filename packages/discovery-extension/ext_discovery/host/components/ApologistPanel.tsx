import type { ApologistPanelState } from "../managers";
import { Apologist } from "./Apologist";
import { MinistriesTab } from "./Ministries";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import "./App.css";
interface ApologistPanelWrapperProps {
  state: ApologistPanelState;
  seedBibleState: SeedBibleState;
}
export function ApologistPanelWrapper({ state }: ApologistPanelWrapperProps) {
  return (
    <>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div className="apologist-tab-bar">
          {state.tabs.map((tab) => (
            <button
              key={tab.key}
              className={`apologist-tab ${
                state.activeTab.value === tab.key ? "apologist-tab--active" : ""
              }`}
              onClick={() => {
                state.activeTab.value = tab.key;
              }}
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
              <span className="apologist-tab-label">{tab.label}</span>
            </button>
          ))}
        </div>

        <div
          style={{
            display: state.activeTab.value === "discovery" ? "block" : "none",
            height: "100%",
            position: "relative",
          }}
        >
          <Apologist
            searchQuery={state.searchQuery}
            searchTrigger={state.searchTrigger}
            searchLevel={state.searchLevel}
            searchLabel={state.searchLabel}
            baselineQuery={state.baselineQuery}
            chapterData={state.chapterDataa}
            openInMinistriesTab={state.openInMinistriesTab}
            cameFromDiscovery={state.cameFromDiscovery}
          />
        </div>

        {state.activeTab.value === "ministries" && (
          <div
            style={{
              display:
                state.activeTab.value === "ministries" ? "block" : "none",
              height: "100%",
            }}
          >
            <MinistriesTab
              state={state}
              cameFromDiscovery={state.cameFromDiscovery}
            />
          </div>
        )}
      </div>
    </>
  );
}
