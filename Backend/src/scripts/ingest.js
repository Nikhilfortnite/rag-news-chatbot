import Parser from "rss-parser";
import axios from "axios";
import { QdrantClient } from "@qdrant/qdrant-js";
import {config} from "dotenv"
config({path: '../../.env'});

const rssParser = new Parser();

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY, 
});

const COLLECTION_NAME = process.env.COLLECTION;

// Setup Qdrant collection (if not exists)
async function initCollection() {
    try {
        const collections = await qdrant.getCollections();
        const exists = collections.collections.find(c => c.name === COLLECTION_NAME);

        if (!exists) {
            await qdrant.createCollection(COLLECTION_NAME, {
                vectors: { size: 768, distance: "Cosine" }, // Jina embeddings = 768 dim
            });
            console.log(`Created collection: ${COLLECTION_NAME}`);
        } else {
            console.log(`Collection already exists: ${COLLECTION_NAME}`);
        }
    } catch (error) {
        console.error("Error initializing collection:", error.message);
        throw error;
    }
}

// Get RSS feed articles
async function fetchArticles() {
    try {
        const feed = await rssParser.parseURL(process.env.NEWS_URL);
        console.log(`Fetched ${feed.items.length} articles from RSS feed`);
        return feed.items
        .filter(item => item.contentSnippet && item.contentSnippet.trim().length > 0)
        .slice(0, 10)
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

// Get embeddings from Jina API
async function getEmbedding(text) {
    try {
        // Skip empty text
        if (!text || text.trim().length === 0) {
            console.warn("Empty text provided for embedding, using placeholder");
            text = "No content available";
        }

        const response = await axios.post(
            process.env.EMBEDDING_URL,
            { model: "jina-embeddings-v2-base-en", input: text },
            { headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}` } }
        );
        return response.data.data[0].embedding;
    } catch (error) {
        console.error("Error getting embedding:", error.message);
        throw error;
    }
}

// Store in Qdrant
async function storeArticles(articles) {
    try {
        const points = [];

        for (let i = 0; i < articles.length; i++) {
            console.log(`Processing article ${i + 1}/${articles.length}: ${articles[i].title}`);
            
            // Skip articles with no content
            if (!articles[i].content || articles[i].content.trim().length === 0) {
                console.warn(`Skipping article with no content: ${articles[i].title}`);
                continue;
            }

            const vector = await getEmbedding(articles[i].content);
            points.push({
                id: Date.now() + i, // Better unique ID generation
                vector,
                payload: {
                    title: articles[i].title,
                    link: articles[i].link,
                    content: articles[i].content,
                },
            });
        }

        if (points.length > 0) {
            await qdrant.upsert(COLLECTION_NAME, { points });
            console.log(`Inserted ${points.length} articles into Qdrant`);
        } else {
            console.warn("No articles to insert");
        }
    } catch (error) {
        console.error("Error storing articles:", error.message);
        throw error;
    }
}

// Main
(async () => {
    try {
        await initCollection();
        const articles = await fetchArticles();
        await storeArticles(articles);
        console.log("Pipeline completed successfully!");
    } catch (error) {
        console.error("Pipeline failed:", error.message);
        process.exit(1);
    }
})();