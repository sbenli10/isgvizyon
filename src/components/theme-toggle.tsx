import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-10 w-10 rounded-2xl border-border/70 bg-card/80 shadow-sm backdrop-blur transition hover:border-primary/30 hover:bg-accent"
        >
          <Sun
            className={`h-[1.1rem] w-[1.1rem] transition-all ${
              isDark ? "rotate-90 scale-0" : "rotate-0 scale-100 text-amber-500"
            }`}
          />
          <Moon
            className={`absolute h-[1.1rem] w-[1.1rem] transition-all ${
              isDark ? "rotate-0 scale-100 text-violet-400" : "-rotate-90 scale-0"
            }`}
          />
          <span className="sr-only">Tema değiştir</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Açık tema
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="mr-2 h-4 w-4" />
          Koyu tema
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
