'use client';

import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as React from 'react';
import { cn } from '../cn';

const Avatar = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root data-slot='avatar' className={cn('relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full', className)} {...props} />
);

const AvatarImage = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Image>) => (
  <AvatarPrimitive.Image data-slot='avatar-image' className={cn('aspect-square h-full w-full', className)} {...props} />
);

const AvatarFallback = ({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    data-slot='avatar-fallback'
    className={cn('flex h-full w-full items-center justify-center rounded-full bg-muted', className)}
    {...props}
  />
);

type AvatarProps = React.ComponentProps<typeof Avatar>;

interface AvatarGroupProps extends React.ComponentProps<'div'> {
  children: React.ReactElement<AvatarProps>[];
  max?: number;
}

const AvatarGroup = ({ children, max, className, ...props }: AvatarGroupProps) => {
  const totalAvatars = React.Children.count(children);
  const displayedAvatars = React.Children.toArray(children).slice(0, max).reverse();
  const remainingAvatars = max ? Math.max(totalAvatars - max, 1) : 0;

  return (
    <div data-slot='avatar-group' className={cn('flex flex-row-reverse items-center', className)} {...props}>
      {remainingAvatars > 0 && (
        <Avatar className='-ml-2 relative ring-2 ring-background hover:z-10'>
          <AvatarFallback className='bg-muted-foreground text-white'>+{remainingAvatars}</AvatarFallback>
        </Avatar>
      )}
      {displayedAvatars.map((avatar, index) => {
        if (!React.isValidElement(avatar)) {
          return null;
        }
        return (
          <div key={index} className='relative -ml-2 hover:z-10'>
            {React.cloneElement(avatar as React.ReactElement<AvatarProps>, {
              className: 'ring-2 ring-background',
            })}
          </div>
        );
      })}
    </div>
  );
};

export { Avatar, AvatarFallback, AvatarGroup, AvatarImage };
