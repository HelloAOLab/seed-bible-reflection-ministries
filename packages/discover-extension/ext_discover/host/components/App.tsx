import "./app.css";
import {
  AnnotationsSection,
  PlaylistSection,
} from "@packages/seed-bible/seed-bible/components/DiscoverPane/DiscoverPane";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";
import type { DiscoverState } from "../managers/discoverManager";
import { Apologist } from "./Apologist";
import { useI18n } from "@packages/seed-bible/seed-bible/i18n";
import { MinistriesTab } from "./Ministries";
import { type VNode } from "preact";

interface DiscoverProps {
  state: DiscoverState;
  context: SeedBibleState;
}
type DiscoverFilter = "all" | "annotations" | "playlists";

export function DiscoverContent({ state, context }: DiscoverProps) {
  const { t } = useI18n("ext_discovery");
  const playlists = context.playlists;
  const userPlaylists = playlists.userPlaylists.value;
  const toast = context.app.toast;
  const modals = context.modals;
  const tabs = context.tabs;
  const selectedTab =
    tabs.tabs.value.find((tab) => tab.id === tabs.selectedTabId.value) ?? null;

  const mediaSections: Record<DiscoverFilter, () => VNode> = {
    all: () => (
      <>
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
        <PlaylistSection
          userPlaylists={userPlaylists}
          playlists={playlists}
          modals={modals}
          toast={toast}
        />
        <AnnotationsSection
          tab={selectedTab}
          annotations={context.annotations}
          modals={modals}
          toast={toast}
          login={context.login}
          tabs={tabs}
          discover={context.discover}
          panes={context.panes}
          onReferenceClick={context.app.openVerseReference}
        />
      </>
    ),

    playlists: () => (
      <PlaylistSection
        userPlaylists={userPlaylists}
        playlists={playlists}
        modals={modals}
        toast={toast}
      />
    ),

    annotations: () => (
      <AnnotationsSection
        tab={selectedTab}
        annotations={context.annotations}
        modals={modals}
        toast={toast}
        login={context.login}
        tabs={tabs}
        discover={context.discover}
        panes={context.panes}
        onReferenceClick={context.app.openVerseReference}
      />
    ),
  };
  const Content = mediaSections[state.activeFilter.value];

  return (
    <div className="discover">
      <div className="discover-topbar">
        {state.tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              state.activeTab.value = tab.key;
            }}
            className={`discover-tab ${
              state.activeTab.value === tab.key ? "discover-tab--active" : ""
            }`}
          >
            <span className="discover-tab-label">{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>
      {state.activeTab.value === "media" && (
        <div className="discover-content-filter">
          <button
            className={`discover-filter ${
              state.activeFilter.value === "all"
                ? "discover-filter--active"
                : ""
            }`}
            onClick={() => {
              state.activeFilter.value = "all";
            }}
          >
            {t("all")}
          </button>

          <button
            className={`discover-filter ${
              state.activeFilter.value === "annotations"
                ? "discover-filter--active"
                : ""
            }`}
            onClick={() => {
              state.activeFilter.value = "annotations";
            }}
          >
            {t("annotations")}
          </button>

          <button
            className={`discover-filter ${
              state.activeFilter.value === "playlists"
                ? "discover-filter--active"
                : ""
            }`}
            onClick={() => {
              state.activeFilter.value = "playlists";
            }}
          >
            {t("playlists")}
          </button>
        </div>
      )}

      <div
        className="discover-content"
        style={{
          flex: state.activeTab.value === "media" ? 1 : undefined,
          height: state.activeTab.value === "media" ? "80%" : "100%",
        }}
      >
        {state.activeTab.value === "media" && <Content />}

        {state.activeTab.value === "ministries" && (
          <MinistriesTab
            state={state}
            cameFromDiscovery={state.cameFromDiscovery}
          />
        )}
      </div>
    </div>
  );
}
