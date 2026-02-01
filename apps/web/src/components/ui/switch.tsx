"use client";

import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border transition-colors",
      "focus:outline-none",
      "disabled:cursor-not-allowed disabled:opacity-60",
      "data-[state=checked]:bg-text-primary data-[state=checked]:border-text-primary",
      "data-[state=unchecked]:bg-surface",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-4 w-4 rounded-full shadow-sm transition-transform",
        "data-[state=checked]:translate-x-4 data-[state=checked]:bg-background",
        "data-[state=unchecked]:translate-x-0 data-[state=unchecked]:bg-text-secondary",
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
