import React, { useState, useEffect, useRef } from "react";

export interface SlotData {
  name: string;
  description: string;
  value: string | null;
  confidence: number;
  source: "asked" | "observed" | "unfilled" | "clinician_only";
}

export interface CandidatePatternRemaining {
  pattern_id: string;
  name: string;
  description: string;
  still_consistent: boolean;
  namaste_code_hint?: string;
  clinical_disclaimer: string;
}

export interface IntakeReportData {
  session_id: string;
  patient_language_used: string;
  chief_complaint: {
    raw: string;
    cleaned: string;
  };
  slots_filled_by_patient: Record<string, SlotData>;
  slots_filled_by_doctor_ocr: Record<string, SlotData>;
  candidate_patterns_remaining: CandidatePatternRemaining[];
  red_flag_status: boolean;
  questions_asked: number;
  full_qa_transcript: Array<{ question: string; answer: string }>;
  summary_for_doctor: string;
  status: string;
}

interface Message {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  timestamp: string;
}

const API_BASE = "http://localhost:8001/api/intake";

// Language BCP-47 tags for Web Speech Synthesis
const BCP47_TAG_MAP: Record<string, string> = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  ta: "ta-IN",
  bn: "bn-IN",
  te: "te-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  pa: "pa-IN",
};

export default function IntakeChatUI({ onBack }: { onBack: () => void }) {
  const [viewMode, setViewMode] = useState<"patient" | "doctor">("patient");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [patientLanguage, setPatientLanguage] = useState<string>("auto");
  const [detectedLangName, setDetectedLangName] = useState<string | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [questionsCount, setQuestionsCount] = useState(0);
  const [intakeReport, setIntakeReport] = useState<IntakeReportData | null>(null);
  const [targetSlot, setTargetSlot] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [ocrUploading, setOcrUploading] = useState(false);
  const [ocrSuccessMsg, setOcrSuccessMsg] = useState<string | null>(null);
  const [ttsUnavailable, setTtsUnavailable] = useState<string | null>(null);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSpeakText = (msgId: string, text: string) => {
    if (!("speechSynthesis" in window)) {
      setTtsUnavailable("Speech synthesis not supported on this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }

    const langCode = (patientLanguage === "auto" ? "hi" : patientLanguage).toLowerCase();
    const bcp47 = BCP47_TAG_MAP[langCode] || "hi-IN";

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = bcp47;

    const availableVoices = window.speechSynthesis.getVoices();
    const voiceMatch = availableVoices.find((v) => v.lang.startsWith(langCode) || v.lang === bcp47);

    if (!voiceMatch && availableVoices.length > 0) {
      setTtsUnavailable(`voice not available for ${langCode.toUpperCase()} (${bcp47}) on this device`);
    } else {
      setTtsUnavailable(null);
      if (voiceMatch) utterance.voice = voiceMatch;
    }

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleMicClick = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Web Speech API is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    const langCode = patientLanguage === "auto" ? "hi" : patientLanguage;
    recognition.lang = BCP47_TAG_MAP[langCode] || "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
    };

    recognition.start();
  };

  const handleStartSession = async (complaintText?: string) => {
    const textToSubmit = complaintText || chiefComplaint.trim();
    if (!textToSubmit) return;

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_language: patientLanguage,
          chief_complaint: textToSubmit,
        }),
      });

      const data = await res.json();
      setSessionId(data.session_id);
      setSessionStarted(true);
      setEmergencyMode(!!data.emergency_mode);
      if (data.detected_language_name) setDetectedLangName(data.detected_language_name);
      if (data.patient_language) setPatientLanguage(data.patient_language);

      const newMsgs: Message[] = [
        {
          id: "1",
          sender: "user",
          text: textToSubmit,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        {
          id: "2",
          sender: "bot",
          text: data.response_to_patient,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ];

      setMessages(newMsgs);
      setTargetSlot(data.target_slot || null);
      setQuestionsCount(1);

      if (data.intake_report) {
        setIntakeReport(data.intake_report);
      } else {
        fetchReport(data.session_id);
      }
    } catch (err) {
      console.error(err);
      alert("Having trouble connecting — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !sessionId || isLoading || emergencyMode || isCompleted) return;

    const userText = inputMessage.trim();
    setInputMessage("");

    const userMsgObj: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsgObj]);
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          patient_message: userText,
        }),
      });

      const data = await res.json();
      setEmergencyMode(!!data.emergency_mode);
      setIsCompleted(!!data.is_completed);
      if (data.questions_asked_count) setQuestionsCount(data.questions_asked_count);

      const botMsgObj: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: data.response_to_patient,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsgObj]);
      if (data.target_slot) setTargetSlot(data.target_slot);

      if (data.intake_report) {
        setIntakeReport(data.intake_report);
      } else {
        fetchReport(sessionId);
      }
    } catch (err) {
      console.error(err);
      alert("Having trouble connecting — please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReport = async (sid: string) => {
    try {
      const res = await fetch(`${API_BASE}/session/${sid}`);
      const data = await res.json();
      if (data.intake_report) {
        setIntakeReport(data.intake_report);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !sessionId) return;

    setOcrUploading(true);
    setOcrSuccessMsg(null);

    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/ocr`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.intake_report) {
        setIntakeReport(data.intake_report);
        setOcrSuccessMsg("Handwritten case-sheet successfully digitized & merged into Intake Report!");
      }
    } catch (err) {
      console.error(err);
      alert("Having trouble connecting — please try again.");
    } finally {
      setOcrUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-xs font-semibold"
          >
            ← Back
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg text-emerald-400">SIH26047</span>
              <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                Ministry of Ayush Engine
              </span>
            </div>
            <p className="text-xs text-slate-400">AI Patient Intake & OCR Case-Sheet Digitizer</p>
          </div>
        </div>

        {/* View Mode Toggle & Language Selector */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-700">
            <button
              onClick={() => setViewMode("patient")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "patient"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              💬 Patient Intake (Half A)
            </button>
            <button
              onClick={() => {
                if (sessionId) fetchReport(sessionId);
                setViewMode("doctor");
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "doctor"
                  ? "bg-blue-600 text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              📋 Doctor Report View (Half A + B)
            </button>
          </div>

          {!sessionStarted && (
            <select
              value={patientLanguage}
              onChange={(e) => setPatientLanguage(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="auto">🌐 Auto-detect Language</option>
              <option value="hi">हिंदी (Hindi)</option>
              <option value="en">English</option>
              <option value="mr">मराठी (Marathi)</option>
              <option value="ta">தமிழ் (Tamil)</option>
              <option value="bn">বাংলা (Bengali)</option>
              <option value="te">తెలుగు (Telugu)</option>
              <option value="gu">ગુજરાતી (Gujarati)</option>
              <option value="kn">ಕನ್ನಡ (Kannada)</option>
              <option value="ml">മലയാളം (Malayalam)</option>
              <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
            </select>
          )}
        </div>
      </header>

      {/* Red-Flag Banner */}
      {emergencyMode && (
        <div className="bg-red-950/90 border-b border-red-800 text-red-200 px-6 py-3 flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚨</span>
            <div>
              <p className="font-bold text-sm">RED FLAG EMERGENCY TRIGGERED</p>
              <p className="text-xs text-red-300">
                Acute distress detected via deterministic gate. Intake halted immediately. Direct patient to emergency services (102 / 108).
              </p>
            </div>
          </div>
          <button
            onClick={() => setViewMode("doctor")}
            className="bg-red-700 hover:bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold"
          >
            View Handoff Report
          </button>
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
      {viewMode === "patient" ? (
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-between">
          {!sessionStarted ? (
            /* INITIAL INTAKE START SCREEN */
            <div className="my-auto py-10 px-6 bg-slate-900/60 border border-slate-800 rounded-3xl shadow-xl backdrop-blur">
              <div className="max-w-xl mx-auto text-center">
                <div className="w-16 h-16 bg-emerald-950 border border-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                  🌿
                </div>
                <h1 className="text-2xl font-bold text-slate-100 mb-2">
                  Ayurvedic Patient Case Intake
                </h1>
                <p className="text-slate-400 text-sm mb-6">
                  Simple conversational intake filling Ashtavidha + Dashavidha Pariksha slots.
                  Enter chief complaint in any Indian language or script below.
                </p>

                {/* Judge Demo Script Shortcuts */}
                <div className="mb-6 flex flex-wrap gap-2 justify-center">
                  <span className="text-xs text-slate-500 w-full mb-1">Judge Demo Multi-Language Presets:</span>
                  <button
                    onClick={() => {
                      setChiefComplaint("I have severe acidity, heartburn, and stomach pain after eating.");
                      handleStartSession("I have severe acidity, heartburn, and stomach pain after eating.");
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-full px-3 py-1 transition-all"
                  >
                    🇬🇧 English Acidity
                  </button>
                  <button
                    onClick={() => {
                      setChiefComplaint("पेट में जलन और खट्टी डकार आती है।");
                      handleStartSession("पेट में जलन और खट्टी डकार आती है।");
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-full px-3 py-1 transition-all"
                  >
                    🇮🇳 Hindi (हिंदी)
                  </button>
                  <button
                    onClick={() => {
                      setChiefComplaint("पोटात जळजळ आणि आंबट ढेकर येतात.");
                      handleStartSession("पोटात जळजळ आणि आंबट ढेकर येतात.");
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-full px-3 py-1 transition-all"
                  >
                    🚩 Marathi (मराठी)
                  </button>
                  <button
                    onClick={() => {
                      setChiefComplaint("வயிற்றில் எரிச்சல் மற்றும் புளிப்பு ஏப்பம் வருகிறது.");
                      handleStartSession("வயிற்றில் எரிச்சல் மற்றும் புளிப்பு ஏப்பம் வருகிறது.");
                    }}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 rounded-full px-3 py-1 transition-all"
                  >
                    🏝️ Tamil (தமிழ்)
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chiefComplaint}
                    onChange={(e) => setChiefComplaint(e.target.value)}
                    placeholder="Enter health concern in any language / अपनी समस्या लिखें..."
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-base"
                    onKeyDown={(e) => e.key === "Enter" && handleStartSession()}
                  />
                  <button
                    onClick={() => handleStartSession()}
                    disabled={!chiefComplaint.trim() || isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-4 rounded-2xl disabled:opacity-50 transition-all flex items-center gap-2"
                  >
                    Start Intake →
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE CHAT SCREEN */
            <div className="flex-1 flex flex-col justify-between h-[calc(100vh-140px)]">
              {/* Header Status Bar */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 mb-4 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-slate-400">
                    Questions Budget: <strong className="text-emerald-400">{questionsCount} / 5</strong>
                  </span>
                  {detectedLangName && (
                    <span className="text-emerald-300 border-l border-slate-700 pl-4 font-medium flex items-center gap-1">
                      🌐 Detected Language: <strong>{detectedLangName}</strong>
                    </span>
                  )}
                  {targetSlot && (
                    <span className="text-slate-400 border-l border-slate-700 pl-4">
                      Target Slot: <code className="text-blue-300 bg-slate-800 px-2 py-0.5 rounded font-mono">{targetSlot}</code>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="text-slate-400 font-mono text-[10px]">SESSION: {sessionId?.slice(0, 8)}...</span>
                </div>
              </div>

              {/* TTS Availability Badge Warning */}
              {ttsUnavailable && (
                <div className="mb-2 px-3 py-1.5 bg-amber-950/80 border border-amber-800/80 text-amber-300 rounded-xl text-xs flex items-center justify-between">
                  <span>⚠️ Read-Aloud Note: {ttsUnavailable}</span>
                  <button onClick={() => setTtsUnavailable(null)} className="text-amber-400 font-bold ml-2">✕</button>
                </div>
              )}

              {/* Chat Stream */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-800">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-3xl p-4 shadow-md ${
                        msg.sender === "user"
                          ? "bg-emerald-600 text-white rounded-br-none"
                          : "bg-slate-900 border border-slate-800 text-slate-100 rounded-bl-none"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1 border-b border-white/10 pb-1">
                        <span className="text-[10px] font-bold tracking-wider uppercase opacity-75">
                          {msg.sender === "user" ? "Patient" : "Ayush Intake Assistant"}
                        </span>
                        <div className="flex items-center gap-2">
                          {msg.sender === "bot" && (
                            <button
                              onClick={() => handleSpeakText(msg.id, msg.text)}
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                                speakingMsgId === msg.id
                                  ? "bg-emerald-500 text-white animate-pulse"
                                  : "bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700"
                              }`}
                              title="Read-Aloud TTS Output for Low-Literacy Patients"
                            >
                              🔊 {speakingMsgId === msg.id ? "Speaking..." : "Listen"}
                            </button>
                          )}
                          <span className="text-[9px] opacity-60 font-mono">{msg.timestamp}</span>
                        </div>
                      </div>
                      <p className="text-base leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-slate-900 border border-slate-800 text-slate-400 rounded-3xl rounded-bl-none px-5 py-3 flex items-center gap-3">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></span>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></span>
                      </div>
                      <span className="text-xs font-medium">Narrowing patterns & formulating target question...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMicClick}
                  className={`p-4 rounded-2xl border transition-all ${
                    isListening
                      ? "bg-red-600 border-red-500 text-white animate-pulse"
                      : "bg-slate-900 border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-slate-700"
                  }`}
                  title="Web Speech API Voice Input"
                >
                  🎙️
                </button>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder={
                    isListening
                      ? "Listening to voice input..."
                      : emergencyMode || isCompleted
                      ? "Intake completed. View report in Doctor View above."
                      : "Type your answer in any language / उत्तर लिखें..."
                  }
                  disabled={isLoading || emergencyMode || isCompleted}
                  className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 disabled:opacity-50 text-base"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || isLoading || emergencyMode || isCompleted}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-4 rounded-2xl disabled:opacity-50 transition-all"
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        /* DOCTOR REPORT VIEW (FOR JUDGES) */
        <div className="flex-1 max-w-6xl w-full mx-auto p-6 overflow-y-auto">
          {/* Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-100">Structured Intake Report</h2>
                <span className="bg-blue-950 border border-blue-800 text-blue-300 text-xs px-3 py-1 rounded-full font-mono">
                  DOCTOR CLINICAL HANDOFF
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Unified Data Record: Half A (Patient Conversational Intake) + Half B (Doctor OCR Case-Sheet Digitizer)
              </p>
            </div>

            {/* OCR Upload Button */}
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleOcrUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrUploading || !sessionId}
                className="bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                📸 {ocrUploading ? "Digitizing Case Sheet..." : "Upload Handwritten Case-Sheet (OCR)"}
              </button>
            </div>
          </div>

          {ocrSuccessMsg && (
            <div className="mb-6 p-4 bg-emerald-950/80 border border-emerald-800 text-emerald-300 rounded-2xl text-sm flex items-center gap-2">
              <span>✅</span> {ocrSuccessMsg}
            </div>
          )}

          {intakeReport ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Chief Complaint & Candidate Patterns */}
              <div className="space-y-6">
                {/* Chief Complaint Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Chief Complaint & Language
                  </h3>
                  <p className="text-base font-semibold text-emerald-400 mb-1">
                    Raw: "{intakeReport.chief_complaint.raw}"
                  </p>
                  <span className="text-xs bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded font-mono">
                    Language Used: {intakeReport.patient_language_used}
                  </span>
                </div>

                {/* Candidate Differential Patterns with NAMASTE hints */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Differential Patterns</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Narrowing Engine</span>
                  </h3>
                  <div className="space-y-3">
                    {intakeReport.candidate_patterns_remaining.map((p) => (
                      <div
                        key={p.pattern_id}
                        className="p-3 bg-slate-800/90 border border-emerald-800/80 rounded-2xl text-xs text-slate-200"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold">{p.name}</span>
                          <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded text-[9px] font-mono">
                            CONSISTENT
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">{p.description}</p>
                        
                        {/* NAMASTE / ICD-11 Mapping Badge */}
                        {p.namaste_code_hint && (
                          <div className="mb-2 bg-blue-950/80 text-blue-300 border border-blue-800 px-2 py-1 rounded text-[10px] font-mono">
                            🏛️ {p.namaste_code_hint}
                          </div>
                        )}

                        <span className="text-[9px] bg-slate-900 text-amber-300 border border-amber-900 px-2 py-0.5 rounded font-mono block text-center">
                          {p.clinical_disclaimer}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Doctor Note Summary */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Doctor Summary
                  </h3>
                  <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap bg-slate-950 p-3 rounded-xl border border-slate-800">
                    {intakeReport.summary_for_doctor}
                  </pre>
                </div>
              </div>

              {/* Center & Right Column: Slots Checklist */}
              <div className="lg:col-span-2 space-y-6">
                {/* Slots Filled by Patient (Half A) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>Patient Self-Reported Slots (Half A)</span>
                    <span className="text-xs text-emerald-400 font-mono">slots_filled_by_patient</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(intakeReport.slots_filled_by_patient).map(([key, slot]) => (
                      <div
                        key={key}
                        className={`p-4 rounded-2xl border text-xs ${
                          slot.value
                            ? "bg-emerald-950/40 border-emerald-800/80 text-emerald-100"
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{slot.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              slot.value ? "bg-emerald-900 text-emerald-300" : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {slot.value ? "ASKED & FILLED" : "UNFILLED"}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">{slot.description}</p>
                        <p className="text-sm font-medium text-slate-100">
                          {slot.value ? `"${slot.value}"` : <em className="text-slate-600">Pending patient response</em>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Slots Filled by Doctor OCR (Half B) */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center justify-between">
                    <span>Clinician Exam & OCR Observed Slots (Half B)</span>
                    <span className="text-xs text-blue-400 font-mono">slots_filled_by_doctor_ocr</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(intakeReport.slots_filled_by_doctor_ocr).map(([key, slot]) => (
                      <div
                        key={key}
                        className={`p-4 rounded-2xl border text-xs ${
                          slot.source === "observed"
                            ? "bg-blue-950/40 border-blue-800/80 text-blue-100"
                            : "bg-slate-950 border-slate-800 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-200">{slot.name}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              slot.source === "observed"
                                ? "bg-blue-900 text-blue-300"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {slot.source.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-2">{slot.description}</p>
                        <p className="text-sm font-medium text-slate-100">
                          {slot.value ? `"${slot.value}"` : <em className="text-slate-600">Doctor physical exam needed</em>}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Judging Criteria Highlight Card */}
                <div className="bg-gradient-to-r from-emerald-950/80 to-blue-950/80 border border-emerald-800/80 rounded-3xl p-5 shadow text-xs">
                  <h3 className="font-bold text-emerald-300 uppercase tracking-wider mb-3">
                    🏆 Judging Rationale & Architectural Strengths (SIH26047)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <p className="font-bold text-slate-200">1. Novel State Object Reasoning</p>
                      <p className="text-slate-400 text-[11px] mt-1">
                        Digitizes diagnostic reasoning (state + pattern narrowing) rather than static paperwork forms.
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <p className="font-bold text-slate-200">2. Deterministic Safety Gate</p>
                      <p className="text-slate-400 text-[11px] mt-1">
                        Red-flag emergency check & question cap are enforced in pure code, preventing LLM hallucinated diagnoses.
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <p className="font-bold text-slate-200">3. Unified Schema Feasibility</p>
                      <p className="text-slate-400 text-[11px] mt-1">
                        One single <code className="text-blue-300">IntakeReport</code> data model for both patient chat (Half A) and OCR (Half B).
                      </p>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                      <p className="font-bold text-slate-200">4. National Standards Alignment</p>
                      <p className="text-slate-400 text-[11px] mt-1">
                        Structured slot output scoped to map directly into NAMASTE, ICD-11 TM2, and ABDM interoperability.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Raw JSON Inspector */}
                <details className="bg-slate-900 border border-slate-800 rounded-3xl p-5">
                  <summary className="text-xs font-bold text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-200">
                    🔍 Raw IntakeReport JSON (Judge Inspection)
                  </summary>
                  <pre className="mt-3 bg-slate-950 p-4 rounded-2xl border border-slate-800 text-emerald-400 text-xs font-mono overflow-x-auto max-h-80 scrollbar-thin">
                    {JSON.stringify(intakeReport, null, 2)}
                  </pre>
                </details>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400">
              <p className="text-lg">No active intake session report found.</p>
              <p className="text-xs text-slate-500 mt-1">Start an intake session from the Patient Chat view to generate a report.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
