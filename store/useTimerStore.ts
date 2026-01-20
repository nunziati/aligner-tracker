import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addSession, getTodayTotalSeconds } from '../db/database';
import { scheduleReturnReminder, cancelReturnReminder } from '../utils/notifications';

// Impostiamo un budget di default di 2 ore (7200 secondi)
const DEFAULT_GOAL_HOURS = 22;
const DEFAULT_GOAL_MINUTES = 0;

// Interfaccia per singola mascherina nel piano
export interface TrayPlan {
    trayNumber: number;
    startDate: string; // ISO date
    isUpper: boolean; // true = superiore, false = inferiore
}

interface TimerState {
    isAlignersOut: boolean;
    outStartTime: number | null;
    secondsConsumedToday: number;
    secondsRemaining: number;
    lastResetDate: string | null;

    // Obiettivo giornaliero in ore e minuti
    dailyGoalHours: number;
    dailyGoalMinutes: number;
    
    // Ora reset giornaliero
    dayResetHour: number;

    // Ritardo promemoria notifica (in minuti)
    reminderDelayMinutes: number;

    // Durata minima sessione (in secondi) - sessioni più brevi non vengono salvate
    minSessionSeconds: number;

    // Sistema Piano Mascherine
    upperTrays: TrayPlan[]; // Piano mascherine superiori
    lowerTrays: TrayPlan[]; // Piano mascherine inferiori
    currentUpperTray: number; // Mascherina superiore attuale (1-indexed)
    currentLowerTray: number; // Mascherina inferiore attuale (1-indexed)

    toggleAligners: (cleaningData?: { brushing: boolean; flossing: boolean; mouthwash: boolean; taskId: number | null }) => void;
    tick: () => void;
    checkDailyReset: () => void;

    setDailyGoal: (hours: number, minutes: number) => void;
    setDayResetHour: (hour: number) => void;
    setReminderDelay: (minutes: number) => void;
    setMinSessionSeconds: (seconds: number) => void;
    reloadTodaySeconds: () => void;
    
    // Funzioni per il piano
    setupPlan: (upperCount: number, lowerCount: number, daysPerTray: number, startDate: string) => void;
    updateTrayDate: (isUpper: boolean, trayIndex: number, newDate: string) => void;
    setCurrentTray: (isUpper: boolean, trayNumber: number) => void;
}

// Funzione helper per calcolare il budget in secondi
const calculateBudgetSeconds = (hours: number, minutes: number) => {
    const goalInMinutes = hours * 60 + minutes;
    return (24 * 60 - goalInMinutes) * 60;
};

export const useTimerStore = create<TimerState>()(
    persist(
        (set, get) => ({
            isAlignersOut: false,
            outStartTime: null,
            secondsConsumedToday: 0,
            secondsRemaining: calculateBudgetSeconds(DEFAULT_GOAL_HOURS, DEFAULT_GOAL_MINUTES),
            lastResetDate: new Date().toDateString(),

            dailyGoalHours: DEFAULT_GOAL_HOURS,
            dailyGoalMinutes: DEFAULT_GOAL_MINUTES,
            dayResetHour: 0,
            reminderDelayMinutes: 60, // Default: 1 ora
            minSessionSeconds: 10, // Default: 10 secondi

            // Piano mascherine
            upperTrays: [],
            lowerTrays: [],
            currentUpperTray: 1,
            currentLowerTray: 1,

            toggleAligners: async (cleaningData?: { brushing: boolean; flossing: boolean; mouthwash: boolean; taskId: number | null }) => {
                const { isAlignersOut, outStartTime, secondsConsumedToday, dailyGoalHours, dailyGoalMinutes, reminderDelayMinutes, minSessionSeconds } = get();
                const budgetSeconds = calculateBudgetSeconds(dailyGoalHours, dailyGoalMinutes);

                if (!isAlignersOut) {
                    // LI HO TOLTI
                    await scheduleReturnReminder(reminderDelayMinutes * 60);

                    set({ 
                        isAlignersOut: true, 
                        outStartTime: Date.now() 
                    });
                } else {
                    // LI RIMETTO
                    await cancelReturnReminder();

                    if (outStartTime) {
                        const now = Date.now();
                        const sessionSeconds = Math.floor((now - outStartTime) / 1000);
                        
                        // Solo se la sessione supera la durata minima, salva e aggiorna il timer
                        if (sessionSeconds >= minSessionSeconds) {
                            // Salva con i dati di pulizia se forniti
                            addSession(
                                outStartTime, 
                                now,
                                cleaningData?.brushing ?? false,
                                cleaningData?.flossing ?? false,
                                cleaningData?.mouthwash ?? false,
                                cleaningData?.taskId ?? null
                            );
                            const newTotalConsumed = secondsConsumedToday + sessionSeconds;
                            
                            set({ 
                                isAlignersOut: false, 
                                outStartTime: null,
                                secondsConsumedToday: newTotalConsumed,
                                secondsRemaining: budgetSeconds - newTotalConsumed
                            });
                        } else {
                            // Sessione troppo breve: non salvare e ripristina il timer
                            set({ 
                                isAlignersOut: false, 
                                outStartTime: null,
                                secondsRemaining: budgetSeconds - secondsConsumedToday
                            });
                        }
                    }
                }
            },

            tick: () => {
                const { isAlignersOut, outStartTime, secondsConsumedToday, dailyGoalHours, dailyGoalMinutes } = get();
                const budgetSeconds = calculateBudgetSeconds(dailyGoalHours, dailyGoalMinutes);
                
                get().checkDailyReset();

                if (isAlignersOut && outStartTime) {
                    const currentSessionSeconds = Math.floor((Date.now() - outStartTime) / 1000);
                    const totalUsed = secondsConsumedToday + currentSessionSeconds;
                    const remaining = budgetSeconds - totalUsed;
                    
                    set({ secondsRemaining: remaining });
                }
            },

            checkDailyReset: () => {
                const { lastResetDate, dayResetHour, dailyGoalHours, dailyGoalMinutes } = get();
                const budgetSeconds = calculateBudgetSeconds(dailyGoalHours, dailyGoalMinutes);
                const now = new Date();
                
                let logicalDate = new Date(now);
                if (now.getHours() < dayResetHour) {
                    logicalDate.setDate(logicalDate.getDate() - 1);
                }
                const today = logicalDate.toDateString();

                if (lastResetDate !== today) {
                    set({
                        secondsConsumedToday: 0,
                        secondsRemaining: budgetSeconds,
                        lastResetDate: today,
                    });
                }
            },

            setDailyGoal: (hours, minutes) => {
                const { secondsConsumedToday } = get();
                const budgetSeconds = calculateBudgetSeconds(hours, minutes);
                set({ 
                    dailyGoalHours: hours,
                    dailyGoalMinutes: minutes,
                    secondsRemaining: budgetSeconds - secondsConsumedToday
                });
            },

            setDayResetHour: (hour) => {
                set({ dayResetHour: hour });
            },

            setReminderDelay: (minutes) => {
                set({ reminderDelayMinutes: minutes });
            },

            setMinSessionSeconds: (seconds) => {
                set({ minSessionSeconds: seconds });
            },

            reloadTodaySeconds: () => {
                const { dayResetHour, dailyGoalHours, dailyGoalMinutes } = get();
                const budgetSeconds = calculateBudgetSeconds(dailyGoalHours, dailyGoalMinutes);
                const todaySeconds = getTodayTotalSeconds(dayResetHour);
                
                set({
                    secondsConsumedToday: todaySeconds,
                    secondsRemaining: budgetSeconds - todaySeconds
                });
            },

            setupPlan: (upperCount, lowerCount, daysPerTray, startDate) => {
                const start = new Date(startDate);
                
                const upperTrays: TrayPlan[] = [];
                const lowerTrays: TrayPlan[] = [];
                
                for (let i = 0; i < upperCount; i++) {
                    const trayDate = new Date(start);
                    trayDate.setDate(start.getDate() + (i * daysPerTray));
                    upperTrays.push({
                        trayNumber: i + 1,
                        startDate: trayDate.toISOString(),
                        isUpper: true
                    });
                }
                
                for (let i = 0; i < lowerCount; i++) {
                    const trayDate = new Date(start);
                    trayDate.setDate(start.getDate() + (i * daysPerTray));
                    lowerTrays.push({
                        trayNumber: i + 1,
                        startDate: trayDate.toISOString(),
                        isUpper: false
                    });
                }
                
                set({ 
                    upperTrays, 
                    lowerTrays,
                    currentUpperTray: 1,
                    currentLowerTray: 1
                });
            },

            updateTrayDate: (isUpper, trayIndex, newDate) => {
                const { upperTrays, lowerTrays } = get();
                const trays = isUpper ? [...upperTrays] : [...lowerTrays];
                
                if (trayIndex < 0 || trayIndex >= trays.length) return;
                
                const oldDate = new Date(trays[trayIndex].startDate);
                const newDateObj = new Date(newDate);
                const diffDays = Math.round((newDateObj.getTime() - oldDate.getTime()) / (1000 * 60 * 60 * 24));
                
                // Aggiorna questa mascherina e shifta tutte le successive
                for (let i = trayIndex; i < trays.length; i++) {
                    const currentDate = new Date(trays[i].startDate);
                    if (i === trayIndex) {
                        trays[i] = { ...trays[i], startDate: newDate };
                    } else {
                        currentDate.setDate(currentDate.getDate() + diffDays);
                        trays[i] = { ...trays[i], startDate: currentDate.toISOString() };
                    }
                }
                
                if (isUpper) {
                    set({ upperTrays: trays });
                } else {
                    set({ lowerTrays: trays });
                }
            },

            setCurrentTray: (isUpper, trayNumber) => {
                if (isUpper) {
                    set({ currentUpperTray: trayNumber });
                } else {
                    set({ currentLowerTray: trayNumber });
                }
            }
        }),
        {
            name: 'timer-storage',
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);
