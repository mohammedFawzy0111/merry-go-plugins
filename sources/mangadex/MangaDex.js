// MangaDex plugin for the new system
const API = "https://api.mangadex.org";
const CDN = "https://uploads.mangadex.org";
const MANGA_DEX_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json",
};
const limit = 20;

// Create the source instance
const mangaDex = sandbox.utils.createSource({
  name: 'MangaDex',
  baseUrl: API,
  icon: 'https://mangadex.org/favicon.ico',
});

// Helper function to get chapters
const getChapters = async (mangaId) => {
  let chapters = [];
  let offset = 0;
  const limit = 100;
  let total = 0;

  do {
    const chaptersResp = await sandbox.http.get(`${API}/chapter`, {
      headers: MANGA_DEX_HEADERS,
      params: {
        manga: mangaId,
        translatedLanguage: ["en", "ar"],
        order: { chapter: "asc" },
        limit,
        offset
      }
    });

    const chapterData = chaptersResp.data.data;
    total = chaptersResp.data.total;

    chapters = chapters.concat(
      chapterData.map((ch) => {
        const chapterNum = Number(ch.attributes.chapter) || 0;
        const chapterUrl = `${API}/chapter/${ch.id}`;
        return sandbox.utils.createChapter({
          number: chapterNum,
          url: chapterUrl,
          title: ch.attributes.title || `Chapter ${chapterNum}`,
          manga: `${API}/manga/${mangaId}`,
          publishedAt: ch.attributes.publishAt || new Date().toISOString(),
          pages: []
        });
      })
    );

    offset += limit;
  } while(offset < total);

  return chapters;
}

// Helper function to get rating
const getRating = async (mangaId) => {
  const response = await sandbox.http.get(`${API}/statistics/manga/${mangaId}`, {
    headers: MANGA_DEX_HEADERS,
  });

  const id = Object.keys(response.data.statistics)[0];
  return Number(response.data.statistics[id].rating.average) ?? 0;
}

// Helper function to get best title
const getBestTitle = (attributes) => {
  if (attributes.title && attributes.title["en"]) return attributes.title["en"];
  if (attributes.title && attributes.title["ar"]) return attributes.title["ar"];
  if (attributes.title && attributes.title["ja"]) return attributes.title["ja"];
  
  if (attributes.altTitles) {
    const englishAltTitle = attributes.altTitles.find((titleObj) => titleObj["en"]);
    if (englishAltTitle?.["en"]) return englishAltTitle["en"];
    
    const firstAltTitle = attributes.altTitles.find((titleObj) => {
      const values = Object.values(titleObj);
      return values.length > 0 && values[0];
    });
    if (firstAltTitle) return Object.values(firstAltTitle)[0];
  }
  
  return "Unknown";
};

// Fetch recent manga
mangaDex.fetchRecentManga = async (offset) => {
  try {
    const response = await sandbox.http.get(`${API}/manga`, {
      headers: MANGA_DEX_HEADERS,
      params: {
        limit,
        offset,
        "order[updatedAt]": "desc",
        includes: ["cover_art"],
      },
    });
    
    const mangas = await Promise.all(
      response.data.data.map(async (item) => {
        const attributes = item.attributes;
        const title = getBestTitle(attributes);
        const url = `${API}/manga/${item.id}`;
        const id = item.id || `${title} + ${url}`;

        const coverRel = item.relationships.find((rel) => rel.type === "cover_art");
        let imageUrl = "";
        if (coverRel?.attributes?.fileName) {
          imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
        }

        const lastChapter = attributes.lastChapter || "no chapters";
        const lastUpdated = attributes.updatedAt || new Date().toISOString();

        return sandbox.utils.createManga({
          id,
          name: title,
          url,
          imageUrl,
          lastChapter,
          lastUpdated,
          source: mangaDex,
        });
      })
    );

    return mangas;
  } catch (error) {
    sandbox.console.error("Error fetching recent manga:", error);
    return [];
  }
}

// Fetch popular manga
mangaDex.fetchPopularManga = async (offset) => {
  try {
    const response = await sandbox.http.get(`${API}/manga`, {
      headers: MANGA_DEX_HEADERS,
      params: {
        limit,
        offset,
        "order[followedCount]": "desc",
        includes: ["cover_art"],
      },
    });
    
    const mangas = await Promise.all(
      response.data.data.map(async (item) => {
        const attributes = item.attributes;
        const title = getBestTitle(attributes);
        const url = `${API}/manga/${item.id}`;
        const id = item.id || `${title} + ${url}`;

        const coverRel = item.relationships.find((rel) => rel.type === "cover_art");
        let imageUrl = "";
        if (coverRel?.attributes?.fileName) {
          imageUrl = `${CDN}/covers/${item.id}/${coverRel.attributes.fileName}.256.jpg`;
        }

        const lastChapter = attributes.lastChapter || "no chapters";
        const lastUpdated = attributes.updatedAt || new Date().toISOString();

        return sandbox.utils.createManga({
          id,
          name: title,
          url,
          imageUrl,
          lastChapter,
          lastUpdated,
          source: mangaDex,
        });
      })
    );

    return mangas;
  } catch (error) {
    sandbox.console.error("Error fetching popular manga:", error);
    return [];
  }
}

// Fetch manga details
mangaDex.fetchMangaDetails = async (mangaUrl) => {
  try {
    const response = await sandbox.http.get(mangaUrl, {
      headers: MANGA_DEX_HEADERS,
      params: {
        includes: ["cover_art", "author", "artist"],
      },
    });
    
    const mangaData = response.data.data;
    const title = getBestTitle(mangaData.attributes);
    
    // Get cover
    let coverUrl = "";
    const coverRel = mangaData.relationships.find((rel) => rel.type === "cover_art");
    if (coverRel?.id) {
      const coverResponse = await sandbox.http.get(`${API}/cover/${coverRel.id}`);
      const fileName = coverResponse.data.data.attributes.fileName;
      coverUrl = `${CDN}/covers/${mangaData.id}/${fileName}.256.jpg`;
    }
    
    const lastChapter = mangaData.attributes.lastChapter || "no chapters";
    const lastUpdated = mangaData.attributes.updatedAt || new Date().toISOString();

    const details = {
      altTitles: mangaData.attributes.altTitles
        ? mangaData.attributes.altTitles
            .map((titleObj) => {
              const firstValue = Object.values(titleObj)[0];
              return firstValue || "";
            })
            .filter(Boolean)
        : [],
      status: mangaData.attributes.status || "Unknown",
      description: mangaData.attributes.description?.en || "",
      "original language": mangaData.attributes.originalLanguage || "en",
      Demographic: mangaData.attributes.publicationDemographic || "Unknown",
      year: mangaData.attributes.year || "Unknown",
      tags: mangaData.attributes.tags?.map((tag) => tag.attributes.name.en) || [],
      author: mangaData.relationships.find((rel) => rel.type === "author")?.attributes?.name || "Unknown Author",
      artist: mangaData.relationships.find((rel) => rel.type === "artist")?.attributes?.name || "Unknown Artist",
      rating: await getRating(mangaData.id),
    }

    const chapters = await getChapters(mangaData.id);
    
    return sandbox.utils.createManga({
      id: mangaData.id || `${title} + ${mangaUrl}`,
      name: title,
      url: mangaUrl,
      imageUrl: coverUrl,
      lastChapter,
      lastUpdated,
      source: mangaDex,
      data: details,
      chapters
    });

  } catch (error) {
    sandbox.console.error("Error fetching manga details:", error);
    return sandbox.utils.createManga({
      id: '',
      name: "Unknown",
      url: mangaUrl,
      imageUrl: "",
      lastChapter: "N/A",
      lastUpdated: new Date().toISOString(),
      source: mangaDex,
      data: {},
      chapters: []
    });
  }
}

// Fetch chapter details
mangaDex.fetchChapterDetails = async (url) => {
  try {
    const chapterReq = await sandbox.http.get(url, {
      headers: MANGA_DEX_HEADERS
    });
    
    const chapterData = chapterReq.data.data;
    const mangaId = chapterData.relationships.find((rel) => rel.type === "manga")?.id || "";
    const title = chapterData.attributes.title || "";
    const chapterNum = Number(chapterData.attributes.chapter) || 0;
    const chapterId = chapterData.id;
    const publishedAt = chapterData.attributes.publishAt || new Date().toISOString();

    const atHomeResp = await sandbox.http.get(`${API}/at-home/server/${chapterId}`, {
      headers: MANGA_DEX_HEADERS
    });
    
    const baseUrl = atHomeResp.data.baseUrl;
    const hash = atHomeResp.data.chapter.hash;
    const fileNames = atHomeResp.data.chapter.data || [];

    const pages = fileNames.map((name) => `${baseUrl}/data/${hash}/${name}`);

    return sandbox.utils.createChapter({
      manga: `${API}/manga/${mangaId}`,
      title,
      number: chapterNum,
      url,
      publishedAt,
      pages
    });
    
  } catch (error) {
    sandbox.console.error("Error fetching chapter:", error);
    return sandbox.utils.createChapter({
      manga: "",
      number: 0,
      url,
      pages: []
    });
  }
}

// Tag cache for search
const tagCache = new Map();

// Fetch search results
mangaDex.fetchSearchResults = async (query, offset) => {
  try {
    const isTagSearch = query.startsWith('[') && query.endsWith(']');
    
    const params = {
      limit,
      offset,
      includes: ["cover_art"],
      availableTranslatedLanguage: ["en", "ar"],
      "order[followedCount]": "desc",
    };

    if (isTagSearch) {
      const tagName = query.slice(1, -1).trim().toLowerCase();
      
      if (tagCache.has(tagName)) {
        params.includedTags = [tagCache.get(tagName)];
      } else {
        const tagResponse = await sandbox.http.get(`${API}/manga/tag`);
        const allTags = tagResponse.data.data;
        
        allTags.forEach((tag) => {
          const name = tag.attributes.name.en.toLowerCase();
          tagCache.set(name, tag.id);
        });
        
        if (tagCache.has(tagName)) {
          params.includedTags = [tagCache.get(tagName)];
        } else {
          return [];
        }
      }
    } else {
      params.title = query;
    }

    const response = await sandbox.http.get(`${API}/manga`, {
      headers: MANGA_DEX_HEADERS,
      params
    });

    const searchResults = response.data.data;
    const mangas = [];

    for (const result of searchResults) {
      const mangaId = result.id;
      const name = getBestTitle(result.attributes);
      const url = `${API}/manga/${mangaId}`;
      
      const coverRel = result.relationships.find((rel) => rel.type === "cover_art");
      const coverFileName = coverRel?.attributes?.fileName;
      const coverUrl = coverFileName 
        ? `${CDN}/covers/${mangaId}/${coverFileName}.256.jpg`
        : '';
        
      const lastChapter = result.attributes.lastChapter || "no chapters";
      const lastUpdated = result.attributes.updatedAt || new Date().toISOString();

      mangas.push(sandbox.utils.createManga({
        id: mangaId,
        name,
        url,
        imageUrl: coverUrl,
        source: mangaDex,
        lastChapter,
        lastUpdated,
      }));
    }
    
    return mangas;

  } catch (error) {
    sandbox.console.error("Error fetching search results:", error);
    return [];
  }
}

// Export the source
module.exports = mangaDex;
