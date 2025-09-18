import { useState, useEffect, useRef } from "react";
import { ReactTyped } from "react-typed";
import MessageBubble from "./MessageBubble";
import { getChatHistory, sendMessage, clearChatHistory } from "../services/api";
import "../styles/ChatWindow.scss";

function ChatWindow({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Load chat history on session change
  useEffect(() => {
    if (!sessionId) return;

    getChatHistory(sessionId)
      .then((res) => {
        console.log("Chat history res: ", res?.data?.history);

        const formattedMessages = (res?.data?.history || []).map((msg) => ({
          type: msg.type || msg.role || "bot",
          text: msg.content || msg.text || msg.message || "",
          sources: msg.sources || [],
          timestamp: msg.timestamp,
          id: msg.id,
        }));

        setMessages(formattedMessages);
      })
      .catch((err) => console.error("Failed to load history:", err));
  }, [sessionId]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea function
  const autoResizeTextarea = (textarea) => {
    if (!textarea) return;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on scroll height, but respect min/max constraints
    const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
    textarea.style.height = newHeight + 'px';
    
    // If content exceeds max height, enable scrolling
    if (textarea.scrollHeight > 120) {
      textarea.style.overflowY = 'auto';
    } else {
      textarea.style.overflowY = 'hidden';
    }
  };

  // Handle input change with auto-resize
  const handleInputChange = (e) => {
    setInput(e.target.value);
    autoResizeTextarea(e.target);
  };

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (input === '' && textareaRef.current) {
      textareaRef.current.style.height = '40px';
      textareaRef.current.style.overflowY = 'hidden';
    }
  }, [input]);

  const fallbackHandleSend = async (message) => {
    try {
      const res = await sendMessage(sessionId, message);
      const botMessage = {
        type: "bot",
        text: res?.data?.response?.content || "No response",
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const messageToSend = input.trim();
    setInput("");

    const userMessage = { type: "user", text: messageToSend };
    setMessages((prev) => [...prev, userMessage]);

    const thinking = { type: "bot", text: "Thinking.." };
    setMessages((prev) => [...prev, thinking]);

    try {
      const res = await sendMessage(sessionId, messageToSend);
      console.log("Gemini Response: ", res?.status);

      if(res.status != 200){
        throw new Error("Gemini streaming not supported (501)");
      }

      let botMessage = {
        type: "bot",
        text: res?.data?.response?.content || "No response",
      };

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...botMessage };
        return updated;
      });
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { type: "bot", text: "🤖 Sorry, I couldn't generate a response. Please try again." };
        return updated;
      });
    }
  };

  const handleSendWithStream = async () => {
    if (!input.trim()) return;

    const messageToSend = input.trim();
    setInput(""); // This will trigger the useEffect to reset textarea height

    const userMessage = { type: "user", text: messageToSend };
    setMessages((prev) => [...prev, userMessage]);
    const thinking = { type: "bot", text: "Thinking.." };
    setMessages((prev) => [...prev, thinking]);

    try {
      const response = await fetch(`http://localhost:5000/api/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: messageToSend }),
      });

      if (response.status === 503) {
        throw new Error("Gemini streaming not supported (501)");
      }

      if (!response.ok || !response.body) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let botMessage = { type: "bot", text: "" };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n").filter(Boolean);

        for (let line of lines) {
          if (line.startsWith("data:")) {
            const data = JSON.parse(line.replace("data: ", ""));
            if (data.type === "chunk") {
              botMessage.text += data.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...botMessage };
                return updated;
              });
            }
          }
        }

        if (!botMessage.text.trim()) {
          botMessage.text = "🤖 Sorry, I couldn't generate a response. Please try again.";
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...botMessage };
            return updated;
          });
        }
      }
   } catch (err) {
      console.error("Stream error:", err);
      fallbackHandleSend(messageToSend);
    }
  };

  const handleClear = async () => {
    if (!sessionId) return;
    try {
      await clearChatHistory(sessionId);
      setMessages([]);
    } catch (error) {
      console.error("Error clearing chat:", error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-window">
      {messages.length > 0 && sessionId && (
        <div className="chat-header">
          <button className="clear-btn" onClick={handleClear}>
            🗑 Clear Chat
          </button>
        </div>
      )}

      {/* <div className="messages-container">
        {sessionId ? (
          messages.map((msg, idx) => (
            <MessageBubble key={idx} type={msg.type} content={msg.text} />
          ))
        ) : (
          <div className="no-session">
            <ReactTyped
              strings={["Select or create a session to start chatting"]}
              typeSpeed={50}
              backSpeed={30}
              loop={false}
              showCursor={false}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div> */}

      <div className="messages-container">
        {sessionId ? (
          messages.length > 0 ? (
            messages.map((msg, idx) => (
              <MessageBubble key={idx} type={msg.type} content={msg.text} />
            ))
          ) : (
            <div className="no-messages">
              <ReactTyped
                strings={[
                  "Welcome! Ask me about news related stuff",
                  "Type a question to get started with your session."
                ]}
                typeSpeed={50}
                backSpeed={30}
                loop={true} // keep it looping while empty
                showCursor={true}
              />
            </div>
          )
        ) : (
          <div className="no-session">
            <ReactTyped
              strings={["Select or create a session to start chatting"]}
              typeSpeed={50}
              backSpeed={30}
              loop={false}
              showCursor={false}
            />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-bar">
        <textarea
          ref={textareaRef}
          placeholder="Type a message..."
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          className="chat-textarea"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !sessionId}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;