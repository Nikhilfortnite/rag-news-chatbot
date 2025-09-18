const Parser = require("rss-parser");
const { initCollection, addDocuments } = require("../services/vectorService.js");

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });


const rssParser = new Parser();

async function fetchArticles() {
  try {
    const feed = await rssParser.parseURL(process.env.NEWS_URL);
    return feed.items
      .filter(item => item.contentSnippet && item.contentSnippet.trim().length > 0)
      .slice(0, 10) // You can make this configurable from .env
      .map(item => ({
        title: item.title,
        link: item.link,
        content: item.contentSnippet || "",
      }));
  } catch (error) {
    console.error("Error fetching articles:", error.message);
    throw error;
  }
}

(async () => {
  try {
    await initCollection();
    const articles = await fetchArticles();
    await addDocuments(articles);
    console.log("Ingestion pipeline completed successfully");
  } catch (error) {
    console.error("Pipeline failed:", error.message);
    process.exit(1);
  }
})();
