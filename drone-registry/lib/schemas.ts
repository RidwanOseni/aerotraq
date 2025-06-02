import { z } from "zod";

export const flightFormSchema = z.object({
  // Basic drone information
  droneName: z.string().min(2, { message: "Drone name must be at least 2 characters." }),
  droneModel: z.string().min(2, { message: "Drone model must be at least 2 characters." }),
  droneType: z.enum(
    ["Quadcopter", "Hexacopter", "Octocopter", "Fixed Wing", "Hybrid VTOL"],
    { required_error: "Please select a valid drone type." }
  ),
  // Technical specifications
  serialNumber: z.string()
    .min(5, { message: "Serial number must be at least 5 characters." })
    .max(15, { message: "Serial number cannot exceed 15 characters." })
    .regex(/^[a-zA-Z0-9]+$/, { message: "Serial number must be alphanumeric." }),
  weight: z.number()
    .min(50, { message: "Weight must be at least 50g." })
    .max(25000, { message: "Weight cannot exceed 25000g." }),
  // Flight details
  flightPurpose: z.enum(
    ["Photography", "Survey/Mapping", "Delivery", "Inspection", "Recreational", "Emergency Response"],
    { required_error: "Please select a valid flight purpose." }
  ),
  flightDescription: z.string().min(10, { message: "Flight description must be at least 10 characters." }),
  // Time and date information
  flightDate: z.string().refine(
    (date) => {
      // Parse date string to ensure it's a valid date object
      const parsedDate = new Date(date + 'T00:00:00'); // Treat date as UTC start of day for comparison
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0); // Compare against UTC start of today
      return !isNaN(parsedDate.getTime()) && parsedDate >= today;
    },
    { message: "Flight date must be a valid date and not in the past." }
  ),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "Start time must be in HH:MM format." }),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, { message: "End time must be in HH:MM format." }),
  dayNightOperation: z.string().min(1, { message: "Operation time is required." }),
  // Flight area specifications
  flightAreaCenter: z.object({
    latitude: z.number({ required_error: "Latitude is required." })
      .describe("Latitude of the flight area center."),
    longitude: z.number({ required_error: "Longitude is required." })
      .describe("Longitude of the flight area center."),
  }, { required_error: "Center point coordinates are required." })
    .describe("Geographical center point of the flight area."),
  flightAreaRadius: z.number().min(1, { message: "Radius is required." }),
  flightAreaMaxHeight: z.number().max(120, { message: "Maximum height cannot exceed 120m without authorization." }),
}).refine( // Refine 1: End time must be after start time
  (data) => {
    const [startH, startM] = data.startTime.split(':').map(Number);
    const [endH, endM] = data.endTime.split(':').map(Number);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    return end > start;
  },
  {
    message: "End time must be after start time.",
    path: ["endTime"],
  }
).refine( // Refine 2: Start and end times must be within 09:00 to 17:30 range
  (data) => {
    // Use string comparison for HH:MM format, which works for 24-hour times
    const operationalStart = "09:00";
    const operationalEnd = "17:30"; // 5:30 PM

    const isStartTimeValid = data.startTime >= operationalStart && data.startTime <= operationalEnd;
    const isEndTimeValid = data.endTime >= operationalStart && data.endTime <= operationalEnd;

    // The flight must be entirely within the operational hours.
    // Given the previous refine ensures startTime <= endTime, we just need to check the boundaries.
    return isStartTimeValid && isEndTimeValid;
  },
  {
    // Providing a clear message that matches the expected range in the frontend description [1]
    message: 'Flight times must be between 09:00 and 17:30 (5:30 PM).',
    path: ['startTime'], // Associate the error with the start time field
  }
);

export type FlightFormData = z.infer<typeof flightFormSchema>;