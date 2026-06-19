'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const cardVariants = cva(
  'rounded-xl border bg-obsidian-900/50 backdrop-blur-sm',
  {
    variants: {
      variant: {
        default: 'border-obsidian-800',
        'channel-website': 'border-teal-500/30 shadow-[0_0_15px_-3px] shadow-teal-500/10',
        'channel-whatsapp': 'border-whatsapp/30 shadow-[0_0_15px_-3px] shadow-whatsapp/10',
        'channel-prospecting': 'border-amber/30 shadow-[0_0_15px_-3px] shadow-amber/10',
        interactive: 'border-obsidian-800 hover:border-obsidian-600 cursor-pointer',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface CardProps
  extends VariantProps<typeof cardVariants> {
  animate?: boolean;
  children?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, animate = false, children, ...props }, ref) => {
    const classes = cn(
      cardVariants({ variant }),
      variant === 'interactive' && 'transition-all duration-200 hover:scale-[1.02] hover:shadow-lg',
      className
    );

    if (animate) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={classes}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={classes} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6 pb-0', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-lg font-semibold text-obsidian-100', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-obsidian-400', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-4', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
export type { CardProps };
