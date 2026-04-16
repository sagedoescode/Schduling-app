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
  AlertCircle,
  Moon,
  Sun,
  MoreVertical,
  Eye,
  EyeOff
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
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [lang, setLang] = useState<"en" | "pt" | null>(() => {
    const saved = localStorage.getItem("lang");
    return saved === "en" || saved === "pt" ? saved : null;
  });

  const t = (en: string, pt: string) => (lang === "pt" ? pt : en);

  const pickLang = (l: "en" | "pt") => {
    localStorage.setItem("lang", l);
    setLang(l);
  };

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add("dark");
    else root.classList.remove("dark");
    localStorage.setItem("darkMode", String(darkMode));
  }, [darkMode]);

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

  const ADMIN_EMAIL = "lucaspinheirofab@gmail.com";
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [view, setView] = useState<"student" | "admin">("student");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const loggedIn = !!user && user.email === ADMIN_EMAIL;
      setIsAdminLoggedIn(loggedIn);
      if (loggedIn) setView("admin");
    });
    return unsub;
  }, []);
  const [adminTab, setAdminTab] = useState<"schedule" | "availability" | "history" | "settings">("schedule");
  const [historyMonth, setHistoryMonth] = useState<number>(new Date().getMonth());
  const [historyYear, setHistoryYear] = useState<number>(new Date().getFullYear());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; appointmentId: string } | null>(null);

  const tagStyles: Record<string, string> = {
    trial: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300",
    "no-show": "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
    complete: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    default: "bg-blue-50 dark:bg-blue-950/30 border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  };

  // Outcome wins over classType for card color (complete/no-show override trial/normal visual)
  const cardStyleFor = (app: Appointment) => {
    const { classType, outcome } = resolveAppointment(app);
    if (outcome === "complete") return tagStyles.complete;
    if (outcome === "no-show") return tagStyles["no-show"];
    if (classType === "trial") return tagStyles.trial;
    return tagStyles.default;
  };

  const setAppointmentTag = async (id: string, tag: AppointmentTag | null) => {
    // Legacy helper kept for any existing callers. New UI uses
    // setClassType / setOutcome below so class type (trial/normal) and
    // outcome (complete/no-show) can coexist on the same card.
    try {
      await updateDoc(doc(db, "appointments", id), { tag: tag ?? null });
      toast.success(tag ? `Marked as ${tag}` : "Tag cleared");
    } catch (error) {
      toast.error("Failed to update");
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
    setContextMenu(null);
  };

  const setClassType = async (id: string, classType: "trial" | "normal") => {
    try {
      await updateDoc(doc(db, "appointments", id), { classType, tag: null });
      toast.success(`Marked as ${classType}`);
    } catch (error) {
      toast.error("Failed to update");
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
    setContextMenu(null);
  };

  const setOutcome = async (id: string, outcome: "complete" | "no-show" | null) => {
    try {
      await updateDoc(doc(db, "appointments", id), { outcome: outcome ?? null });
      toast.success(outcome ? `Marked as ${outcome}` : "Outcome cleared");
    } catch (error) {
      toast.error("Failed to update");
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${id}`);
    }
    setContextMenu(null);
  };

  // Resolve class type + outcome handling legacy tag field.
  // For legacy data where tag was overwritten (e.g., trial->complete lost trial),
  // fall back to inferring class type from the actual class duration.
  const resolveAppointment = (app: Appointment) => {
    const legacy = app.tag;
    const start = app.startTime instanceof Date ? app.startTime : new Date(app.startTime);
    const end = app.endTime instanceof Date ? app.endTime : new Date(app.endTime);
    const durationMin = (end.getTime() - start.getTime()) / 60000;
    const inferredType: "trial" | "normal" = durationMin > 0 && durationMin < 45 ? "trial" : "normal";

    const classType: "trial" | "normal" =
      app.classType ?? (legacy === "trial" ? "trial" : inferredType);
    const outcome: "complete" | "no-show" | undefined =
      app.outcome ?? (legacy === "complete" ? "complete" : legacy === "no-show" ? "no-show" : undefined);
    return { classType, outcome };
  };

  const unlockWeeklySchedule = async (id: string) => {
    const source = appointments.find(a => a.id === id);
    if (!source) {
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    const sourceStart = source.startTime instanceof Date ? source.startTime : new Date(source.startTime);
    const sourceDay = sourceStart.getDay();
    const sourceHour = sourceStart.getHours();
    const sourceMinute = sourceStart.getMinutes();
    const now = new Date();
    // Find all future recurring appointments for same student at same day/time
    const toDelete = appointments.filter(a => {
      if (a.studentName !== source.studentName) return false;
      if (!a.recurring && a.id !== id) return false;
      const t = a.startTime instanceof Date ? a.startTime : new Date(a.startTime);
      if (t < now) return false;
      return t.getDay() === sourceDay && t.getHours() === sourceHour && t.getMinutes() === sourceMinute;
    });
    let deleted = 0;
    let failed = 0;
    for (const app of toDelete) {
      try {
        await deleteDoc(doc(db, "appointments", app.id));
        if (app.googleCalendarEventId) {
          await removeFromGoogleCalendar(app.googleCalendarEventId);
        }
        deleted++;
      } catch {
        failed++;
      }
    }
    if (failed > 0 && deleted > 0) toast.success(`Removed ${deleted}, ${failed} failed`);
    else if (failed > 0) toast.error("Failed to unlock weekly schedule");
    else toast.success(`Unlocked ${deleted} future ${deleted === 1 ? "class" : "classes"} for ${source.studentName}`);
  };

  const lockWeeklySchedule = async (id: string, weeks: number = 4) => {
    const source = appointments.find(a => a.id === id);
    if (!source) {
      setContextMenu(null);
      return;
    }
    setContextMenu(null);
    const startTime = source.startTime instanceof Date ? source.startTime : new Date(source.startTime);
    const endTime = source.endTime instanceof Date ? source.endTime : new Date(source.endTime);
    let created = 0;
    try {
      for (let i = 1; i <= weeks; i++) {
        const newStart = addDays(startTime, 7 * i);
        const newEnd = addDays(endTime, 7 * i);
        // Skip if a booking already exists at that exact time
        const conflict = appointments.some(a => a.startTime.getTime() === newStart.getTime());
        if (conflict) continue;
        const docRef = await addDoc(collection(db, "appointments"), {
          studentName: source.studentName,
          studentPhone: source.studentPhone,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          status: "booked",
          tag: source.tag ?? null,
          classType: source.classType ?? null,
          recurring: true,
          createdAt: serverTimestamp()
        });
        const eventId = await addToGoogleCalendar(source.studentName, newStart, newEnd);
        if (eventId) {
          await updateDoc(doc(db, "appointments", docRef.id), { googleCalendarEventId: eventId });
        }
        created++;
      }
      toast.success(`Locked ${created} weekly ${created === 1 ? "class" : "classes"} for ${source.studentName}`);
    } catch (error) {
      toast.error("Failed to lock weekly schedule");
      handleFirestoreError(error, OperationType.CREATE, "appointments");
    }
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [step, setStep] = useState<"info" | "schedule" | "success">("info");
  const [studentInfo, setStudentInfo] = useState({ name: "", phone: "" });
  const [selectedDate, setSelectedDate] = useState<Date>(startOfToday());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Date | null>(null);
  const [selectedClassKind, setSelectedClassKind] = useState<"trial" | "normal30" | "normal50">("normal50");

  // Pricing (BRL)
  const priceFor = (app: Appointment): number => {
    const { classType, outcome } = resolveAppointment(app);
    if (outcome !== "complete") return 0;
    if (classType === "trial") return 10;
    const start = app.startTime instanceof Date ? app.startTime : new Date(app.startTime);
    const end = app.endTime instanceof Date ? app.endTime : new Date(app.endTime);
    const duration = (end.getTime() - start.getTime()) / 60000;
    return duration < 45 ? 19 : 35;
  };

  const weeklyEarnings = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = addDays(start, 7);
    return appointments.reduce((sum, app) => {
      const t = app.startTime instanceof Date ? app.startTime : new Date(app.startTime);
      if (t >= start && t < end) return sum + priceFor(app);
      return sum;
    }, 0);
  }, [appointments]);

  const weeklyHours = useMemo(() => {
    const now = new Date();
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = addDays(start, 7);
    const mins = appointments.reduce((sum, app) => {
      const t = app.startTime instanceof Date ? app.startTime : new Date(app.startTime);
      if (t < start || t >= end) return sum;
      if (app.status === "cancelled") return sum;
      const s = t.getTime();
      const e = (app.endTime instanceof Date ? app.endTime : new Date(app.endTime)).getTime();
      return sum + (e - s) / 60000;
    }, 0);
    return mins / 60;
  }, [appointments]);
  const [lastBookingId, setLastBookingId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("lastBooking");
      if (!raw) return null;
      const data = JSON.parse(raw);
      // Expire if class already started
      if (data.startTime && new Date(data.startTime).getTime() < Date.now()) {
        localStorage.removeItem("lastBooking");
        return null;
      }
      return data.id || null;
    } catch {
      return null;
    }
  });
  const [lastBookingEventId, setLastBookingEventId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem("lastBooking");
      return raw ? (JSON.parse(raw).eventId || null) : null;
    } catch {
      return null;
    }
  });

  // Sync lastBooking across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "lastBooking") return;
      if (!e.newValue) {
        setLastBookingId(null);
        setLastBookingEventId(null);
        return;
      }
      try {
        const data = JSON.parse(e.newValue);
        setLastBookingId(data.id || null);
        setLastBookingEventId(data.eventId || null);
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const saveAdminSettings = async (updates: Partial<AdminSettings>, opts?: { silent?: boolean }) => {
    // Optimistic local update first so UI reflects change immediately
    setAdminSettings(prev => ({ ...prev, ...updates }));
    try {
      await setDoc(doc(db, "settings", "admin"), updates, { merge: true });
      if (!opts?.silent) toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  // Build OAuth URL for full-page redirect
  const buildOAuthUrl = (promptType: "consent" | "none") => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const redirectUri = window.location.origin;
    const scope = "https://www.googleapis.com/auth/calendar.events";
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scope)}&prompt=${promptType}&include_granted_scopes=true`;
  };

  // Handle OAuth redirect callback: parse #access_token=... from URL
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token")) return;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const expiresIn = params.get("expires_in");
    if (accessToken) {
      const expiry = Date.now() + (Number(expiresIn) || 3600) * 1000;
      saveAdminSettings({
        googleCalendarConnected: true,
        googleAccessToken: accessToken,
        googleTokenExpiry: expiry,
      }, { silent: true });
      toast.success("Google Calendar connected!");
    }
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const connectGoogleCalendar = () => {
    if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      toast.error("Google Client ID not configured.");
      return;
    }
    window.location.href = buildOAuthUrl("consent");
  };

  // Silent refresh via hidden iframe
  const silentRefreshToken = (): Promise<string | null> => {
    return new Promise(resolve => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = buildOAuthUrl("none");
      const timeout = setTimeout(() => {
        document.body.removeChild(iframe);
        resolve(null);
      }, 10000);
      iframe.onload = () => {
        try {
          const hash = iframe.contentWindow?.location.hash;
          if (hash?.includes("access_token")) {
            const params = new URLSearchParams(hash.substring(1));
            const token = params.get("access_token");
            const expiresIn = params.get("expires_in");
            if (token) {
              const expiry = Date.now() + (Number(expiresIn) || 3600) * 1000;
              saveAdminSettings({
                googleCalendarConnected: true,
                googleAccessToken: token,
                googleTokenExpiry: expiry,
              }, { silent: true });
              clearTimeout(timeout);
              document.body.removeChild(iframe);
              resolve(token);
              return;
            }
          }
        } catch (e) {
          // Cross-origin access denied (expected when iframe navigates to google.com)
        }
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve(null);
      };
      document.body.appendChild(iframe);
    });
  };

  const getValidAccessToken = async (): Promise<string | null> => {
    const { googleAccessToken, googleTokenExpiry } = adminSettings;
    if (googleAccessToken && googleTokenExpiry && Date.now() < googleTokenExpiry - 60000) {
      return googleAccessToken;
    }
    return silentRefreshToken();
  };

  const addToGoogleCalendar = async (studentName: string, start: Date, end: Date): Promise<string | null> => {
    if (!adminSettings.googleCalendarConnected || adminSettings.googleCalendarAutoSync === false) return null;
    const token = await getValidAccessToken();
    if (!token) {
      // Token expired and silent refresh failed - silently mark as disconnected
      // so the user sees the Connect button next time they open Settings
      // without being spammed with error toasts on every booking.
      setAdminSettings(prev => ({ ...prev, googleCalendarConnected: false }));
      setDoc(doc(db, "settings", "admin"), { googleCalendarConnected: false }, { merge: true }).catch(() => {});
      return null;
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
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (res.ok) {
        const data = await res.json();
        return data.id || null;
      }
      console.error("Failed to create calendar event:", await res.text());
      return null;
    } catch (e) {
      console.error("Google Calendar error:", e);
      return null;
    }
  };

  const removeFromGoogleCalendar = async (eventId: string) => {
    if (!adminSettings.googleCalendarConnected || adminSettings.googleCalendarAutoSync === false) return;
    const token = await getValidAccessToken();
    if (!token) {
      setAdminSettings(prev => ({ ...prev, googleCalendarConnected: false }));
      setDoc(doc(db, "settings", "admin"), { googleCalendarConnected: false }, { merge: true }).catch(() => {});
      toast.error("Google Calendar token expired - event not removed from calendar. Reconnect in Settings.");
      return;
    }
    try {
      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
    } catch (e) {
      console.error("Failed to remove calendar event:", e);
    }
  };

  const disconnectGoogleCalendar = async () => {
    const token = adminSettings.googleAccessToken;
    if (token) {
      // Fire-and-forget revoke so Google forgets the grant
      fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: "POST" }).catch(() => {});
    }
    // Use null (not undefined) because Firestore rejects undefined values
    setAdminSettings(prev => ({
      ...prev,
      googleCalendarConnected: false,
      googleAccessToken: undefined,
      googleTokenExpiry: undefined,
    }));
    try {
      await setDoc(doc(db, "settings", "admin"), {
        googleCalendarConnected: false,
        googleAccessToken: null,
        googleTokenExpiry: null,
        googleCalendarAutoSync: null,
      }, { merge: true });
      toast.success("Google Calendar disconnected");
    } catch (error) {
      toast.error("Failed to disconnect");
      handleFirestoreError(error, OperationType.UPDATE, "settings/admin");
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

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    if (loginEmail !== ADMIN_EMAIL) {
      setLoginError("Invalid email or password");
      return;
    }
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginModal(false);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setLoginError("Invalid email or password");
      } else if (code === "auth/too-many-requests") {
        setLoginError("Too many attempts. Try again later.");
      } else if (code === "auth/network-request-failed") {
        setLoginError("Network error - check your connection");
      } else if (code === "auth/operation-not-allowed") {
        setLoginError("Email/Password not enabled yet - ask Claude");
      } else {
        setLoginError(code ? `Login failed (${code})` : "Login failed");
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setLoginError("Enter your email first");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, loginEmail);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/user-not-found") {
        setLoginError("No account found with that email");
      } else {
        toast.error("Failed to send reset email");
      }
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    setView("student");
  };

  const weekDays = useMemo(() => {
    const now = nowLocal();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = startOfWeek(now, { weekStartsOn: 1 });
    // Always show 2 weeks so students can pick from next week too
    const allDays = eachDayOfInterval({
      start,
      end: addDays(start, 13)
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
    const duration = selectedClassKind === "normal50" ? 50 : 30;
    const classType: "trial" | "normal" = selectedClassKind === "trial" ? "trial" : "normal";
    const endTime = addMinutes(selectedSlot, duration);
    try {
      const docRef = await addDoc(collection(db, path), {
        studentName: studentInfo.name,
        studentPhone: studentInfo.phone,
        startTime: selectedSlot.toISOString(),
        endTime: endTime.toISOString(),
        status: "booked",
        classType,
        createdAt: serverTimestamp()
      });

      setLastBookingId(docRef.id);
      setLastBookingEventId(null);
      localStorage.setItem("lastBooking", JSON.stringify({
        id: docRef.id,
        startTime: selectedSlot.toISOString(),
      }));

      // Add to Google Calendar if connected + auto-sync enabled
      const eventId = await addToGoogleCalendar(studentInfo.name, selectedSlot, endTime);
      if (eventId) {
        await updateDoc(doc(db, path, docRef.id), { googleCalendarEventId: eventId });
        setLastBookingEventId(eventId);
        localStorage.setItem("lastBooking", JSON.stringify({
          id: docRef.id,
          eventId,
          startTime: selectedSlot.toISOString(),
        }));
      }

      // WhatsApp Notification
      const tzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(selectedSlot).find(p => p.type === "timeZoneName")?.value || tz;
      const message = `Hey Lucas, this time and date suits me ${format(selectedSlot, "EEEE, d MMMM").toLowerCase()} at ${format(selectedSlot, "HH:mm")} (${tzAbbr})`;
      const waUrl = `https://wa.me/5592981432135?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");

      // For non-trial classes, ask if they want to schedule the same time for the next 4 weeks
      if (classType === "normal") {
        const promptMsg = t(
          "Would you like to schedule this same time for the next 4 weeks too?",
          "Quer agendar este mesmo horário para as próximas 4 semanas também?"
        );
        if (confirm(promptMsg)) {
          let extraCreated = 0;
          for (let i = 1; i <= 3; i++) {
            const extraStart = addDays(selectedSlot, 7 * i);
            const extraEnd = addDays(endTime, 7 * i);
            try {
              const extraDoc = await addDoc(collection(db, path), {
                studentName: studentInfo.name,
                studentPhone: studentInfo.phone,
                startTime: extraStart.toISOString(),
                endTime: extraEnd.toISOString(),
                status: "booked",
                classType,
                recurring: true,
                createdAt: serverTimestamp()
              });
              const extraEventId = await addToGoogleCalendar(studentInfo.name, extraStart, extraEnd);
              if (extraEventId) {
                await updateDoc(doc(db, path, extraDoc.id), { googleCalendarEventId: extraEventId });
              }
              extraCreated++;
            } catch {}
          }
          if (extraCreated > 0) {
            toast.success(t(`${extraCreated} more weekly classes scheduled`, `${extraCreated} aulas semanais agendadas`));
          }
        }
      }

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
    const appointment = appointments.find(a => a.id === id);
    try {
      await deleteDoc(doc(db, "appointments", id));
      if (appointment?.googleCalendarEventId) {
        await removeFromGoogleCalendar(appointment.googleCalendarEventId);
      }
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


  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {/* Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
          <BookLogo size="sm" />
          <span className="hidden sm:inline">English with Lucas</span>
        </div>
        <div className="flex items-center gap-4">
          {lang && (
            <button
              onClick={() => pickLang(lang === "en" ? "pt" : "en")}
              className="text-xs font-bold px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
              title="Change language / Mudar idioma"
            >
              {lang === "en" ? "EN" : "PT"}
            </button>
          )}
          <button
            onClick={() => setDarkMode(d => !d)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button
            onClick={handleAdminAccess}
            className="flex items-center gap-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {view === "student" ? <Settings className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {view === "student" ? "Admin" : "Student View"}
          </button>
          {isAdminLoggedIn && (
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors"
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
            {step === "info" && lastBookingId && (() => {
              const booking = appointments.find(a => a.id === lastBookingId);
              if (!booking) return null;
              return (
                <div className="max-w-md mx-auto bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 mb-1">Sua próxima aula</div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      {format(booking.startTime, "EEEE, d MMMM")} às {format(booking.startTime, "HH:mm")}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm("Cancelar esta aula?")) return;
                      try {
                        await deleteDoc(doc(db, "appointments", lastBookingId));
                        if (lastBookingEventId) await removeFromGoogleCalendar(lastBookingEventId);
                        toast.success("Aula cancelada");
                        setLastBookingId(null);
                        setLastBookingEventId(null);
                        localStorage.removeItem("lastBooking");
                      } catch {
                        toast.error("Não foi possível cancelar");
                      }
                    }}
                    className="text-sm font-bold text-red-500 dark:text-red-400 hover:underline whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                </div>
              );
            })()}
            {step === "info" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/30 p-8 md:p-12 max-w-md mx-auto text-center"
              >
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <BookLogo size="lg" />
                </div>
                <h1 className="text-2xl font-bold mb-2">{t("Welcome!", "Bem-vindo!")}</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">{t("Please enter your details to view available times for your English class.", "Por favor, preencha seus dados para ver os horários disponíveis da sua aula.")}</p>

                <div className="space-y-4 text-left">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">{t("Full Name", "Nome Completo")}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={studentInfo.name}
                        onChange={(e) => setStudentInfo({ ...studentInfo, name: e.target.value })}
                        placeholder={t("Your Name", "Seu nome")}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">{t("WhatsApp / Phone Number", "WhatsApp / Telefone")}</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="tel"
                        value={studentInfo.phone}
                        onChange={(e) => setStudentInfo({ ...studentInfo, phone: e.target.value })}
                        placeholder={t("Your WhatsApp number", "Seu WhatsApp")}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button
                    disabled={!studentInfo.name || !studentInfo.phone}
                    onClick={() => setStep("schedule")}
                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all mt-4"
                  >
                    {t("Continue to Schedule", "Continuar para os horários")}
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
                    className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition-colors"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <div className="text-center">
                    <h1 className="text-2xl font-bold">{t("Pick a Time", "Escolha um Horário")}</h1>
                    <p className="text-[11px] text-slate-400 mt-1">{t("All times shown in your timezone", "Horários mostrados no seu fuso horário")} · {tz}</p>
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
                            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-500"
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

                <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6">
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> {t("Available Slots", "Horários Disponíveis")}
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
                                ? "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed line-through" 
                                : selected
                                  ? "bg-blue-50 border-blue-600 text-blue-600 ring-2 ring-blue-100"
                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-400 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400"
                            }`}
                          >
                            {format(slot, "HH:mm")}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                      <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>{t("No availability for this day.", "Sem horários disponíveis neste dia.")}</p>
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
                              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{t("Confirm Class", "Confirmar Aula")}</div>
                              <div className="font-bold">{format(selectedSlot, "EEEE, MMMM do")} at {format(selectedSlot, "HH:mm")}</div>
                            </div>
                          </div>
                          <button
                            onClick={handleSchedule}
                            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                          >
                            <Check className="w-5 h-5" />
                            {t("Book Now", "Agendar")}
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                          {([
                            { key: "trial", label: "Trial (30 min)" },
                            { key: "normal30", label: "Normal (30 min)" },
                            { key: "normal50", label: "Normal (50 min)" },
                          ] as const).map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => setSelectedClassKind(opt.key)}
                              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all ${
                                selectedClassKind === opt.key
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-transparent border-white/20 text-slate-300 hover:border-white/40"
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
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
                className="bg-white dark:bg-slate-800 dark:border dark:border-slate-700 rounded-3xl shadow-xl dark:shadow-black/30 p-12 max-w-md mx-auto text-center"
              >
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h1 className="text-3xl font-bold mb-4">{t("Booked!", "Agendado!")}</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                  Your English class is scheduled for <span className="font-bold text-slate-900 dark:text-slate-100">{format(selectedSlot!, "EEEE, MMMM do")}</span> at <span className="font-bold text-slate-900 dark:text-slate-100">{format(selectedSlot!, "HH:mm")}</span>.
                </p>
                <p className="text-xs text-slate-400 mb-4">{t("Your timezone", "Seu fuso horário")}: {tz}</p>
                <button
                  onClick={() => {
                    setStep("info");
                    setSelectedSlot(null);
                    setLastBookingId(null);
                    setLastBookingEventId(null);
                    localStorage.removeItem("lastBooking");
                  }}
                  className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-colors mb-2"
                >
                  {t("Schedule Another", "Agendar Outra")}
                </button>
                {lastBookingId && (
                  <button
                    onClick={async () => {
                      if (!confirm("Cancelar esta aula? Esta ação não pode ser desfeita.")) return;
                      try {
                        await deleteDoc(doc(db, "appointments", lastBookingId));
                        if (lastBookingEventId) {
                          await removeFromGoogleCalendar(lastBookingEventId);
                        }
                        toast.success("Aula cancelada");
                        setLastBookingId(null);
                        setLastBookingEventId(null);
                        localStorage.removeItem("lastBooking");
                        setSelectedSlot(null);
                        setStep("info");
                      } catch (e) {
                        toast.error("Não foi possível cancelar");
                      }
                    }}
                    className="w-full text-red-500 dark:text-red-400 font-medium text-sm py-2 hover:underline transition-colors"
                  >
                    Marcou errado? Cancelar esta aula
                  </button>
                )}
              </motion.div>
            )}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-200">Admin Dashboard</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Manage your availability and view upcoming classes.</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                  This week: <span className="font-bold text-green-600 dark:text-green-400">R$ {weeklyEarnings.toFixed(2)}</span>
                  <span className="opacity-60"> · {weeklyHours.toFixed(1)}h scheduled</span>
                </p>
              </div>
              <div className="flex gap-1 sm:gap-2 bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
                <button
                  onClick={() => setAdminTab("schedule")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "schedule" ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" : "text-slate-600 dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"}`}
                >
                  Schedule
                </button>
                <button
                  onClick={() => setAdminTab("availability")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "availability" ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" : "text-slate-600 dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"}`}
                >
                  Availability
                </button>
                <button
                  onClick={() => setAdminTab("history")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "history" ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" : "text-slate-600 dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"}`}
                >
                  History
                </button>
                <button
                  onClick={() => setAdminTab("settings")}
                  className={`px-3 sm:px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${adminTab === "settings" ? "bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-none" : "text-slate-600 dark:text-blue-300 hover:bg-slate-50 dark:hover:bg-slate-700/60"}`}
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
                <div key={weekIndex} className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-black/30 p-4 sm:p-6 md:p-8 border border-slate-100 dark:border-slate-700">
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

                        <div className="flex-1 min-w-0 w-full">
                          {dayAppointments.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {dayAppointments.map((app) => {
                                const style = cardStyleFor(app);
                                const { classType, outcome } = resolveAppointment(app);
                                const startT = app.startTime instanceof Date ? app.startTime : new Date(app.startTime);
                                const endT = app.endTime instanceof Date ? app.endTime : new Date(app.endTime);
                                const durMin = Math.round((endT.getTime() - startT.getTime()) / 60000);
                                return (
                                  <div
                                    key={app.id}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      setContextMenu({ x: e.clientX, y: e.clientY, appointmentId: app.id });
                                    }}
                                    className={`p-3 pr-8 border rounded-xl text-xs group relative cursor-context-menu ${style}`}
                                  >
                                    <label
                                      className="absolute top-1.5 right-1.5 flex items-center cursor-pointer p-1"
                                      onClick={(e) => e.stopPropagation()}
                                      title={outcome === "complete" ? "Unmark complete" : "Mark complete"}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={outcome === "complete"}
                                        onChange={() => setAppointmentTag(app.id, outcome === "complete" ? null : "complete")}
                                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-500 text-green-600 focus:ring-green-500 cursor-pointer"
                                      />
                                    </label>
                                    <div className="font-bold text-sm">{format(app.startTime, "HH:mm")} <span className="text-[10px] font-medium opacity-70">({durMin}m)</span></div>
                                    <div className="font-medium text-slate-700 dark:text-slate-200 truncate">{app.studentName}</div>
                                    <div className="text-slate-500 dark:text-slate-400 text-[10px] truncate">{app.studentPhone}</div>
                                    {outcome ? (
                                      <>
                                        <div className="text-[10px] font-bold uppercase tracking-wider mt-1">{outcome.replace("-", " ")}</div>
                                        <div className="text-[8px] font-bold uppercase tracking-wider opacity-60">{classType}</div>
                                      </>
                                    ) : (
                                      <div className="text-[9px] font-bold uppercase tracking-wider mt-1 opacity-70">{classType}</div>
                                    )}
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
                            <div className="text-sm text-slate-300 dark:text-slate-600 italic py-2">No classes</div>
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
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-black/30 p-4 sm:p-6 md:p-8 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Availability Grid
                  </h3>
                  <div className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 font-medium italic">
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

                  {Array.from({ length: 16 }, (_, i) => i + 7).flatMap(hour => [
                    <div key={`label-${hour}`} className="text-right pr-1 sm:pr-3 text-[10px] font-bold text-slate-400 flex items-center justify-end h-8 sm:h-10">
                      {format(setHours(nowLocal(), hour), "HH:00")}
                    </div>,
                    ...[1, 2, 3, 4, 5, 6, 0].map(day => {
                      const { day: utcDay, hour: utcHour } = localToUtc(day, hour);
                      const isActive = availability.some(a => a.dayOfWeek === utcDay && a.hour === utcHour);
                      return (
                        <button
                          key={`${day}-${hour}`}
                          onClick={() => toggleAvailability(day, hour)}
                          className={`h-8 sm:h-10 rounded-lg sm:rounded-xl border transition-all ${
                            isActive
                              ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
                              : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-600 active:bg-blue-50 dark:active:bg-blue-950"
                          }`}
                        >
                          {isActive && <Check className="w-3 h-3 sm:w-4 sm:h-4 mx-auto" />}
                        </button>
                      );
                    })
                  ])}
                </div>
              </div>
            ) : adminTab === "history" ? (
              <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-black/30 p-4 sm:p-6 md:p-8 border border-slate-100 dark:border-slate-700">
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
                            ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100 dark:shadow-none"
                            : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-blue-200 dark:hover:border-blue-600"
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
                      <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm">No classes in {format(new Date(historyYear, historyMonth, 1), "MMMM yyyy")}.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {monthAppointments.map(app => {
                        const { classType, outcome } = resolveAppointment(app);
                        const bgClass = outcome === "complete" ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                          : outcome === "no-show" ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                          : classType === "trial" ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                          : "bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-700";
                        return (
                        <div
                          key={app.id}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, appointmentId: app.id });
                          }}
                          className={`p-4 pr-10 border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-context-menu relative ${bgClass}`}
                        >
                          <label
                            className="absolute top-2 right-2 flex items-center cursor-pointer p-1"
                            onClick={(e) => e.stopPropagation()}
                            title={app.outcome === "complete" || app.tag === "complete" ? "Unmark complete" : "Mark complete"}
                          >
                            <input
                              type="checkbox"
                              checked={app.outcome === "complete" || app.tag === "complete"}
                              onChange={() => setAppointmentTag(app.id, (app.outcome === "complete" || app.tag === "complete") ? null : "complete")}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-500 text-green-600 focus:ring-green-500 cursor-pointer"
                            />
                          </label>
                          <div className="flex items-center gap-4">
                            <div className="text-center min-w-[60px]">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">{format(app.startTime, "EEE")}</div>
                              <div className="text-xl font-bold text-slate-700 dark:text-slate-200">{format(app.startTime, "dd")}</div>
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{app.studentName}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{format(app.startTime, "HH:mm")} · {app.studentPhone}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {outcome ? (
                              <>
                                <span className="text-[11px]">{outcome.replace("-", " ")}</span>
                                <span className="text-[9px] opacity-70">{classType}</span>
                              </>
                            ) : (
                              <span className="text-[10px]">{classType}</span>
                            )}
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
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl dark:shadow-black/30 p-8 border border-slate-100 dark:border-slate-700">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-600" />
                    Settings
                  </h3>

                  <div className="space-y-8">
                    {/* Google Calendar */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3 block">
                        Google Calendar Integration
                      </label>
                      {adminSettings.googleCalendarConnected ? (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                            <span className="text-sm font-bold text-green-700">Connected</span>
                          </div>
                          <button
                            onClick={disconnectGoogleCalendar}
                            className="px-4 py-3 border border-red-200 text-red-600 rounded-xl text-sm font-bold hover:bg-red-50 transition-colors"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={connectGoogleCalendar}
                          className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-lg transition-all"
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
                      {adminSettings.googleCalendarConnected && (
                        <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                          <div>
                            <div className="text-sm font-bold text-slate-700">Auto-sync bookings</div>
                            <div className="text-xs text-slate-500 mt-0.5">Automatically add new classes to your Google Calendar and remove cancelled ones.</div>
                          </div>
                          <button
                            onClick={() => saveAdminSettings({ googleCalendarAutoSync: !(adminSettings.googleCalendarAutoSync !== false) })}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
                              adminSettings.googleCalendarAutoSync !== false ? "bg-blue-600" : "bg-slate-300"
                            }`}
                          >
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                              adminSettings.googleCalendarAutoSync !== false ? "translate-x-6" : "translate-x-1"
                            }`} />
                          </button>
                        </div>
                      )}
                      {!adminSettings.googleCalendarConnected && (
                        <p className="text-xs text-slate-400 mt-2">Connect to automatically add new bookings to your Google Calendar.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Language Picker Modal - shown to students until they pick */}
      <AnimatePresence>
        {view === "student" && lang === null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-6"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
            >
              <h2 className="text-xl font-bold mb-2">Choose your language</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Escolha o seu idioma</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => pickLang("en")}
                  className="py-4 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <div className="text-2xl mb-1">🇺🇸</div>
                  <div className="text-sm font-bold">English</div>
                </button>
                <button
                  onClick={() => pickLang("pt")}
                  className="py-4 px-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                >
                  <div className="text-2xl mb-1">🇧🇷</div>
                  <div className="text-sm font-bold">Português</div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Appointment Context Menu */}
      {contextMenu && (
        <div
          style={{
            top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 340)),
            left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 200)),
          }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-[100] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1 min-w-[180px]"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 pt-1 pb-0.5">Class type</div>
          <button onClick={() => setClassType(contextMenu.appointmentId, "trial")} className="w-full text-left px-4 py-2 text-sm hover:bg-amber-50 dark:hover:bg-amber-950 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" /> Trial (30 min)
          </button>
          <button onClick={() => setClassType(contextMenu.appointmentId, "normal")} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-950 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> Normal (50 min)
          </button>
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-4 pt-1 pb-0.5">Outcome</div>
          <button onClick={() => setOutcome(contextMenu.appointmentId, "complete")} className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 dark:hover:bg-green-950 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" /> Complete
          </button>
          <button onClick={() => setOutcome(contextMenu.appointmentId, "no-show")} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" /> No-show
          </button>
          <button onClick={() => setOutcome(contextMenu.appointmentId, null)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-slate-400" /> Clear outcome
          </button>
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          {(() => {
            const app = appointments.find(a => a.id === contextMenu.appointmentId);
            const isRecurring = !!app?.recurring;
            return isRecurring ? (
              <button onClick={() => unlockWeeklySchedule(contextMenu.appointmentId)} className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2">
                <X className="w-3 h-3 text-red-500" /> Unlock weekly (remove future)
              </button>
            ) : (
              <button onClick={() => lockWeeklySchedule(contextMenu.appointmentId, 4)} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                <Calendar className="w-3 h-3 text-blue-500" /> Lock weekly (4 weeks)
              </button>
            );
          })()}
          <div className="border-t border-slate-200 dark:border-slate-700 my-1" />
          <button
            onClick={() => {
              const id = contextMenu.appointmentId;
              setContextMenu(null);
              if (confirm("Cancel this class?")) removeAppointment(id);
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-950 flex items-center gap-2 text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-3 h-3" /> Cancel class
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
              className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-sm w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Admin Login</h2>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">Email</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => { setLoginEmail(e.target.value); setLoginError(""); }}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => { setLoginPassword(e.target.value); setLoginError(""); }}
                      placeholder="••••••••"
                      className="w-full px-4 pr-12 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                {loginError && (
                  <p className="text-red-500 text-sm font-medium">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={!loginEmail || !loginPassword}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 disabled:opacity-50 disabled:shadow-none transition-all"
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
