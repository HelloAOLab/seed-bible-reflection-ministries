export function navigateToBibleReference({
  bookName,
  chapter,
  translationId,
  booksData,
}) {
  const bookData = booksData.find((book) =>
    book.commonName?.toLowerCase().includes(bookName.toLowerCase())
  );

  console.log(bookData, "bookData");

  if (!bookData) {
    console.log("Book not found");
    return;
  }

  const chapterUrl = bookData.firstChapterApiLink.replace(
    "1.json",
    `${chapter}.json`
  );

  console.log(chapterUrl);

  globalThis.Open(bookData.id, chapter, translationId, chapterUrl);
}
