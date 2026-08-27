export function bibleRefrenceParser(text: string) {
  const regex =
    /\b((?:[1-3]\s)?(?:genesis|exodus|leviticus|numbers|deuteronomy|joshua|judges|ruth|(?:1|2)\s+samuel|(?:1|2)\s+kings|(?:1|2)\s+chronicles|ezra|nehemiah|esther|job|psalms?|proverbs|ecclesiastes|song of songs|song of solomon|isaiah|jeremiah|lamentations|ezekiel|daniel|hosea|joel|amos|obadiah|jonah|micah|nahum|habakkuk|zephaniah|haggai|zechariah|malachi|matthew|mark|luke|john|acts|romans|(?:1|2)\s+corinthians|galatians|ephesians|philippians|colossians|(?:1|2)\s+thessalonians|(?:1|2)\s+timothy|titus|philemon|hebrews|james|(?:1|2)\s+peter|(?:1|2|3)\s+john|jude|revelation))\s+(\d+)(?::(\d+)(?:[-‐-‒–—](\d+))?)?/gi;

  return [...text.matchAll(regex)].map((match) => ({
    full: match[0],
    book: match[1]?.trim(),
    chapter: Number(match[2]),
    verse: match[3] ? Number(match[3]) : null,
    endVerse: match[4] ? Number(match[4]) : null,
  }));
}
export function parseTranslation(text: string) {
  const translations = [
    {
      id: "AAB",
      shortName: "AAB",
      fullName: "Accessible Ancients Bible",
    },
    {
      id: "eng_asv",
      shortName: "ASV",
      fullName: "American Standard Version (1901)",
    },
    {
      id: "AMP",
      shortName: "AMP",
      fullName: "Amplified Bible",
    },
    {
      id: "BSB",
      shortName: "BSB",
      fullName: "Berean Standard Bible",
    },
    {
      id: "eng_bbe",
      shortName: "BBE",
      fullName: "Bible in Basic English",
    },
    {
      id: "eng_dby",
      shortName: "DBY",
      fullName: "Darby Translation",
    },
    {
      id: "eng_dra",
      shortName: "DRA",
      fullName: "Douay-Rheims 1899",
    },
    {
      id: "eng_fbv",
      shortName: "FBV",
      fullName: "Free Bible Version",
    },
    {
      id: "eng_gnv",
      shortName: "GNV",
      fullName: "Geneva Bible 1599",
    },
    {
      id: "eng_kjv",
      shortName: "KJAV",
      fullName: "King James (Authorized) Version",
    },
    {
      id: "eng_kja",
      shortName: "KJVA",
      fullName: "King James Version + Apocrypha",
    },
    {
      id: "eng_cpb",
      shortName: "KJVCP",
      fullName: "KJV Cambridge Paragraph Bible",
    },
    {
      id: "eng_lsv",
      shortName: "LSV",
      fullName: "Literal Standard Version",
    },
    {
      id: "eng_msb",
      shortName: "MSB",
      fullName: "Majority Standard Bible",
    },
    {
      id: "eng_net",
      shortName: "NETB",
      fullName: "NET Bible",
    },
    {
      id: "NASB1995",
      shortName: "NASB95",
      fullName: "New American Standard Bible (1995)",
    },
    {
      id: "NASB2020",
      shortName: "NASB2020",
      fullName: "New American Standard Bible (2020)",
    },
    {
      id: "eng_wbs",
      shortName: "NWB",
      fullName: "Noah Webster Bible",
    },
    {
      id: "eng_rv5",
      shortName: "RVA",
      fullName: "Revised Version with Apocrypha (1895)",
    },
    {
      id: "eng_ojb",
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
