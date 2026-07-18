import {
  registerExtension,
  type SeedBibleState,
} from "@packages/seed-bible/seed-bible/managers";

import { askKenContext, isOpenedFromVerse, openAskKen } from "./askKenService";
export default function initAskKenExtension() {
  registerExtension({
    id: "ext_askKen",

    init: function* (context: SeedBibleState) {
      // Save the SeedBible context
      askKenContext.value = context;

      yield context.tools.registerVerseToolbarTool({
        id: "ext_askKen",
        title: {
          key: "askKen",
          defaultValue: "Ask Ken",
          ns: "ext_askKen",
        },
        icon: () => <span className="material-symbols-outlined">chat</span>,

        onSelect: () => {
          isOpenedFromVerse.value = true;
          openAskKen();
        },

        priority: 100,
      });
      if (!context.app.isMobile.value) {
        return;
      }
      yield context.tools.registerToolbarTool({
        id: "ext_askKen",
        title: {
          key: "askKen",
          defaultValue: "Ask Ken",
          ns: "ext_askKen",
        },
        icon: () => <span className="material-symbols-outlined">chat</span>,
        onSelect: () => {
          openAskKen();
        },
        priority: 100,
      });
    },
  });
}
