import { NextRequest, NextResponse } from "next/server";
import { FLIGHTS, BOOKINGS } from "@/lib/flightData";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const flightNumber = searchParams.get("flight");
  const bookingRef = searchParams.get("booking");

  if (flightNumber) {
    const flight = FLIGHTS[flightNumber.toUpperCase()];
    if (!flight) {
      return NextResponse.json({ error: "Flight not found" }, { status: 404 });
    }
    return NextResponse.json(flight);
  }

  if (bookingRef) {
    const booking = BOOKINGS[bookingRef.toUpperCase()];
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    const flights = booking.flights.map(fn => FLIGHTS[fn]).filter(Boolean);
    return NextResponse.json({ ...booking, flightDetails: flights });
  }

  // Return all demo bookings for the UI picker
  return NextResponse.json({
    bookings: Object.keys(BOOKINGS),
    flights: Object.keys(FLIGHTS),
  });
}
