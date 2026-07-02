import { registerExtension, type SeedBibleState } from "seed-bible.app.api";
import { createAskKenState } from "ext_askKen.host.managers.askKenManager";

import { AskKen } from "ext_askKen.host.components.askKen";
import { buildExplainQuery } from "ext_askKen.host.managers.askKenManager";
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
            if (!context.app.currentReadingState.value) {
              throw new Error("Current reading state is not initialized.");
            }
            const readingState =
              context?.app?.currentReadingState?.value.tab.readingState;
            const selectedVerses = readingState.selectedVerses.value;

            const book = readingState.chapterData.value?.book.name ?? "";
            const chapter = readingState.chapterData.value?.chapter.number ?? 1;
            state.query.value = buildExplainQuery(
              book,
              chapter,
              selectedVerses
            );

            state.autoSend.value = true;
            console.log(selectedVerses, readingState, "selectedverse");

            return <AskKen state={state} />;
          },
        });
      },
      priority: 100,
    });
  },
});
