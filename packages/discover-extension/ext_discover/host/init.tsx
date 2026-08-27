import {
  registerExtension,
  type SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";
import { DiscoverContent } from "./components/App";
import { createDiscoverState } from "./managers/discoverManager";
import { DiscoverPaneHeader } from "@packages/seed-bible/seed-bible/components/DiscoverPane/DiscoverPane";

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
          const state = createDiscoverState(context);

          context.panes.openPane({
            placement: "side",
            title: "Discover",

            header: () => (
              <DiscoverPaneHeader
                playlists={context.playlists}
                annotations={context.annotations}
              />
            ),

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
