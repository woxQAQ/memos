import { MessageSquarePlus, Pencil, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { ChatSession } from "@/types/proto/api/v1/ai_service";
import { useTranslate } from "@/utils/i18n";

interface SessionListProps {
  sessions: ChatSession[];
  currentSession: ChatSession | null;
  onSelectSession: (session: ChatSession) => void;
  onCreateSession: () => void;
  onUpdateSession: (sessionUid: string, title: string) => void;
  onDeleteSession: (sessionUid: string) => void;
}

const SessionList = observer(
  ({ sessions, currentSession, onSelectSession, onCreateSession, onUpdateSession, onDeleteSession }: SessionListProps) => {
    const t = useTranslate();
    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");

    const formatDate = (timestamp: any) => {
      if (!timestamp) return "";

      let date: Date;
      if (timestamp.seconds !== undefined) {
        // Protobuf timestamp format
        date = new Date(timestamp.seconds * 1000 + (timestamp.nanos || 0) / 1000000);
      } else if (typeof timestamp === "string") {
        // ISO string format
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return "";
      }

      if (isNaN(date.getTime())) {
        return "";
      }

      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } else if (days === 1) {
        return t("ai.yesterday");
      } else if (days < 7) {
        return t("ai.days-ago", { count: days });
      } else {
        return date.toLocaleDateString();
      }
    };

    const handleUpdateTitle = (sessionUid: string, title: string) => {
      onUpdateSession(sessionUid, title);
      setEditingSessionId(null);
      setEditingTitle("");
    };

    return (
      <div className="w-80 border-r border-gray-200 dark:border-zinc-700 flex flex-col bg-gray-100 dark:bg-zinc-950">
        <div className="p-4 border-b border-gray-200 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("ai.chat-history")}</h3>
            <button
              onClick={onCreateSession}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-gray-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
              title={t("ai.new-conversation-button")}
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pt-4">
          {sessions.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <p>{t("ai.no-chat-history")}</p>
              <button onClick={onCreateSession} className="mt-2 text-teal-600 dark:text-teal-400 hover:underline">
                {t("ai.start-first-conversation")}
              </button>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.uid}
                className={`p-3 mx-2 mb-2 rounded-lg cursor-pointer transition-colors group ${
                  currentSession?.uid === session.uid
                    ? "bg-teal-100 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800"
                    : "hover:bg-gray-200 dark:hover:bg-zinc-800"
                }`}
                onClick={() => onSelectSession(session)}
              >
                <div className="flex items-center justify-between">
                  {editingSessionId === session.uid ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleUpdateTitle(session.uid, editingTitle)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleUpdateTitle(session.uid, editingTitle);
                        } else if (e.key === "Escape") {
                          setEditingSessionId(null);
                          setEditingTitle("");
                        }
                      }}
                      className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-gray-100"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {session.title || t("ai.new-conversation")}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{formatDate(session.updatedTime)}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSessionId(session.uid);
                        setEditingTitle(session.title || "");
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
                      title={t("ai.rename")}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.uid);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                      title={t("ai.delete")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  },
);

export default SessionList;
