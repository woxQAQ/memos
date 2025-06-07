// import { Button } from "@mui/joy";
import { SendIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { KeyboardEvent, useState } from "react";
import { useTranslate } from "@/utils/i18n";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onFirstMessage?: () => void;
}

const ChatInput = observer(({ onSendMessage, disabled, placeholder, onFirstMessage }: ChatInputProps) => {
  const t = useTranslate();
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      if (onFirstMessage) {
        onFirstMessage();
      }
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex gap-3 items-start">
      <div className="flex-1">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={placeholder || t("ai.type-message")}
          disabled={disabled}
          rows={1}
          className="w-full px-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl 
                     resize-none focus:outline-none
                     bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100
                     placeholder-gray-500 dark:placeholder-gray-400 min-h-[52px] max-h-32
                     transition-all duration-200 shadow-sm"
          style={{
            height: "52px",
            minHeight: "52px",
            paddingTop: "14px",
            paddingBottom: "14px",
            lineHeight: "24px",
          }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "52px";
            const newHeight = Math.max(52, Math.min(target.scrollHeight, 128));
            target.style.height = `${newHeight}px`;

            // 当高度为52px时，保持垂直居中
            if (newHeight === 52) {
              target.style.paddingTop = "14px";
              target.style.paddingBottom = "14px";
            } else {
              // 多行时使用正常的padding
              target.style.paddingTop = "12px";
              target.style.paddingBottom = "12px";
            }
          }}
        />
      </div>
      <div className="flex-shrink-0 mt-0">
        <button
          onClick={handleSubmit}
          disabled={!message.trim() || disabled}
          className="w-[52px] h-[52px] bg-teal-500 hover:bg-teal-600 disabled:bg-teal-300 disabled:shadow-md disabled:opacity-60 rounded-xl flex items-center justify-center p-0 text-white transition-all duration-200 border-none outline-none focus:outline-none cursor-pointer disabled:cursor-not-allowed"
        >
          <SendIcon className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
});

export default ChatInput;
