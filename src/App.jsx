import { useState } from "react";

// Same-origin path — both the Vite dev server and the nginx container
// proxy this through to https://gps-specials.polydial.com/v1/moderate/text,
// so the browser never makes a cross-origin request and CORS never applies.
const ENDPOINT = "/api/moderate/text";

const DECISION_META = {
  allow: {
    label: "Allow",
    sub: "Message passes unchanged to dispatch.",
    color: "#4FAE7C",
    dim: "#1B2B22",
  },
  rewrite: {
    label: "Rewrite",
    sub: "Sanitised and reworded before dispatch.",
    color: "#D9A441",
    dim: "#2E2717",
  },
  reject: {
    label: "Reject",
    sub: "Not dispatched. Guidance returned to the business owner.",
    color: "#E2604F",
    dim: "#2E1D19",
  },
};

function decisionMeta(decision) {
  return (
    DECISION_META[decision] || {
      label: decision || "Unknown",
      sub: "Unrecognised decision value.",
      color: "#8A9598",
      dim: "#22282A",
    }
  );
}

export default function TextModerationConsole() {
  const [message, setMessage] = useState(
    "Fresh pasta specials all week — come try our new menu!"
  );
  const [businessId, setBusinessId] = useState("biz_00123");
  const [localeHint, setLocaleHint] = useState("en");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  async function runCheck() {
    if (!message.trim()) {
      setStatus("error");
      setErrorMsg("Enter a message before running the check.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    setResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          business_id: businessId || undefined,
          locale_hint: localeHint || undefined,
        }),
      });
      if (!res.ok) {
        throw new Error(`Server responded ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setResult(data);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err && err.message
          ? err.message
          : "Could not reach the moderation service."
      );
    }
  }

  const meta = result ? decisionMeta(result.decision) : null;
  const changed =
    result && result.original_message !== result.final_message;

  return (
    <div
      style={{
        minHeight: "100%",
        background: "#0F1315",
        color: "#E8ECEC",
        fontFamily:
          "'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif",
        padding: "32px 20px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .tm-input {
          width: 100%;
          background: #171D1F;
          border: 1px solid #2A3335;
          border-radius: 6px;
          color: #E8ECEC;
          padding: 10px 12px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 120ms ease;
        }
        .tm-input:focus {
          outline: none;
          border-color: #5B8A87;
        }
        .tm-btn {
          background: #E8ECEC;
          color: #0F1315;
          border: none;
          border-radius: 6px;
          padding: 11px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 120ms ease;
          font-family: inherit;
        }
        .tm-btn:hover { opacity: 0.85; }
        .tm-btn:disabled { opacity: 0.5; cursor: default; }
        .chip {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 12px;
          font-family: 'IBM Plex Mono', ui-monospace, monospace;
          border: 1px solid #3A4547;
          color: #C4CBCC;
          background: #1B2224;
        }
      `}</style>

      <div style={{ maxWidth: 880, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            className="mono"
            style={{ fontSize: 12, color: "#6E7A7C", marginBottom: 6 }}
          >
            API-TXT · gps-specials.polydial.com
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            Text moderation console
          </h1>
          <p style={{ color: "#8A9598", fontSize: 14, marginTop: 6 }}>
            Send a marketing message through the filter and see the full
            decision, rewrite, and metadata returned.
          </p>
        </div>

        {/* Input panel */}
        <div
          style={{
            background: "#141A1B",
            border: "1px solid #232C2E",
            borderRadius: 10,
            padding: 20,
            marginBottom: 20,
          }}
        >
          <label
            style={{
              fontSize: 12,
              color: "#8A9598",
              display: "block",
              marginBottom: 6,
            }}
          >
            Message
          </label>
          <textarea
            className="tm-input"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type the raw marketing message a business owner would send…"
            style={{ resize: "vertical", marginBottom: 14 }}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              marginBottom: 16,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#8A9598",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Business ID
              </label>
              <input
                className="tm-input mono"
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                placeholder="biz_00123"
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "#8A9598",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                Locale hint
              </label>
              <input
                className="tm-input mono"
                value={localeHint}
                onChange={(e) => setLocaleHint(e.target.value)}
                placeholder="en"
              />
            </div>
          </div>

          <button
            className="tm-btn"
            onClick={runCheck}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Checking…" : "Run moderation check"}
          </button>

          {status === "error" && (
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                background: "#2E1D19",
                border: "1px solid #4A2A24",
                borderRadius: 6,
                color: "#F0A897",
                fontSize: 13,
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>

        {/* Result panel */}
        {result && meta && (
          <div
            style={{
              background: "#141A1B",
              border: "1px solid #232C2E",
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            {/* Decision header */}
            <div
              style={{
                background: meta.dim,
                borderBottom: `1px solid ${meta.color}33`,
                padding: "20px 22px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: meta.color,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      color: meta.color,
                      textTransform: "capitalize",
                    }}
                  >
                    {meta.label}
                  </div>
                  <div style={{ fontSize: 13, color: "#B7C0C1" }}>
                    {meta.sub}
                  </div>
                </div>
              </div>

              {/* Confidence gauge */}
              <div style={{ minWidth: 160 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 11,
                    color: "#8A9598",
                    marginBottom: 4,
                  }}
                  className="mono"
                >
                  <span>confidence</span>
                  <span>
                    {typeof result.confidence === "number"
                      ? result.confidence.toFixed(2)
                      : "—"}
                  </span>
                </div>
                <div
                  style={{
                    width: 160,
                    height: 6,
                    borderRadius: 4,
                    background: "#232C2E",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.round(
                        (result.confidence || 0) * 100
                      )}%`,
                      height: "100%",
                      background: meta.color,
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: 22 }}>
              {/* Message comparison */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: "#8A9598",
                    marginBottom: 8,
                  }}
                >
                  Original message
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: "10px 12px",
                    background: "#0F1315",
                    border: "1px solid #232C2E",
                    borderRadius: 6,
                    color: changed ? "#8A9598" : "#E8ECEC",
                    textDecoration: changed ? "line-through" : "none",
                  }}
                >
                  {result.original_message}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "#8A9598",
                    margin: "10px 0 8px",
                  }}
                >
                  Final message
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: "10px 12px",
                    background: "#0F1315",
                    border: `1px solid ${meta.color}55`,
                    borderRadius: 6,
                    color: result.final_message ? "#E8ECEC" : "#6E7A7C",
                  }}
                >
                  {result.final_message ||
                    (result.decision === "reject"
                      ? "No message — rejected, nothing dispatched."
                      : "No message returned.")}
                </div>
              </div>

              {/* Categories + word count row */}
              <div
                style={{
                  display: "flex",
                  gap: 24,
                  flexWrap: "wrap",
                  marginBottom: result.guidance ? 20 : 0,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8A9598",
                      marginBottom: 8,
                    }}
                  >
                    Categories
                  </div>
                  {result.categories && result.categories.length > 0 ? (
                    <div
                      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                    >
                      {result.categories.map((c, i) => (
                        <span key={i} className="chip">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span
                      className="mono"
                      style={{ fontSize: 13, color: "#6E7A7C" }}
                    >
                      none flagged
                    </span>
                  )}
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8A9598",
                      marginBottom: 8,
                    }}
                  >
                    Word count
                  </div>
                  <div className="mono" style={{ fontSize: 14 }}>
                    {result.word_count ?? "—"}
                  </div>
                </div>
              </div>

              {/* Guidance */}
              {result.guidance && (
                <div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#8A9598",
                      marginBottom: 8,
                    }}
                  >
                    Guidance for business owner
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      lineHeight: 1.6,
                      padding: "10px 12px",
                      background: "#2E2717",
                      border: "1px solid #4A3E1F",
                      borderRadius: 6,
                      color: "#E9CE8E",
                    }}
                  >
                    {result.guidance}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata footer */}
            <div
              style={{
                borderTop: "1px solid #232C2E",
                padding: "12px 22px",
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                fontSize: 12,
                color: "#6E7A7C",
              }}
              className="mono"
            >
              <span>
                processing: {result.metadata?.processing_ms ?? "—"}ms
              </span>
              <span>model: {result.metadata?.model_version ?? "—"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
