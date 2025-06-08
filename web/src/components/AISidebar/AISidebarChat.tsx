import { BotIcon, Settings, MessageSquare, Plus } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import AIConfigDialog from "@/components/AIChatPanel/AIConfigDialog";
import ChatInput from "@/components/AIChatPanel/ChatInput";
import ChatMessage from "@/components/AIChatPanel/ChatMessage";
import { aiServiceClient } from "@/grpcweb";
import { ChatMessage as ChatMessageType, GenerateContentRequest, ChatSession, StreamEventType } from "@/types/proto/api/v1/ai_service";
import { cn } from "@/utils";
import { useTranslate } from "@/utils/i18n";

interface Props {
  className?: string;
}

const AISidebarChat = observer(({ className }: Props) => {
  const t = useTranslate();
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const createNewSession = () => {
    setCurrentSession(null);
    setMessages([]);
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    const userMessage: ChatMessageType = {
      role: "user",
      content: content.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsStreaming(true);
    setStreamingContent("");

    const sessionToUse = currentSession;

    try {
      const request: GenerateContentRequest = {
        messages: newMessages,
        sessionUid: sessionToUse?.uid || "",
      };

      const stream = aiServiceClient.generateContent(request);
      let accumulatedContent = "";
      let sessionAlreadySet = false;

      for await (const response of stream) {
        switch (response.eventType) {
          case StreamEventType.MODEL_READY:
            if (response.session && !sessionAlreadySet) {
              setCurrentSession(response.session);
              sessionAlreadySet = true;
            }
            break;

          case StreamEventType.CONTENT:
            if (response.content) {
              accumulatedContent += response.content;
              setStreamingContent(accumulatedContent);
            }
            break;

          case StreamEventType.SESSION_UPDATED:
            if (response.session) {
              if (!sessionAlreadySet) {
                setCurrentSession(response.session);
                sessionAlreadySet = true;
              }
            }
            break;

          case StreamEventType.TITLE_GENERATED:
            if (response.session) {
              setCurrentSession(response.session);
            }
            break;

          default:
            if (response.content) {
              accumulatedContent += response.content;
              setStreamingContent(accumulatedContent);
            }
            if (response.session) {
              setCurrentSession(response.session);
            }
            break;
        }
      }

      if (accumulatedContent) {
        const assistantMessage: ChatMessageType = {
          role: "assistant",
          content: accumulatedContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error: any) {
      let errorMessage = t("ai.ai-response-failed");
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes("please sign in to use ai features")) {
          errorMessage = t("ai.sign-in-required");
        } else if (msg.includes("invalid api key") || msg.includes("unauthenticated")) {
          errorMessage = t("ai.invalid-api-key");
        } else if (msg.includes("ai configuration incomplete") || msg.includes("failed precondition")) {
          errorMessage = t("ai.ai-config-incomplete");
        } else {
          errorMessage = error.message;
        }
      }

      setMessages((prevMessages) => prevMessages.slice(0, -1));
      toast.error(errorMessage);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  return (
    <div className={cn("w-full h-full flex flex-col", className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
        <div className="flex items-center gap-2">
          <BotIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">{t("ai.assistant")}</h3>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={createNewSession}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title={t("ai.new-conversation")}
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setConfigDialogOpen(true)}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            title={t("common.settings")}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 消息区域 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-zinc-50 dark:bg-zinc-900">
        {messages.length === 0 && !streamingContent && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm">{t("ai.start-conversation")}</p>
          </div>
        )}

        {messages.map((message, index) => (
          <ChatMessage key={index} message={message} />
        ))}

        {isStreaming && streamingContent && (
          <ChatMessage
            message={{
              role: "assistant",
              content: streamingContent,
            }}
            isStreaming={true}
          />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="border-t border-gray-200 dark:border-zinc-700 p-3 bg-zinc-50 dark:bg-zinc-900">
        <ChatInput onSendMessage={handleSendMessage} disabled={isStreaming} placeholder={t("ai.type-message")} />
      </div>

      <AIConfigDialog isOpen={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
    </div>
  );
});

export default AISidebarChat;
