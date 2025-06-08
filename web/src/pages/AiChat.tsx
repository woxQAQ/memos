import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import AIChatPanel from "@/components/AIChatPanel/AIChatPanel";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";

const AiChat = observer(() => {
  const currentUser = useCurrentUser();
  const navigateTo = useNavigateTo();

  useEffect(() => {
    if (!currentUser) {
      navigateTo("/auth");
    }
  }, [currentUser, navigateTo]);

  if (!currentUser) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-white dark:bg-zinc-900 px-6 py-4 max-w-7xl mx-auto">
      <AIChatPanel />
    </div>
  );
});

export default AiChat;
 