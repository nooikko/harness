import { z } from 'zod/v4';

export const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string(),
  startDate: z.date('Start date is required'),
  endDate: z.date('End date is required'),
  color: z.enum(['blue', 'green', 'red', 'yellow', 'purple', 'orange']),
  location: z.string(),
  createOnOutlook: z.boolean(),
});

export type TEventFormData = z.infer<typeof eventSchema>;
