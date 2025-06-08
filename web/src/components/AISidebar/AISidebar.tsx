import { observer } from "mobx-react-lite";
import { cn } from "@/utils";
import AISidebarChat from "./AISidebarChat";

interface Props {
  className?: string;
}

const AISidebar = observer(({ className }: Props) => {
  return (
    <div className={cn("w-full h-full bg-zinc-50 dark:bg-zinc-900", className)}>
      <AISidebarChat />
    </div>
  );
});

export default AISidebar;
