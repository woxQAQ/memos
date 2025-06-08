// import { Button } from "@mui/joy";
import { observer } from "mobx-react-lite";
import { KeyboardEvent, useRef, useState, useEffect } from "react";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // 重置高度以获得正确的scrollHeight
      textarea.style.height = "auto";
      const newHeight = Math.max(52, Math.min(textarea.scrollHeight, 128));
      textarea.style.height = `${newHeight}px`;

      // 调整padding
      if (newHeight === 52) {
        textarea.style.paddingTop = "14px";
        textarea.style.paddingBottom = "14px";
      } else {
        textarea.style.paddingTop = "12px";
        textarea.style.paddingBottom = "12px";
      }
    }
  };

  const handleSubmit = () => {
    if (message.trim() && !disabled) {
      if (onFirstMessage) {
        onFirstMessage();
      }
      onSendMessage(message.trim());
      setMessage("");
    }
  };

  // 监听message变化，调整高度
  useEffect(() => {
    adjustHeight();
  }, [message]);

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyPress}
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
      />
    </div>
  );
});

export default ChatInput;
