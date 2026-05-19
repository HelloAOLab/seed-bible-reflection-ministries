import { bibleRefrenceParser } from "app.components.bibleRefrenceParser";
import { navigateToBibleReference } from "app.components.navigateToBibleReference";
import { parseTranslation } from "app.components.bibleRefrenceParser";
import { useBibleContext } from "app.hooks.bibleVariables";

export function VerseRenderer({ text, booksData, tabs }) {
  const { scrollToVerse } = useBibleContext();

  const refs = bibleRefrenceParser(text);
  const translationId = parseTranslation(text);

  if (!refs.length) {
    return <span>{text}</span>;
  }

  let currentIndex = 0;

  const elements = [];

  refs.forEach((ref, i) => {
    const start = text.indexOf(ref.full, currentIndex);

    // normal text before ref
    if (start > currentIndex) {
      elements.push(
        <span key={`text-${i}`}>{text.slice(currentIndex, start)}</span>
      );
    }

    elements.push(
      <span
        key={`ref-${i}`}
        onClick={() =>
          navigateToBibleReference({
            bookName: ref.book,
            chapter: ref.chapter,
            translationId: translationId,
            booksData,
            verseNumber: ref.verse,
            scrollToVerse,
            tabs,
          })
        }
        style={{
          color: "#2563eb",
          cursor: "pointer",
          fontWeight: 600,
          textDecoration: "underline",
        }}
      >
        {ref.full}
      </span>
    );

    currentIndex = start + ref.full.length;
  });

  if (currentIndex < text.length) {
    elements.push(<span key="end">{text.slice(currentIndex)}</span>);
  }

  return <>{elements}</>;
}
