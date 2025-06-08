import { BotIcon, PanelRightClose } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AISidebar, AISidebarDrawer } from "@/components/AISidebar";
import { HomeSidebar, HomeSidebarDrawer } from "@/components/HomeSidebar";
import MobileHeader from "@/components/MobileHeader";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { cn } from "@/utils";

const HomeLayout = observer(() => {
  const { md, lg } = useResponsiveWidth();
  const [showAISidebar, setShowAISidebar] = useState(false);

  return (
    <section className="@container w-full min-h-full flex flex-col justify-start items-center">
      {!md && (
        <MobileHeader>
          <div className="flex items-center gap-2">
            <HomeSidebarDrawer />
            <AISidebarDrawer />
          </div>
        </MobileHeader>
      )}
      {md && (
        <div
          className={cn(
            "fixed top-0 left-16 shrink-0 h-svh transition-all",
            "border-r border-gray-200 dark:border-zinc-800",
            lg ? "w-72" : "w-56",
          )}
        >
          <HomeSidebar className={cn("px-3 py-6")} />
        </div>
      )}
      <div
        className={cn(
          "w-full min-h-full transition-all",
          lg ? "pl-72" : md ? "pl-56" : "",
          showAISidebar && md ? (lg ? "pr-96" : "pr-80") : "",
        )}
      >
        <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-8")}>
          {/* AI Toggle Button - Only show on desktop */}
          {md && (
            <div className="fixed top-6 right-6 z-50">
              <button
                onClick={() => setShowAISidebar(!showAISidebar)}
                className={`
                  p-2.5 rounded-full shadow-md transition-all duration-200 
                  ${
                    showAISidebar
                      ? "bg-teal-500 text-white hover:bg-teal-600"
                      : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 border border-gray-200 dark:border-zinc-700 hover:border-teal-300 dark:hover:border-teal-600"
                  }
                `}
                title={showAISidebar ? "隐藏AI助手" : "显示AI助手"}
              >
                {showAISidebar ? <PanelRightClose className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
              </button>
            </div>
          )}
          <Outlet />
        </div>
      </div>

      {/* AI Sidebar - Desktop */}
      {md && showAISidebar && (
        <div
          className={cn(
            "fixed top-0 right-0 shrink-0 h-svh transition-all bg-white dark:bg-zinc-800",
            "border-l border-gray-200 dark:border-zinc-800",
            lg ? "w-96" : "w-80",
          )}
        >
          <AISidebar className="p-4" />
        </div>
      )}
    </section>
  );
});

export default HomeLayout;
