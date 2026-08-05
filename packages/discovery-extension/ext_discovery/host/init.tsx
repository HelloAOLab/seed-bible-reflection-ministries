import {
  registerExtension,
  type SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";

import { ApologistPanelWrapper } from "./components/ApologistPanel";
import { CreateApologistState } from "./managers";
import { useMemo } from "preact/hooks";

export default function initDiscoveryExtension() {
  registerExtension({
    id: "ext_discovery",
    init: function* (context: SeedBibleState) {
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
            placement: "side",
            title: "Disvovery",
            component: () => {
              const state = useMemo(() => CreateApologistState(context), []);

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
}
