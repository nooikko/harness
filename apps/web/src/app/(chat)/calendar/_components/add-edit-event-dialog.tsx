import {
  Button,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@harness/ui';
import { zodResolver } from '@hookform/resolvers/zod';
import { addMinutes, format, set } from 'date-fns';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { useDisclosure } from '@/components/hooks';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { createOutlookEvent } from '../_actions/create-outlook-event';
import { updateOutlookEvent } from '../_actions/update-outlook-event';
import { COLORS } from '../_helpers/event-colors';
import { eventSchema, type TEventFormData } from '../_helpers/event-schema';
import type { IEvent } from '../_helpers/interfaces';
import { useCalendar } from './calendar-context';

interface IProps {
  children: ReactNode;
  startDate?: Date;
  startTime?: { hour: number; minute: number };
  event?: IEvent;
}

type AddEditEventDialogComponent = (props: IProps) => React.ReactNode;

export const AddEditEventDialog: AddEditEventDialogComponent = ({ children, startDate, startTime, event }) => {
  const { isOpen, onClose, onToggle } = useDisclosure();
  const { addEvent, updateEvent } = useCalendar();
  const isEditing = !!event;
  const isOutlookEvent = isEditing && event.source === 'OUTLOOK' && !!event.externalId;
  const [isSaving, setIsSaving] = useState(false);

  const initialDates = useMemo(() => {
    if (!isEditing && !event) {
      if (!startDate) {
        const now = new Date();
        return { startDate: now, endDate: addMinutes(now, 30) };
      }
      const start = startTime
        ? set(new Date(startDate), {
            hours: startTime.hour,
            minutes: startTime.minute,
            seconds: 0,
          })
        : new Date(startDate);
      const end = addMinutes(start, 30);
      return { startDate: start, endDate: end };
    }

    return {
      startDate: new Date(event.startDate),
      endDate: new Date(event.endDate),
    };
  }, [startDate, startTime, event, isEditing]);

  const form = useForm<TEventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: event?.title ?? '',
      description: event?.description ?? '',
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      color: event?.color ?? 'blue',
      location: event?.location ?? '',
      createOnOutlook: false,
    },
  });

  useEffect(() => {
    form.reset({
      title: event?.title ?? '',
      description: event?.description ?? '',
      startDate: initialDates.startDate,
      endDate: initialDates.endDate,
      color: event?.color ?? 'blue',
      location: event?.location ?? '',
      createOnOutlook: false,
    });
  }, [event, initialDates, form]);

  const onSubmit = async (values: TEventFormData) => {
    try {
      setIsSaving(true);

      if (isOutlookEvent) {
        const result = await updateOutlookEvent({
          eventId: event.id,
          externalId: event.externalId!,
          title: values.title,
          startAt: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
          endAt: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
          location: values.location,
          description: values.description,
        });

        if ('error' in result) {
          toast.error(result.error);
          return;
        }

        updateEvent({
          ...event,
          title: values.title,
          startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
          endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
          location: values.location || null,
          description: values.description || '',
          color: values.color,
        });

        toast.success('Outlook event updated');
        onClose();
        form.reset();
        return;
      }

      if (!isEditing && values.createOnOutlook) {
        const result = await createOutlookEvent({
          title: values.title,
          startAt: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
          endAt: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
          location: values.location || undefined,
          description: values.description || undefined,
        });

        if ('error' in result) {
          toast.error(result.error);
          return;
        }

        toast.success('Event created on Outlook');
        onClose();
        form.reset();
        return;
      }

      const formattedEvent: IEvent = {
        ...values,
        startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
        endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
        id: isEditing ? event.id : String(Math.floor(Math.random() * 1000000)),
        user: isEditing
          ? event.user
          : {
              id: Math.floor(Math.random() * 1000000).toString(),
              name: 'Jeraidi Yassir',
              picturePath: null,
            },
        color: values.color,
        source: isEditing ? event.source : 'LOCAL',
        isTeamsMeeting: isEditing ? event.isTeamsMeeting : false,
        joinUrl: isEditing ? event.joinUrl : null,
        location: values.location || (isEditing ? event.location : null),
        organizer: isEditing ? event.organizer : null,
        attendees: isEditing ? event.attendees : null,
        isCancelled: isEditing ? event.isCancelled : false,
        isAllDay: isEditing ? event.isAllDay : false,
        cronJobId: isEditing ? event.cronJobId : null,
        webLink: isEditing ? event.webLink : null,
        importance: isEditing ? event.importance : null,
        sensitivity: isEditing ? event.sensitivity : null,
        reminder: isEditing ? event.reminder : null,
        recurrence: isEditing ? event.recurrence : null,
        externalId: isEditing ? event.externalId : null,
      };

      if (isEditing) {
        updateEvent(formattedEvent);
        toast.success('Event updated successfully');
      } else {
        addEvent(formattedEvent);
        toast.success('Event created successfully');
      }

      onClose();
      form.reset();
    } catch {
      toast.error(`Failed to ${isEditing ? 'edit' : 'add'} event`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={onToggle} modal={false}>
      <ModalTrigger asChild>{children}</ModalTrigger>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>{isEditing ? 'Edit Event' : 'Add New Event'}</ModalTitle>
          <ModalDescription>
            {isEditing
              ? isOutlookEvent
                ? 'Edit this Outlook event. Changes sync to Microsoft.'
                : 'Modify your existing event.'
              : 'Create a new event for your calendar.'}
          </ModalDescription>
        </ModalHeader>

        <Form {...form}>
          <form id='event-form' onSubmit={form.handleSubmit(onSubmit)} className='grid gap-4 py-4'>
            <FormField
              control={form.control}
              name='title'
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel htmlFor='title' className='required'>
                    Title
                  </FormLabel>
                  <FormControl>
                    <Input id='title' placeholder='Enter a title' {...field} className={fieldState.invalid ? 'border-red-500' : ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='location'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder='Enter a location' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name='startDate' render={({ field }) => <DateTimePicker form={form} field={field} />} />
            <FormField control={form.control} name='endDate' render={({ field }) => <DateTimePicker form={form} field={field} />} />
            <FormField
              control={form.control}
              name='color'
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel className='required'>Variant</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={`w-full ${fieldState.invalid ? 'border-red-500' : ''}`}>
                        <SelectValue placeholder='Select a variant' />
                      </SelectTrigger>
                      <SelectContent>
                        {COLORS.map((color) => (
                          <SelectItem value={color} key={color}>
                            <div className='flex items-center gap-2'>
                              <div className={`size-3.5 rounded-full bg-${color}-600 dark:bg-${color}-700`} />
                              {color}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='description'
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder='Enter a description' className={fieldState.invalid ? 'border-red-500' : ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {!isEditing && (
              <FormField
                control={form.control}
                name='createOnOutlook'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-2'>
                    <FormLabel>Add to Outlook</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
          </form>
        </Form>
        <ModalFooter className='flex justify-end gap-2'>
          <ModalClose asChild>
            <Button type='button' variant='outline'>
              Cancel
            </Button>
          </ModalClose>
          <Button form='event-form' type='submit' disabled={isSaving}>
            {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Event'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
