import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useTranslate } from "@/utils/i18n";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog = observer(({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel }: ConfirmDialogProps) => {
  const t = useTranslate();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            {cancelText || t("common.cancel")}
          </button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors">
            {confirmText || t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
});

export default ConfirmDialog;
