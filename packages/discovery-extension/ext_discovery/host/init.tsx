import { registerExtension, type SeedBibleState } from "seed-bible.app.api";

import { ApologistPanelWrapper } from "ext_discovery.host.components.ApologistPanel";
import { CreateApologistState } from "ext_discovery.host.managers.ApologistPanelManager";

registerExtension({
  id: "ext_discovery",
  init: function* (context: SeedBibleState) {
    console.log(context, "context");
    yield context.tools.registerToolbarTool({
      id: "ext_discovery",
      title: {
        key: "discovery",
        defaultValue: "Discovery",
        ns: "ext_discovery",
      },
      icon: () => <span className="material-symbols-outlined">explore</span>,
      onSelect: () => {
        context.panes.openPane({
          type: "detached",
          detachedAnchor: "side",
          component: () => {
            const state = CreateApologistState(context);
            return (
              <ApologistPanelWrapper state={state} seedBibleState={context} />
            );
          },
        });
      },
      priority: 100,
    });
  },
});
