import { Drawer } from "@mui/joy";
import { Button } from "@usememos/mui";
import { BotIcon } from "lucide-react";
import { useState } from "react";
import AISidebarChat from "./AISidebarChat";

const AISidebarDrawer = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="plain" onClick={() => setOpen(true)} className="relative">
        <BotIcon className="w-5 h-auto" />
      </Button>
      <Drawer open={open} onClose={() => setOpen(false)} anchor="right" size="lg">
        <div className="w-full h-full">
          <AISidebarChat />
        </div>
      </Drawer>
    </>
  );
};

export default AISidebarDrawer;
