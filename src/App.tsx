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

const TIMEZONE = "America/Sao_Paulo";
const nowBrasilia = () => new TZDate(new Date(), TIMEZONE);
const toBrasilia = (date: Date) => new TZDate(date, TIMEZONE);
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
import { TimeSlot, Availability, Appointment } from "./types";

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
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [view, setView] = useState<"student" | "admin">("student");
  const [adminTab, setAdminTab] = useState<"schedule" | "availability">("schedule");
  const [step, setStep] = useState<"info" | "schedule" | "success">("info");
  const [studentInfo, setStudentInfo] = useState({ name: "", phone: "" });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = nowBrasilia();
    return new TZDate(now.getFullYear(), now.getMonth(), now.getDate(), TIMEZONE);
  });
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
          startTime: toBrasilia(new Date(d.startTime)),
          endTime: toBrasilia(new Date(d.endTime))
        } as Appointment;
      });
      setAppointments(data);
    }, (error) => handleFirestoreError(error, OperationType.LIST, "appointments"));

    return () => {
      unsubAvail();
      unsubApp();
    };
  }, []);

  const handleAdminAccess = () => {
    if (isAdminLoggedIn) {
      setView(view === "student" ? "admin" : "student");
    } else {
      const email = prompt("Enter Admin Email:");
      if (email === "lucaspinheirofab@gmail.com") {
        const pass = prompt("Enter Admin Password:");
        if (pass === "AirbusA320#") {
          setIsAdminLoggedIn(true);
          setView("admin");
        } else {
          alert("Wrong password!");
        }
      } else {
        alert("Access denied!");
      }
    }
  };

  const handleLogout = () => {
    setIsAdminLoggedIn(false);
    setView("student");
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(nowBrasilia(), { weekStartsOn: 1 });
    return eachDayOfInterval({
      start,
      end: addDays(start, 6)
    });
  }, []);

  const generateTimeSlots = (date: Date) => {
    const brasiliaDate = toBrasilia(date);
    const dayOfWeek = brasiliaDate.getDay();
    const dayAvailability = availability.filter(a => a.dayOfWeek === dayOfWeek);

    if (dayAvailability.length === 0) return [];

    const slots: Date[] = [];
    dayAvailability.forEach(avail => {
      const current = setMinutes(setHours(brasiliaDate, avail.hour), 0);

      if (!isPast(addMinutes(current, 50))) {
        slots.push(current);
      }
    });

    return slots.sort((a, b) => a.getTime() - b.getTime());
  };

  const availableSlots = useMemo(() => generateTimeSlots(selectedDate), [selectedDate, availability]);

  const handleSchedule = async () => {
    if (!selectedSlot || !studentInfo.name || !studentInfo.phone) return;

    const path = "appointments";
    try {
      await addDoc(collection(db, path), {
        studentName: studentInfo.name,
        studentPhone: studentInfo.phone,
        startTime: selectedSlot.toISOString(),
        endTime: addMinutes(selectedSlot, 50).toISOString(),
        status: "booked",
        createdAt: serverTimestamp()
      });

      // WhatsApp Notification
      const message = `Hey Lucas, this time and date suits me ${format(selectedSlot, "EEEE, d MMMM").toLowerCase()} at ${format(selectedSlot, "HH:mm")}`;
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

  const toggleAvailability = async (day: number, hour: number) => {
    const slotKey = `${day}-${hour}`;
    if (pendingSlots.has(slotKey)) return;

    const existing = availability.find(a => a.dayOfWeek === day && a.hour === hour);
    const path = "availability";
    
    setPendingSlots(prev => new Set(prev).add(slotKey));
    
    try {
      if (existing) {
        await deleteDoc(doc(db, path, existing.id));
      } else {
        await addDoc(collection(db, path), {
          dayOfWeek: day,
          hour: hour
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

      <main className="max-w-4xl mx-auto p-6">
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
                  <h1 className="text-2xl font-bold">Pick a Time</h1>
                  <div className="w-10" />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                  {weekDays.map((day, i) => {
                    const isSelected = isSameDay(day, selectedDate);
                    const isToday = isSameDay(day, nowBrasilia());
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
                    <Clock className="w-4 h-4" /> Available Slots (50 min each)
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
                      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
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
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-slate-500">Manage your availability and view upcoming classes.</p>
              </div>
              <div className="flex gap-2 bg-white p-1 rounded-xl border border-slate-200">
                <button 
                  onClick={() => setAdminTab("schedule")}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${adminTab === "schedule" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Schedule
                </button>
                <button 
                  onClick={() => setAdminTab("availability")}
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${adminTab === "availability" ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  Availability
                </button>
              </div>
            </div>

            {adminTab === "schedule" ? (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100 overflow-x-auto">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Weekly Schedule
                </h3>
                
                <div className="grid grid-cols-7 min-w-[800px] gap-4">
                  {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
                    const date = addDays(startOfWeek(nowBrasilia(), { weekStartsOn: 0 }), dayOffset);
                    const dayAppointments = appointments.filter(app => 
                      isSameDay(app.startTime, date)
                    );

                    return (
                      <div key={dayOffset} className="flex flex-col gap-3">
                        <div className="text-center p-2 bg-slate-50 rounded-xl">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{format(date, "EEE")}</div>
                          <div className="text-lg font-bold">{format(date, "dd")}</div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {dayAppointments.length > 0 ? (
                            dayAppointments
                              .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                              .map((app) => (
                                <div key={app.id} className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-[10px] group relative">
                                  <div className="font-bold text-blue-700">{format(app.startTime, "HH:mm")}</div>
                                  <div className="font-medium text-slate-700 truncate">{app.studentName}</div>
                                  <div className="text-slate-500">{app.studentPhone}</div>
                                  <button 
                                    onClick={() => removeAppointment(app.id)}
                                    className="mt-2 text-red-500 hover:text-red-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-4 text-slate-300 text-[10px] italic">No classes</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    Availability Grid
                  </h3>
                  <div className="text-xs text-slate-400 font-medium italic">
                    Changes are saved automatically.
                  </div>
                </div>
                
                <div className="overflow-x-auto no-scrollbar">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-8 gap-2 mb-4">
                      <div className="w-20" /> {/* Hour label column */}
                      {[1, 2, 3, 4, 5, 6, 0].map(day => (
                        <div key={day} className="text-center font-bold text-xs uppercase tracking-widest text-slate-400">
                          {format(addDays(startOfWeek(nowBrasilia(), { weekStartsOn: 0 }), day), "EEE")}
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-2">
                      {Array.from({ length: 16 }, (_, i) => i + 7).map(hour => (
                        <div key={hour} className="grid grid-cols-8 gap-2 items-center">
                          <div className="text-right pr-4 text-[10px] font-bold text-slate-400">
                            {format(setHours(nowBrasilia(), hour), "HH:00")}
                          </div>
                          {[1, 2, 3, 4, 5, 6, 0].map(day => {
                            const isActive = availability.some(a => a.dayOfWeek === day && a.hour === hour);
                            return (
                              <button
                                key={day}
                                onClick={() => toggleAvailability(day, hour)}
                                className={`h-10 rounded-xl border transition-all ${
                                  isActive 
                                    ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-100" 
                                    : "bg-slate-50 border-slate-100 hover:border-blue-200"
                                }`}
                              >
                                {isActive && <Check className="w-4 h-4 mx-auto" />}
                              </button>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
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
