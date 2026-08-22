import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Activer le thème clair" : "Activer le thème sombre"}
        >
          <Sun className="h-[18px] w-[18px] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[18px] w-[18px] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{theme === "dark" ? "Thème clair" : "Thème sombre"}</TooltipContent>
    </Tooltip>
  );
}
