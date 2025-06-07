import { observer } from "mobx-react-lite";
import { ChatMessage as ChatMessageType } from "@/types/proto/api/v1/ai_service";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

const ChatMessage = observer(({ message, isStreaming }: ChatMessageProps) => {
  const isUser = message.role === "user";

  const formatContent = (content: string) => {
    // Simple formatting for code blocks and line breaks
    return content.split("\n").map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className={`mb-4 ${isUser ? "text-right" : "text-left"}`}>
      <div
        className={`inline-block p-4 shadow-sm max-w-[80%] ${
          isUser
            ? "bg-teal-500 text-white rounded-2xl rounded-br-md"
            : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-bl-md"
        }`}
      >
        <div className="whitespace-pre-wrap break-words leading-relaxed">
          {formatContent(message.content)}
          {isStreaming && <span className="inline-block w-2 h-5 bg-current opacity-50 animate-pulse ml-1" />}
        </div>
      </div>
    </div>
  );
});

export default ChatMessage;
