import { BotIcon, PanelLeftOpen, PanelLeftClose, Settings } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import AIConfigDialog from "@/components/AIChatPanel/AIConfigDialog";
import ChatInput from "@/components/AIChatPanel/ChatInput";
import ChatMessage from "@/components/AIChatPanel/ChatMessage";
import ConfirmDialog from "@/components/AIChatPanel/ConfirmDialog";
import SessionList from "@/components/AIChatPanel/SessionList";
import { aiServiceClient } from "@/grpcweb";
import { ChatMessage as ChatMessageType, GenerateContentRequest, ChatSession, StreamEventType } from "@/types/proto/api/v1/ai_service";
import { useTranslate } from "@/utils/i18n";

const AIChatPanel = observer(() => {
  const t = useTranslate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSessions, setShowSessions] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await aiServiceClient.listChatSessions({});
      setSessions(response.sessions || []);

      if (!currentSession && response.sessions && response.sessions.length > 0) {
        await selectSession(response.sessions[0]);
      }
    } catch (error: any) {
      console.error("Failed to load sessions:", error);
      toast.error(t("ai.load-chat-history-failed"));
    }
  };

  const selectSession = async (session: ChatSession) => {
    try {
      const fullSession = await aiServiceClient.getChatSession({ uid: session.uid });
      setCurrentSession(fullSession);
      setMessages(fullSession.messages || []);
    } catch (error: any) {
      console.error("Failed to load session:", error);
      toast.error(t("ai.load-chat-messages-failed"));
    }
  };

  const createNewSession = () => {
    // 创建虚拟对话 - 不调用后端API
    setCurrentSession(null);
    setMessages([]);
  };

  const updateSessionTitle = async (sessionUid: string, title: string) => {
    try {
      await aiServiceClient.updateChatSession({
        uid: sessionUid || "",
        title: title,
      });
      await loadSessions();
    } catch (error: any) {
      console.error("Failed to update session:", error);
      toast.error(t("ai.update-conversation-failed"));
    }
  };

  const deleteSession = async (sessionUid: string) => {
    setSessionToDelete(sessionUid);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      await aiServiceClient.deleteChatSession({ uid: sessionToDelete });
      await loadSessions();

      if (currentSession?.uid === sessionToDelete) {
        setCurrentSession(null);
        setMessages([]);
      }
    } catch (error: any) {
      console.error("Failed to delete session:", error);
      toast.error(t("ai.delete-conversation-failed"));
    } finally {
      setDeleteConfirmOpen(false);
      setSessionToDelete(null);
    }
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
      let newSessionCreated: ChatSession | null = null;
      let sessionAlreadySet = false;

      for await (const response of stream) {
        switch (response.eventType) {
          case StreamEventType.MODEL_READY:
            // 当模型就绪时，如果返回了新会话，立即设置当前会话
            if (response.session && !sessionAlreadySet) {
              newSessionCreated = response.session;
              setCurrentSession(response.session);
              sessionAlreadySet = true;
              // 不要在流处理过程中异步加载会话列表，避免状态混乱
            }
            break;

          case StreamEventType.CONTENT:
            if (response.content) {
              accumulatedContent += response.content;
              setStreamingContent(accumulatedContent);
            }
            break;

          case StreamEventType.OUTPUT_COMPLETE:
            break;

          case StreamEventType.SESSION_UPDATED:
            if (response.session) {
              newSessionCreated = response.session;
              if (!sessionAlreadySet) {
                setCurrentSession(response.session);
                sessionAlreadySet = true;
              }
            }
            break;

          case StreamEventType.TITLE_GENERATED:
            if (response.session) {
              newSessionCreated = response.session;
              setCurrentSession(response.session);
              // 延迟加载会话列表，避免在流处理中造成状态混乱
            }
            break;

          case StreamEventType.OUTPUT_END:
            break;

          default:
            // 向后兼容旧版本
            if (response.content) {
              accumulatedContent += response.content;
              setStreamingContent(accumulatedContent);
            }
            if (response.session) {
              newSessionCreated = response.session;
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

      // 流处理完成后，只刷新会话列表一次
      if (newSessionCreated || sessionToUse) {
        await loadSessions();
      }
    } catch (error: any) {
      console.error("Failed to get AI response:", error);

      // Handle specific error messages
      let errorMessage = t("ai.ai-response-failed");
      if (error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes("please sign in to use ai features")) {
          errorMessage = t("ai.sign-in-required");
        } else if (msg.includes("invalid api key") || msg.includes("unauthenticated")) {
          errorMessage = t("ai.invalid-api-key");
        } else if (msg.includes("rate limit") || msg.includes("resource exhausted")) {
          errorMessage = t("ai.rate-limit-exceeded");
        } else if (msg.includes("quota") || msg.includes("billing")) {
          errorMessage = t("ai.quota-exceeded");
        } else if (msg.includes("ai configuration incomplete") || msg.includes("failed precondition")) {
          errorMessage = t("ai.ai-config-incomplete");
        } else if (msg.includes("ai configuration is not set up") || msg.includes("contact your administrator")) {
          errorMessage = t("ai.ai-config-not-set");
        } else {
          errorMessage = error.message;
        }
      }

      // 如果AI响应失败，从消息列表中移除用户刚才的消息
      setMessages((prevMessages) => prevMessages.slice(0, -1));
      toast.error(errorMessage);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-gray-200 dark:border-zinc-700 overflow-hidden h-[calc(100vh-2rem)] flex">
      {showSessions && (
        <SessionList
          sessions={sessions}
          currentSession={currentSession}
          onSelectSession={selectSession}
          onCreateSession={createNewSession}
          onUpdateSession={updateSessionTitle}
          onDeleteSession={deleteSession}
        />
      )}

      <div className="flex-1 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSessions(!showSessions)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title={showSessions ? t("ai.hide-chat-list") : t("ai.show-chat-list")}
            >
              {showSessions ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
            <BotIcon className="w-6 h-6 text-gray-800 dark:text-gray-200" />
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{currentSession?.title || t("ai.new-conversation")}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfigDialogOpen(true)}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
              title={t("setting.ai-section.title")}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {messages.length === 0 && !streamingContent && (
            <div className="text-center text-gray-500 dark:text-gray-400 py-16">
              <BotIcon className="w-16 h-16 mx-auto mb-6 text-gray-300" />
              <p className="text-lg">{currentSession ? t("ai.continue-your-conversation") : t("ai.start-conversation")}</p>
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

        <div className="border-t border-gray-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-800">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={isStreaming}
            placeholder={currentSession ? t("ai.continue-conversation") : t("ai.start-new-conversation")}
          />
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        title={t("ai.delete-conversation")}
        message={t("ai.delete-conversation-confirm")}
        confirmText={t("ai.delete")}
        cancelText={t("common.cancel")}
        onConfirm={confirmDeleteSession}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setSessionToDelete(null);
        }}
      />

      <AIConfigDialog isOpen={configDialogOpen} onClose={() => setConfigDialogOpen(false)} />
    </div>
  );
});

export default AIChatPanel;
