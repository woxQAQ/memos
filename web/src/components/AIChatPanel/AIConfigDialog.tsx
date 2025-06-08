import { Button, Input } from "@usememos/mui";
import { isEqual } from "lodash-es";
import { X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { workspaceSettingNamePrefix } from "@/store/common";
import { workspaceStore } from "@/store/v2";
import { WorkspaceSettingKey } from "@/store/v2/workspace";
import { WorkspaceAIModelSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { useTranslate } from "@/utils/i18n";

interface AIConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIConfigDialog = observer(({ isOpen, onClose }: AIConfigDialogProps) => {
  const t = useTranslate();
  const [setting, setSetting] = useState<WorkspaceAIModelSetting>({
    model: "",
    apiKey: "",
    baseUrl: "",
  });
  const [originalSetting, setOriginalSetting] = useState<WorkspaceAIModelSetting>(setting);

  useEffect(() => {
    if (isOpen) {
      workspaceStore.fetchWorkspaceSetting(WorkspaceSettingKey.AI_MODEL).then(() => {
        const fetchedSetting = workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.AI_MODEL)?.aiModelSetting;
        if (fetchedSetting) {
          setSetting(fetchedSetting);
          setOriginalSetting(fetchedSetting);
        }
      });
    }
  }, [isOpen]);

  const handleSettingChange = (partial: Partial<WorkspaceAIModelSetting>) => {
    setSetting({
      ...setting,
      ...partial,
    });
  };

  const handleSave = async () => {
    if (!setting.model || !setting.apiKey || !setting.baseUrl) {
      toast.error("Please fill in all fields.");
      return;
    }

    try {
      await workspaceStore.upsertWorkspaceSetting({
        name: `${workspaceSettingNamePrefix}${WorkspaceSettingKey.AI_MODEL}`,
        aiModelSetting: setting,
      });
    } catch (error: any) {
      toast.error(error.details);
      return;
    }
    toast.success(t("message.update-succeed"));
    setOriginalSetting(setting);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-gray-200 dark:border-zinc-700 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("setting.ai-section.title")}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="w-full flex flex-col justify-start items-start gap-4">
            <div className="w-full flex flex-col justify-start items-start gap-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("setting.ai-section.model-name")}</span>
              <Input
                className="w-full"
                placeholder="e.g., gpt-4"
                value={setting.model}
                onChange={(e) => handleSettingChange({ model: e.target.value })}
              />
            </div>
            <div className="w-full flex flex-col justify-start items-start gap-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("setting.ai-section.api-key")}</span>
              <Input
                className="w-full"
                type="password"
                placeholder="e.g., sk-..."
                value={setting.apiKey}
                onChange={(e) => handleSettingChange({ apiKey: e.target.value })}
              />
            </div>
            <div className="w-full flex flex-col justify-start items-start gap-1">
              <span className="text-sm text-gray-700 dark:text-gray-300">{t("setting.ai-section.base-url")}</span>
              <Input
                className="w-full"
                placeholder="e.g., https://api.openai.com"
                value={setting.baseUrl}
                onChange={(e) => handleSettingChange({ baseUrl: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-6 border-t border-gray-200 dark:border-zinc-700">
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" disabled={isEqual(setting, originalSetting)} onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
});

export default AIConfigDialog;
