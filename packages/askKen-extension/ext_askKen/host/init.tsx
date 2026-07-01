import { registerExtension, type SeedBibleState } from "seed-bible.app.api";
import { createAskKenState } from "ext_askKen.host.managers.askKenManager";

import { AskKen } from "ext_askKen.host.components.askKen";
const { useMemo } = os.appHooks;

registerExtension({
  id: "ext_askKen",
  init: function* (context: SeedBibleState) {
    yield context.tools.registerToolbarTool({
      id: "ext_askKen",
      title: {
        key: "askKen",
        defaultValue: "askKen",
        ns: "ext_askKen",
      },
      icon: () => <span className="material-symbols-outlined">chat</span>,
      onSelect: () => {
        context.panes.openPane({
          type: "detached",
          detachedAnchor: "side",
          component: () => {
            const state = useMemo(() => createAskKenState(context), []);

            return <AskKen state={state} />;
          },
        });
      },
      priority: 100,
    });
    yield context.tools.registerVerseToolbarTool({
      id: "ext_askKen",
      title: {
        key: "askKen",
        defaultValue: "askKen",
        ns: "ext_askKen",
      },
      icon: () => <span className="material-symbols-outlined">chat</span>,
      onSelect: () => {
        context.panes.openPane({
          type: "detached",
          detachedAnchor: "side",
          component: () => {
            const state = useMemo(() => createAskKenState(context), []);

            return <AskKen state={state} />;
          },
        });
      },
      priority: 100,
    });
  },
});
