import { Button } from "@mui/joy";
import { BotIcon } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import AIChatPanel from "./AIChatPanel";

const AIChatButton = observer(() => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          variant="solid"
          color="primary"
          onClick={() => setIsOpen(true)}
          className="rounded-full w-14 h-14 p-0 shadow-lg hover:shadow-xl transition-all duration-200"
        >
          <BotIcon className="w-6 h-6" />
        </Button>
      </div>

      {/* Chat Panel Modal/Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black bg-opacity-25" onClick={() => setIsOpen(false)} />

          {/* Chat Panel */}
          <div className="relative w-full max-w-md h-full max-h-[80vh] sm:h-auto sm:max-h-[600px] sm:m-4 sm:rounded-lg overflow-hidden shadow-2xl">
            <AIChatPanel />
          </div>
        </div>
      )}
    </>
  );
});

export default AIChatButton;
