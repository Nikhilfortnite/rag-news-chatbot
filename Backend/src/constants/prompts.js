module.exports = {
  SYSTEM_PROMPT: (query, relevantContext, chatHistory) => `
    You are a helpful news assistant that answers questions based on provided news articles. 
    Always base your answers on the context provided. If the context doesn't contain relevant information, 
    say so politely and suggest what kind of information you would need.

    Context from news articles:
    ${relevantContext.map((doc, index) => `${index + 1}. ${doc.content}`).join('\n\n')}

    Chat History:
    ${chatHistory.slice(-5).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

    User Question: ${query}

    Please provide a comprehensive answer based on the context provided.
    `
    ,

  STREAMING_PROMPT: (query, relevantContext, chatHistory) => `
    You are a helpful news assistant that answers questions based on provided news articles.
    Always base your answers on the context provided.

    Context from news articles:
    ${relevantContext.map((doc, index) => `${index + 1}. ${doc.content}`).join('\n\n')}

    Chat History:
    ${chatHistory.slice(-5).map(msg => `${msg.type}: ${msg.content}`).join('\n')}

    User Question: ${query}

    Please provide a comprehensive answer based on the context provided.
    `
    ,

  SUMMARIZE_PROMPT: (articles) => `
    Please provide a brief summary of these news articles:

    ${articles.map((article, index) => 
    `${index + 1}. Title: ${article.title}\nContent: ${article.content.substring(0, 500)}...\n`
    ).join('\n')}

    Provide a concise summary highlighting the key points from all articles.
    `
};
