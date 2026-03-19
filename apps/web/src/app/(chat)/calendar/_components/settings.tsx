import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Switch,
} from '@harness/ui';
import { SettingsIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useCalendar } from './calendar-context';

type SettingsComponent = () => React.ReactNode;

export const Settings: SettingsComponent = () => {
  const { badgeVariant, setBadgeVariant, use24HourFormat, toggleTimeFormat, agendaModeGroupBy, setAgendaModeGroupBy } = useCalendar();
  const { theme, setTheme } = useTheme();

  const isDarkMode = theme === 'dark';
  const isDotVariant = badgeVariant === 'dot';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='outline' size='icon'>
          <SettingsIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className='w-56'>
        <DropdownMenuLabel>Calendar settings</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Use dark mode
            <DropdownMenuShortcut>
              <Switch checked={isDarkMode} onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>

          <DropdownMenuItem>
            Use dot badge
            <DropdownMenuShortcut>
              <Switch checked={isDotVariant} onCheckedChange={(checked) => setBadgeVariant(checked ? 'dot' : 'colored')} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            Use 24 hour format
            <DropdownMenuShortcut>
              <Switch checked={use24HourFormat} onCheckedChange={toggleTimeFormat} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Agenda view group by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={agendaModeGroupBy} onValueChange={(value) => setAgendaModeGroupBy(value as 'date' | 'color')}>
            <DropdownMenuRadioItem value='date'>Date</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value='color'>Color</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
