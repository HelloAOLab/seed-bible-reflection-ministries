import { bibleRefrenceParser, parseTranslation } from "../managers/aiActions";
import { navigateToBibleReference } from "../managers/aiActions";
import type { SeedBibleState } from "@packages/seed-bible/seed-bible/managers";

interface VerseRendererProps {
  text: string;
  seedBibleContext: SeedBibleState;
}

export function VerseRenderer({ text, seedBibleContext }: VerseRendererProps) {
  const refs = bibleRefrenceParser(text);
  const translation = parseTranslation(text);

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
            bookName: ref.book!,
            chapter: ref.chapter,
            translationId:
              translation?.id ||
              seedBibleContext.app.currentReadingState.value?.translationId ||
              "NASB95",
            seedBibleContext,

            verseNumber: ref.verse,
            endVerseNumber: ref.endVerse || ref.verse,
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
