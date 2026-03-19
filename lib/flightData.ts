// Mock flight database for the flight delay agent demo

export type FlightStatus = "on-time" | "delayed" | "cancelled" | "boarding" | "departed";

export type Flight = {
  flightNumber: string;
  airline: string;
  origin: string;
  originCode: string;
  destination: string;
  destinationCode: string;
  scheduledDeparture: string; // ISO time e.g. "14:30"
  scheduledArrival: string;
  date: string; // YYYY-MM-DD
  status: FlightStatus;
  delayMinutes: number;
  gate: string;
  aircraft: string;
  availableSeats: number;
  price: number; // USD fare for one passenger
};

export type Booking = {
  bookingRef: string;
  passengerName: string;
  passengerPhone: string; // E.164 format for Twilio
  flights: string[]; // flight numbers in itinerary
  passengers: number;
  class: "economy" | "business";
};

// Today's flights (using relative times for the demo)
const TODAY = "2026-03-19";

export const FLIGHTS: Record<string, Flight> = {
  // Delayed flight that triggers the agent
  "UA234": {
    flightNumber: "UA234",
    airline: "United Airlines",
    origin: "New York",
    originCode: "JFK",
    destination: "Chicago",
    destinationCode: "ORD",
    scheduledDeparture: "09:00",
    scheduledArrival: "10:45",
    date: TODAY,
    status: "delayed",
    delayMinutes: 95,
    gate: "B22",
    aircraft: "Boeing 737",
    availableSeats: 0,
    price: 189,
  },

  // Tight connection that will be missed due to delay
  "UA890": {
    flightNumber: "UA890",
    airline: "United Airlines",
    origin: "Chicago",
    originCode: "ORD",
    destination: "Los Angeles",
    destinationCode: "LAX",
    scheduledDeparture: "11:30",
    scheduledArrival: "13:45",
    date: TODAY,
    status: "on-time",
    delayMinutes: 0,
    gate: "C14",
    aircraft: "Boeing 777",
    availableSeats: 0,
    price: 298,
  },

  // Alternative flights for rebooking
  "AA456": {
    flightNumber: "AA456",
    airline: "American Airlines",
    origin: "New York",
    originCode: "JFK",
    destination: "Los Angeles",
    destinationCode: "LAX",
    scheduledDeparture: "10:30",
    scheduledArrival: "14:00",
    date: TODAY,
    status: "on-time",
    delayMinutes: 0,
    gate: "D5",
    aircraft: "Airbus A321",
    availableSeats: 12,
    price: 342,
  },

  "DL789": {
    flightNumber: "DL789",
    airline: "Delta Air Lines",
    origin: "New York",
    originCode: "JFK",
    destination: "Los Angeles",
    destinationCode: "LAX",
    scheduledDeparture: "11:15",
    scheduledArrival: "14:45",
    date: TODAY,
    status: "on-time",
    delayMinutes: 0,
    gate: "A11",
    aircraft: "Boeing 767",
    availableSeats: 4,
    price: 315,
  },

  "UA567": {
    flightNumber: "UA567",
    airline: "United Airlines",
    origin: "New York",
    originCode: "JFK",
    destination: "Los Angeles",
    destinationCode: "LAX",
    scheduledDeparture: "13:00",
    scheduledArrival: "16:30",
    date: TODAY,
    status: "on-time",
    delayMinutes: 0,
    gate: "B7",
    aircraft: "Boeing 757",
    availableSeats: 28,
    price: 289,
  },

  "B6123": {
    flightNumber: "B6123",
    airline: "JetBlue",
    origin: "New York",
    originCode: "JFK",
    destination: "Los Angeles",
    destinationCode: "LAX",
    scheduledDeparture: "15:45",
    scheduledArrival: "19:15",
    date: TODAY,
    status: "on-time",
    delayMinutes: 0,
    gate: "T5-23",
    aircraft: "Airbus A320",
    availableSeats: 52,
    price: 249,
  },
};

// Sample bookings for the demo
export const BOOKINGS: Record<string, Booking> = {
  "BK7823": {
    bookingRef: "BK7823",
    passengerName: "Sarah Chen",
    passengerPhone: "+14155551234",
    flights: ["UA234", "UA890"],
    passengers: 2,
    class: "economy",
  },
  "BK4491": {
    bookingRef: "BK4491",
    passengerName: "Marcus Johnson",
    passengerPhone: "+13105559876",
    flights: ["UA234"],
    passengers: 1,
    class: "business",
  },
};

// Helper: get all alternative flights between two airports on a date
export function getAlternativeFlights(
  originCode: string,
  destinationCode: string,
  date: string,
): Flight[] {
  return Object.values(FLIGHTS).filter(
    f =>
      f.originCode === originCode &&
      f.destinationCode === destinationCode &&
      f.date === date &&
      f.status !== "cancelled" &&
      f.availableSeats > 0
  );
}
