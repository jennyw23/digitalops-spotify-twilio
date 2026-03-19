import Anthropic from "@anthropic-ai/sdk";
import { FLIGHTS, BOOKINGS, getAlternativeFlights, type Flight } from "./flightData";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tool definitions for Claude ───────────────────────────────────────────

const tools: Anthropic.Tool[] = [
  {
    name: "check_flight_status",
    description:
      "Check the current status of a flight including delay information, gate, and departure time.",
    input_schema: {
      type: "object",
      properties: {
        flight_number: {
          type: "string",
          description: "The flight number, e.g. 'UA234'",
        },
      },
      required: ["flight_number"],
    },
  },
  {
    name: "get_booking_details",
    description:
      "Retrieve a passenger booking including all flights in the itinerary, passenger count, and contact details.",
    input_schema: {
      type: "object",
      properties: {
        booking_ref: {
          type: "string",
          description: "The booking reference number, e.g. 'BK7823'",
        },
      },
      required: ["booking_ref"],
    },
  },
  {
    name: "search_alternative_flights",
    description:
      "Search for available alternative flights between two airports on a given date. Returns flights with available seats.",
    input_schema: {
      type: "object",
      properties: {
        origin_code: {
          type: "string",
          description: "IATA code of the departure airport, e.g. 'JFK'",
        },
        destination_code: {
          type: "string",
          description: "IATA code of the arrival airport, e.g. 'LAX'",
        },
        date: {
          type: "string",
          description: "Date in YYYY-MM-DD format",
        },
        passengers_needed: {
          type: "number",
          description: "Number of seats needed",
        },
      },
      required: ["origin_code", "destination_code", "date", "passengers_needed"],
    },
  },
  {
    name: "rebook_passenger",
    description:
      "Rebook a passenger onto a new flight. This reserves the seats and marks the old booking as modified.",
    input_schema: {
      type: "object",
      properties: {
        booking_ref: {
          type: "string",
          description: "Original booking reference",
        },
        new_flight_number: {
          type: "string",
          description: "The flight number of the new flight to book",
        },
        reason: {
          type: "string",
          description: "Brief reason for the rebooking (for the passenger record)",
        },
      },
      required: ["booking_ref", "new_flight_number", "reason"],
    },
  },
  {
    name: "send_whatsapp_notification",
    description:
      "Send a WhatsApp message to a passenger's phone number to notify them of the rebooking.",
    input_schema: {
      type: "object",
      properties: {
        to_phone: {
          type: "string",
          description: "Passenger phone number in E.164 format, e.g. '+14155551234'",
        },
        message: {
          type: "string",
          description: "The notification message to send",
        },
      },
      required: ["to_phone", "message"],
    },
  },
];

// ─── Tool execution functions ───────────────────────────────────────────────

function checkFlightStatus(flightNumber: string): string {
  const flight = FLIGHTS[flightNumber.toUpperCase()];
  if (!flight) {
    return JSON.stringify({ error: `Flight ${flightNumber} not found` });
  }

  const result = {
    flightNumber: flight.flightNumber,
    airline: flight.airline,
    route: `${flight.origin} (${flight.originCode}) → ${flight.destination} (${flight.destinationCode})`,
    scheduledDeparture: flight.scheduledDeparture,
    scheduledArrival: flight.scheduledArrival,
    status: flight.status,
    delayMinutes: flight.delayMinutes,
    estimatedDeparture:
      flight.delayMinutes > 0
        ? addMinutesToTime(flight.scheduledDeparture, flight.delayMinutes)
        : flight.scheduledDeparture,
    gate: flight.gate,
    aircraft: flight.aircraft,
    availableSeats: flight.availableSeats,
  };

  return JSON.stringify(result);
}

function getBookingDetails(bookingRef: string): string {
  const booking = BOOKINGS[bookingRef.toUpperCase()];
  if (!booking) {
    return JSON.stringify({ error: `Booking ${bookingRef} not found` });
  }

  const flightDetails = booking.flights.map(fn => {
    const f = FLIGHTS[fn];
    return f
      ? {
          flightNumber: f.flightNumber,
          airline: f.airline,
          route: `${f.originCode} → ${f.destinationCode}`,
          scheduledDeparture: f.scheduledDeparture,
          status: f.status,
          delayMinutes: f.delayMinutes,
        }
      : { flightNumber: fn, error: "Details unavailable" };
  });

  return JSON.stringify({
    bookingRef: booking.bookingRef,
    passengerName: booking.passengerName,
    passengerPhone: booking.passengerPhone,
    passengers: booking.passengers,
    class: booking.class,
    flights: flightDetails,
  });
}

function searchAlternativeFlights(
  originCode: string,
  destinationCode: string,
  date: string,
  passengersNeeded: number
): string {
  const alternatives = getAlternativeFlights(originCode, destinationCode, date)
    .filter(f => f.availableSeats >= passengersNeeded)
    .sort((a, b) => a.scheduledDeparture.localeCompare(b.scheduledDeparture));

  if (alternatives.length === 0) {
    return JSON.stringify({
      message: "No alternative flights with sufficient seats found",
      searched: { originCode, destinationCode, date, passengersNeeded },
    });
  }

  return JSON.stringify(
    alternatives.map(f => ({
      flightNumber: f.flightNumber,
      airline: f.airline,
      departure: f.scheduledDeparture,
      arrival: f.scheduledArrival,
      status: f.status,
      availableSeats: f.availableSeats,
      pricePerPassenger: f.price,
      totalPrice: f.price * passengersNeeded,
      gate: f.gate,
    }))
  );
}

function rebookPassenger(
  bookingRef: string,
  newFlightNumber: string,
  reason: string
): string {
  const booking = BOOKINGS[bookingRef.toUpperCase()];
  if (!booking) {
    return JSON.stringify({ error: `Booking ${bookingRef} not found` });
  }

  const newFlight = FLIGHTS[newFlightNumber.toUpperCase()];
  if (!newFlight) {
    return JSON.stringify({ error: `Flight ${newFlightNumber} not found` });
  }

  if (newFlight.availableSeats < booking.passengers) {
    return JSON.stringify({
      error: `Insufficient seats: ${newFlight.availableSeats} available, ${booking.passengers} needed`,
    });
  }

  // Simulate the rebooking (in production this would hit the airline API)
  newFlight.availableSeats -= booking.passengers;

  return JSON.stringify({
    success: true,
    bookingRef: booking.bookingRef,
    passengerName: booking.passengerName,
    newFlight: {
      flightNumber: newFlight.flightNumber,
      airline: newFlight.airline,
      route: `${newFlight.originCode} → ${newFlight.destinationCode}`,
      departure: newFlight.scheduledDeparture,
      arrival: newFlight.scheduledArrival,
      gate: newFlight.gate,
    },
    passengers: booking.passengers,
    reason,
    confirmationCode: `RBK-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  });
}

async function sendWhatsAppNotification(toPhone: string, message: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

  if (!accountSid || !authToken) {
    // Demo mode: simulate the notification being sent
    return JSON.stringify({
      success: true,
      simulated: true,
      message: "WhatsApp notification simulated (Twilio credentials not configured)",
      to: toPhone,
      preview: message,
    });
  }

  try {
    const twilio = (await import("twilio")).default;
    const twilioClient = twilio(accountSid, authToken);

    const result = await twilioClient.messages.create({
      body: message,
      from,
      to: `whatsapp:${toPhone}`,
    });

    return JSON.stringify({
      success: true,
      messageSid: result.sid,
      status: result.status,
      to: toPhone,
    });
  } catch (err) {
    return JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : "Failed to send notification",
    });
  }
}

// ─── Execute a tool by name ─────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "check_flight_status":
      return checkFlightStatus(input.flight_number as string);
    case "get_booking_details":
      return getBookingDetails(input.booking_ref as string);
    case "search_alternative_flights":
      return searchAlternativeFlights(
        input.origin_code as string,
        input.destination_code as string,
        input.date as string,
        input.passengers_needed as number
      );
    case "rebook_passenger":
      return rebookPassenger(
        input.booking_ref as string,
        input.new_flight_number as string,
        input.reason as string
      );
    case "send_whatsapp_notification":
      return sendWhatsAppNotification(
        input.to_phone as string,
        input.message as string
      );
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

// ─── Agent event types (streamed to client) ─────────────────────────────────

export type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: string }
  | { type: "done"; summary: string };

// ─── Run the flight rebooking agent ────────────────────────────────────────

export async function* runFlightAgent(
  bookingRef: string
): AsyncGenerator<AgentEvent> {
  const systemPrompt = `You are an automated Flight Disruption Management Agent for a major airline.

Your job is to:
1. Look up the passenger's booking
2. Check the status of each flight in their itinerary
3. Identify any disruptions (delays >30 minutes that cause missed connections, or cancellations)
4. Search for the best alternative flights
5. Rebook the passenger automatically onto the best option
6. Send them a WhatsApp notification with their new itinerary

Decision criteria for the best alternative:
- Earliest arrival at the final destination
- Sufficient seats for all passengers in the booking
- Prefer same-airline first (loyalty points), then lowest price
- Avoid alternatives that arrive more than 4 hours later than original

Be proactive and decisive. Do not ask for confirmation — act on behalf of the passenger.
After completing the rebooking, write a clear summary of what you found and what you did.`;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Process booking reference: ${bookingRef}. Check all flights, identify any disruptions, and handle rebooking if needed. Send the passenger a WhatsApp notification with their updated itinerary.`,
    },
  ];

  // Agentic loop
  while (true) {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: systemPrompt,
      tools,
      messages,
    });

    let currentThinking = "";
    let currentText = "";

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "thinking_delta") {
          currentThinking += event.delta.thinking;
        } else if (event.delta.type === "text_delta") {
          currentText += event.delta.text;
        }
      }
    }

    const message = await stream.finalMessage();

    // Emit thinking if present
    if (currentThinking) {
      yield { type: "thinking", text: currentThinking };
    }

    // Emit text if present
    if (currentText) {
      yield { type: "text", text: currentText };
    }

    if (message.stop_reason === "end_turn") {
      yield { type: "done", summary: currentText };
      break;
    }

    if (message.stop_reason !== "tool_use") {
      yield { type: "done", summary: currentText || "Agent completed." };
      break;
    }

    // Process tool calls
    messages.push({ role: "assistant", content: message.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of message.content) {
      if (block.type !== "tool_use") continue;

      const input = block.input as Record<string, unknown>;
      yield { type: "tool_call", tool: block.name, input };

      const result = await executeTool(block.name, input);
      yield { type: "tool_result", tool: block.name, result };

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}

// ─── Utility ────────────────────────────────────────────────────────────────

function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}
