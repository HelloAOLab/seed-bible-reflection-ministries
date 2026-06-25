import type { Signal } from "@preact/signals";
import {
  bibleRefrenceParser,
  parseTranslation,
} from "ext_askKen.host.managers.bibleReferenceParser";
import { navigateToBibleReference } from "ext_askKen.host.managers.bibleNavigation";
import type { SeedBibleState } from "seed-bible.app.api";

interface VerseRendererProps {
  text: string;
  scrollToVerse: Signal<number | null>;
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
            translationId: translation?.id || "AAB",
            seedBibleContext,
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
