import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { TargetAndTransition } from 'motion/react';
import { motion } from 'motion/react';
import * as React from 'react';
import { cn } from 'ui';

export const buttonVariants = cva(
  // No border classes in base — variants control their own border
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-[inherit] cursor-pointer select-none outline-none transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground border-0 hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground border-0 hover:bg-destructive/90',
        ghost: 'border border-border text-muted-foreground bg-transparent hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground border-0 hover:bg-secondary/80',
        outline: 'border border-primary bg-transparent text-primary hover:bg-accent',
        link: 'text-primary underline-offset-4 hover:underline bg-transparent border-0',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-xs',
        lg: 'h-9 px-4',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>;
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>;

// Subtle lift on hover — moves button + text together as a unit
const HOVER_SCALE: Partial<Record<ButtonVariant, TargetAndTransition>> = {
  default: { y: -1 },
  destructive: { y: -1 },
};

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 28 };

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return <Slot ref={ref} className={classes} {...props} />;
    }

    return (
      <motion.button
        ref={ref}
        className={classes}
        whileHover={variant ? HOVER_SCALE[variant] : undefined}
        whileTap={{ scale: 0.97 }}
        transition={springTransition}
        {...(props as React.ComponentProps<typeof motion.button>)}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
