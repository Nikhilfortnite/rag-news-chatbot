const { QdrantClient } = require("@qdrant/qdrant-js");
const axios = require("axios");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

console.log("QDRANT_URL:", process.env.QDRANT_URL);
console.log("QDRANT_API_KEY:", process.env.QDRANT_API_KEY ? "Exists" : "Missing");
console.log("JINA_API_KEY:", process.env.JINA_API_KEY ? "Exists" : "Missing");
console.log("EMBEDDING_URL:", process.env.EMBEDDING_URL);

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

const COLLECTION_NAME = process.env.COLLECTION;

async function initCollection() {
  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.find(
      (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
      await qdrant.createCollection(COLLECTION_NAME, {
        vectors: { size: 768, distance: "Cosine" },
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

async function getEmbedding(text) {
  try {
    if (!text || text.trim().length === 0) {
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

async function addDocuments(docs) {
  try {
    const points = [];

    for (let i = 0; i < docs.length; i++) {
      const vector = await getEmbedding(docs[i].content);
      points.push({
        id: Date.now() + i,
        vector,
        payload: {
          title: docs[i].title,
          link: docs[i].link,
          content: docs[i].content,
        },
      });
    }

    if (points.length > 0) {
      await qdrant.upsert(COLLECTION_NAME, { points });
      console.log(`Inserted ${points.length} documents into Qdrant`);
    }
  } catch (error) {
    console.error("Error adding documents:", error.message);
    throw error;
  }
}

async function searchDocuments(queryVector, limit = 5) {
  try {
    const result = await qdrant.search(COLLECTION_NAME, {
      vector: queryVector,
      limit,
    });
    return result;
  } catch (error) {
    console.error("Error searching documents:", error.message);
    throw error;
  }
}

module.exports = {
  initCollection,
  getEmbedding,
  addDocuments,
  searchDocuments,
};
