import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Separator, Toggle } from '@harness/ui';
import { CheckIcon, Filter, RefreshCcw } from 'lucide-react';
import type { TEventColor } from '../_helpers/types';
import { useCalendar } from './calendar-context';

type FilterEventsComponent = () => React.ReactNode;

const FilterEvents: FilterEventsComponent = () => {
  const { selectedColors, filterEventsBySelectedColors, clearFilter } = useCalendar();

  const colors: TEventColor[] = ['blue', 'green', 'red', 'yellow', 'purple', 'orange'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Toggle variant='outline' className='cursor-pointer w-fit'>
          <Filter className='h-4 w-4' />
        </Toggle>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-37.5'>
        {colors.map((color) => (
          <DropdownMenuItem
            key={color}
            className='flex items-center gap-2 cursor-pointer'
            onClick={(e) => {
              e.preventDefault();
              filterEventsBySelectedColors(color);
            }}
          >
            <div className={`size-3.5 rounded-full bg-${color}-600 dark:bg-${color}-700`} />
            <span className='capitalize flex justify-center items-center gap-2'>
              {color}
              <span>
                {selectedColors.includes(color) && (
                  <span className='text-blue-500'>
                    <CheckIcon className='size-4' />
                  </span>
                )}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        <Separator className='my-2' />
        <DropdownMenuItem
          disabled={selectedColors.length === 0}
          className='flex gap-2 cursor-pointer'
          onClick={(e) => {
            e.preventDefault();
            clearFilter();
          }}
        >
          <RefreshCcw className='size-3.5' />
          Clear Filter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default FilterEvents;
