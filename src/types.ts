export interface TimeSlot {
  id: string;
  startTime: Date;
  endTime: Date;
  isBooked: boolean;
  studentName?: string;
  studentPhone?: string;
}

export interface Availability {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
}

export type AppointmentTag = 'trial' | 'no-show' | 'complete';

export interface Appointment {
  id: string;
  studentName: string;
  studentPhone: string;
  startTime: Date;
  endTime: Date;
  status: 'booked' | 'cancelled';
  tag?: AppointmentTag;
  googleCalendarEventId?: string;
}

export interface AdminSettings {
  meetingDurationMinutes: number;
  googleCalendarConnected: boolean;
  googleCalendarAutoSync?: boolean;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
}
