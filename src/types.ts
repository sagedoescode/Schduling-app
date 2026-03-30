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
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
}

export interface Appointment {
  id: string;
  studentName: string;
  studentPhone: string;
  startTime: Date;
  endTime: Date;
  status: 'booked' | 'cancelled';
}
