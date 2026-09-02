import { useEffect, useRef } from "preact/hooks";
import { effect, signal, type Signal } from "@preact/signals";
import axios from "axios";
import { isDiscoveryOpen } from "../extraServices";

interface ResourceItem {
  published_on?: string;
  created_at?: string;
  image_url?: string;
  type: "book" | "url" | "youtube" | "episode";
  url: string;
  id: string;
  referral_url: string;
  listing_url: string;
  title: string;
  Name: string;
  description?: string;
  summary?: string;
  snippet?: string;
  excerpt?: string;
}

function getDomain(u: string) {
  if (!u) return "";

  try {
    if (!/^https?:\/\//i.test(u)) {
      u = "http://" + u;
    }

    let hostname = new URL(u).hostname;

    // Remove leading "www."
    hostname = hostname.replace(/^www\./, "");

    return hostname;
  } catch {
    return "";
  }
}

const TYPE_ORDER = {
  youtube: 0,
  episode: 10,
  url: 20,
  book: 30,
};

const SOURCE_PRIORITY = {
  youtube: 0,
  tabletalk: 1,
  ligonier: 2,
  default: 5,
};

const TITLE_WHITESPACE_REGEX = /\s+/g;

function normalizeTitleValue(value: string) {
  if (!value) return "";
  return value.trim().replace(TITLE_WHITESPACE_REGEX, " ").toLowerCase();
}

function getPrimaryUrl(item: ResourceItem) {
  return item?.url || item?.referral_url || item?.listing_url || "";
}

function getResultDomain(item: ResourceItem) {
  const domain = getDomain(getPrimaryUrl(item));
  return domain ? domain.toLowerCase() : "";
}
type ResourceType = keyof typeof TYPE_ORDER;

function computeResultRank(item: ResourceItem) {
  const type = (item?.type || "").toLowerCase();
  if (type === "youtube") {
    return SOURCE_PRIORITY.youtube;
  }

  const domain = getResultDomain(item);
  if (domain.includes("tabletalkmagazine.com")) {
    return SOURCE_PRIORITY.tabletalk;
  }
  if (domain.includes("ligonier.org")) {
    return SOURCE_PRIORITY.ligonier;
  }

  return (
    SOURCE_PRIORITY.default +
    (TYPE_ORDER[type as keyof typeof TYPE_ORDER] ?? 50)
  );
}

function compareResults(a: ResourceItem, b: ResourceItem): number {
  const rankDiff = computeResultRank(a) - computeResultRank(b);
  if (rankDiff !== 0) return rankDiff;

  const typeA = (a.type ?? "").toLowerCase();
  const typeB = (b.type ?? "").toLowerCase();

  const typeDiff =
    (typeA in TYPE_ORDER ? TYPE_ORDER[typeA as ResourceType] : 100) -
    (typeB in TYPE_ORDER ? TYPE_ORDER[typeB as ResourceType] : 100);

  if (typeDiff !== 0) return typeDiff;

  const titleA = normalizeTitleValue(a.title || a.Name || "");
  const titleB = normalizeTitleValue(b.title || b.Name || "");

  if (titleA < titleB) return -1;
  if (titleA > titleB) return 1;

  return 0;
}

function dedupeResults(results: ResourceItem[]): ResourceItem[] {
  const seenIds = new Set();
  const seenTitles = new Map();
  const deduped: ResourceItem[] = [];

  results.forEach((item: ResourceItem) => {
    if (item?.id) {
      if (seenIds.has(item.id)) return;
      seenIds.add(item.id);
    }

    const normalizedTitle = normalizeTitleValue(
      item?.title || item?.Name || ""
    );

    if (!normalizedTitle) {
      deduped.push(item);
      return;
    }

    const candidatePriority = computeResultRank(item);

    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.set(normalizedTitle, {
        index: deduped.length,
        priority: candidatePriority,
      });
      deduped.push(item);
      return;
    }

    const existing = seenTitles.get(normalizedTitle);

    if (candidatePriority < existing.priority) {
      deduped[existing.index] = item;
      existing.priority = candidatePriority;
    }
  });

  return deduped;
}

function buildResultKey(item: ResourceItem) {
  if (!item) return null;
  if (item.id) {
    return `id:${item.id}`;
  }
  const titleKey = normalizeTitleValue(item?.title || item?.Name || "");
  if (!titleKey) return null;
  const domain = getResultDomain(item);
  return `title:${titleKey}|domain:${domain}`;
}
// ── Lazy-loading wrapper for cards (IntersectionObserver) ──

// ── In-memory result cache (5 min TTL) ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map(); // key → { data: [], timestamp: number }
const queryPlanCache = new Map(); // key → { data: string[], timestamp: number }

function getCachedResults(key: string) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResults(key: string, data: ResourceItem[]) {
  // Store only the fields the UI actually uses to keep memory light
  const trimmed = data.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    Name: item.Name,
    url: item.url,
    referral_url: item.referral_url,
    listing_url: item.listing_url,
    image_url: item.image_url,
    description: item.description,
    summary: item.summary,
    snippet: item.snippet,
    excerpt: item.excerpt,
    published_on: item.published_on,
    created_at: item.created_at,
  }));
  resultCache.set(key, { data: trimmed, timestamp: Date.now() });
  // Evict oldest entries if cache grows too large (max 100 queries)
  if (resultCache.size > 100) {
    const oldest = resultCache.keys().next().value;
    resultCache.delete(oldest);
  }
}

function getCachedQueryPlan(key: string) {
  const entry = queryPlanCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    queryPlanCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedQueryPlan(key: string, data: string[]) {
  queryPlanCache.set(key, { data, timestamp: Date.now() });
  if (queryPlanCache.size > 200) {
    const oldest = queryPlanCache.keys().next().value;
    queryPlanCache.delete(oldest);
  }
}
function normalizeQueryValue(value: string): string {
  return String(value).trim().replace(/\s+/g, " ");
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  queries.forEach((query: string) => {
    const value = normalizeQueryValue(query);
    if (!value) return;

    const key = value.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    normalized.push(value);
  });

  return normalized;
}

function truncateText(value: string, maxLength = 220) {
  const text = normalizeQueryValue(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function truncateQueryPhrase(value: string, maxLength = 30) {
  const text = normalizeQueryValue(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const words = text.split(/\s+/);
  let phrase = "";
  for (const word of words) {
    const next = phrase ? `${phrase} ${word}` : word;
    if (next.length > maxLength) break;
    phrase = next;
  }

  return phrase || text.slice(0, maxLength).trim();
}

function escapeRegExp(value: string) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getResultSearchableText(item: ResourceItem) {
  return normalizeQueryValue(
    [
      item?.title,
      item?.Name,
      item?.description,
      item?.summary,
      item?.snippet,
      item?.excerpt,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

const CANONICAL_BOOK_NAMES = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Psalm",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Song of Songs",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

const SIGNAL_STOPWORDS = new Set([
  "the",
  "then",
  "than",
  "into",
  "over",
  "under",
  "about",
  "through",
  "after",
  "before",
  "because",
  "these",
  "those",
  "such",
  "this",
  "and",
  "but",
  "not",
  "you",
  "your",
  "yours",
  "they",
  "them",
  "their",
  "there",
  "here",
  "have",
  "will",
  "would",
  "could",
  "should",
  "shall",
  "from",
  "with",
  "for",
  "that",
  "that",
  "what",
  "when",
  "where",
  "which",
  "were",
  "been",
  "being",
  "also",
  "does",
  "just",
  "with",
  "from",
  "chapter",
  "verse",
  "verses",
  "book",
  "bible",
  "apologetics",
  "theological",
  "themes",
  "doctrine",
  "study",
  "related",
  "resource",
  "resources",
  "unto",
  "said",
  "says",
  "say",
  "spoke",
  "called",
  "made",
  "make",
  "came",
  "come",
  "went",
  "take",
  "took",
  "seen",
  "gave",
  "give",
  "let",
  "upon",
  "every",
  "each",
  "many",
  "much",
  "very",
  "might",
  "must",
  "whose",
  "whom",
  "lord",
  "god",
  "gods",
  "man",
  "men",
  "woman",
  "women",
  "son",
  "sons",
  "daughter",
  "daughters",
  "children",
  "child",
  "people",
  "israel",
  "earth",
  "heaven",
  "heavens",
  "name",
  "day",
  "days",
  "night",
  "nights",
  "hand",
  "hands",
  "eyes",
  "voice",
  "house",
  "land",
  "waters",
  "water",
  "midst",
  "according",
  "behold",
  "therefore",
  "again",
  "indeed",
  "among",
  "within",
  "without",
  "whosever",
]);

function parseChapterLabel(label: string) {
  const normalizedLabel = normalizeQueryValue(label);
  if (!normalizedLabel) return null;

  const chapterMatch = normalizedLabel.match(/^(.*?)(\d+)\s*$/);
  if (!chapterMatch) return null;

  const bookName = normalizeQueryValue(chapterMatch[1]!);
  const chapterNumber = parseInt(chapterMatch[2]!, 10);
  if (!bookName || Number.isNaN(chapterNumber)) return null;

  return {
    label: normalizedLabel,
    bookName,
    chapterNumber,
    escapedBookName: escapeRegExp(bookName),
    bookTokens: bookName.toLowerCase().split(/\s+/).filter(Boolean),
  };
}
interface ChapterInfo {
  label: string;
  bookName: string;
  chapterNumber: number;
  escapedBookName: string;
  bookTokens: string[];
}
function getExplicitChapterMatch(
  searchableText: string,
  chapterInfo: ChapterInfo
) {
  if (!searchableText || !chapterInfo) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const exactRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+${chapterInfo.chapterNumber}\\b`,
    "i"
  );
  if (exactRegex.test(searchableText)) {
    return { isExplicit: true, chapterScore: 12, matchType: "exact" };
  }

  const rangeRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+(\\d+)\\s*[–-]\\s*(\\d+)\\b`,
    "i"
  );
  const rangeMatch = searchableText.match(rangeRegex);
  if (!rangeMatch) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const start = parseInt(rangeMatch[1] ?? "", 10);
  const end = parseInt(rangeMatch[2] ?? "", 10);
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { isExplicit: false, chapterScore: 0, matchType: null };
  }

  const isInRange =
    chapterInfo.chapterNumber >= Math.min(start, end) &&
    chapterInfo.chapterNumber <= Math.max(start, end);
  return {
    isExplicit: isInRange,
    chapterScore: isInRange ? 8 : 0,
    matchType: isInRange ? "range" : null,
  };
}

function getOtherBookReferenceCount(
  searchableText: string,
  chapterInfo: ChapterInfo
) {
  if (!searchableText) return 0;

  let count = 0;
  CANONICAL_BOOK_NAMES.forEach((bookName) => {
    if (
      chapterInfo &&
      bookName.toLowerCase() === chapterInfo.bookName.toLowerCase()
    ) {
      return;
    }

    const regex = new RegExp(`\\b${escapeRegExp(bookName)}\\s+\\d+\\b`, "i");
    if (regex.test(searchableText)) {
      count += 1;
    }
  });
  return count;
}

function tokenizeSignalText(text: string, chapterInfo: ChapterInfo) {
  const normalizedText = normalizeQueryValue(text).toLowerCase();
  if (!normalizedText) return [];

  return normalizedText
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => {
      if (!token || token.length < 4) return false;
      if (SIGNAL_STOPWORDS.has(token)) return false;
      if (chapterInfo?.bookTokens?.includes(token)) return false;
      if (!Number.isNaN(Number(token))) return false;
      return true;
    });
}
interface Verse {
  text?: string;
  number?: number | string;
  verseNumber?: number | string;
}

interface Section {
  heading?: string;
  title?: string;
  name?: string;
  verses?: Verse[];
}

export interface ChapterData {
  content?: Section[];
  combinedText: string;
  book: string;
  chapter: number;
  number: number;
  translation: string;
}

function extractSectionSignals(chapterData: ChapterData) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];

  const signals: string[] = [];
  chapterData.content.forEach((section) => {
    const heading = normalizeQueryValue(
      section?.heading || section?.title || section?.name || ""
    );
    if (heading) {
      signals.push(heading);
    }

    const firstVerse = Array.isArray(section?.verses)
      ? section.verses[0]
      : null;
    if (firstVerse?.text) {
      signals.push(truncateText(firstVerse.text, 120));
    }
  });

  return signals;
}

function extractSectionHeadings(chapterData: ChapterData | null): string[] {
  if (!chapterData || !Array.isArray(chapterData.content)) {
    return [];
  }

  return uniqueQueries(
    chapterData.content.map((section) =>
      normalizeQueryValue(
        section?.heading || section?.title || section?.name || ""
      )
    )
  );
}

function extractKeywordsFromText(text: string, bookName: string) {
  const bookTokens = normalizeQueryValue(bookName)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const frequencies = new Map();

  normalizeQueryValue(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .forEach((token) => {
      if (!token || token.length < 4) return;
      if (SIGNAL_STOPWORDS.has(token)) return;
      if (bookTokens.includes(token)) return;
      if (!Number.isNaN(Number(token))) return;
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    });

  const topTerms = Array.from(frequencies.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([token]) => token);

  if (!topTerms.length) return "";
  return normalizeQueryValue([bookName, ...topTerms].filter(Boolean).join(" "));
}
interface QueryResultPair {
  query: string;
  results: ResourceItem[];
}

function buildChapterSignalSet(
  chapterData: ChapterData,
  chapterInfo: ChapterInfo,
  queryResultPairs: QueryResultPair[]
) {
  const signalTokens = new Set<string>();
  const sources = [
    chapterData?.combinedText,
    ...extractSectionSignals(chapterData),
    ...(queryResultPairs || []).map((pair) => pair?.query || ""),
  ];

  sources.forEach((source) => {
    tokenizeSignalText(source, chapterInfo).forEach((token) =>
      signalTokens.add(token)
    );
  });

  return signalTokens;
}

function getResultTitle(item: ResourceItem) {
  return normalizeQueryValue(item?.title || item?.Name || "");
}

function hasConflictingChapterInTitle(
  item: ResourceItem,
  chapterInfo: ChapterInfo
) {
  if (!chapterInfo) return false;
  const title = getResultTitle(item);
  if (!title) return false;

  // Match: same book + ANY chapter number in the title
  const anyChapterRegex = new RegExp(
    `\\b${chapterInfo.escapedBookName}\\s+(\\d+)`,
    "gi"
  );
  let match;
  while ((match = anyChapterRegex.exec(title)) !== null) {
    const mentionedChapter = parseInt(match[1] ?? "", 10);
    if (
      !Number.isNaN(mentionedChapter) &&
      mentionedChapter !== chapterInfo.chapterNumber
    ) {
      return true;
    }
  }
  return false;
}
interface ChapterContext {
  hitCountByKey: Map<string, number>;
  chapterInfo: ChapterInfo | null;
  signalTokens: Set<string>;
}

interface ClassificationResult {
  bucket: "explicitMatch" | "implicitMatch" | "unrelated";
  score: number;
  explicit: {
    isExplicit: boolean;
    chapterScore: number;
    matchType: string | null;
  };
  sharedSignalCount: number;
  hitCount: number;
  otherBookReferenceCount: number;
}

function classifyChapterResult(
  item: ResourceItem,
  context: ChapterContext
): ClassificationResult {
  const searchableText = getResultSearchableText(item);
  const resultKey = buildResultKey(item);

  const hitCount = resultKey ? (context.hitCountByKey.get(resultKey) ?? 1) : 1;

  if (!context.chapterInfo) {
    return {
      bucket: "unrelated",
      score: 0,
      explicit: {
        isExplicit: false,
        chapterScore: 0,
        matchType: null,
      },
      sharedSignalCount: 0,
      hitCount,
      otherBookReferenceCount: 0,
    };
  }

  const explicit = getExplicitChapterMatch(searchableText, context.chapterInfo);

  const otherBookReferenceCount = getOtherBookReferenceCount(
    searchableText,
    context.chapterInfo
  );

  const resultTokens = new Set<string>(
    tokenizeSignalText(searchableText, context.chapterInfo)
  );

  const sharedSignalCount = Array.from(context.signalTokens).filter((token) =>
    resultTokens.has(token)
  ).length;

  const sameBookMentionRegex = new RegExp(
    `\\b${context.chapterInfo.escapedBookName}\\b`,
    "i"
  );

  const hasSameBookMention = sameBookMentionRegex.test(searchableText);

  if (explicit.isExplicit) {
    return {
      bucket: "explicitMatch",
      score:
        200 +
        explicit.chapterScore * 5 +
        hitCount * 12 +
        Math.max(0, 30 - computeResultRank(item)),
      explicit,
      sharedSignalCount,
      hitCount,
      otherBookReferenceCount,
    };
  }

  const implicitConfidence =
    hitCount * 16 +
    sharedSignalCount * 14 +
    (hasSameBookMention ? 16 : 0) -
    otherBookReferenceCount * 18;

  const isImplicitMatch =
    otherBookReferenceCount === 0 &&
    sharedSignalCount >= 2 &&
    (hasSameBookMention || hitCount >= 2);

  if (isImplicitMatch) {
    return {
      bucket: "implicitMatch",
      score:
        100 + implicitConfidence + Math.max(0, 20 - computeResultRank(item)),
      explicit,
      sharedSignalCount,
      hitCount,
      otherBookReferenceCount,
    };
  }

  return {
    bucket: "unrelated",
    score: implicitConfidence,
    explicit,
    sharedSignalCount,
    hitCount,
    otherBookReferenceCount,
  };
}

function extractAnchorQueries(
  chapterData: ChapterData | null,
  fallbackLabel: string
) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];
  const firstSection = chapterData.content.find(
    (section) => Array.isArray(section?.verses) && section.verses.length
  );
  const firstVerse = Array.isArray(firstSection?.verses)
    ? firstSection.verses[0]
    : null;

  if (firstVerse?.text) {
    const book = chapterData.book || "";
    const chapter = chapterData.chapter || "";
    const verseNumber = firstVerse?.number || firstVerse?.verseNumber || "";
    const verseLabel = `${book} ${chapter}:${verseNumber}`.trim();
    const anchorText = truncateQueryPhrase(firstVerse.text, 30);
    return uniqueQueries([`${verseLabel} ${anchorText}`]);
  }

  if (chapterData.combinedText) {
    return uniqueQueries([
      `${fallbackLabel} ${truncateQueryPhrase(chapterData.combinedText, 30)}`,
    ]);
  }

  return [];
}
interface GenerateChapterSearchQueriesParams {
  chapterData: ChapterData | null;
  chapterLabel: string;
  chapterText: string;
}

async function generateChapterSearchQueries({
  chapterData,
  chapterLabel,
  chapterText,
}: GenerateChapterSearchQueriesParams) {
  const normalizedLabel = normalizeQueryValue(chapterLabel);
  const normalizedText = normalizeQueryValue(
    chapterData?.combinedText || chapterText
  );
  const normalizedTranslation = normalizeQueryValue(
    chapterData?.translation || ""
  );
  const cacheKey = `chapter-plan:${normalizedLabel.toLowerCase()}:${normalizedTranslation.toLowerCase()}`;
  const cachedPlan = getCachedQueryPlan(cacheKey);
  if (cachedPlan?.length) {
    return cachedPlan;
  }

  const queries = [normalizedLabel];
  const headings = extractSectionHeadings(chapterData);
  const firstHeading = headings[0];
  if (firstHeading !== undefined) {
    queries.push(firstHeading);
  }
  if (headings.length > 1) {
    const middleHeading = headings[Math.floor(headings.length / 2)];
    if (
      middleHeading &&
      middleHeading.toLowerCase() !== headings[0]?.toLowerCase()
    ) {
      queries.push(middleHeading);
    }
  }

  if (normalizedText) {
    const keywordQuery = extractKeywordsFromText(
      normalizedText,
      chapterData?.book || ""
    );
    if (keywordQuery) {
      queries.push(keywordQuery);
    }
  }

  queries.push(...extractAnchorQueries(chapterData, normalizedLabel));

  const finalQueries = uniqueQueries(queries).slice(0, 5);
  setCachedQueryPlan(cacheKey, finalQueries);
  return finalQueries;
}
interface RankedResult {
  item: ResourceItem;
  bucket: string;
  score: number;
  explicit: {
    isExplicit: boolean;
    chapterScore: number;
    matchType: string | null;
  };
  sharedSignalCount: number;
  hitCount: number;
  otherBookReferenceCount: number;
}

function buildHybridRankedResults(
  queryResultPairs: QueryResultPair[],
  chapterLabel: string,
  chapterData: ChapterData
) {
  const chapterInfo = parseChapterLabel(chapterLabel);
  const hitCountByKey = new Map();

  const allResults: ResourceItem[] = [];
  const seenGlobal = new Set();

  queryResultPairs.forEach(({ results }) => {
    results.forEach((item) => {
      const key = buildResultKey(item);

      if (!key) {
        allResults.push(item);
        return;
      }

      if (seenGlobal.has(key)) {
        return;
      }

      seenGlobal.add(key);
      allResults.push(item);
    });
  });

  const allowedTypes = new Set(["youtube", "episode", "url", "book"]);

  const typed = allResults.filter((item) => {
    const isAllowedType = allowedTypes.has(item?.type);

    if (item?.type === "book") {
      const hasUrl = item?.url || item?.referral_url || item?.listing_url;

      return isAllowedType && !!hasUrl;
    }

    return isAllowedType;
  });

  const signalTokens = buildChapterSignalSet(
    chapterData,
    chapterInfo!,
    queryResultPairs
  );

  // Only remove obvious chapter conflicts
  const deduped = dedupeResults(typed).filter((item) => {
    const hasConflict = hasConflictingChapterInTitle(item, chapterInfo!);

    return !hasConflict;
  });

  const classified = deduped.map((item) => ({
    item,
    ...classifyChapterResult(item, {
      chapterInfo,
      hitCountByKey,
      signalTokens,
    }),
  }));

  const explicitMatches = classified.filter(
    (entry) => entry.bucket === "explicitMatch"
  );

  const implicitMatches = classified.filter(
    (entry) => entry.bucket === "implicitMatch"
  );

  const fallbackMatches = classified.filter(
    (entry) => entry.bucket === "unrelated"
  );

  const sortEntries = (entries: Array<RankedResult>): ResourceItem[] =>
    entries
      .slice()
      .sort((a, b) => b.score - a.score || compareResults(a.item, b.item))
      .map((entry) => entry.item);

  return sortEntries([
    ...explicitMatches,
    ...implicitMatches,
    ...fallbackMatches,
  ]);
}

export interface ApologistState {
  data: Signal<ResourceItem[]>;
  loading: Signal<boolean>;
  err: Signal<string>;

  openIds: Signal<Set<string>>;

  searchParam: Signal<string>;
  searchRunId: Signal<number>;

  hasMore: Signal<boolean>;
  loadingMore: Signal<boolean>;

  displayedCount: Signal<number>;
  allData: Signal<ResourceItem[]>;

  activeCardId: Signal<string | null>;
  headerLabel: Signal<string>;

  nowPlayingId: Signal<string | null>;
  linkOpenId: Signal<string | null>;

  // refs
  lastSearchKeyRef: { current: string | null };
  lastResultKeysRef: { current: Set<string> };
  debounceRef: {
    current: ReturnType<typeof setTimeout> | null;
  };
  isFirstLoadRef: { current: boolean };
  baselineQueryRef: { current: string };
  baselineResultKeysRef: { current: Set<string> };

  // derived values
  resolvedLevel: string;
  isVerseLevel: boolean;
  currentBaselineQuery: string;
  showResetControl: boolean;
  loadMoreRef: { current: HTMLDivElement | null };

  fetchResults: () => Promise<void>;
  loadMore: () => void;
  handleResetToBaseline: () => void;
  buildResultKey: (item: ResourceItem) => string | null;

  retry: () => void;
}

export function createApologistState(props: {
  searchQuery: Signal<string>;
  searchTrigger: Signal<number>;
  searchLevel: Signal<string>;
  searchLabel: Signal<string>;
}): ApologistState {
  const search = props.searchQuery;

  const trigger = props.searchTrigger;

  const level = props.searchLevel;

  const label = props.searchLabel;
  const authHeader = null;
  const cacheTtl = null;
  const chapterData = null;
  const url =
    "https://reflections-ministries.apologist.seedbible.io/api/v1/search?cache_ttl=300";
  const enabled = true;

  const data = signal<ResourceItem[]>([]);
  const loading = signal(true);
  const err = signal("");

  const openIds = signal(new Set<string>());

  const searchParam = signal(search.value || "Genesis 1");
  const searchRunId = signal(trigger.value || 0);

  const hasMore = signal(false);
  const loadingMore = signal(false);

  const displayedCount = signal(10);
  const allData = signal<ResourceItem[]>([]);

  const activeCardId = signal<string | null>(null);
  const headerLabel = signal("");

  const nowPlayingId = signal<string | null>(null);
  const linkOpenId = signal<string | null>(null);
  const lastSearchKeyRef = useRef<string | null>(null);
  const lastResultKeysRef = useRef<Set<string>>(new Set<string>());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoadRef = useRef(true);
  const baselineQueryRef = useRef("");
  const baselineResultKeysRef = useRef<Set<string>>(new Set<string>());
  const resolvedLevel = "chapter".toLowerCase();
  const isVerseLevel = resolvedLevel === "verse";
  const currentBaselineQuery = baselineQueryRef.current;
  const showResetControl = Boolean(isVerseLevel && currentBaselineQuery);

  const loadMoreRef = useRef(null);
  effect(() => {
    isDiscoveryOpen.value = true;

    return () => {
      isDiscoveryOpen.value = false;
    };
  });

  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry) {
          return;
        }

        if (entry.isIntersecting) {
          loadMore();
        }
      },
      { threshold: 1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) observer.unobserve(loadMoreRef.current);
    };
  }, [hasMore, loadingMore]);

  useEffect(() => {
    const trimmed = (search.value ?? "").trim();
    if (!trimmed) {
      searchParam.value = "";
      searchRunId.value = trigger.value;
      return;
    }

    searchParam.value = trimmed;
    searchRunId.value = trigger.value;
  }, [search.value, trigger.value]);

  useEffect(() => {
    if (!enabled) {
      data.value = [];
      allData.value = [];
      err.value = "";

      openIds.value = new Set<string>();

      hasMore.value = false;

      displayedCount.value = 10;

      loading.value = false;
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (!searchParam || !searchParam.value.trim()) {
        return;
      }

      data.value = [];
      allData.value = [];
      err.value = "";

      openIds.value = new Set<string>();

      hasMore.value = false;

      displayedCount.value = 10;

      loading.value = true;

      try {
        const trimmedQuery = searchParam.value.trim();

        const currentLabel = (label.value ?? "").trim();

        const apiQuery =
          resolvedLevel === "chapter"
            ? currentLabel || trimmedQuery
            : currentLabel
              ? `${currentLabel} ${trimmedQuery}`
              : trimmedQuery;

        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(cacheTtl != null ? { "x-cache-ttl": String(cacheTtl) } : {}),
        };

        const fetchQueryResults = async (query: string) => {
          const key = normalizeQueryValue(query).toLowerCase();
          if (!key) return [];

          const cached = getCachedResults(key);
          if (cached) return cached;

          const payload = {
            query,
            limit: 20,
            filters: {
              team_ids: [160],
              types: ["article", "book", "url", "media", "youtube", "episode"],
            },
          };

          const res = await axios.post(url, payload, { headers });
          const results = res?.data?.results || [];
          setCachedResults(key, results);
          return results;
        };

        const chapterContextData = chapterData;

        let normalizedSearchKey = normalizeQueryValue(apiQuery).toLowerCase();
        let results = [];

        if (resolvedLevel === "chapter") {
          const chapterQueries = await generateChapterSearchQueries({
            chapterData: chapterContextData,
            chapterLabel: currentLabel || trimmedQuery,
            chapterText: trimmedQuery,
          });

          const queryPlan = uniqueQueries([
            currentLabel || trimmedQuery,
            ...chapterQueries,
          ]).slice(0, 3);

          normalizedSearchKey = `hybrid:${queryPlan.join("|").toLowerCase()}`;

          const queryResultPairs = await Promise.all(
            queryPlan.map(async (q) => {
              try {
                return { query: q, results: await fetchQueryResults(q) };
              } catch {
                return { query: q, results: [] };
              }
            })
          );

          if (cancelled) return;

          results = buildHybridRankedResults(
            queryResultPairs,
            currentLabel || trimmedQuery,
            chapterContextData!
          );
        } else {
          const singleResults = await fetchQueryResults(apiQuery);

          const allowedTypes = new Set(["youtube", "episode", "url", "book"]);

          results = dedupeResults(
            singleResults.filter((item: ResourceItem) =>
              allowedTypes.has(item?.type)
            )
          );
        }

        if (cancelled) return;
        const computedLabel =
          label.value ||
          (isVerseLevel && currentBaselineQuery
            ? currentBaselineQuery
            : trimmedQuery);
        headerLabel.value = computedLabel;

        allData.value = results;

        data.value = results.slice(0, 10);

        hasMore.value = results.length > 10;

        lastSearchKeyRef.current = normalizedSearchKey;
      } catch (e) {
        if (!cancelled) {
          err.value = e instanceof Error ? e.message : "Network error";

          data.value = [];

          allData.value = [];
        }
      } finally {
        if (!cancelled) loading.value = false;
      }
    };
    loading.value = true;

    err.value = "";

    data.value = [];

    allData.value = [];

    openIds.value = new Set<string>();

    hasMore.value = false;

    displayedCount.value = 10;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      if (!cancelled) run();
    }, 200);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    searchParam,
    searchRunId,
    enabled,
    authHeader,
    cacheTtl,
    url,
    level,
    trigger,
    label,
    chapterData,
  ]);

  const fetchResults = async () => {
    loading.value = true;

    try {
      const results: ResourceItem[] = [];

      data.value = results;
      allData.value = results;

      hasMore.value = results.length > 10;
    } catch {
      err.value = "Unknown Error";
    } finally {
      loading.value = false;
    }
  };

  const loadMore = () => {
    if (loadingMore.value || !hasMore.value) {
      return;
    }

    loadingMore.value = true;

    const nextCount = displayedCount.value + 10;

    data.value = allData.value.slice(0, nextCount);

    displayedCount.value = nextCount;

    hasMore.value = nextCount < allData.value.length;

    loadingMore.value = false;
  };

  const handleResetToBaseline = () => {
    if (!currentBaselineQuery) return;

    // Use the stored chapter-level label (not the current which may be verse-level)

    // Always sync globals so polling stays consistent
  };

  const retry = () => {
    err.value = "";
    searchRunId.value++;
    fetchResults();
  };

  return {
    data,
    loading,
    err,

    openIds,

    searchParam,
    searchRunId,

    hasMore,
    loadingMore,

    displayedCount,
    allData,

    activeCardId,
    headerLabel,

    nowPlayingId,
    linkOpenId,

    lastSearchKeyRef,
    lastResultKeysRef,
    debounceRef,
    isFirstLoadRef,
    baselineQueryRef,
    baselineResultKeysRef,

    resolvedLevel,
    isVerseLevel,
    currentBaselineQuery,
    showResetControl,
    loadMoreRef,
    handleResetToBaseline,
    buildResultKey,

    fetchResults,
    loadMore,
    retry,
  };
}
