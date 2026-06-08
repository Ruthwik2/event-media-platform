import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        neutral: 'bg-muted text-muted-foreground',
        success:
          'bg-[hsl(144_55%_94%)] text-[hsl(144_59%_27%)]',
        warning:
          'bg-[hsl(36_92%_92%)] text-[hsl(36_100%_27%)]',
        destructive:
          'bg-[hsl(4_82%_95%)] text-[hsl(4_72%_40%)]',
        outline: 'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
