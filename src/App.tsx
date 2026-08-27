import { useState, useRef, useEffect } from "react";
import { useLanguage } from "./i18n/LanguageContext";

type Screen = "login" | "otp" | "language" | "home" | "case-sheet" | "voice-confirm" | "my-reports" | "past-visits";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिंदी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
];

export default function App() {
  const { language: selectedLang, setLanguage: setSelectedLang, t, isTranslating } = useLanguage();
  const [screen, setScreen] = useState<Screen>("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [errors, setErrors] = useState<{ name?: string; phone?: string; otp?: string }>({});
  const [resendTimer, setResendTimer] = useState(30);
  const [listening, setListening] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [caseText, setCaseText] = useState("");
  const [expandedVisit, setExpandedVisit] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (screen !== "otp") return;
    setResendTimer(30);
    const interval = setInterval(() => setResendTimer((t) => (t > 0 ? t - 1 : 0)), 1000);
    return () => clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function validateLogin() {
    const e: { name?: string; phone?: string } = {};
    if (!name.trim()) e.name = t("Please enter your name.");
    if (!phone.trim()) e.phone = t("Please enter your phone number.");
    else if (!/^\d{10}$/.test(phone.replace(/\s/g, "")))
      e.phone = t("Please enter a valid 10-digit phone number.");
    return e;
  }

  function handleLoginSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validateLogin();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setOtp(["", "", "", ""]);
    setScreen("otp");
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setErrors((prev) => ({ ...prev, otp: undefined }));
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0)
      inputRefs.current[index - 1]?.focus();
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const next = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, 3)]?.focus();
  }

  function handleOtpSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (otp.some((d) => d === "")) {
      setErrors({ otp: t("Please enter the 4-digit OTP sent to your number.") });
      return;
    }
    setErrors({});
    setScreen("language");
  }

  function handleLangSelect(code: string) {
    setSelectedLang(code);
    setTimeout(() => setScreen("home"), 300);
  }

  function toggleMic() {
    setListening((l) => !l);
    setMenuOpen(false);
    if (!listening) setTimeout(() => setListening(false), 3000);
  }

  const fieldBase: React.CSSProperties = { background: "#f0f7ff", border: "2.5px solid #b8d8f8", color: "#1a3a5c" };
  const fieldError: React.CSSProperties = { ...fieldBase, border: "2.5px solid #e05252" };
  function onFocus(e: React.FocusEvent<HTMLInputElement>) { e.target.style.border = "2.5px solid #1a6fd4"; }
  function onBlur(e: React.FocusEvent<HTMLInputElement>, hasErr: boolean) {
    e.target.style.border = hasErr ? "2.5px solid #e05252" : "2.5px solid #b8d8f8";
  }

  const currentLang = LANGUAGES.find((l) => l.code === selectedLang);

  /* ── Top-right menu (language + success screens only) ── */
  const TopMenu = () => (
    <div ref={menuRef} className="absolute top-5 right-5" style={{ zIndex: 100 }}>
      {/* Hamburger trigger */}
      <button
        onClick={() => setMenuOpen((o) => !o)}
        className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all active:scale-95"
        style={{ background: menuOpen ? "#1a6fd4" : "#e8f4ff", border: "2px solid #b8d8f8" }}
        aria-label="Open menu"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {menuOpen ? (
            <path d="M5 5l10 10M15 5L5 15" stroke={menuOpen ? "#fff" : "#1a6fd4"}
              strokeWidth="2.2" strokeLinecap="round" />
          ) : (
            <>
              <line x1="3" y1="6" x2="17" y2="6" stroke="#1a6fd4" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="3" y1="10" x2="17" y2="10" stroke="#1a6fd4" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="3" y1="14" x2="17" y2="14" stroke="#1a6fd4" strokeWidth="2.2" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Dropdown */}
      {menuOpen && (
        <div
          className="absolute top-14 right-0 rounded-2xl overflow-hidden"
          style={{
            background: "#fff",
            border: "2px solid #dbeeff",
            boxShadow: "0 8px 24px rgba(26,111,212,0.12)",
            minWidth: "210px",
          }}
        >
          {/* Speak your language */}
          <button
            onClick={toggleMic}
            className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all"
            style={{
              background: listening ? "#e8f4ff" : "#fff",
              borderBottom: "1.5px solid #dbeeff",
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.background = "#f0f7ff")}
            onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.background = listening ? "#e8f4ff" : "#fff")}
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: listening ? "#1a6fd4" : "#dbeeff" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill={listening ? "#fff" : "#1a6fd4"} />
                <path d="M5 10a7 7 0 0 0 14 0" stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" fill="none" />
                <line x1="12" y1="17" x2="12" y2="21" stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21" stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-base font-semibold" style={{ color: "#1a3a5c" }}>
                {listening ? t("Listening…") : t("Speak your language")}
              </p>
              <p className="text-xs" style={{ color: "#7aadd4" }}>{t("Use voice to select")}</p>
            </div>
          </button>

          {/* Change language */}
          <button
            onClick={() => { setMenuOpen(false); setScreen("language"); }}
            className="w-full flex items-center gap-3 px-5 py-4 text-left transition-all"
            style={{ background: "#fff" }}
            onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.background = "#f0f7ff")}
            onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.background = "#fff")}
          >
            <span
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#dbeeff" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#1a6fd4" strokeWidth="2" />
                <path d="M12 2c-2.5 3-4 6.5-4 10s1.5 7 4 10M12 2c2.5 3 4 6.5 4 10s-1.5 7-4 10M2 12h20"
                  stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="text-base font-semibold" style={{ color: "#1a3a5c" }}>{t("Change language")}</p>
              <p className="text-xs" style={{ color: "#7aadd4" }}>
                {currentLang ? `${t("Now:")} ${currentLang.native}` : t("Pick your language")}
              </p>
            </div>
          </button>
        </div>
      )}
    </div>
  );

  /* ══════════════════ HOME ══════════════════ */
  if (screen === "home") {
    const actions = [
      {
        id: "case-sheet",
        label: t("Prepare Case Sheet"),
        sub: t("Fill in patient details"),
        icon: (
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect x="8" y="4" width="24" height="32" rx="4" fill="#dbeeff" />
            <rect x="8" y="4" width="24" height="32" rx="4" stroke="#1a6fd4" strokeWidth="2" />
            <line x1="14" y1="14" x2="26" y2="14" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="20" x2="26" y2="20" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
            <line x1="14" y1="26" x2="21" y2="26" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        id: "my-reports",
        label: t("My Reports"),
        sub: t("View your test results"),
        icon: (
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="14" fill="#dbeeff" stroke="#1a6fd4" strokeWidth="2" />
            <polyline points="13,22 17,17 21,21 27,14" stroke="#1a6fd4" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        ),
      },
      {
        id: "past-visits",
        label: t("Past Visits"),
        sub: t("Check previous appointments"),
        icon: (
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect x="6" y="10" width="28" height="26" rx="4" fill="#dbeeff" stroke="#1a6fd4" strokeWidth="2" />
            <line x1="6" y1="18" x2="34" y2="18" stroke="#1a6fd4" strokeWidth="2" />
            <line x1="14" y1="6" x2="14" y2="14" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
            <line x1="26" y1="6" x2="26" y2="14" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
            <circle cx="14" cy="26" r="2" fill="#1a6fd4" />
            <circle cx="20" cy="26" r="2" fill="#1a6fd4" />
            <circle cx="26" cy="26" r="2" fill="#1a6fd4" />
          </svg>
        ),
      },
    ];

    return (
      <div className="relative min-h-screen flex flex-col px-6 py-12">
        <TopMenu />

        {/* Greeting */}
        <div className="mt-8 mb-10">
          <p className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>
            {t("Hello,")} {name} 👋
          </p>
          <p className="text-base mt-1" style={{ color: "#4a7aaa" }}>
            {t("What would you like to do today?")}
          </p>
        </div>

        {/* 3 main action cards */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => setScreen(action.id as Screen)}
              className="w-full flex items-center gap-5 px-6 py-6 rounded-2xl text-left transition-all active:scale-95"
              style={{
                background: "#f0f7ff",
                border: "2.5px solid #b8d8f8",
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#e2f0ff";
                (e.currentTarget as HTMLElement).style.border = "2.5px solid #1a6fd4";
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.background = "#f0f7ff";
                (e.currentTarget as HTMLElement).style.border = "2.5px solid #b8d8f8";
              }}
            >
              <span className="flex-shrink-0">{action.icon}</span>
              <div>
                <p className="text-xl font-bold" style={{ color: "#1a3a5c" }}>
                  {action.label}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "#7aadd4" }}>
                  {action.sub}
                </p>
              </div>
              <svg className="ml-auto flex-shrink-0" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4l6 6-6 6" stroke="#b8d8f8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>

        <p className="mt-auto pt-12 text-sm text-center" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ LANGUAGE ══════════════════ */
  if (screen === "language") {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <TopMenu />

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "#dbeeff" }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <circle cx="20" cy="20" r="16" stroke="#1a6fd4" strokeWidth="2.5" />
            <path d="M20 4c-4 5-6.5 10.5-6.5 16S16 31 20 36M20 4c4 5 6.5 10.5 6.5 16S24 31 20 36M4 20h32"
              stroke="#1a6fd4" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: "#1a3a5c" }}>
          {t("Choose Language")}
        </h1>
        <p className="text-base text-center mb-10" style={{ color: "#4a7aaa" }}>
          {t("Select the language you are comfortable with")}
        </p>

        <div className="w-full max-w-sm flex flex-col gap-4">
          {LANGUAGES.map((lang) => {
            const isSelected = selectedLang === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => handleLangSelect(lang.code)}
                className="w-full flex items-center justify-between px-6 py-5 rounded-2xl text-left transition-all active:scale-95"
                style={{
                  background: isSelected ? "#1a6fd4" : "#f0f7ff",
                  border: isSelected ? "2.5px solid #1a6fd4" : "2.5px solid #b8d8f8",
                }}
              >
                <div>
                  <p className="text-xl font-bold" style={{ color: isSelected ? "#fff" : "#1a3a5c" }}>
                    {lang.native}
                  </p>
                  <p className="text-sm" style={{ color: isSelected ? "#cce4ff" : "#7aadd4" }}>
                    {lang.label}
                  </p>
                </div>
                {isSelected && (
                  <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                    <circle cx="13" cy="13" r="13" fill="white" fillOpacity="0.25" />
                    <path d="M7 13l4 4 8-8" stroke="white" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-10 text-sm text-center max-w-xs" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ CASE SHEET ══════════════════ */
  if (screen === "case-sheet") {
    return (
      <div className="relative min-h-screen flex flex-col px-6 py-12">
        {/* Back button */}
        <button
          onClick={() => setScreen("home")}
          className="flex items-center gap-2 text-base font-medium mb-2 w-fit"
          style={{ color: "#4a7aaa" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16l-6-6 6-6" stroke="#4a7aaa" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("Back")}
        </button>

        {/* Title */}
        <div className="mt-4 mb-2">
          <h1 className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>
            {t("Prepare Case Sheet")}
          </h1>
          <p className="text-base mt-1" style={{ color: "#4a7aaa" }}>
            {t("Speak or type your health concern")}
          </p>
        </div>

        {/* Centered mic section */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 py-10">
          {/* Ripple + mic button */}
          <div className="relative flex items-center justify-center">
            {/* Ripple rings when listening */}
            {listening && (
              <>
                <span
                  className="absolute rounded-full animate-ping"
                  style={{
                    width: 160, height: 160,
                    background: "rgba(26,111,212,0.12)",
                    animationDuration: "1.2s",
                  }}
                />
                <span
                  className="absolute rounded-full animate-ping"
                  style={{
                    width: 130, height: 130,
                    background: "rgba(26,111,212,0.15)",
                    animationDuration: "1.2s",
                    animationDelay: "0.3s",
                  }}
                />
              </>
            )}

            {/* Big mic button */}
            <button
              onClick={toggleMic}
              className="relative flex items-center justify-center rounded-full transition-all active:scale-95"
              style={{
                width: 110,
                height: 110,
                background: listening ? "#1a6fd4" : "#e8f4ff",
                border: `4px solid ${listening ? "#1a6fd4" : "#b8d8f8"}`,
                boxShadow: listening
                  ? "0 8px 32px rgba(26,111,212,0.35)"
                  : "0 4px 16px rgba(26,111,212,0.12)",
              }}
              aria-label="Start speaking"
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3"
                  fill={listening ? "#fff" : "#1a6fd4"} />
                <path d="M5 10a7 7 0 0 0 14 0"
                  stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" fill="none" />
                <line x1="12" y1="17" x2="12" y2="21"
                  stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21"
                  stroke={listening ? "#fff" : "#1a6fd4"}
                  strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Prompt text */}
          <div className="text-center px-4">
            <p className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>
              {listening ? t("Listening…") : t("Tell me what problem you are facing")}
            </p>
            {!listening && (
              <p className="text-base mt-2" style={{ color: "#7aadd4" }}>
                {t("Tap the mic button and speak")}
              </p>
            )}
            {listening && (
              <p className="text-base mt-2" style={{ color: "#1a6fd4" }}>
                {t("Speak now — I am listening")}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 w-full max-w-xs">
            <div className="flex-1 h-px" style={{ background: "#dbeeff" }} />
            <span className="text-sm font-medium" style={{ color: "#b8d8f8" }}>{t("or type below")}</span>
            <div className="flex-1 h-px" style={{ background: "#dbeeff" }} />
          </div>

          {/* Text area */}
          <div className="w-full max-w-xs">
            <textarea
              rows={3}
              value={caseText}
              onChange={(e) => setCaseText(e.target.value)}
              placeholder={t("e.g. I have a headache and fever since 2 days…")}
              className="w-full text-base px-5 py-4 rounded-2xl outline-none resize-none transition-all"
              style={{
                background: "#f0f7ff",
                border: "2.5px solid #b8d8f8",
                color: "#1a3a5c",
                fontFamily: "inherit",
              }}
              onFocus={(e) => (e.target.style.border = "2.5px solid #1a6fd4")}
              onBlur={(e) => (e.target.style.border = "2.5px solid #b8d8f8")}
            />
          </div>

          {/* Submit */}
          <button
            onClick={() => {
              const text = caseText.trim() || t("I have been having a headache and mild fever since the last 2 days. I also feel very tired and my throat is sore.");
              setSpokenText(text);
              setScreen("voice-confirm");
            }}
            className="w-full max-w-xs py-5 rounded-2xl text-xl font-bold text-white transition-all active:scale-95 shadow-md"
            style={{ background: "#1a6fd4" }}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = "#155db8")}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = "#1a6fd4")}
          >
            {t("Submit")}
          </button>
        </div>

        <p className="text-sm text-center" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ VOICE CONFIRM ══════════════════ */
  if (screen === "voice-confirm") {
    return (
      <div className="min-h-screen flex flex-col px-6 py-12">
        {/* Back */}
        <button
          onClick={() => setScreen("case-sheet")}
          className="flex items-center gap-2 text-base font-medium mb-2 w-fit"
          style={{ color: "#4a7aaa" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16l-6-6 6-6" stroke="#4a7aaa" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("Back")}
        </button>

        {/* Title */}
        <div className="mt-4 mb-10">
          <h1 className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>
            {t("Voice Confirmation")}
          </h1>
          <p className="text-base mt-1" style={{ color: "#4a7aaa" }}>
            {t("Please check if this is correct")}
          </p>
        </div>

        {/* Waveform decoration */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {[18, 30, 22, 38, 26, 42, 30, 36, 20, 32, 24, 40, 28, 34, 18].map((h, i) => (
            <div
              key={i}
              className="rounded-full"
              style={{
                width: 5,
                height: h,
                background: i % 3 === 0 ? "#1a6fd4" : "#b8d8f8",
              }}
            />
          ))}
        </div>

        {/* Converted text bubble */}
        <div
          className="w-full rounded-3xl px-6 py-6 mb-10"
          style={{
            background: "#f0f7ff",
            border: "2.5px solid #b8d8f8",
          }}
        >
          {/* Mic badge */}
          <div className="flex items-center gap-2 mb-4">
            <span
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "#1a6fd4" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="11" rx="3" fill="#fff" />
                <path d="M5 10a7 7 0 0 0 14 0" stroke="#fff" strokeWidth="2"
                  strokeLinecap="round" fill="none" />
                <line x1="12" y1="17" x2="12" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <line x1="9" y1="21" x2="15" y2="21" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-sm font-semibold" style={{ color: "#1a6fd4" }}>
              {t("What you said")}
            </span>
          </div>

          <p className="text-lg leading-relaxed font-medium" style={{ color: "#1a3a5c" }}>
            "{t(spokenText)}"
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={() => setScreen("home")}
            className="w-full py-5 rounded-2xl text-xl font-bold text-white transition-all active:scale-95 shadow-md"
            style={{ background: "#1a6fd4" }}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = "#155db8")}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = "#1a6fd4")}
          >
            ✓ {t("Confirm")}
          </button>

          <button
            onClick={() => { setCaseText(""); setSpokenText(""); setScreen("case-sheet"); }}
            className="w-full py-5 rounded-2xl text-xl font-bold transition-all active:scale-95"
            style={{
              background: "#f0f7ff",
              border: "2.5px solid #b8d8f8",
              color: "#1a6fd4",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#e2f0ff";
              (e.currentTarget as HTMLElement).style.border = "2.5px solid #1a6fd4";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#f0f7ff";
              (e.currentTarget as HTMLElement).style.border = "2.5px solid #b8d8f8";
            }}
          >
            🎙 {t("Speak Again")}
          </button>
        </div>

        <p className="mt-auto pt-12 text-sm text-center" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ MY REPORTS ══════════════════ */
  if (screen === "my-reports") {
    const reports = [
      {
        type: t("Prescription"),
        doctor: "Dr. Anjali Sharma",
        date: "22 Aug 2026",
        detail: t("Paracetamol, Cetirizine, Vitamin C"),
        color: "#dbeeff",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="2" width="14" height="20" rx="3" fill="#1a6fd4" fillOpacity="0.15" stroke="#1a6fd4" strokeWidth="1.8" />
            <line x1="8" y1="8" x2="16" y2="8" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="16" x2="12" y2="16" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        type: t("Lab Report"),
        doctor: "City Diagnostics Lab",
        date: "18 Aug 2026",
        detail: t("CBC, Blood Sugar, Thyroid (TSH)"),
        color: "#e8f4ff",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 3h2v7L7 17a3 3 0 0 0 10 0l-4-7V3h2" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="9" y1="3" x2="15" y2="3" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        type: t("Prescription"),
        doctor: "Dr. Ramesh Patil",
        date: "5 Aug 2026",
        detail: t("Amoxicillin, ORS, Pantoprazole"),
        color: "#dbeeff",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="2" width="14" height="20" rx="3" fill="#1a6fd4" fillOpacity="0.15" stroke="#1a6fd4" strokeWidth="1.8" />
            <line x1="8" y1="8" x2="16" y2="8" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="16" x2="12" y2="16" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        type: t("Lab Report"),
        doctor: "HealthCare Pathology",
        date: "28 Jul 2026",
        detail: t("Urine Routine, Creatinine, HbA1c"),
        color: "#e8f4ff",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M9 3h2v7L7 17a3 3 0 0 0 10 0l-4-7V3h2" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="9" y1="3" x2="15" y2="3" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        type: t("Prescription"),
        doctor: "Dr. Sunita Verma",
        date: "10 Jul 2026",
        detail: t("Metformin, Atorvastatin, Aspirin"),
        color: "#dbeeff",
        icon: (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="2" width="14" height="20" rx="3" fill="#1a6fd4" fillOpacity="0.15" stroke="#1a6fd4" strokeWidth="1.8" />
            <line x1="8" y1="8" x2="16" y2="8" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="12" x2="16" y2="12" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="8" y1="16" x2="12" y2="16" stroke="#1a6fd4" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
    ];

    return (
      <div className="relative min-h-screen flex flex-col px-6 py-12">
        {/* Back */}
        <button
          onClick={() => setScreen("home")}
          className="flex items-center gap-2 text-base font-medium mb-2 w-fit"
          style={{ color: "#4a7aaa" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16l-6-6 6-6" stroke="#4a7aaa" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("Back")}
        </button>

        {/* Title */}
        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>{t("My Reports")}</h1>
          <p className="text-base mt-1" style={{ color: "#4a7aaa" }}>
            {reports.length} {t("records found")}
          </p>
        </div>

        {/* Report cards */}
        <div className="flex flex-col gap-4 w-full max-w-sm pb-36">
          {reports.map((r, i) => (
            <div
              key={i}
              className="w-full rounded-2xl px-5 py-5 flex items-start gap-4"
              style={{ background: "#f0f7ff", border: "2px solid #b8d8f8" }}
            >
              {/* Icon badge */}
              <span
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                style={{ background: r.color, border: "1.5px solid #b8d8f8" }}
              >
                {r.icon}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "#dbeeff", color: "#1a6fd4" }}
                  >
                    {r.type}
                  </span>
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: "#7aadd4" }}>
                    {r.date}
                  </span>
                </div>
                <p className="text-base font-semibold mt-2 truncate" style={{ color: "#1a3a5c" }}>
                  {r.doctor}
                </p>
                <p className="text-sm mt-0.5" style={{ color: "#7aadd4" }}>
                  {r.detail}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Sticky bottom buttons */}
        <div
          className="fixed bottom-0 left-0 right-0 flex gap-4 px-6 py-5"
          style={{ background: "rgba(255,255,255,0.95)", borderTop: "2px solid #dbeeff", backdropFilter: "blur(8px)" }}
        >
          <button
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold text-white transition-all active:scale-95"
            style={{ background: "#1a6fd4" }}
            onMouseOver={(e) => ((e.currentTarget as HTMLElement).style.background = "#155db8")}
            onMouseOut={(e) => ((e.currentTarget as HTMLElement).style.background = "#1a6fd4")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="#fff" strokeWidth="2" />
              <path d="M8 12h8M12 8v8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t("Scan New")}
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-lg font-bold transition-all active:scale-95"
            style={{ background: "#f0f7ff", border: "2.5px solid #b8d8f8", color: "#1a6fd4" }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#e2f0ff";
              (e.currentTarget as HTMLElement).style.border = "2.5px solid #1a6fd4";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#f0f7ff";
              (e.currentTarget as HTMLElement).style.border = "2.5px solid #b8d8f8";
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 16V4M12 4l-4 4M12 4l4 4" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="#1a6fd4" strokeWidth="2" strokeLinecap="round" />
            </svg>
            {t("Upload")}
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════ PAST VISITS ══════════════════ */
  if (screen === "past-visits") {
    const visits = [
      {
        date: "22 Aug 2026",
        day: t("Saturday"),
        doctor: "Dr. Anjali Sharma",
        hospital: "City Health Clinic",
        complaint: t("Fever and body ache"),
        diagnosis: t("Viral fever with mild dehydration"),
        medicines: [t("Paracetamol 500mg – twice a day"), t("ORS sachets – after every loose motion"), t("Vitamin C – once daily")],
        notes: t("Rest for 3 days. Drink plenty of fluids. Return if fever persists beyond 3 days."),
        followUp: "29 Aug 2026",
      },
      {
        date: "5 Aug 2026",
        day: t("Wednesday"),
        doctor: "Dr. Ramesh Patil",
        hospital: "Jan Swasthya Kendra",
        complaint: t("Sore throat and cold"),
        diagnosis: t("Acute pharyngitis"),
        medicines: [t("Amoxicillin 500mg – thrice a day for 5 days"), t("Cetirizine 10mg – at night"), t("Betadine gargle – twice a day")],
        notes: t("Avoid cold drinks and ice cream. Complete the full antibiotic course."),
        followUp: "12 Aug 2026",
      },
      {
        date: "10 Jul 2026",
        day: t("Friday"),
        doctor: "Dr. Sunita Verma",
        hospital: "Primary Health Centre",
        complaint: t("Sugar level check and routine follow-up"),
        diagnosis: t("Type 2 Diabetes – controlled"),
        medicines: [t("Metformin 500mg – twice a day"), t("Atorvastatin 10mg – at night"), t("Aspirin 75mg – once daily")],
        notes: t("HbA1c improved. Continue current diet and walking routine. Recheck after 3 months."),
        followUp: "10 Oct 2026",
      },
      {
        date: "18 Jun 2026",
        day: t("Thursday"),
        doctor: "Dr. Kavita Nair",
        hospital: "Community Hospital",
        complaint: t("Knee pain while walking"),
        diagnosis: t("Mild osteoarthritis – early stage"),
        medicines: [t("Diclofenac gel – apply twice a day"), t("Calcium + Vitamin D3 – once daily"), t("Physiotherapy – 3 sessions/week")],
        notes: t("Avoid stairs if possible. Do gentle knee exercises. Lose 3–4 kg to reduce joint pressure."),
        followUp: "18 Jul 2026",
      },
    ];

    return (
      <div className="relative min-h-screen flex flex-col px-6 py-12 pb-10">
        {/* Back */}
        <button
          onClick={() => { setExpandedVisit(null); setScreen("home"); }}
          className="flex items-center gap-2 text-base font-medium mb-2 w-fit"
          style={{ color: "#4a7aaa" }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16l-6-6 6-6" stroke="#4a7aaa" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("Back")}
        </button>

        {/* Title */}
        <div className="mt-4 mb-8">
          <h1 className="text-2xl font-bold" style={{ color: "#1a3a5c" }}>{t("Past Visits")}</h1>
          <p className="text-base mt-1" style={{ color: "#4a7aaa" }}>
            {t("Tap on a visit to view case sheet")}
          </p>
        </div>

        {/* Visit cards */}
        <div className="flex flex-col gap-4 w-full max-w-sm">
          {visits.map((v, i) => {
            const isOpen = expandedVisit === i;
            return (
              <div
                key={i}
                className="w-full rounded-2xl overflow-hidden transition-all"
                style={{ border: isOpen ? "2.5px solid #1a6fd4" : "2px solid #b8d8f8", background: "#f0f7ff" }}
              >
                {/* Card header — always visible */}
                <button
                  className="w-full flex items-center gap-4 px-5 py-5 text-left"
                  onClick={() => setExpandedVisit(isOpen ? null : i)}
                >
                  {/* Date badge */}
                  <div
                    className="flex flex-col items-center justify-center rounded-xl flex-shrink-0"
                    style={{ width: 52, height: 52, background: isOpen ? "#1a6fd4" : "#dbeeff" }}
                  >
                    <span className="text-lg font-bold leading-none" style={{ color: isOpen ? "#fff" : "#1a6fd4" }}>
                      {v.date.split(" ")[0]}
                    </span>
                    <span className="text-xs font-medium" style={{ color: isOpen ? "#cce4ff" : "#4a7aaa" }}>
                      {v.date.split(" ")[1]}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate" style={{ color: "#1a3a5c" }}>{v.doctor}</p>
                    <p className="text-sm truncate" style={{ color: "#4a7aaa" }}>{v.hospital}</p>
                    <p className="text-xs mt-1 truncate" style={{ color: "#7aadd4" }}>
                      {v.day} · {v.date.split(" ").slice(1).join(" ")}
                    </p>
                  </div>

                  {/* Chevron */}
                  <svg
                    width="20" height="20" viewBox="0 0 20 20" fill="none"
                    style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}
                  >
                    <path d="M7 4l6 6-6 6" stroke={isOpen ? "#1a6fd4" : "#b8d8f8"}
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {/* Expanded case sheet */}
                {isOpen && (
                  <div style={{ borderTop: "1.5px solid #dbeeff" }}>
                    <div className="px-5 py-5 flex flex-col gap-5">

                      {/* Complaint */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#7aadd4" }}>
                          {t("Complaint")}
                        </p>
                        <p className="text-base font-medium" style={{ color: "#1a3a5c" }}>{v.complaint}</p>
                      </div>

                      {/* Diagnosis */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#7aadd4" }}>
                          {t("Diagnosis")}
                        </p>
                        <p className="text-base font-medium" style={{ color: "#1a3a5c" }}>{v.diagnosis}</p>
                      </div>

                      {/* Medicines */}
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#7aadd4" }}>
                          {t("Medicines")}
                        </p>
                        <div className="flex flex-col gap-2">
                          {v.medicines.map((m, j) => (
                            <div key={j} className="flex items-start gap-2">
                              <span
                                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{ background: "#dbeeff" }}
                              >
                                <span className="text-xs font-bold" style={{ color: "#1a6fd4" }}>{j + 1}</span>
                              </span>
                              <p className="text-sm" style={{ color: "#1a3a5c" }}>{m}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Doctor notes */}
                      <div
                        className="rounded-xl px-4 py-3"
                        style={{ background: "#e8f4ff", border: "1.5px solid #b8d8f8" }}
                      >
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#7aadd4" }}>
                          {t("Doctor's Note")}
                        </p>
                        <p className="text-sm" style={{ color: "#1a3a5c" }}>{v.notes}</p>
                      </div>

                      {/* Follow-up */}
                      <div className="flex items-center gap-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="3" y="4" width="18" height="18" rx="3" stroke="#1a6fd4" strokeWidth="1.8" />
                          <line x1="3" y1="10" x2="21" y2="10" stroke="#1a6fd4" strokeWidth="1.8" />
                          <line x1="8" y1="2" x2="8" y2="6" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" />
                          <line x1="16" y1="2" x2="16" y2="6" stroke="#1a6fd4" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                        <p className="text-sm" style={{ color: "#4a7aaa" }}>
                          {t("Follow-up on")}{" "}
                          <span className="font-semibold" style={{ color: "#1a6fd4" }}>{v.followUp}</span>
                        </p>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-sm text-center" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ OTP ══════════════════ */
  if (screen === "otp") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
          style={{ background: "#dbeeff" }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="7" y="14" width="26" height="18" rx="3" fill="#1a6fd4" />
            <path d="M13 14v-3a7 7 0 0 1 14 0v3" stroke="#1a6fd4" strokeWidth="3"
              strokeLinecap="round" fill="none" />
            <circle cx="20" cy="23" r="2.5" fill="white" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-center mb-2" style={{ color: "#1a3a5c" }}>
          {t("Enter OTP")}
        </h1>
        <p className="text-base text-center mb-2" style={{ color: "#4a7aaa" }}>
          {t("A 4-digit code was sent to")}
        </p>
        <p className="text-lg font-semibold text-center mb-10" style={{ color: "#1a6fd4" }}>
          +91 {phone}
        </p>

        <form onSubmit={handleOtpSubmit} className="w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex gap-4 justify-center" onPaste={handleOtpPaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(i, e)}
                onFocus={onFocus}
                onBlur={(e) => onBlur(e, !!errors.otp)}
                className="w-16 h-16 text-center text-2xl font-bold rounded-2xl outline-none transition-all"
                style={errors.otp ? fieldError : fieldBase}
              />
            ))}
          </div>

          {errors.otp && (
            <p className="text-sm font-medium -mt-2" style={{ color: "#e05252" }}>
              ⚠ {t(errors.otp)}
            </p>
          )}

          <button
            type="submit"
            className="w-full py-5 rounded-2xl text-xl font-bold text-white transition-all active:scale-95 shadow-md"
            style={{ background: "#1a6fd4" }}
            onMouseOver={(e) => ((e.target as HTMLElement).style.background = "#155db8")}
            onMouseOut={(e) => ((e.target as HTMLElement).style.background = "#1a6fd4")}
          >
            {t("Verify OTP")}
          </button>
        </form>

        <div className="mt-8 text-center">
          {resendTimer > 0 ? (
            <p className="text-base" style={{ color: "#7aadd4" }}>
              {t("Resend OTP in")}{" "}
              <span className="font-semibold" style={{ color: "#1a6fd4" }}>{resendTimer}s</span>
            </p>
          ) : (
            <button
              onClick={() => { setOtp(["", "", "", ""]); setResendTimer(30); setTimeout(() => inputRefs.current[0]?.focus(), 50); }}
              className="text-base font-semibold underline"
              style={{ color: "#1a6fd4" }}
            >
              {t("Resend OTP")}
            </button>
          )}
        </div>

        <button
          onClick={() => setScreen("login")}
          className="mt-6 text-sm font-medium"
          style={{ color: "#7aadd4" }}
        >
          ← {t("Change phone number")}
        </button>

        <p className="mt-10 text-sm text-center max-w-xs" style={{ color: "#7aadd4" }}>
          {t("Need help? Call us at")}{" "}
          <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
            1800-123-4567
          </a>
        </p>
      </div>
    );
  }

  /* ══════════════════ LOGIN ══════════════════ */
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
        style={{ background: "#dbeeff" }}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="14" r="7" fill="#1a6fd4" />
          <path d="M6 34c0-7.732 6.268-14 14-14s14 6.268 14 14"
            stroke="#1a6fd4" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-center mb-2" style={{ color: "#1a3a5c" }}>
        {t("Login")}
      </h1>
      <p className="text-base text-center mb-10" style={{ color: "#4a7aaa" }}>
        {t("Please enter your details to continue")}
      </p>

      <form onSubmit={handleLoginSubmit} className="w-full max-w-sm flex flex-col gap-6" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-lg font-semibold" style={{ color: "#1a3a5c" }}>
            {t("Your Full Name")}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            placeholder={t("e.g. Ramesh Kumar")}
            inputMode="text"
            autoComplete="name"
            className="w-full text-lg px-5 py-4 rounded-2xl outline-none transition-all"
            style={errors.name ? fieldError : fieldBase}
            onFocus={onFocus}
            onBlur={(e) => onBlur(e, !!errors.name)}
          />
          {errors.name && (
            <p className="text-sm font-medium" style={{ color: "#e05252" }}>⚠ {t(errors.name)}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="phone" className="text-lg font-semibold" style={{ color: "#1a3a5c" }}>
            {t("Mobile Number")}
          </label>
          <input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 10);
              setPhone(val);
              setErrors((p) => ({ ...p, phone: undefined }));
            }}
            placeholder={t("e.g. 9876543210")}
            inputMode="numeric"
            autoComplete="tel"
            maxLength={10}
            className="w-full text-lg px-5 py-4 rounded-2xl outline-none transition-all"
            style={{ ...(errors.phone ? fieldError : fieldBase), letterSpacing: "0.08em" }}
            onFocus={onFocus}
            onBlur={(e) => onBlur(e, !!errors.phone)}
          />
          {errors.phone && (
            <p className="text-sm font-medium" style={{ color: "#e05252" }}>⚠ {t(errors.phone)}</p>
          )}
        </div>

        <button
          type="submit"
          className="w-full py-5 rounded-2xl text-xl font-bold text-white mt-2 transition-all active:scale-95 shadow-md"
          style={{ background: "#1a6fd4" }}
          onMouseOver={(e) => ((e.target as HTMLElement).style.background = "#155db8")}
          onMouseOut={(e) => ((e.target as HTMLElement).style.background = "#1a6fd4")}
        >
          {t("Send OTP")}
        </button>
      </form>

      <p className="mt-10 text-sm text-center max-w-xs" style={{ color: "#7aadd4" }}>
        {t("Need help? Call us at")}{" "}
        <a href="tel:18001234567" className="font-semibold underline" style={{ color: "#1a6fd4" }}>
          1800-123-4567
        </a>
      </p>
    </div>
  );
}
