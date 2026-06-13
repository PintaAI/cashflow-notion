import { HugeiconsIcon } from "@hugeicons/react";
import { TaskDaily01Icon } from "@hugeicons/core-free-icons";

export function HabitTracker() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center">
      <HugeiconsIcon
        icon={TaskDaily01Icon}
        strokeWidth={1.5}
        className="size-16 text-muted-foreground/40"
      />
      <div>
        <p className="text-lg font-semibold">Coming Soon</p>
        <p className="text-sm text-muted-foreground">
          Fitur Habbit Tracker sedang dalam pengembangan
        </p>
      </div>
    </div>
  );
}
