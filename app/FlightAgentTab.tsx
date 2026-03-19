"use client";

import { useState } from "react";

type AgentEvent =
  | { type: "thinking"; text: string }
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool: string; result: string }
  | { type: "done"; summary: string }
  | { type: "error"; message: string };

type LogEntry = {
  id: number;
  event: AgentEvent;
};

const TOOL_LABELS: Record<string, { icon: string; label: string }> = {
  check_flight_status: { icon: "🔍", label: "Check flight status" },
  get_booking_details: { icon: "📋", label: "Get booking details" },
  search_alternative_flights: { icon: "✈️", label: "Search alternatives" },
  rebook_passenger: { icon: "🎫", label: "Rebook passenger" },
  send_whatsapp_notification: { icon: "📱", label: "Send WhatsApp" },
};

const DEMO_BOOKINGS = [
  { ref: "BK7823", label: "BK7823 — Sarah Chen (2 passengers, JFK→ORD→LAX)" },
  { ref: "BK4491", label: "BK4491 — Marcus Johnson (1 passenger, JFK→ORD)" },
];

function formatToolInput(tool: string, input: Record<string, unknown>): string {
  const parts = Object.entries(input).map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join(" · ");
}

function parseToolResult(result: string): React.ReactNode {
  try {
    const obj = JSON.parse(result);
    if (obj.error) {
      return <span style={{ color: "var(--error, #e55)" }}>{obj.error}</span>;
    }
    if (Array.isArray(obj)) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {obj.map((item, i) => (
            <div key={i} style={{ fontSize: "12px", color: "var(--muted-light, #aaa)" }}>
              {item.flightNumber || item.airline
                ? `${item.flightNumber} (${item.airline}) — departs ${item.departure}, ${item.availableSeats} seats, $${item.pricePerPassenger}/pax`
                : JSON.stringify(item)}
            </div>
          ))}
        </div>
      );
    }
    if (obj.success) {
      return (
        <span style={{ color: "#4caf50" }}>
          {obj.confirmationCode
            ? `Rebooked! Confirmation: ${obj.confirmationCode} → ${obj.newFlight?.flightNumber} departs ${obj.newFlight?.departure}`
            : obj.messageSid
            ? `WhatsApp sent (SID: ${obj.messageSid})`
            : obj.simulated
            ? `WhatsApp simulated (demo mode): "${obj.preview?.slice(0, 80)}..."`
            : "Success"}
        </span>
      );
    }
    if (obj.flightNumber || obj.bookingRef) {
      const lines = Object.entries(obj)
        .filter(([, v]) => typeof v !== "object" || v === null)
        .map(([k, v]) => `${k}: ${String(v)}`);
      return <span style={{ fontSize: "12px" }}>{lines.join(" | ")}</span>;
    }
    return <span style={{ fontSize: "12px" }}>{result.slice(0, 200)}</span>;
  } catch {
    return <span style={{ fontSize: "12px" }}>{result.slice(0, 200)}</span>;
  }
}

export function FlightAgentTab() {
  const [selectedBooking, setSelectedBooking] = useState(DEMO_BOOKINGS[0].ref);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [showProcessDesign, setShowProcessDesign] = useState(true);
  const [showThinking, setShowThinking] = useState(false);
  const nextId = { current: 0 };

  const runAgent = async () => {
    setRunning(true);
    setLog([]);

    try {
      const res = await fetch("/api/flights/rebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingRef: selectedBooking }),
      });

      if (!res.ok) {
        const err = await res.json();
        setLog([
          {
            id: 0,
            event: { type: "error", message: err.error || "Request failed" },
          },
        ]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as AgentEvent;
            setLog(prev => [...prev, { id: nextId.current++, event }]);
          } catch {
            // ignore malformed lines
          }
        }
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      {/* Process Design Section */}
      <section className="card">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
          }}
          onClick={() => setShowProcessDesign(!showProcessDesign)}
        >
          <h2 style={{ margin: 0 }}>Process Design: Human → Agent Workflow</h2>
          <span style={{ fontSize: "20px" }}>{showProcessDesign ? "▲" : "▼"}</span>
        </div>

        {showProcessDesign && (
          <>
            <p className="muted" style={{ marginTop: 8, marginBottom: 20 }}>
              This demo illustrates how a <strong>manual, human-mediated process</strong> is redesigned
              as an <strong>automated agent workflow</strong> — one of the core patterns in digital operations.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* BEFORE */}
              <div
                style={{
                  background: "rgba(255,80,80,0.06)",
                  border: "1px solid rgba(255,80,80,0.2)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <h3 style={{ margin: "0 0 12px", color: "#e55" }}>Before: Human Process</h3>
                <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
                  {[
                    ["1.", "Flight delayed — system flags it"],
                    ["2.", "Gate agent notified (15–30 min lag)"],
                    ["3.", "Passenger calls customer service"],
                    ["4.", "Hold time: 45–90 min average"],
                    ["5.", "Agent manually checks seat availability"],
                    ["6.", "Agent offers rebooking options verbally"],
                    ["7.", "Passenger confirms choice"],
                    ["8.", "Agent processes new booking (10–15 min)"],
                    ["9.", "Passenger receives email confirmation"],
                    ["⏱", "Total time: 1–3 hours"],
                    ["😤", "Pain: missed connections, stress, uncertainty"],
                  ].map(([step, desc]) => (
                    <div key={step} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, minWidth: "24px", color: "#e55" }}>{step}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AFTER */}
              <div
                style={{
                  background: "rgba(76,175,80,0.06)",
                  border: "1px solid rgba(76,175,80,0.25)",
                  borderRadius: "10px",
                  padding: "16px",
                }}
              >
                <h3 style={{ margin: "0 0 12px", color: "#4caf50" }}>After: Agent Workflow</h3>
                <div style={{ fontSize: "13px", lineHeight: "1.8" }}>
                  {[
                    ["1.", "Flight delayed — agent triggered instantly"],
                    ["2.", "Agent checks all affected bookings"],
                    ["3.", "Agent evaluates all alternative flights"],
                    ["4.", "Agent selects optimal option automatically"],
                    ["5.", "Agent confirms rebooking via airline API"],
                    ["6.", "WhatsApp notification sent to passenger"],
                    ["7.", "Passenger receives new gate + time"],
                    ["⏱", "Total time: 15–45 seconds"],
                    ["✨", "Benefit: proactive, zero hold time, scalable"],
                    ["🔧", "Tools: Claude API + tool use + Twilio"],
                    ["📚", "Pattern: agentic workflow with real actions"],
                  ].map(([step, desc]) => (
                    <div key={step} style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
                      <span style={{ fontWeight: 700, minWidth: "24px", color: "#4caf50" }}>{step}</span>
                      <span>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Architecture diagram */}
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "10px",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h4 style={{ margin: "0 0 12px", fontSize: "13px", color: "var(--muted-light, #aaa)" }}>
                AGENT ARCHITECTURE
              </h4>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  flexWrap: "wrap",
                  fontSize: "13px",
                }}
              >
                {[
                  { label: "Booking System", icon: "🗄️", color: "#888" },
                  { label: "→", icon: "", color: "#555" },
                  { label: "Claude Opus 4.6", icon: "🧠", color: "#a78bfa" },
                  { label: "→", icon: "", color: "#555" },
                  { label: "Flight API Tools", icon: "🔧", color: "#60a5fa" },
                  { label: "→", icon: "", color: "#555" },
                  { label: "Airline DB", icon: "✈️", color: "#34d399" },
                  { label: "→", icon: "", color: "#555" },
                  { label: "Twilio WhatsApp", icon: "📱", color: "#f472b6" },
                ].map((item, i) =>
                  item.icon === "" ? (
                    <span key={i} style={{ color: item.color, fontSize: "16px" }}>
                      {item.label}
                    </span>
                  ) : (
                    <span
                      key={i}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        background: "rgba(255,255,255,0.05)",
                        border: `1px solid ${item.color}44`,
                        color: item.color,
                        fontWeight: 600,
                      }}
                    >
                      {item.icon} {item.label}
                    </span>
                  )
                )}
              </div>
              <p style={{ margin: "12px 0 0", fontSize: "12px", color: "var(--muted-light, #777)" }}>
                Claude uses <strong>tool use</strong> (function calling) to interact with real systems. Each
                tool call is a discrete action — check status, search flights, rebook, notify — chained
                together by the model based on what it discovers. This is the{" "}
                <strong>agentic workflow pattern</strong>.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Agent Demo Section */}
      <section className="card">
        <h2>Live Demo: Run the Flight Agent</h2>
        <p className="muted" style={{ marginTop: 4, marginBottom: 20 }}>
          Select a booking with a disrupted itinerary. The agent will analyze it, find alternatives,
          rebook, and send a WhatsApp notification — all automatically.
        </p>

        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
              Select Booking
            </label>
            <select
              value={selectedBooking}
              onChange={e => setSelectedBooking(e.target.value)}
              disabled={running}
              style={{ minWidth: "340px" }}
            >
              {DEMO_BOOKINGS.map(b => (
                <option key={b.ref} value={b.ref}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
            <button onClick={runAgent} disabled={running} style={{ marginTop: "auto" }}>
              {running ? "⏳ Agent running…" : "▶ Run Agent"}
            </button>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer", marginTop: "auto", paddingBottom: "2px" }}>
              <input
                type="checkbox"
                checked={showThinking}
                onChange={e => setShowThinking(e.target.checked)}
              />
              Show thinking
            </label>
          </div>
        </div>

        {/* Flight status overview for selected booking */}
        {selectedBooking === "BK7823" && (
          <div
            style={{
              padding: "12px",
              background: "rgba(255,165,0,0.06)",
              border: "1px solid rgba(255,165,0,0.2)",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            <strong>⚠️ Disruption detected:</strong> UA234 (JFK→ORD) is delayed 95 min, causing missed
            connection to UA890 (ORD→LAX 11:30). Agent will find a direct alternative.
          </div>
        )}

        {/* Agent Log */}
        {log.length > 0 && (
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 14px",
                background: "rgba(255,255,255,0.04)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--muted-light, #aaa)",
                letterSpacing: "0.05em",
              }}
            >
              AGENT LOG
            </div>

            <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {log.map(({ id, event }) => {
                if (event.type === "thinking" && !showThinking) return null;

                if (event.type === "thinking") {
                  return (
                    <div
                      key={id}
                      style={{
                        padding: "10px 12px",
                        background: "rgba(167,139,250,0.06)",
                        border: "1px solid rgba(167,139,250,0.15)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#a78bfa", marginBottom: "6px", fontSize: "11px" }}>
                        🧠 THINKING
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          whiteSpace: "pre-wrap",
                          fontFamily: "inherit",
                          color: "rgba(167,139,250,0.7)",
                          maxHeight: "200px",
                          overflow: "auto",
                          fontSize: "11px",
                        }}
                      >
                        {event.text}
                      </pre>
                    </div>
                  );
                }

                if (event.type === "tool_call") {
                  const meta = TOOL_LABELS[event.tool] || { icon: "⚙️", label: event.tool };
                  return (
                    <div
                      key={id}
                      style={{
                        padding: "10px 12px",
                        background: "rgba(96,165,250,0.06)",
                        border: "1px solid rgba(96,165,250,0.15)",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#60a5fa", marginBottom: "4px" }}>
                        {meta.icon} {meta.label}
                      </div>
                      <code style={{ fontSize: "11px", color: "rgba(96,165,250,0.7)" }}>
                        {formatToolInput(event.tool, event.input)}
                      </code>
                    </div>
                  );
                }

                if (event.type === "tool_result") {
                  const meta = TOOL_LABELS[event.tool] || { icon: "⚙️", label: event.tool };
                  return (
                    <div
                      key={id}
                      style={{
                        padding: "8px 12px",
                        background: "rgba(52,211,153,0.04)",
                        border: "1px solid rgba(52,211,153,0.12)",
                        borderRadius: "8px",
                        fontSize: "12px",
                        marginLeft: "16px",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: "#34d399", marginBottom: "4px", fontSize: "11px" }}>
                        ↳ {meta.label} result
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.6)" }}>
                        {parseToolResult(event.result)}
                      </div>
                    </div>
                  );
                }

                if (event.type === "text" || event.type === "done") {
                  const content = event.type === "text" ? event.text : event.summary;
                  return (
                    <div
                      key={id}
                      style={{
                        padding: "12px",
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        lineHeight: "1.7",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {content}
                    </div>
                  );
                }

                if (event.type === "error") {
                  return (
                    <div
                      key={id}
                      style={{
                        padding: "10px 12px",
                        background: "rgba(255,80,80,0.08)",
                        border: "1px solid rgba(255,80,80,0.2)",
                        borderRadius: "8px",
                        color: "#e55",
                        fontSize: "13px",
                      }}
                    >
                      ⚠️ {event.message}
                    </div>
                  );
                }

                return null;
              })}

              {running && (
                <div style={{ textAlign: "center", padding: "12px", color: "var(--muted-light, #888)", fontSize: "13px" }}>
                  <span style={{ animation: "pulse 1s infinite" }}>Agent working…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Learning Notes Section */}
      <section className="card">
        <h2>Key Concepts for Students</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "12px" }}>
          {[
            {
              icon: "🔧",
              title: "Tool Use (Function Calling)",
              body: "Claude doesn't have access to real-time data by default. Tools let it take actions: check databases, call APIs, send messages. Each tool is a typed function with a JSON schema.",
            },
            {
              icon: "🔄",
              title: "Agentic Loop",
              body: "The agent runs in a loop: call Claude → it requests tools → execute tools → feed results back → repeat until done. This loop is how complex multi-step tasks are automated.",
            },
            {
              icon: "🧠",
              title: "Adaptive Thinking",
              body: "Claude Opus 4.6 uses adaptive thinking to reason step-by-step before acting. This improves decision quality for complex tasks like evaluating tradeoffs between flight options.",
            },
            {
              icon: "📡",
              title: "Streaming Responses",
              body: "The agent streams events via NDJSON so the UI updates in real time. You see thinking, tool calls, and results as they happen — not just a final answer at the end.",
            },
            {
              icon: "🤝",
              title: "Human ↔ Agent Boundary",
              body: "Well-designed agents act autonomously for routine cases but can escalate. This demo auto-rebooks; a real system might pause for human approval on expensive upgrades.",
            },
            {
              icon: "🔔",
              title: "Closing the Loop",
              body: "Automation is only valuable if the human knows what happened. The WhatsApp notification closes the loop — the passenger is informed without having to call or check an app.",
            },
          ].map(card => (
            <div
              key={card.title}
              style={{
                padding: "14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "10px",
              }}
            >
              <div style={{ fontSize: "22px", marginBottom: "8px" }}>{card.icon}</div>
              <div style={{ fontWeight: 700, marginBottom: "6px", fontSize: "14px" }}>{card.title}</div>
              <div style={{ fontSize: "13px", color: "var(--muted-light, #aaa)", lineHeight: "1.6" }}>
                {card.body}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
