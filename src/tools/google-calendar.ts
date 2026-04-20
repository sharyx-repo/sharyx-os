import { google } from 'googleapis';
import { SimpleTool } from './types';

/**
 * Google Calendar Integration Tool
 * Required Environment Variables:
 * - GOOGLE_CLIENT_EMAIL
 * - GOOGLE_PRIVATE_KEY
 * - GOOGLE_CALENDAR_ID (or 'primary')
 */
export const googleCalendarTools: SimpleTool[] = [
  {
    name: 'check_availability',
    description: 'Check if a specific time slot is available on the calendar.',
    parameters: {
      timeMin: { type: 'string', description: 'Start time in ISO format (e.g. 2024-05-20T10:00:00Z)', required: true },
      timeMax: { type: 'string', description: 'End time in ISO format', required: true }
    },
    handler: async ({ timeMin, timeMax }) => {
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        undefined,
        process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/calendar.readonly']
      );

      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.list({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];
      return {
        available: events.length === 0,
        conflicts: events.map(e => ({ summary: e.summary, start: e.start, end: e.end }))
      };
    }
  },
  {
    name: 'book_appointment',
    description: 'Book a new appointment on the calendar.',
    parameters: {
      summary: { type: 'string', description: 'Title of the appointment', required: true },
      start: { type: 'string', description: 'Start time in ISO format', required: true },
      end: { type: 'string', description: 'End time in ISO format', required: true },
      description: { type: 'string', description: 'Additional details' }
    },
    handler: async ({ summary, start, end, description }) => {
      const auth = new google.auth.JWT(
        process.env.GOOGLE_CLIENT_EMAIL,
        undefined,
        process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        ['https://www.googleapis.com/auth/calendar']
      );

      const calendar = google.calendar({ version: 'v3', auth });
      const response = await calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        requestBody: {
          summary,
          description,
          start: { dateTime: start },
          end: { dateTime: end },
        },
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink
      };
    }
  }
];
