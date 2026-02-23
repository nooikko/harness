// Shared UI utilities
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};

export type { AlertProps } from './components/alert';
export { Alert, AlertDescription, AlertTitle, alertVariants } from './components/alert';
export type { BadgeProps } from './components/badge';
export { Badge, badgeVariants } from './components/badge';
// Shared UI components
export type { ButtonProps } from './components/button';
export { Button, buttonVariants } from './components/button';

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/card';
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './components/dialog';
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './components/dropdown-menu';
export { Input } from './components/input';
export { Label } from './components/label';
export { Progress } from './components/progress';
export { ScrollArea, ScrollBar } from './components/scroll-area';
export { Separator } from './components/separator';
export { Skeleton } from './components/skeleton';
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './components/table';

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './components/tooltip';
