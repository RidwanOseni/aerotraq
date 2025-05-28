"use client";

import { UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, DrillIcon as Drone, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import { type FlightFormData } from "@/lib/schemas";

interface FlightDetailsDialogProps {
  form: UseFormReturn<FlightFormData>;
}

export default function FlightDetailsDialog({ form }: FlightDetailsDialogProps) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Drone Specifications</CardTitle>
          <CardDescription>Enter the details of your drone</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="droneName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drone Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Phantom 4 Pro" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="droneModel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drone Model</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Mavic 3" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="droneType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Drone Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select drone type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Quadcopter">Quadcopter</SelectItem>
                    <SelectItem value="Hexacopter">Hexacopter</SelectItem>
                    <SelectItem value="Octocopter">Octocopter</SelectItem>
                    <SelectItem value="Fixed Wing">Fixed Wing</SelectItem>
                    <SelectItem value="Hybrid VTOL">Hybrid VTOL</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Serial Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 1581T3D5K028Y"
                    {...field}
                    // pattern="[a-zA-Z0-9]+" // Handled by Zod schema regex [3]
                    // title="Serial number must be alphanumeric" // Handled by Zod schema message [3]
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="weight"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Weight (g)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 895"
                    type="number"
                    min="50"
                    max="25000"
                    {...field}
                    // Ensure the input value is a number or empty string, and onChange handles parsing safely
                    value={field.value === 0 || field.value === undefined || field.value === null || isNaN(field.value as number) ? '' : field.value}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      // If the input is cleared (resulting in NaN), set the form value to 0
                      field.onChange(isNaN(value) ? 0 : value);
                    }}
                  />
                </FormControl>
                <FormDescription>Maximum legal weight is 25kg (25000g) without special authorization</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Flight Plan</CardTitle>
          <CardDescription>Enter the details of your planned flight</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="flightPurpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flight Purpose</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select flight purpose" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Photography">Photography</SelectItem>
                    <SelectItem value="Survey/Mapping">Survey/Mapping</SelectItem>
                    <SelectItem value="Delivery">Delivery</SelectItem>
                    <SelectItem value="Inspection">Inspection</SelectItem>
                    <SelectItem value="Recreational">Recreational</SelectItem>
                    <SelectItem value="Emergency Response">Emergency Response</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="flightDescription"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Flight Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your flight plan and objectives"
                    className="min-h-[100px]"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Must be at least 10 characters long</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="flightDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Flight Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? format(new Date(field.value + 'T00:00:00'), "PPP") : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value ? new Date(field.value + 'T00:00:00') : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const year = date.getFullYear();
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const day = date.getDate().toString().padStart(2, '0');
                            const formattedDate = `${year}-${month}-${day}`;
                            field.onChange(formattedDate);
                          } else {
                            field.onChange("");
                          }
                        }}
                        disabled={(date) => date < new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        min="06:00"
                        max="19:30"
                      />
                    </FormControl>
                    <FormDescription>Between 6:00 AM and 7:30 PM</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        min="06:00"
                        max="19:30"
                      />
                    </FormControl>
                    <FormDescription>Between 6:00 AM and 7:30 PM</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="dayNightOperation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Operation Time</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select operation time" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="day">Day Operation</SelectItem>
                    <SelectItem value="night">Night Operation</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>Night operations require additional authorization</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Flight Area
            </h4>

            <FormField
              control={form.control}
              name="flightAreaCenter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Center Point</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Latitude, Longitude (e.g., 51.5074, -0.1278)"
                      {...field}
                      onChange={(e) => {
                        const [lat, lng] = e.target.value.split(',').map(s => parseFloat(s.trim()));
                        if (!isNaN(lat) && !isNaN(lng)) {
                          field.onChange({ latitude: lat, longitude: lng });
                        } else {
                          field.onChange(e.target.value);
                        }
                      }}
                      // Display value as string for the input field, handle non-object states
                      value={typeof field.value === 'object' && field.value !== null && 'latitude' in field.value
                        ? `${field.value.latitude}, ${field.value.longitude}`
                        : (field.value === undefined || field.value === null ? '' : field.value as any) // Also handle null/undefined by showing empty string
                      }
                    />
                  </FormControl>
                  <FormDescription>Enter the center coordinates of your flight area</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="flightAreaRadius"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Radius (meters)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="500"
                        type="number"
                        min="1"
                        {...field}
                        // Ensure the input value is a number or empty string, and onChange handles parsing safely
                        value={field.value === 0 || field.value === undefined || field.value === null || isNaN(field.value as number) ? '' : field.value}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                          // If the input is cleared (resulting in NaN), set the form value to 0
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>Maximum distance from center point</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="flightAreaMaxHeight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maximum Height (meters)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="0"
                        type="number"
                        max="120"
                        {...field}
                        // Ensure the input value is a number or empty string, and onChange handles parsing safely
                         value={field.value === 0 || field.value === undefined || field.value === null || isNaN(field.value as number) ? '' : field.value}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value);
                           // If the input is cleared (resulting in NaN), set the form value to 0
                          field.onChange(isNaN(value) ? 0 : value);
                        }}
                      />
                    </FormControl>
                    <FormDescription>Maximum legal altitude is 120m without authorization</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}