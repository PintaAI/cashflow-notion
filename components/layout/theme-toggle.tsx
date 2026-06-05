"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      suppressHydrationWarning
    >
      {theme === "dark" ? (
        <HugeiconsIcon icon={Sun01Icon} size={18} />
      ) : (
        <HugeiconsIcon icon={Moon01Icon} size={18} />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
