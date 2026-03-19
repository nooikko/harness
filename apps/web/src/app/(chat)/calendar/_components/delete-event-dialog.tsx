import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Button,
} from '@harness/ui';
import { TrashIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useCalendar } from './calendar-context';

interface DeleteEventDialogProps {
  eventId: string;
}

type DeleteEventDialogComponent = (props: DeleteEventDialogProps) => React.ReactNode;

const DeleteEventDialog: DeleteEventDialogComponent = ({ eventId }) => {
  const { removeEvent } = useCalendar();

  const deleteEvent = () => {
    try {
      removeEvent(eventId);
      toast.success('Event deleted successfully.');
    } catch {
      toast.error('Error deleting event.');
    }
  };

  if (!eventId) {
    return null;
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant='destructive'>
          <TrashIcon />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your event and remove event data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={deleteEvent}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteEventDialog;
