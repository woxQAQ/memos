import { BotIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { ChatMessage as ChatMessageType } from "@/types/proto/api/v1/ai_service";
import MarkdownRenderer from "./MarkdownRenderer";

interface ChatMessageProps {
  message: ChatMessageType;
  isStreaming?: boolean;
}

const ChatMessage = observer(({ message, isStreaming }: ChatMessageProps) => {
  const isUser = message.role === "user";

  const formatUserContent = (content: string) => {
    // Simple formatting for user messages - keep them as plain text with line breaks
    return content.split("\n").map((line, index) => (
      <span key={index}>
        {line}
        {index < content.split("\n").length - 1 && <br />}
      </span>
    ));
  };

  return (
    <div className={`mb-6 ${isUser ? "flex justify-end" : "flex justify-start items-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900 rounded-full flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          </div>
        </div>
      )}

      <div className={`${isUser ? "max-w-[80%]" : "flex-1 min-w-0"}`}>
        {isUser ? (
          <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-600">
            <div className="whitespace-pre-wrap break-words leading-relaxed">{formatUserContent(message.content)}</div>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <MarkdownRenderer content={message.content} className="text-gray-900 dark:text-gray-100 break-words" />
            {isStreaming && <span className="inline-block w-2 h-5 bg-gray-400 opacity-50 animate-pulse ml-1" />}
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatMessage;
