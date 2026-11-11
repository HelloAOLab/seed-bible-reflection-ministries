import {
  registerExtension,
  type SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";
import { DiscoverContent } from "./components/App";
import { createDiscoverState } from "./managers/discoverManager";

export default function initDiscoveryExtension() {
  registerExtension({
    id: "ext_discovery",
    init: function* (context: SeedBibleState) {
      yield context.tools.registerToolbarTool({
        id: "ext_discovery",
        title: {
          key: "discover",
          defaultValue: "Discover",
          ns: "ext_discovery",
        },
        icon: () => <span className="material-symbols-outlined">explore</span>,
        onSelect: () => {
          // If Discover is already open, close it
          if (context.isDiscoverOpen.value === true) {
            context.panes.closePane("ext_discovery");
            context.isDiscoverOpen.value = false;
            return;
          }
          context.isMoreOpenInMobile.value = false;
          context.isDiscoverOpen.value = true;
          const selectedTab = context.tabs.tabs.value.find(
            (tab) => tab.id === context.tabs.selectedTabId.value
          );
          const readingState = selectedTab?.readingState;
          const chapterId = readingState?.bookId.value;
          const chapterNumber = readingState?.chapterNumber.value;
          const isMobileView = context?.app.isMobile.value ?? false;
          const state = createDiscoverState(context);
          context.panes.openPane({
            id: "ext_discovery",
            placement: "side",
            title: isMobileView
              ? `Discover ${chapterId} ${chapterNumber}`
              : "Discover",
            component: () => (
              <DiscoverContent state={state} context={context} />
            ),
          });
        },
        priority: 100,
      });
    },
  });
}
