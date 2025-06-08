import { Button, Input } from "@usememos/mui";
import { isEqual } from "lodash-es";
import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { workspaceSettingNamePrefix } from "@/store/common";
import { workspaceStore } from "@/store/v2";
import { WorkspaceSettingKey } from "@/store/v2/workspace";
import { WorkspaceAIModelSetting } from "@/types/proto/api/v1/workspace_setting_service";
import { useTranslate } from "@/utils/i18n";

const AISection = observer(() => {
  const t = useTranslate();
  const [setting, setSetting] = useState<WorkspaceAIModelSetting>({
    model: "",
    apiKey: "",
    baseUrl: "",
  });
  const [originalSetting, setOriginalSetting] = useState<WorkspaceAIModelSetting>(setting);

  useEffect(() => {
    workspaceStore.fetchWorkspaceSetting(WorkspaceSettingKey.AI_MODEL).then(() => {
      const fetchedSetting = workspaceStore.getWorkspaceSettingByKey(WorkspaceSettingKey.AI_MODEL)?.aiModelSetting;
      if (fetchedSetting) {
        setSetting(fetchedSetting);
        setOriginalSetting(fetchedSetting);
      }
    });
  }, []);

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
  };

  return (
    <div className="w-full flex flex-col gap-2 pt-2 pb-4">
      <p className="font-medium text-gray-700 dark:text-gray-500">{t("setting.ai-section.title")}</p>
      <div className="w-full flex flex-col justify-start items-start gap-4">
        <div className="w-full flex flex-col justify-start items-start gap-1">
          <span className="text-sm">{t("setting.ai-section.model-name")}</span>
          <Input
            className="w-full"
            placeholder="e.g., gpt-4"
            value={setting.model}
            onChange={(e) => handleSettingChange({ model: e.target.value })}
          />
        </div>
        <div className="w-full flex flex-col justify-start items-start gap-1">
          <span className="text-sm">{t("setting.ai-section.api-key")}</span>
          <Input
            className="w-full"
            type="password"
            placeholder="e.g., sk-..."
            value={setting.apiKey}
            onChange={(e) => handleSettingChange({ apiKey: e.target.value })}
          />
        </div>
        <div className="w-full flex flex-col justify-start items-start gap-1">
          <span className="text-sm">{t("setting.ai-section.base-url")}</span>
          <Input
            className="w-full"
            placeholder="e.g., https://api.openai.com"
            value={setting.baseUrl}
            onChange={(e) => handleSettingChange({ baseUrl: e.target.value })}
          />
        </div>
      </div>
      <div className="mt-2 w-full flex justify-end">
        <Button color="primary" disabled={isEqual(setting, originalSetting)} onClick={handleSave}>
          {t("common.save")}
        </Button>
      </div>
    </div>
  );
});

export default AISection;
