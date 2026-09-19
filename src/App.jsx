import { useEffect, useMemo, useState } from "react";

// Same-origin path — both the Vite dev server and the nginx container
// proxy this through to https://gps-specials.polydial.com/v1/moderate/text,
// so the browser never makes a cross-origin request and CORS never applies.
const ENDPOINT = "/api/moderate/text";

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------
const DECISION_META = {
    allow: {
        label: "Allow",
        sub: "Message passes unchanged to dispatch.",
        color: "#4FAE7C",
        dim: "#1B2B22",
    },
    rewrite: {
        label: "Rewrite",
        sub: "Sanitised and reworded before dispatch, in the original language.",
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

const CATEGORY_LABELS = {
    profanity: "Profanity",
    hate: "Hate / discriminatory",
    sexual: "Sexual content",
    aggressive: "Aggressive tone",
    ambiguous: "Ambiguous",
    length_exceeded: "Length exceeded",
    unsupported_language: "Unsupported language",
    invalid_input: "Invalid input",
};

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------
// Shown only if GET /v1/languages cannot be reached. The live list from the
// API always wins, so adding a language to SUPPORTED_LANGUAGES / languages.json
// on the server needs no change here.
const FALLBACK_LANGUAGES = [
    { code: "en", name: "English" },
    { code: "ar", name: "Arabic" },
];

// Text direction is handled by the browser: every message box uses dir="auto",
// so Arabic (and any other RTL language) lays out correctly with no per-language
// configuration here.

// One-click sample per language, for demoing the multi-language flow.
const SAMPLES = {
    en: "Fresh pasta specials all week — come try our new menu!",
    ar: "معكرونة طازجة طوال الأسبوع — تعالوا جربوا قائمتنا الجديدة!",
};

// Deliberately outside the supported set, to demonstrate the language gate.
const UNSUPPORTED_SAMPLE = {
    code: "zh",
    text: "整周供应新鲜意面——快来品尝我们的新菜单！",
};

const CODE_PATTERN = /^[a-z]{2,3}(-[A-Za-z0-9]+)?$/;

// GET /v1/languages is only specified as "the languages enabled on this
// deployment", so accept the plausible shapes rather than one exact one:
//   { "en": "English", ... }            { "en": { name, max_words, ... } }
//   { languages | supported: [...] }    [ "en", "es" ]  [ { code, name } ]
function normalizeLanguages(data) {
    let src = data;
    if (data && !Array.isArray(data) && typeof data === "object") {
        src = data.languages ?? data.supported_languages ?? data.supported ?? data;
    }

    const out = [];
    const push = (code, value) => {
        if (typeof code !== "string" || !CODE_PATTERN.test(code)) return;
        const v = typeof value === "string" ? { name: value } : value || {};
        out.push({
            code: code.toLowerCase(),
            name: v.name || undefined,
            maxWords: typeof v.max_words === "number" ? v.max_words : undefined,
        });
    };

    if (Array.isArray(src)) {
        src.forEach((item) =>
            typeof item === "string" ? push(item, {}) : push(item?.code, item)
        );
    } else if (src && typeof src === "object") {
        Object.entries(src).forEach(([code, value]) => push(code, value));
    }
    return out;
}

function intlName(code, displayLocale) {
    try {
        return new Intl.DisplayNames([displayLocale], { type: "language" }).of(code);
    } catch {
        return undefined;
    }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TextModerationConsole() {
    const [message, setMessage] = useState(SAMPLES.en);
    const [businessId, setBusinessId] = useState("biz_00123");
    const [localeHint, setLocaleHint] = useState(""); // "" = auto-detect
    const [status, setStatus] = useState("idle"); // idle | loading | done | error
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");

    const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);
    const [langSource, setLangSource] = useState("loading"); // loading | live | fallback

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(LANGUAGES_ENDPOINT);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const list = normalizeLanguages(await res.json());
                if (!list.length) throw new Error("empty language list");
                if (!cancelled) {
                    setLanguages(list);
                    setLangSource("live");
                }
            } catch {
                if (!cancelled) setLangSource("fallback");
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const languageByCode = useMemo(() => {
        const map = {};
        languages.forEach((l) => {
            map[l.code] = l;
        });
        return map;
    }, [languages]);

    function languageName(code) {
        if (!code || code === "unknown") return "Unknown";
        return (
            languageByCode[code]?.name || intlName(code, "en") || code.toUpperCase()
        );
    }

    function nativeName(code) {
        if (!code || code === "unknown") return undefined;
        const native = intlName(code, code);
        return native && native.toLowerCase() !== languageName(code).toLowerCase()
            ? native
            : undefined;
    }

    const samples = languages
        .filter((l) => SAMPLES[l.code])
        .map((l) => ({ code: l.code, text: SAMPLES[l.code] }));
    const showUnsupportedSample = !languageByCode[UNSUPPORTED_SAMPLE.code];

    function loadSample(text) {
        setMessage(text);
        setLocaleHint("");
        setResult(null);
        setStatus("idle");
        setErrorMsg("");
    }

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
    const changed = result && result.original_message !== result.final_message;

    // Language details for the result panel
    const detected = result?.detected_language;
    const detectedKnown = !!detected && detected !== "unknown";
    const detectedLang = detectedKnown ? languageByCode[detected] : undefined;
    const langConfidence =
        typeof result?.language_confidence === "number"
            ? result.language_confidence
            : null;
    const isUnsupported = !!result?.categories?.includes("unsupported_language");
    const hintMismatch =
        !!localeHint && detectedKnown && localeHint !== detected;
    const wordCap = detectedLang?.maxWords;

    return (
        <div
            style={{
                minHeight: "100%",
                background: "#0F1315",
                color: "#E8ECEC",
                fontFamily:
                    "'Space Grotesk', 'IBM Plex Sans Arabic', 'Inter', system-ui, -apple-system, sans-serif",
                padding: "32px 20px",
                boxSizing: "border-box",
            }}
        >
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap');
        .mono { font-family: 'IBM Plex Mono', 'IBM Plex Sans Arabic', ui-monospace, monospace; }
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
          font-family: inherit;
        }
        .tm-input:focus {
          outline: none;
          border-color: #5B8A87;
        }
        select.tm-input { appearance: auto; }
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
        .tm-btn:focus-visible, .sample-btn:focus-visible {
          outline: 2px solid #5B8A87;
          outline-offset: 2px;
        }
        .chip {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 100px;
          font-size: 12px;
          font-family: 'IBM Plex Mono', 'IBM Plex Sans Arabic', ui-monospace, monospace;
          border: 1px solid #3A4547;
          color: #C4CBCC;
          background: #1B2224;
        }
        .sample-btn {
          background: #171D1F;
          border: 1px solid #2A3335;
          border-radius: 100px;
          color: #C4CBCC;
          padding: 4px 12px;
          font-size: 12px;
          cursor: pointer;
          font-family: 'IBM Plex Mono', 'IBM Plex Sans Arabic', ui-monospace, monospace;
          transition: border-color 120ms ease, color 120ms ease;
        }
        .sample-btn:hover { border-color: #5B8A87; color: #E8ECEC; }
        .sample-btn.gate { border-style: dashed; color: #E9CE8E; border-color: #4A3E1F; }
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
                        decision, rewrite, detected language, and metadata returned.
                    </p>

                    {/* Supported languages */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginTop: 12,
                        }}
                    >
            <span style={{ fontSize: 12, color: "#8A9598" }}>
              Supported languages
            </span>
                        {languages.map((l) => (
                            <span
                                key={l.code}
                                className="chip"
                                title={`${languageName(l.code)} (${l.code})`}
                            >
                {l.code}
              </span>
                        ))}
                        {langSource === "fallback" && (
                            <span style={{ fontSize: 12, color: "#D9A441" }}>

              </span>
                        )}
                    </div>
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
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            flexWrap: "wrap",
                            gap: 8,
                            marginBottom: 6,
                        }}
                    >
                        <label
                            htmlFor="tm-message"
                            style={{ fontSize: 12, color: "#8A9598" }}
                        >
                            Message
                        </label>
                        <span style={{ fontSize: 12, color: "#6E7A7C" }}>
              Any supported language — detected automatically
            </span>
                    </div>
                    <textarea
                        id="tm-message"
                        className="tm-input"
                        dir="auto"
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type the raw marketing message a business owner would send…"
                        style={{ resize: "vertical", marginBottom: 10 }}
                    />

                    {/* Samples */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            marginBottom: 16,
                        }}
                    >
                        <span style={{ fontSize: 12, color: "#8A9598" }}>Try a sample</span>
                        {samples.map((s) => (
                            <button
                                key={s.code}
                                type="button"
                                className="sample-btn"
                                onClick={() => loadSample(s.text)}
                                title={languageName(s.code)}
                            >
                                {s.code}
                            </button>
                        ))}
                        {showUnsupportedSample && (
                            <button
                                type="button"
                                className="sample-btn gate"
                                onClick={() => loadSample(UNSUPPORTED_SAMPLE.text)}
                                title="Not enabled on this deployment — should be rejected by the language gate"
                            >
                                {UNSUPPORTED_SAMPLE.code} · Not Supported Sample
                            </button>
                        )}
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                            gap: 14,
                            marginBottom: 16,
                        }}
                    >
                        <div>
                            <label
                                htmlFor="tm-business"
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
                                id="tm-business"
                                className="tm-input mono"
                                value={businessId}
                                onChange={(e) => setBusinessId(e.target.value)}
                                placeholder="biz_00123"
                            />
                        </div>
                        <div>
                            <label
                                htmlFor="tm-hint"
                                style={{
                                    fontSize: 12,
                                    color: "#8A9598",
                                    display: "block",
                                    marginBottom: 6,
                                }}
                            >
                                Language hint (optional)
                            </label>
                            <select
                                id="tm-hint"
                                className="tm-input"
                                value={localeHint}
                                onChange={(e) => setLocaleHint(e.target.value)}
                            >
                                <option value="">Auto-detect</option>
                                {languages.map((l) => (
                                    <option key={l.code} value={l.code}>
                                        {languageName(l.code)} ({l.code})
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: 11, color: "#6E7A7C", marginTop: 4 }}>
                                The API always detects the language itself; a hint never
                                bypasses the language check.
                            </div>
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
                            role="alert"
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
                                            width: `${Math.round((result.confidence || 0) * 100)}%`,
                                            height: "100%",
                                            background: meta.color,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 22 }}>
                            {/* Detected language */}
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    flexWrap: "wrap",
                                    gap: 14,
                                    padding: "12px 14px",
                                    marginBottom: 20,
                                    background: "#0F1315",
                                    border: `1px solid ${isUnsupported ? "#4A2A24" : "#232C2E"}`,
                                    borderRadius: 6,
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                      className="chip"
                      style={
                          isUnsupported
                              ? { borderColor: "#4A2A24", color: "#F0A897" }
                              : undefined
                      }
                  >
                    {detectedKnown ? detected : "?"}
                  </span>
                                    <div>
                                        <div style={{ fontSize: 12, color: "#8A9598" }}>
                                            Detected language
                                        </div>
                                        <div style={{ fontSize: 15, fontWeight: 500 }}>
                                            {languageName(detected)}
                                            {nativeName(detected) && (
                                                <span
                                                    lang={detected}
                                                    dir="auto"
                                                    style={{
                                                        color: "#8A9598",
                                                        fontWeight: 400,
                                                        marginInlineStart: 8,
                                                    }}
                                                >
                          {nativeName(detected)}
                        </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

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
                                        <span>language confidence</span>
                                        <span>
                      {langConfidence !== null ? langConfidence.toFixed(2) : "—"}
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
                                                width: `${Math.round((langConfidence || 0) * 100)}%`,
                                                height: "100%",
                                                background: isUnsupported ? "#E2604F" : "#5B8A87",
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {hintMismatch && (
                                <div
                                    style={{
                                        fontSize: 13,
                                        color: "#E9CE8E",
                                        background: "#2E2717",
                                        border: "1px solid #4A3E1F",
                                        borderRadius: 6,
                                        padding: "8px 12px",
                                        marginBottom: 20,
                                    }}
                                >
                                    You hinted {languageName(localeHint)} ({localeHint}), but the
                                    message was detected as {languageName(detected)} ({detected}).
                                    The detected language is what the filter applied.
                                </div>
                            )}

                            {isUnsupported && (
                                <div style={{ marginBottom: 20 }}>
                                    <div
                                        style={{ fontSize: 12, color: "#8A9598", marginBottom: 8 }}
                                    >
                                        This deployment accepts
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                        {languages.map((l) => (
                                            <span key={l.code} className="chip">
                        {languageName(l.code)} · {l.code}
                      </span>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                    dir="auto"
                                    lang={detectedKnown ? detected : undefined}
                                    style={{
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        padding: "10px 12px",
                                        background: "#0F1315",
                                        border: "1px solid #232C2E",
                                        borderRadius: 6,
                                        color: changed ? "#8A9598" : "#E8ECEC",
                                        textDecoration: changed ? "line-through" : "none",
                                        overflowWrap: "anywhere",
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
                                    dir="auto"
                                    lang={detectedKnown ? detected : undefined}
                                    style={{
                                        fontSize: 14,
                                        lineHeight: 1.6,
                                        padding: "10px 12px",
                                        background: "#0F1315",
                                        border: `1px solid ${meta.color}55`,
                                        borderRadius: 6,
                                        color: result.final_message ? "#E8ECEC" : "#6E7A7C",
                                        overflowWrap: "anywhere",
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
                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                            {result.categories.map((c, i) => (
                                                <span key={i} className="chip" title={c}>
                          {CATEGORY_LABELS[c] || c}
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
                                        {wordCap !== undefined && (
                                            <span style={{ color: "#6E7A7C" }}>
                        {" "}
                                                / {wordCap} max for {detected}
                      </span>
                                        )}
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
                            <span>processing: {result.metadata?.processing_ms ?? "—"}ms</span>
                            <span>model: {result.metadata?.model_version ?? "—"}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
