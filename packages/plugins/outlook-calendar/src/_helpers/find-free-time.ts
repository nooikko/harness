import type { PluginContext, ToolResult } from '@harness/plugin-contract';
import { graphFetch } from './graph-fetch';

type FindFreeTimeInput = {
  startDateTime: string;
  endDateTime: string;
  durationMinutes?: number;
};

type FindFreeTime = (ctx: PluginContext, input: FindFreeTimeInput, timezone?: string) => Promise<ToolResult>;

const findFreeTime: FindFreeTime = async (ctx, input, timezone) => {
  const tz = timezone ?? ctx.config.timezone ?? 'America/Phoenix';
  const duration = input.durationMinutes ?? 30;
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  const data = (await graphFetch(ctx, '/me/findMeetingTimes', {
    method: 'POST',
    body: {
      timeConstraint: {
        timeslots: [
          {
            start: {
              dateTime: input.startDateTime,
              timeZone: tz,
            },
            end: {
              dateTime: input.endDateTime,
              timeZone: tz,
            },
          },
        ],
      },
      meetingDuration: `PT${hours}H${minutes}M`,
      maxCandidates: 10,
      returnSuggestionReasons: true,
    },
  })) as {
    meetingTimeSuggestions: Array<{
      meetingTimeSlot: {
        start: { dateTime: string; timeZone: string };
        end: { dateTime: string; timeZone: string };
      };
      confidence: number;
      suggestionReason: string;
    }>;
  };

  if (!data?.meetingTimeSuggestions?.length) {
    return 'No available time slots found in the specified range.';
  }

  const slots = data.meetingTimeSuggestions.map((s) => ({
    start: s.meetingTimeSlot.start.dateTime,
    end: s.meetingTimeSlot.end.dateTime,
    timeZone: s.meetingTimeSlot.start.timeZone,
    confidence: s.confidence,
    reason: s.suggestionReason,
  }));

  const text = JSON.stringify(slots, null, 2);

  const events = slots.map((slot, i) => ({
    id: i.toString(),
    subject: slot.reason ?? 'Available',
    start: slot.start,
    end: slot.end,
    isAllDay: false,
  }));

  return {
    text,
    blocks: [{ type: 'calendar-events', data: { events } }],
  };
};

export { findFreeTime };
