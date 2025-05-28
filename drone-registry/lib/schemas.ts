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
      const parsedDate = new Date(date);
      return !isNaN(parsedDate.getTime()) && parsedDate >= new Date();
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
}).refine(
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
);

export type FlightFormData = z.infer<typeof flightFormSchema>;