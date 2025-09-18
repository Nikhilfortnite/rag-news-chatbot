import React from "react";
import "../styles/MessageBubble.scss";

const MessageBubble = ({ type, content }) => {
  return (
    <div className={`message-bubble ${type}`}>
      <p>{content}</p>
    </div>
  );
};

export default MessageBubble;
