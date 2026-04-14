import { useState, useEffect, useMemo, Component, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import { 
  Calendar, 
  Clock, 
  User, 
  Phone, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight, 
  Settings, 
  Plus, 
  Trash2, 
  ArrowLeft,
  BookOpen,
  Check,
  X,
  LogOut,
  AlertCircle
} from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  eachDayOfInterval,
  isSameDay,
  addMinutes,
  isPast,
  isBefore,
  startOfToday,
  setHours,
  setMinutes,
  addHours
} from "date-fns";
import { TZDate } from "@date-fns/tz";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  query, 
  where,
  getDoc,
  setDoc,
  serverTimestamp,
  getDocFromServer
} from "firebase/firestore";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { db, auth, OperationType, handleFirestoreError } from "./firebase";
import { TimeSlot, Availability, Appointment, AdminSettings, AppointmentTag } from "./types";

// Error Boundary Component
class ErrorBoundary extends Component<any, any> {
  constructor(props: any) {
    super(props);
    // @ts-ignore
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        // @ts-ignore
        const parsed = JSON.parse(this.state.error.message);
        errorMessage = parsed.error || errorMessage;
      } catch (e) {
        // @ts-ignore
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Oops!</h1>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    // @ts-ignore
    return this.props.children;
  }
}

const BookLogo = ({ size = "sm" }: { size?: "sm" | "lg" }) => {
  const s = size === "lg" ? 48 : 24;
  return (
    <svg 
      width={s} 
      height={s} 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm"
    >
      <defs>
        <clipPath id="leftPage">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        </clipPath>
        <clipPath id="rightPage">
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </clipPath>
      </defs>
      
      {/* Left Page - Transparent */}
      <g clipPath="url(#leftPage)">
        <rect x="2" y="3" width="10" height="18" fill="none" />
      </g>
      
      {/* Right Page - USA */}
      <g clipPath="url(#rightPage)">
        <rect x="12" y="3" width="10" height="18" fill="white" />
        <rect x="12" y="3" width="10" height="1.5" fill="#b22234" />
        <rect x="12" y="6" width="10" height="1.5" fill="#b22234" />
        <rect x="12" y="9" width="10" height="1.5" fill="#b22234" />
        <rect x="12" y="12" width="10" height="1.5" fill="#b22234" />
        <rect x="12" y="15" width="10" height="1.5" fill="#b22234" />
        <rect x="12" y="18" width="10" height="1.5" fill="#b22234" />
        
        <rect x="12" y="3" width="5" height="6" fill="#3c3b6e" />
        {/* USA Stars */}
        <circle cx="13.5" cy="4.5" r="0.25" fill="white" />
        <circle cx="15.5" cy="4.5" r="0.25" fill="white" />
        <circle cx="14.5" cy="6" r="0.25" fill="white" />
        <circle cx="13.5" cy="7.5" r="0.25" fill="white" />
        <circle cx="15.5" cy="7.5" r="0.25" fill="white" />
      </g>
      
      {/* Outline with blue stroke to match UI */}
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

function SchedulingApp() {
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    fetch("https://ipapi.co/timezone/")
      .then(r => r.text())
      .then(detected => { if (detected && detected.includes("/")) setTz(detected); })
      .catch(() => {});
  }, []);

  const nowLocal = () => new TZDate(new Date(), tz);
  const toLocal = (date: Date) => new TZDate(date, tz);
  const localToUtc = (localDay: number, localHour: number) => {
    const base = nowLocal();
    const target = setMinutes(setHours(addDays(startOfWeek(base, { weekStartsOn: 0 }), localDay), localHour), 0);
    return { day: target.getUTCDay(), hour: target.getUTCHours() };
  };

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    const ts = localStorage.getItem("adminSessionTs");
    return ts ? Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000 : false;
  });
  const [view, setView] = useState<"student" | "admin">(() => {
    const ts = localStorage.getItem("adminSessionTs");
    return ts && Date.now() - Number(ts) < 7 * 24 * 60 * 60 * 1000 ? "admin" : "student";
  });
  const [adminTab, setAdminTab] = useState<"schedule" | "availability" | "history" | "settings">("schedule");
  const [historyMonth, setHistoryMonth] = useState<number>(new Date().getMonth());
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointmentId: string } | null>(null);

  const tagStyles: Record<string, string> = {
    trial: "bg-amber-50 border-amber-200 text-amber-800",
    "no-show": "bg-red-50 border-red-200 text-red-700",
    complete: "bg-green-50 border-green-200 text-green-700",
    default: "bg-blue-50 border-blue-100 text-blue-700",
  };

  const setAppointmentTag = async (id: string, tag: AppointmentTag | null) => {
    try {
      await updateDoc(doc(db, "appointments", id), { tag: tag ?? null });
      toast.success(tag ? `Marked as ${tag}` : "Tag cleared");
    } catch (error) {
      toast.error("Failed to update");
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
    setContextMenu(null);
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    meetingDurationMinutes: 30,
    googleCalendarConnected: false,
  });
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [step, setStep] = useState<"info" | "schedule" | "success">("info");
  const [studentInfo, setStudentInfo] = useState({ name: "", phone: "" });
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          toast.error("Firebase connection failed. Please check your configuration.");
        }
      }
    };
    testConnection();
  }, []);

  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    testConnection();

    const unsubAvail = onSnapshot(collection(db, "availability"), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Availability));
      setAvailability(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "availability"));

    const unsubApp = onSnapshot(collection(db, "appointments"), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          startTime: toLocal(new Date(d.startTime)),
          endTime: toLocal(new Date(d.endTime))
        } as Appointment;
      });
      setAppointments(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "appointments"));

    const unsubSettings = onSnapshot(doc(db, "settings", "admin"), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as AdminSettings;
        setAdminSettings(prev => ({ ...prev, ...data }));
      }
    }, () => {});

    return () => {
      unsubAvail();
      unsubApp();
      unsubSettings();
    };
  }, []);

  const saveAdminSettings = async (updates: Partial<AdminSettings>) => {
    try {
      await setDoc(doc(db, "settings", "admin"), { ...adminSettings, ...updates }, { merge: true });
      setAdminSettings(prev => ({ ...prev, ...updates }));
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const connectGoogleCalendar = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error("Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to .env");
      return;
    }
    const redirectUri = window.location.origin;
    const scope = "https://www.googleapis.com/auth/calendar.events";
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=consent&access_type=offline`;
    window.location.href = url;
  };

  // Handle Google OAuth callback
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const expiresIn = params.get("expires_in");
      if (accessToken) {
        const expiry = Date.now() + Number(expiresIn || 3600) * 1000;
        saveAdminSettings({
          googleCalendarConnected: true,
          googleAccessToken: accessToken,
          googleTokenExpiry: expiry,
        });
        window.history.replaceState(null, "", window.location.pathname);
        toast.success("Google Calendar connected!");
      }
    }
  }, []);

  const addToGoogleCalendar = async (studentName: string, start: Date, end: Date) => {
    if (!adminSettings.googleCalendarConnected || !adminSettings.googleAccessToken) return;
    if (adminSettings.googleTokenExpiry && Date.now() > adminSettings.googleTokenExpiry) {
      toast.error("Google Calendar token expired. Please reconnect in Settings.");
      return;
    }
    try {
      const event = {
        summary: `English Class - ${studentName}`,
        start: { dateTime: start.toISOString(), timeZone: tz },
        end: { dateTime: end.toISOString(), timeZone: tz },
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 15 }] },
      };
      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${adminSettings.googleAccessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        console.log("Google Calendar event created");
      } else {
        console.error("Failed to create calendar event:", await res.text());
      }
    } catch (e) {
      console.error("Google Calendar error:", e);
    }
  };

  const handleAdminAccess = () => {
    if (isAdminLoggedIn) {
      setView(view === "student" ? "admin" : "student");
    } else {
      setLoginEmail("");
      setLoginPassword("");
      setLoginError("");
      setShowLoginModal(true);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginEmail === "lucaspinheirofab@gmail.com" && loginPassword === "AirbusA320#") {
      setIsAdminLoggedIn(true);
      setView("admin");
      setShowLoginModal(false);
      localStorage.setItem("adminSessionTs", String(Date.now()));
    } else {
      setLoginError("Invalid email or password");
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setView("student");
    localStorage.removeItem("adminSessionTs");
  };

  const weekDays = useMemo(() => {
    const now = nowLocal();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    // Show next week too on Thu(4), Fri(5), Sat(6), Sun(0)
    const showNextWeek = dayOfWeek === 0 || dayOfWeek >= 4;
    const allDays = eachDayOfInterval({
      start,
      end: addDays(start, showNextWeek ? 13 : 6)
    });
    return allDays.filter(day => day >= today);
  }, [tz]);

  const generateTimeSlots = (date: Date) => {
    const tzDate = toLocal(date);
    const slots: Date[] = [];
    for (let h = 0; h < 24; h++) {
      const slotDate = setMinutes(setHours(tzDate, h), 0);
      const utcDay = slotDate.getUTCDay();
      const utcHour = slotDate.getUTCHours();

      if (availability.some(a => a.dayOfWeek === utcDay && a.hour === utcHour)) {
        if (!isBefore(slotDate, addHours(new Date(), 12))) {
          slots.push(slotDate);
        }
      }
    }
    return slots;
  };

  const availableSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate, availability, tz]);

  const handleSchedule = async () => {
    if (!selectedSlot || !studentInfo.name || !studentInfo.phone) return;

    const path = "appointments";
    const duration = adminSettings.meetingDurationMinutes || 30;
    const endTime = addMinutes(selectedSlot, duration);
    try {
      await addDoc(collection(db, path), {
        studentName: studentInfo.name,
        studentPhone: studentInfo.phone,
        startTime: selectedSlot.toISOString(),
        endTime: endTime.toISOString(),
        status: "booked",
        createdAt: serverTimestamp()
      });

      // Add to Google Calendar if connected
      await addToGoogleCalendar(studentInfo.name, selectedSlot, endTime);

      // WhatsApp Notification
      const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(selectedSlot).find(p => p.type === "timeZoneName")?.value || tz;
      const message = `Hey Lucas, this time and date suits me ${format(selectedSlot, "EEEE, d MMMM").toLowerCase()} at ${format(selectedSlot, "HH:mm")} (${tzAbbr})`;
      const waUrl = `https://wa.me/5592981432135?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");

      setStep("success");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const isSlotBooked = (date: Date) => {
    return appointments.some(a => isSameDay(a.startTime, date) && a.startTime.getTime() === date.getTime() && a.status === "booked");
  };

  const removeAppointment = async (id: string) => {
    const path = `appointments/${id}`;
    try {
      await deleteDoc(doc(db, "appointments", id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const [pendingSlots, setPendingSlots] = useState<Set<string>>(new Set());

  const toggleAvailability = async (localDay: number, localHour: number) => {
    const slotKey = `${localDay}-${localHour}`;
    if (pendingSlots.has(slotKey)) return;

    const { day: utcDay, hour: utcHour } = localToUtc(localDay, localHour);
    const existing = availability.find(a => a.dayOfWeek === utcDay && a.hour === utcHour);
    const path = "availability";

    setPendingSlots(prev => new Set(prev).add(slotKey));

    try {
      if (existing) {
        await deleteDoc(doc(db, path, existing.id));
      } else {
        await addDoc(collection(db, path), {
          dayOfWeek: utcDay,
          hour: utcHour
        });
      }
      toast.success("Availability updated", { id: "availability-update" });
    } catch (error) {
      toast.error("Failed to update availability");
      handleFirestoreError(error, OperationType.WRITE, path);
    } finally {
      setPendingSlots(prev => {
        const next = new Set(prev);
        next.delete(slotKey);
        return next;
      });
    }
  };

  if (view === "student" && step === "info" && !studentInfo.name && !studentInfo.phone && false) {
    // This block is removed as we don't want a separate login screen anymore
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <BookLogo size="sm" />
          <span className="hidden sm:inline">English with Lucas</span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleAdminAccess}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors"
          >
            {view === "student" ? <Settings className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {view === "student" ? "Admin" : "Student View"}
          </button>
          {isAdminLoggedIn && (
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {view === "student" ? (
          <div className="space-y-8">
            {step === "info" && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 p-8 md:p-12 max-w-md mx-auto text-center"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <BookLogo size="lg" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
                <p className="text-slate-500 mb-8">Please enter your details to view available times for your English class.</p>
                
                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        value={studentInfo.name}
                        onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                        placeholder="Your Name"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">WhatsApp / Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="tel" 
                        value={studentInfo.phone}
                        onChange={(e) => setStudentInfo({ ...studentInfo, phone: e.target.value })}
                        placeholder="Your WhatsApp number"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button 
                    disabled={!studentInfo.name || !studentInfo.phone}
                    onClick={() => setStep("schedule")}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all mt-4"
                  >
                    Continue to Schedule
                  </button>
                </div>
              </motion.div>
            )}

            {step === "schedule" && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setStep("info")}
                    className="p-2 hover:bg-white rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="text-center">
                    <h1 className="text-2xl font-bold">Pick a Time</h1>
                    <p className="text-[11px] text-slate-400 mt-1">All times shown in your timezone · {tz}</p>
                  </div>
                  <div className="w-10" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                  {weekDays.map((day, i) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, nowLocal());
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(day)}
                        className={`flex-shrink-0 w-20 py-4 rounded-2xl border transition-all ${
                          isSelected 
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        <div className="text-[10px] font-bold uppercase tracking-widest mb-1 opacity-70">
                          {format(day, "EEE")}
                        </div>
                        <div className="text-xl font-bold">
                          {format(day, "d")}
                        </div>
                        {isToday && !isSelected && <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-1" />}
                      </button>
                    );
                  })}
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Available Slots
                  </h2>
                  
                  {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {availableSlots.map((slot, i) => {
                        const booked = isSlotBooked(slot);
                        const selected = selectedSlot?.getTime() === slot.getTime();
                        return (
                          <button
                            key={i}
                            disabled={booked}
                            onClick={() => setSelectedSlot(slot)}
                            className={`py-3 px-4 rounded-xl border text-sm font-bold transition-all ${
                              booked 
                                ? "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through" 
                                : selected
                                  ? "bg-blue-50 border-blue-600 text-blue-600 ring-2 ring-blue-100"
                                  : "bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600"
                            }`}
                          >
                            {format(slot, "HH:mm")}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No availability for this day.</p>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {selectedSlot && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="fixed bottom-8 left-6 right-6 max-w-4xl mx-auto"
                    >
                      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl">
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/10 rounded-xl">
                              <Calendar className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Confirm Class</div>
                              <div className="font-bold">{format(selectedSlot, "EEEE, MMMM do")} at {format(selectedSlot, "HH:mm")}</div>
                            </div>
                          </div>
                          <button
                            onClick={handleSchedule}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            Book Now
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed text-center sm:text-left">
                          Ao agendar, você concorda em enviar uma confirmação pelo WhatsApp até 1 hora antes da aula. Sem confirmação, a aula será reagendada. Em caso de não comparecimento nos primeiros 10 minutos, a aula será cancelada e precisará ser remarcada.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-xl p-12 max-w-md mx-auto text-center"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold mb-4">Booked!</h1>
                <p className="text-slate-500 mb-8 leading-relaxed">
                  Your English class is scheduled for <span className="font-bold text-slate-900">{format(selectedSlot!, "EEEE, MMMM do")}</span> at <span className="font-bold text-slate-900">{format(selectedSlot!, "HH:mm")}</span>.
                </p>
                <p className="text-xs text-slate-400 mb-4">Your timezone: {tz}</p>
                <button 
                  onClick={() => {
                    setStep("info");
                    setSelectedSlot(null);
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors"
                >
                  Schedule Another
                </button>
              </motion.div>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-slate-500">Manage your availability and view upcoming classes.</p>
              </div>
              <div className="flex gap-1 sm:gap-2 bg-white p-1 rounded-xl border border-slate-200 overflow-x-auto">
                <button
                  onClick={() => setAdminTab("schedule")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "schedule" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Schedule
                </button>
                <button
                  onClick={() => setAdminTab("availability")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "availability" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Availability
                </button>
                <button
                  onClick={() => setAdminTab("history")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "history" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  History
                </button>
                <button
                  onClick={() => setAdminTab("settings")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "settings" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Settings
                </button>
              </div>
            </div>

            {adminTab === "schedule" ? (
              <div className="space-y-6">
                {[0, 1].map((weekIndex) => {
                  const weekStart = addDays(startOfWeek(nowLocal(), { weekStartsOn: 1 }), weekIndex * 7);
                  return (
                <div key={weekIndex} className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-slate-100">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  {weekIndex === 0 ? "This Week" : "Next Week"}
                </h3>

                <div className="flex flex-col divide-y divide-slate-100">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                    const date = addDays(weekStart, dayOffset);
                    const dayAppointments = appointments
                      .filter(app => isSameDay(app.startTime, date))
                      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
                    const isToday = isSameDay(date, new Date());
                    const isPastDay = date < new Date() && !isToday;

                    return (
                      <div key={dayOffset} className={`flex flex-col sm:flex-row gap-3 sm:gap-5 py-4 ${isPastDay ? "opacity-60" : ""}`}>
                        <div className={`flex sm:flex-col items-center sm:items-start gap-3 sm:gap-1 sm:w-20 flex-shrink-0 ${isToday ? "" : ""}`}>
                          <div className={`text-xs font-bold uppercase tracking-widest ${isToday ? "text-blue-600" : "text-slate-400"}`}>
                            {format(date, "EEE")}
                          </div>
                          <div className={`text-2xl font-bold leading-none ${isToday ? "text-blue-600" : "text-slate-700"}`}>
                            {format(date, "dd")}
                          </div>
                          {isToday && (
                            <div className="text-[9px] font-bold uppercase tracking-widest bg-blue-600 text-white px-2 py-0.5 rounded-full">
                              Today
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {dayAppointments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {dayAppointments.map((app) => {
                                const style = tagStyles[app.tag || "default"];
                                const tagLabel = app.tag ? app.tag.replace("-", " ") : "normal";
                                return (
                                  <div
                                    key={app.id}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setContextMenu({ x: e.clientX, y: e.clientY, appointmentId: app.id });
                                    }}
                                    className={`p-3 border rounded-xl text-xs group relative cursor-context-menu w-[160px] ${style}`}
                                  >
                                    <div className="font-bold text-sm">{format(app.startTime, "HH:mm")}</div>
                                    <div className="font-medium text-slate-700 truncate">{app.studentName}</div>
                                    <div className="text-slate-500 text-[10px] truncate">{app.studentPhone}</div>
                                    <div className="text-[9px] font-bold uppercase tracking-wider mt-1 opacity-70">{tagLabel}</div>
                                    <button
                                      onClick={() => removeAppointment(app.id)}
                                      className="mt-2 text-red-500 hover:text-red-700 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-slate-300 italic py-2">No classes</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                  );
                })}
              </div>
            ) : adminTab === "availability" ? (
              <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-slate-100">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Availability Grid
                  </h3>
                  <div className="text-[10px] sm:text-xs text-slate-400 font-medium italic">
                    Tap to toggle
                  </div>
                </div>

                <div className="grid grid-cols-8 gap-1 sm:gap-2">
                  <div /> {/* Hour label column */}
                  {[1, 2, 3, 4, 5, 6, 0].map(day => (
                    <div key={day} className="text-center font-bold text-[10px] sm:text-xs uppercase tracking-wider text-slate-400 pb-2">
                      {format(addDays(startOfWeek(nowLocal(), { weekStartsOn: 0 }), day), "EEEEE")}
                      <span className="hidden sm:inline">{format(addDays(startOfWeek(nowLocal(), { weekStartsOn: 0 }), day), "EEE").slice(1)}</span>
                    </div>
                  ))}

                  {Array.from({ length: 16 }, (_, i) => i + 7).map(hour => (
                    <>{/* Fragment for each row */}
                      <div key={`label-${hour}`} className="text-right pr-1 sm:pr-3 text-[10px] font-bold text-slate-400 flex items-center justify-end h-8 sm:h-10">
                        {format(setHours(nowLocal(), hour), "HH:00")}
                      </div>
                      {[1, 2, 3, 4, 5, 6, 0].map(day => {
                        const { day: utcDay, hour: utcHour } = localToUtc(day, hour);
                        const isActive = availability.some(a => a.dayOfWeek === utcDay && a.hour === utcHour);
                        return (
                          <button
                            key={`${day}-${hour}`}
                            onClick={() => toggleAvailability(day, hour)}
                            className={`h-8 sm:h-10 rounded-lg sm:rounded-xl border transition-all ${
                              isActive
                                ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100"
                                : "bg-slate-50 border-slate-100 hover:border-blue-200 active:bg-blue-50"
                            }`}
                          >
                            {isActive && <Check className="w-3 h-3 sm:w-4 sm:h-4 mx-auto" />}
                          </button>
                        );
                      })}
                    </>
                  ))}
                </div>
              </div>
            ) : adminTab === "history" ? (
              <div className="bg-white rounded-3xl shadow-xl p-4 sm:p-6 md:p-8 border border-slate-100">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    History
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryYear(y => y - 1)}
                      className="p-2 rounded-lg hover:bg-slate-50 text-slate-500"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="font-bold text-slate-700 w-16 text-center">{historyYear}</span>
                    <button
                      onClick={() => setHistoryYear(y => y + 1)}
                      className="p-2 rounded-lg hover:bg-slate-50 text-slate-500"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-6">
                  {Array.from({ length: 12 }, (_, i) => i).map(m => {
                    const count = appointments.filter(a => a.startTime.getFullYear() === historyYear && a.startTime.getMonth() === m).length;
                    const isActive = historyMonth === m;
                    return (
                      <button
                        key={m}
                        onClick={() => setHistoryMonth(m)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all relative ${
                          isActive
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100"
                            : "bg-slate-50 border-slate-100 text-slate-600 hover:border-blue-200"
                        }`}
                      >
                        {format(new Date(historyYear, m, 1), "MMM")}
                        {count > 0 && (
                          <span className={`ml-1 text-[10px] ${isActive ? "text-blue-100" : "text-slate-400"}`}>({count})</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const monthAppointments = appointments
                    .filter(a => a.startTime.getFullYear() === historyYear && a.startTime.getMonth() === historyMonth)
                    .sort((a, b) => a.studentName.localeCompare(b.studentName) || b.startTime.getTime() - a.startTime.getTime());

                  if (monthAppointments.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No classes in {format(new Date(historyYear, historyMonth, 1), "MMMM yyyy")}.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {monthAppointments.map(app => {
                        const tagColors: Record<string, string> = {
                          trial: "bg-amber-50 border-amber-200",
                          "no-show": "bg-red-50 border-red-200",
                          complete: "bg-green-50 border-green-200",
                        };
                        const bgClass = app.tag ? tagColors[app.tag] : "bg-slate-50 border-slate-100";
                        return (
                        <div
                          key={app.id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, appointmentId: app.id });
                          }}
                          className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-context-menu ${bgClass}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{format(app.startTime, "EEE")}</div>
                              <div className="text-xl font-bold text-slate-700">{format(app.startTime, "dd")}</div>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900">{app.studentName}</div>
                              <div className="text-xs text-slate-500">{format(app.startTime, "HH:mm")} · {app.studentPhone}</div>
                            </div>
                          </div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {app.tag ? app.tag.replace("-", " ") : "normal"}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Settings
                  </h3>

                  <div className="space-y-8">
                    {/* Meeting Duration */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                        Default Meeting Duration
                      </label>
                      <div className="flex items-center gap-4">
                        {[15, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            onClick={() => saveAdminSettings({ meetingDurationMinutes: mins })}
                            className={`px-5 py-3 rounded-xl border font-bold text-sm transition-all ${
                              adminSettings.meetingDurationMinutes === mins
                                ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                                : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
                            }`}
                          >
                            {mins} min
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Currently set to {adminSettings.meetingDurationMinutes} minutes per class.</p>
                    </div>

                    {/* Google Calendar */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 block">
                        Google Calendar Integration
                      </label>
                      {adminSettings.googleCalendarConnected ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-bold text-green-700">Connected</span>
                          </div>
                          <button
                            onClick={() => saveAdminSettings({ googleCalendarConnected: false, googleAccessToken: undefined, googleTokenExpiry: undefined })}
                            className="px-4 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={connectGoogleCalendar}
                          className="flex items-center gap-3 px-6 py-3 bg-white border-2 border-slate-200 rounded-xl font-bold text-sm hover:border-blue-300 hover:shadow-lg transition-all"
                        >
                          <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                          </svg>
                          Connect Google Calendar
                        </button>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {adminSettings.googleCalendarConnected
                          ? "New bookings will automatically appear in your Google Calendar."
                          : "Connect to automatically add new bookings to your Google Calendar."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Appointment Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[100] bg-white border border-slate-200 rounded-xl shadow-2xl py-1 min-w-[180px]"
        >
          <button onClick={() => setAppointmentTag(contextMenu.appointmentId, "trial")} className="w-full text-left px-4 py-2 text-sm hover:bg-amber-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Trial (30 min)
          </button>
          <button onClick={() => setAppointmentTag(contextMenu.appointmentId, null)} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Normal (50 min)
          </button>
          <button onClick={() => setAppointmentTag(contextMenu.appointmentId, "complete")} className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Complete
          </button>
          <button onClick={() => setAppointmentTag(contextMenu.appointmentId, "no-show")} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> No-show
          </button>
        </div>
      )}

      {/* Admin Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-6"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Admin Login</h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setLoginError(""); }}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 block">Password</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                </div>
                {loginError && (
                  <p className="text-red-500 text-sm font-medium">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={!loginEmail || !loginPassword}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  Sign In
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Toaster position="top-center" richColors />
      <SchedulingApp />
    </ErrorBoundary>
  );
}
