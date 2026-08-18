const { useSideBarContext } = await import("app.hooks.sideBar");
const { useEffect, useState, useMemo, useRef } = os.appHooks;
const getStyleOf = await thisBot.GetStyle();
const SgCard = await thisBot.ApologistCards();

const APOLOGIST_API_KEY = thisBot?.tags?.APOLOGIST_API_KEY;

function getDomain(u) {
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

function normalizeTitleValue(value) {
  if (!value) return "";
  return value.trim().replace(TITLE_WHITESPACE_REGEX, " ").toLowerCase();
}

function getPrimaryUrl(item) {
  return item?.url || item?.referral_url || item?.listing_url || "";
}

function getResultDomain(item) {
  const domain = getDomain(getPrimaryUrl(item));
  return domain ? domain.toLowerCase() : "";
}

function computeResultRank(item) {
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

  return SOURCE_PRIORITY.default + (TYPE_ORDER[type] ?? 50);
}

function compareResults(a, b) {
  const rankDiff = computeResultRank(a) - computeResultRank(b);
  if (rankDiff !== 0) return rankDiff;

  const typeDiff =
    (TYPE_ORDER[(a?.type || "").toLowerCase()] ?? 100) -
    (TYPE_ORDER[(b?.type || "").toLowerCase()] ?? 100);
  if (typeDiff !== 0) return typeDiff;

  const titleA = normalizeTitleValue(a?.title || a?.Name || "");
  const titleB = normalizeTitleValue(b?.title || b?.Name || "");
  if (titleA < titleB) return -1;
  if (titleA > titleB) return 1;
  return 0;
}

function dedupeResults(results) {
  const seenIds = new Set();
  const seenTitles = new Map();
  const deduped = [];

  results.forEach((item) => {
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

function buildResultKey(item) {
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
function LazyCard({ children }) {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef(null);

  useEffect(() => {
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (isVisible) return children;

  return (
    <div
      ref={placeholderRef}
      className="sg-card-placeholder"
      style={{
        minHeight: "120px",
        borderRadius: "10px",
        background: "var(--inputBackground, #1e1e1e)",
        opacity: 0.4,
      }}
    />
  );
}

const DEFAULT_URL =
  "https://reflections-ministries.apologist.seedbible.io/api/v1/search?cache_ttl=300";

// ── In-memory result cache (5 min TTL) ──
const CACHE_TTL_MS = 5 * 60 * 1000;
const resultCache = new Map(); // key → { data: [], timestamp: number }
const queryPlanCache = new Map(); // key → { data: string[], timestamp: number }

function getCachedResults(key) {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedResults(key, data) {
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

function getCachedQueryPlan(key) {
  const entry = queryPlanCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    queryPlanCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCachedQueryPlan(key, data) {
  queryPlanCache.set(key, { data, timestamp: Date.now() });
  if (queryPlanCache.size > 200) {
    const oldest = queryPlanCache.keys().next().value;
    queryPlanCache.delete(oldest);
  }
}

function normalizeQueryValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function uniqueQueries(queries) {
  const seen = new Set();
  const normalized = [];
  queries.forEach((query) => {
    const value = normalizeQueryValue(query);
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(value);
  });
  return normalized;
}

function truncateText(value, maxLength = 220) {
  const text = normalizeQueryValue(value);
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function truncateQueryPhrase(value, maxLength = 30) {
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

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getResultSearchableText(item) {
  return normalizeQueryValue(
    [
      item?.title,
      item?.Name,
      item?.description,
      item?.summary,
      item?.snippet,
      item?.excerpt,
      item?.content,
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

function parseChapterLabel(label) {
  const normalizedLabel = normalizeQueryValue(label);
  if (!normalizedLabel) return null;

  const chapterMatch = normalizedLabel.match(/^(.*?)(\d+)\s*$/);
  if (!chapterMatch) return null;

  const bookName = normalizeQueryValue(chapterMatch[1]);
  const chapterNumber = parseInt(chapterMatch[2], 10);
  if (!bookName || Number.isNaN(chapterNumber)) return null;

  return {
    label: normalizedLabel,
    bookName,
    chapterNumber,
    escapedBookName: escapeRegExp(bookName),
    bookTokens: bookName.toLowerCase().split(/\s+/).filter(Boolean),
  };
}

function getExplicitChapterMatch(searchableText, chapterInfo) {
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

  const start = parseInt(rangeMatch[1], 10);
  const end = parseInt(rangeMatch[2], 10);
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

function getOtherBookReferenceCount(searchableText, chapterInfo) {
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

function tokenizeSignalText(text, chapterInfo) {
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

function extractSectionSignals(chapterData) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];

  const signals = [];
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

function extractSectionHeadings(chapterData) {
  if (!chapterData || !Array.isArray(chapterData.content)) return [];

  return uniqueQueries(
    chapterData.content.map((section) =>
      normalizeQueryValue(
        section?.heading || section?.title || section?.name || ""
      )
    )
  );
}

function extractKeywordsFromText(text, bookName) {
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

function buildChapterSignalSet(chapterData, chapterInfo, queryResultPairs) {
  const signalTokens = new Set();
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

function getResultTitle(item) {
  return normalizeQueryValue(item?.title || item?.Name || "");
}

function hasConflictingChapterInTitle(item, chapterInfo) {
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
    const mentionedChapter = parseInt(match[1], 10);
    if (
      !Number.isNaN(mentionedChapter) &&
      mentionedChapter !== chapterInfo.chapterNumber
    ) {
      return true;
    }
  }
  return false;
}

function classifyChapterResult(item, context) {
  const searchableText = getResultSearchableText(item);
  const resultKey = buildResultKey(item);
  const hitCount = resultKey ? context.hitCountByKey.get(resultKey) || 1 : 1;
  const explicit = getExplicitChapterMatch(searchableText, context.chapterInfo);
  const otherBookReferenceCount = getOtherBookReferenceCount(
    searchableText,
    context.chapterInfo
  );
  const resultTokens = new Set(
    tokenizeSignalText(searchableText, context.chapterInfo)
  );
  const sharedSignalCount = Array.from(context.signalTokens).filter((token) =>
    resultTokens.has(token)
  ).length;

  const sameBookMentionRegex = context.chapterInfo
    ? new RegExp(`\\b${context.chapterInfo.escapedBookName}\\b`, "i")
    : null;
  const hasSameBookMention = sameBookMentionRegex
    ? sameBookMentionRegex.test(searchableText)
    : false;

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

function prioritizeDiverseTopResults(results, topLimit = 10) {
  const selected = [];
  const deferred = [];
  const domainCount = new Map();

  results.forEach((item) => {
    const domain = getResultDomain(item) || "unknown";
    const count = domainCount.get(domain) || 0;
    if (selected.length < topLimit && count < 3) {
      selected.push(item);
      domainCount.set(domain, count + 1);
      return;
    }
    deferred.push(item);
  });

  if (!selected.some((item) => item?.type === "youtube")) {
    const youtubeCandidate = deferred.find((item) => item?.type === "youtube");
    if (youtubeCandidate) {
      const replacementIndex = selected.length ? selected.length - 1 : -1;
      if (replacementIndex >= 0) {
        deferred.push(selected[replacementIndex]);
        selected[replacementIndex] = youtubeCandidate;
      } else {
        selected.push(youtubeCandidate);
      }
    }
  }

  const hasArticleLike = selected.some((item) =>
    ["url", "episode", "book"].includes((item?.type || "").toLowerCase())
  );
  if (!hasArticleLike) {
    const articleCandidate = deferred.find((item) =>
      ["url", "episode", "book"].includes((item?.type || "").toLowerCase())
    );
    if (articleCandidate) {
      const replacementIndex = selected.length > 1 ? selected.length - 1 : 0;
      if (selected[replacementIndex]) {
        deferred.push(selected[replacementIndex]);
        selected[replacementIndex] = articleCandidate;
      } else {
        selected.push(articleCandidate);
      }
    }
  }

  const rebuiltSelectedKeys = new Set(
    selected
      .map((item) => buildResultKey(item))
      .filter(Boolean)
      .map((value) => String(value))
  );
  const orderedRemainder = [
    ...deferred.filter((item) => {
      const key = buildResultKey(item);
      if (!key) return true;
      return !rebuiltSelectedKeys.has(String(key));
    }),
    ...results.filter((item) => {
      const key = buildResultKey(item);
      if (!key) return false;
      return !rebuiltSelectedKeys.has(String(key));
    }),
  ];

  const seen = new Set();
  const final = [];

  [...selected, ...deferred].forEach((item) => {
    const key = buildResultKey(item);
    if (!key) return;

    if (seen.has(key)) return;

    seen.add(key);
    final.push(item);
  });

  return final;
}

function extractAnchorQueries(chapterData, fallbackLabel) {
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

async function generateChapterSearchQueries({
  chapterData,
  chapterLabel,
  chapterText,
}) {
  const normalizedLabel = normalizeQueryValue(chapterLabel);
  const normalizedText = normalizeQueryValue(
    chapterData?.combinedText || chapterText
  );
  const normalizedTranslation = normalizeQueryValue(chapterData?.translation);
  const cacheKey = `chapter-plan:${normalizedLabel.toLowerCase()}:${normalizedTranslation.toLowerCase()}`;
  const cachedPlan = getCachedQueryPlan(cacheKey);
  if (cachedPlan?.length) {
    return cachedPlan;
  }

  const queries = [normalizedLabel];
  const headings = extractSectionHeadings(chapterData);
  if (headings.length > 0) {
    queries.push(headings[0]);
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

function buildHybridRankedResults(queryResultPairs, chapterLabel, chapterData) {
  const chapterInfo = parseChapterLabel(chapterLabel);
  const hitCountByKey = new Map();
  const allResults = [];

  const seenGlobal = new Set();

  queryResultPairs.forEach(({ results }) => {
    results.forEach((item) => {
      const key = buildResultKey(item);

      if (!key) {
        allResults.push(item);
        return;
      }

      if (seenGlobal.has(key)) return;

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
    chapterInfo,
    queryResultPairs
  );
  const deduped = dedupeResults(typed).filter((item) => {
    const searchableText = getResultSearchableText(item);

    const hasConflict = hasConflictingChapterInTitle(item, chapterInfo);
    const otherBookRefs = getOtherBookReferenceCount(
      searchableText,
      chapterInfo
    );

    const resultTokens = new Set(
      tokenizeSignalText(searchableText, chapterInfo)
    );

    const sharedSignalCount = Array.from(signalTokens).filter((token) =>
      resultTokens.has(token)
    ).length;

    const isSameBookMention = chapterInfo
      ? new RegExp(`\\b${chapterInfo.escapedBookName}\\b`, "i").test(
          searchableText
        )
      : false;

    // ✅ MUCH LESS STRICT
    const isRelevant = sharedSignalCount >= 1 || isSameBookMention;

    return !hasConflict && otherBookRefs === 0 && isRelevant;
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

  const sortEntries = (entries) =>
    entries
      .slice()
      .sort((a, b) => b.score - a.score || compareResults(a.item, b.item))
      .map((entry) => entry.item);

  const orderedResults = prioritizeDiverseTopResults(
    sortEntries([...explicitMatches, ...implicitMatches, ...fallbackMatches]),
    10
  );

  return orderedResults;
}

/**
 * Props:
 * - search: string (required)
 * - url?: string
 * - enabled?: boolean
 * - className?: string
 * - authHeader?: string
 * - cacheTtl?: number
 */
function Apologist({
  search,
  trigger = 0,
  authHeader = null,
  cacheTtl = null,
  url = DEFAULT_URL,
  enabled = true,
  className = "",
  level = "chapter",
  baselineQuery = "",
  label = "",
  chapterData = null,
  setCameFromDiscovery,
}) {
  const { t } = useSideBarContext();
  const { openOnMobile, isMobile } = useSideBarContext();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [openIds, setOpenIds] = useState(new Set());
  const [searchParam, setSearchParam] = useState("");
  const [searchRunId, setSearchRunId] = useState(0);

  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [displayedCount, setDisplayedCount] = useState(10);
  const [allData, setAllData] = useState([]);
  const [activeCardId, setActiveCardId] = useState(null);
  const [headerLabel, setHeaderLabel] = useState("");
  const [nowPlayingId, setNowPlayingId] = useState(null);
  const [linkOpenId, setLinkOpenId] = useState(null);
  const lastSearchKeyRef = useRef(null);
  const lastResultKeysRef = useRef(new Set());
  const debounceRef = useRef(null);
  const isFirstLoadRef = useRef(true);
  const baselineQueryRef = useRef(baselineQuery || "");
  const baselineResultKeysRef = useRef(new Set());
  const resolvedLevel = (level || "chapter").toLowerCase();
  const isVerseLevel = resolvedLevel === "verse";
  const currentBaselineQuery = baselineQuery || baselineQueryRef.current;
  const showResetControl = Boolean(isVerseLevel && currentBaselineQuery);

  const loadMoreRef = useRef(null);
  useEffect(() => {
    if (!hasMore || loadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
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
    const trimmed = (search ?? "").trim();
    if (!trimmed) {
      setSearchParam("");
      setSearchRunId(trigger);
      return;
    }

    setSearchParam(trimmed);
    setSearchRunId(trigger);
  }, [search, trigger]);

  useEffect(() => {
    baselineQueryRef.current = baselineQuery || baselineQueryRef.current;
  }, [baselineQuery]);

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setAllData([]);
      setErr("");
      setOpenIds(new Set());
      setHasMore(false);
      setDisplayedCount(10);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (!searchParam || !searchParam.trim()) {
        return;
      }

      setLoading(true);
      setErr("");

      setData([]);
      setAllData([]);
      setOpenIds(new Set());
      setHasMore(false);
      setDisplayedCount(10);

      try {
        const trimmedQuery = searchParam.trim();

        const currentLabel = (
          label ||
          globalThis.GlobalSearchLabel ||
          ""
        ).trim();

        let apiQuery =
          resolvedLevel === "chapter"
            ? currentLabel || trimmedQuery
            : currentLabel
              ? `${currentLabel} ${trimmedQuery}`
              : trimmedQuery;
        console.log(apiQuery, "apiQuery");

        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader
            ? { Authorization: authHeader }
            : { Authorization: `Bearer ${APOLOGIST_API_KEY}` }),
          ...(cacheTtl != null ? { "x-cache-ttl": String(cacheTtl) } : {}),
        };

        const fetchQueryResults = async (query) => {
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

          const res = await web.post(url, payload, { headers });

          if (cancelled) return [];

          if (!res || res.status !== 200) {
            throw new Error(res?.error || `HTTP ${res?.status}`);
          }

          const results = res?.data?.results || [];
          setCachedResults(key, results);
          return results;
        };

        const chapterContextData =
          chapterData || globalThis.GlobalSearchChapterData;

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
          console.log(queryResultPairs, "queryresultpairs");

          if (cancelled) return;

          results = buildHybridRankedResults(
            queryResultPairs,
            currentLabel || trimmedQuery,
            chapterContextData
          );
          console.log(results, "results");
        } else {
          const singleResults = await fetchQueryResults(apiQuery);

          const allowedTypes = new Set(["youtube", "episode", "url", "book"]);

          results = dedupeResults(
            singleResults.filter((item) => allowedTypes.has(item?.type))
          );
        }

        if (cancelled) return;
        const computedLabel =
          globalThis.GlobalSearchLabel ||
          (isVerseLevel && currentBaselineQuery
            ? currentBaselineQuery
            : trimmedQuery);
        setHeaderLabel(computedLabel);

        setAllData(results);
        setData(results.slice(0, 10));

        setHasMore(results.length > 10);

        lastSearchKeyRef.current = normalizedSearchKey;
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || "Network error");
          setData([]);
          setAllData([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    setLoading(true);
    setErr("");

    setData([]);
    setAllData([]);
    setOpenIds(new Set());
    setHasMore(false);
    setDisplayedCount(10);

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
    baselineQuery,
    label,
    chapterData,
  ]);

  const handleResetToBaseline = () => {
    if (!currentBaselineQuery) return;
    globalThis.IsVerseClicked = false;
    globalThis.IsVerseClickedOnDesktop = false;

    // Use the stored chapter-level label (not the current which may be verse-level)
    const chapterLabel =
      globalThis.GlobalSearchChapterLabel || globalThis.GlobalSearchLabel || "";

    // Always sync globals so polling stays consistent
    globalThis.GlobalSearch = currentBaselineQuery;
    globalThis.GlobalSearchLevel = "chapter";
    globalThis.GlobalSearchLabel = chapterLabel;

    const helper = globalThis.UpdateStudyNoteSearch;
    if (typeof helper === "function") {
      helper(currentBaselineQuery, {
        level: "chapter",
        label: chapterLabel,
        baseline: currentBaselineQuery,
        chapterData: globalThis.GlobalSearchChapterData || chapterData || null,
        forceRefresh: true,
      });
    }
  };

  const handleRetry = () => {
    setErr("");
    setSearchRunId((prev) => prev + 1);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);

    // Simulate loading delay for better UX
    setTimeout(() => {
      const newDisplayedCount = displayedCount + 10;
      const newData = allData.slice(0, newDisplayedCount);

      setData(newData);
      setDisplayedCount(newDisplayedCount);
      setHasMore(newDisplayedCount < allData.length);

      // Add new book IDs to openIds
      const newBookIds = newData
        .filter((item) => item.type === "book" && item.id)
        .map((item) => item.id);
      setOpenIds((prev) => {
        const merged = new Set(prev);
        newBookIds.forEach((id) => merged.add(id));
        return merged;
      });

      setLoadingMore(false);
    }, 300);
  };

  if (!search?.trim())
    return <div className="sg-muted">Type a search to begin…</div>;

  if (loading && data.length === 0) {
    return (
      <div className={`sg-searchWrap ${className}`}>
        <div className={`sg-results sg-list ${className}`}>
          {/* Article-style skeletons */}
          {[1, 2, 3, 4].map((i) => (
            <div
              key={`a${i}`}
              className="sg-skeleton-card sg-skeleton-article"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="sg-skeleton-row">
                <div className="sg-skeleton-circle" />
                <div className="sg-skeleton-bar" style={{ width: "80px" }} />
                <div className="sg-skeleton-dot" />
                <div className="sg-skeleton-bar" style={{ width: "60px" }} />
                <div style={{ flex: 1 }} />
                <div className="sg-skeleton-icon" />
              </div>
              <div
                className="sg-skeleton-bar sg-skeleton-title"
                style={{ width: `${65 + i * 5}%` }}
              />
            </div>
          ))}
          {/* Book-style skeletons */}
          {[1, 2].map((i) => (
            <div
              key={`b${i}`}
              className="sg-skeleton-card sg-skeleton-book"
              style={{ animationDelay: `${(4 + i) * 0.1}s` }}
            >
              <div className="sg-skeleton-cover" />
              <div
                className="sg-skeleton-bar sg-skeleton-title"
                style={{ width: "60%", margin: "0 auto" }}
              />
              <div className="sg-skeleton-pill" />
            </div>
          ))}
        </div>
        <style>{getStyleOf("apologist.css")}</style>
      </div>
    );
  }

  if (err) {
    return (
      <div className="sg-error">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: "36px", opacity: 0.7 }}
        >
          cloud_off
        </span>
        <b>Search error:</b> {err}
        <button className="sg-retry-btn" onClick={handleRetry}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: "16px" }}
          >
            refresh
          </span>
          Retry
        </button>
        <div className="sg-muted sg-small">
          If a preview is blocked, use "Open".
        </div>
        <style>{getStyleOf("apologist.css")}</style>
      </div>
    );
  }

  return (
    <div className={`sg-searchWrap ${className}`}>
      <div className="sg-header">
        {data && data.length > 0 && (
          <div className="sg-headerTop">
            {showResetControl && (
              <button
                type="button"
                className="material-symbols-outlined sg-resetBtn"
                onClick={handleResetToBaseline}
                title={`Back to chapter`}
                aria-label="Back to chapter search"
              >
                arrow_back
              </button>
            )}
            <div className="sg-resultCount">
              {t(headerLabel)} | {data.length} {t("results")}
            </div>
          </div>
        )}
      </div>

      {/* Pinned Now Playing Section */}

      <div
        className={`sg-results sg-list
         ${className}`}
      >
        {data && data.length > 0 ? (
          <>
            {data.map((item, index) => {
              const key =
                buildResultKey(item) ||
                item?.id ||
                item?.url ||
                `fallback-${index}`;

              return (
                <LazyCard key={key}>
                  <SgCard
                    item={item}
                    key={key}
                    isOpen={
                      nowPlayingId === item.id ? true : openIds.has(item.id)
                    }
                    isNowPlaying={nowPlayingId === item.id}
                    setNowPlayingId={setNowPlayingId}
                    onClose={
                      nowPlayingId === item.id
                        ? () => setNowPlayingId(null)
                        : undefined
                    }
                    isPinned={nowPlayingId === item.id}
                    isActive={activeCardId === item.id}
                    isLinkOpen={linkOpenId === item.id}
                    setlinkOpenId={setLinkOpenId}
                    setActiveCardId={setActiveCardId}
                    setcameFromDiscovery={setCameFromDiscovery}
                  />
                </LazyCard>
              );
            })}
            {hasMore && (
              <div ref={loadMoreRef} className="sg-loadMore">
                {loadingMore && (
                  <>
                    <div className="sg-spinner"></div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          !loading &&
          searchParam &&
          data.length === 0 && (
            <div className="sg-empty">
              <div className="sg-emptyIcon">🔎</div>
              <div className="sg-emptyTitle">{t("noContent")}</div>
              <div className="sg-emptyHint">{t("noResources")}</div>
            </div>
          )
        )}

        <style>{getStyleOf("apologist.css")}</style>
      </div>
    </div>
  );
}

globalThis.Apologist = Apologist;
globalThis.ApologistSearch = Apologist;

return Apologist;
