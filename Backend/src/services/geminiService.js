const { GoogleGenerativeAI } = require('@google/generative-ai');
const {SYSTEM_PROMPT, STREAMING_PROMPT, SUMMARIZE_PROMPT} = require('../constants/prompts');
require('dotenv').config();

class GeminiService {
    constructor() {
        this.genAI = GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    }

    async generateResponse(query, relevantContext, chatHistory = []) {
        try {
            // Construct the prompt with context and history
            const systemPrompt = SYSTEM_PROMPT(query, relevantContext, chatHistory);
            const result = await this.model.generateContent(systemPrompt);
            const response = await result.response;
        
            return {
                text: response.text(),
                sources: relevantContext.map(doc => ({
                title: doc.title || 'News Article',
                url: doc.url || null,
                snippet: doc.content.substring(0, 150) + '...'
                }))
            };
        } 
        catch (error) {
            console.error('Gemini API Error:', error);
            throw new Error('Failed to generate response from Gemini API');
        }
    }

    async generateStreamingResponse(query, relevantContext, chatHistory = []) {
        try {
            const systemPrompt = STREAMING_PROMPT(query, relevantContext, chatHistory);
            const result = await this.model.generateContentStream(systemPrompt);
            return result.stream;
        } 
        catch (error) {
            console.error('Gemini Streaming API Error:', error);
            throw new Error('Failed to generate streaming response from Gemini API');
        }
    }

    async summarizeArticles(articles) {
        try {
            const prompt = SUMMARIZE_PROMPT(articles);
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } 
        catch (error) {
            console.error('Gemini Summarization Error:', error);
            throw new Error('Failed to summarize articles');
        }
    }
}

module.exports = new GeminiService();
