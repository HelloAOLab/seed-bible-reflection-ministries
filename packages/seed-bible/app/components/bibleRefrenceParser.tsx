export function bibleRefrenceParser(text: string) {
  const regex =
    /\b((?:[1-3]\s)?(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|(?:1|2)\s+samuel|(?:1|2)\s+kings|(?:1|2)\s+chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song of songs|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|(?:1|2)\s+corinthians|galatians|ephesians|philippians|colossians|(?:1|2)\s+thessalonians|(?:1|2)\s+timothy|titus|philemon|hebrews|james|(?:1|2)\s+peter|(?:1|2|3)\s+john|jude|revelation))\s+(\d+):(\d+)(?:[-–](\d+))?/gi;

  return [...text.matchAll(regex)].map((match) => ({
    full: match[0],
    book: match[1]?.trim(),
    chapter: Number(match[2]),
    verse: Number(match[3]),
    endVerse: match[4] ? Number(match[4]) : null,
  }));
}
export function parseTranslation(text) {
  const translations = [
    {
      shortName: "AAB",
      fullName: "Accessible Ancients Bible",
    },
    {
      shortName: "ASV",
      fullName: "American Standard Version (1901)",
    },
    {
      shortName: "AMP",
      fullName: "Amplified Bible",
    },
    {
      shortName: "BSB",
      fullName: "Berean Standard Bible",
    },
    {
      shortName: "BBE",
      fullName: "Bible in Basic English",
    },
    {
      shortName: "DBY",
      fullName: "Darby Translation",
    },
    {
      shortName: "DRA",
      fullName: "Douay-Rheims 1899",
    },
    {
      shortName: "FBV",
      fullName: "Free Bible Version",
    },
    {
      shortName: "GNV",
      fullName: "Geneva Bible 1599",
    },
    {
      shortName: "KJAV",
      fullName: "King James (Authorized) Version",
    },
    {
      shortName: "KJVA",
      fullName: "King James Version + Apocrypha",
    },
    {
      shortName: "KJVCP",
      fullName: "KJV Cambridge Paragraph Bible",
    },
    {
      shortName: "LSV",
      fullName: "Literal Standard Version",
    },
    {
      shortName: "MSB",
      fullName: "Majority Standard Bible",
    },
    {
      shortName: "NETB",
      fullName: "NET Bible",
    },
    {
      shortName: "NASB95",
      fullName: "New American Standard Bible (1995)",
    },
    {
      shortName: "NASB2020",
      fullName: "New American Standard Bible (2020)",
    },
    {
      shortName: "NWB",
      fullName: "Noah Webster Bible",
    },
    {
      shortName: "RVA",
      fullName: "Revised Version with Apocrypha (1895)",
    },
    {
      shortName: "TOJB",
      fullName: "The Orthodox Jewish Bible",
    },
  ];

  const upperText = text.toUpperCase();

  return translations.find(
    (translation) =>
      upperText.includes(translation.shortName.toUpperCase()) ||
      upperText.includes(translation.fullName.toUpperCase())
  );
}
