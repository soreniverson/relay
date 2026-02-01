import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-secondary font-light transition-colors disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        default:
          "bg-transparent border border-border text-text-primary hover:bg-[#141414] hover:border-border-hover",
        primary:
          "bg-foreground text-background hover:bg-foreground/90",
        destructive:
          "bg-transparent border border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50",
        outline:
          "bg-transparent border border-border text-text-secondary hover:bg-[#141414] hover:border-border-hover hover:text-text-primary",
        secondary:
          "bg-surface border border-border text-text-secondary hover:bg-[#141414] hover:border-border-hover",
        ghost:
          "text-text-secondary hover:bg-[#141414] hover:text-text-primary",
        link:
          "text-text-secondary underline-offset-4 hover:underline hover:text-text-primary",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-3 text-small",
        lg: "h-10 rounded-lg px-6",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
