// GetApp.tsx — Entry point called by the packager via configEditor.app: "@GetApp"
// Returns the ApologistPanelWrapper component for panel rendering.

// First, ensure the Apologist component is loaded and registered on globalThis.
// Apologist.tsx self-registers as globalThis.Apologist at module level,
// but tag scripts only execute when explicitly called.
if (!globalThis.Apologist) {
  await thisBot.Apologist();
}
if (!globalThis.AskKenTab) {
  await thisBot.AskKen();
}
if (!globalThis.MinistriesTab) {
  await thisBot.MinistriesTab();
}

// Now get or load the panel wrapper
const ApologistPanelWrapper = globalThis.ApologistPanelWrapper;
if (ApologistPanelWrapper) {
  return ApologistPanelWrapper;
}

// Fallback: if ApologistPanel.tsx hasn't set globalThis yet, load it from the bot
const Panel = await thisBot.ApologistPanel();
globalThis.ApologistPanelWrapper = Panel;
return Panel;
