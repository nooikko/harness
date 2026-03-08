// Shared UI utilities
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};

export type { AlertProps } from './components/alert';
export { Alert, AlertDescription, AlertTitle, alertVariants } from './components/alert';
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/alert-dialog';
export type { BadgeProps } from './components/badge';
export { Badge, badgeVariants } from './components/badge';
// Shared UI components
export type { ButtonProps } from './components/button';
export { Button, buttonVariants } from './components/button';

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/card';
export { Collapsible, CollapsibleContent, CollapsibleTrigger } from './components/collapsible';
export type { CommandFooterHint, CommandFooterProps } from './components/command';
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './components/command';
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
export { Kbd } from './components/kbd';
export { Label } from './components/label';
export { Popover, PopoverAnchor, PopoverClose, PopoverContent, PopoverTrigger } from './components/popover';
export { Progress } from './components/progress';
export { ScrollArea, ScrollBar } from './components/scroll-area';
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/select';
export { Separator } from './components/separator';
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  sidebarMenuButtonVariants,
  useSidebar,
} from './components/sidebar';
export { Skeleton } from './components/skeleton';
export { Switch } from './components/switch';
export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow } from './components/table';
export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/tabs';
export { Textarea } from './components/textarea';
export { Tooltip } from './components/tooltip';
