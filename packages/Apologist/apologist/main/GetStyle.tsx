// GetStyle — Returns a function that reads CSS tag content from thisBot's tags.
// Used by Apologist.tsx: const getStyleOf = await thisBot.GetStyle();
// Then: <style>{getStyleOf("apologist.css")}</style>

function getStyleOf(name) {
  return tags[name];
}

return getStyleOf;
