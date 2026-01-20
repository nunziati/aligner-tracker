// db/database.ts
import * as SQLite from 'expo-sqlite';

export interface DailyStat {
  date: string;       // "2023-10-27"
  totalSeconds: number; // Somma dei secondi di quel giorno
}

export interface PeriodStats {
  data: DailyStat[];
  totalSeconds: number;
  averageSeconds: number;
  daysWithData: number;
}

export interface Session {
  id: number;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  date: string;
  // Campi pulizia
  brushing: boolean;
  flossing: boolean;
  mouthwash: boolean;
  cleaningTaskId: number | null;
}

// Task di pulizia programmato
export interface CleaningTask {
  id: number;
  name: string;
  scheduledTime: string; // "HH:MM"
  requiresBrushing: boolean;
  requiresFlossing: boolean;
  requiresMouthwash: boolean;
  isActive: boolean;
}

// Stato completamento task per un giorno
export interface DayCleaningStatus {
  date: string;
  allTasksCompleted: boolean;
  completedTasks: number;
  totalTasks: number;
}

// Helper per ottenere data locale in formato YYYY-MM-DD
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Apre (o crea) il database
const db = SQLite.openDatabaseSync('aligner.db');

// Elimina tutti i dati dal database
export const resetDatabase = (): void => {
  try {
    db.runSync('DELETE FROM sessions');
    db.runSync('DELETE FROM cleaning_tasks');
    console.log('Database resettato con successo');
  } catch (error) {
    console.error('Errore durante il reset del database:', error);
    throw error;
  }
};

export const initDB = () => {
    // Crea la tabella sessioni (con nuovi campi pulizia)
    db.execSync(`
        CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        startTime INTEGER NOT NULL,
        endTime INTEGER NOT NULL,
        durationSeconds INTEGER NOT NULL,
        date TEXT NOT NULL,
        brushing INTEGER DEFAULT 0,
        flossing INTEGER DEFAULT 0,
        mouthwash INTEGER DEFAULT 0,
        cleaningTaskId INTEGER DEFAULT NULL
        );
    `);
    
    // Crea la tabella per i task di pulizia
    db.execSync(`
        CREATE TABLE IF NOT EXISTS cleaning_tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        scheduledTime TEXT NOT NULL,
        requiresBrushing INTEGER DEFAULT 1,
        requiresFlossing INTEGER DEFAULT 0,
        requiresMouthwash INTEGER DEFAULT 0,
        isActive INTEGER DEFAULT 1
        );
    `);
    
    // Migrazione: aggiungi colonne se non esistono
    try {
      db.runSync('ALTER TABLE sessions ADD COLUMN brushing INTEGER DEFAULT 0');
    } catch (e) { /* colonna già esistente */ }
    try {
      db.runSync('ALTER TABLE sessions ADD COLUMN flossing INTEGER DEFAULT 0');
    } catch (e) { /* colonna già esistente */ }
    try {
      db.runSync('ALTER TABLE sessions ADD COLUMN mouthwash INTEGER DEFAULT 0');
    } catch (e) { /* colonna già esistente */ }
    try {
      db.runSync('ALTER TABLE sessions ADD COLUMN cleaningTaskId INTEGER DEFAULT NULL');
    } catch (e) { /* colonna già esistente */ }
};

export const addSession = (
    startTime: number, 
    endTime: number,
    brushing: boolean = false,
    flossing: boolean = false,
    mouthwash: boolean = false,
    cleaningTaskId: number | null = null
) => {
    const duration = Math.floor((endTime - startTime) / 1000);
    const dateStr = getLocalDateString(new Date(startTime));

    db.runSync(
        'INSERT INTO sessions (startTime, endTime, durationSeconds, date, brushing, flossing, mouthwash, cleaningTaskId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [startTime, endTime, duration, dateStr, brushing ? 1 : 0, flossing ? 1 : 0, mouthwash ? 1 : 0, cleaningTaskId]
    );
    
    console.log("Sessione salvata nel DB:", duration, "secondi, pulizia:", { brushing, flossing, mouthwash });
};

export const getHistory = (): any[] => {
    return db.getAllSync('SELECT * FROM sessions ORDER BY startTime DESC');
};

// Ottiene i secondi totali consumati oggi (per sincronizzare con lo store)
export const getTodayTotalSeconds = (dayResetHour: number = 0): number => {
  try {
    const now = new Date();
    let logicalDate = new Date(now);
    if (now.getHours() < dayResetHour) {
      logicalDate.setDate(logicalDate.getDate() - 1);
    }
    const dateStr = getLocalDateString(logicalDate);
    
    const result = db.getAllSync(`
      SELECT SUM(durationSeconds) as totalSeconds
      FROM sessions
      WHERE date = ?
    `, [dateStr]) as { totalSeconds: number | null }[];
    
    return result.length > 0 && result[0].totalSeconds ? result[0].totalSeconds : 0;
  } catch (error) {
    console.error("Errore recupero secondi oggi:", error);
    return 0;
  }
};

// Statistiche per un singolo giorno
export const getDayStats = (date: Date): PeriodStats => {
  try {
    const dateStr = getLocalDateString(date);
    
    const result = db.getAllSync(`
      SELECT date, SUM(durationSeconds) as totalSeconds
      FROM sessions
      WHERE date = ?
      GROUP BY date
    `, [dateStr]) as DailyStat[];
    
    const totalSeconds = result.length > 0 ? result[0].totalSeconds : 0;
    
    return {
      data: result,
      totalSeconds,
      averageSeconds: totalSeconds,
      daysWithData: result.length
    };
  } catch (error) {
    console.error("Errore recupero statistiche giornaliere:", error);
    return { data: [], totalSeconds: 0, averageSeconds: 0, daysWithData: 0 };
  }
};

// Statistiche per una settimana (da lunedì a domenica)
export const getWeekStats = (weekStartDate: Date): PeriodStats => {
  try {
    const startStr = getLocalDateString(weekStartDate);
    const endDate = new Date(weekStartDate);
    endDate.setDate(endDate.getDate() + 6);
    const endStr = getLocalDateString(endDate);
    
    const result = db.getAllSync(`
      SELECT date, SUM(durationSeconds) as totalSeconds
      FROM sessions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `, [startStr, endStr]) as DailyStat[];
    
    let totalSeconds = 0;
    result.forEach(day => totalSeconds += day.totalSeconds);
    
    return {
      data: result,
      totalSeconds,
      averageSeconds: result.length > 0 ? Math.floor(totalSeconds / result.length) : 0,
      daysWithData: result.length
    };
  } catch (error) {
    console.error("Errore recupero statistiche settimanali:", error);
    return { data: [], totalSeconds: 0, averageSeconds: 0, daysWithData: 0 };
  }
};

// Statistiche per un mese intero
export const getMonthStats = (year: number, month: number): PeriodStats => {
  try {
    // month è 0-indexed (0 = gennaio)
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0); // Ultimo giorno del mese
    
    const startStr = getLocalDateString(startDate);
    const endStr = getLocalDateString(endDate);
    
    const result = db.getAllSync(`
      SELECT date, SUM(durationSeconds) as totalSeconds
      FROM sessions
      WHERE date >= ? AND date <= ?
      GROUP BY date
      ORDER BY date ASC
    `, [startStr, endStr]) as DailyStat[];
    
    let totalSeconds = 0;
    result.forEach(day => totalSeconds += day.totalSeconds);
    
    return {
      data: result,
      totalSeconds,
      averageSeconds: result.length > 0 ? Math.floor(totalSeconds / result.length) : 0,
      daysWithData: result.length
    };
  } catch (error) {
    console.error("Errore recupero statistiche mensili:", error);
    return { data: [], totalSeconds: 0, averageSeconds: 0, daysWithData: 0 };
  }
};

// Manteniamo la vecchia funzione per retrocompatibilità
export const getWeeklyStats = (): DailyStat[] => {
  const today = new Date();
  const monday = new Date(today);
  const dayOfWeek = today.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  monday.setDate(today.getDate() - diff);
  
  return getWeekStats(monday).data;
};

// Ottiene tutte le sessioni di un giorno specifico
export const getDaySessions = (date: Date): Session[] => {
  try {
    const dateStr = getLocalDateString(date);
    
    const result = db.getAllSync(`
      SELECT id, startTime, endTime, durationSeconds, date, 
             brushing, flossing, mouthwash, cleaningTaskId
      FROM sessions
      WHERE date = ?
      ORDER BY startTime ASC
    `, [dateStr]) as any[];
    
    return result.map(r => ({
      ...r,
      brushing: r.brushing === 1,
      flossing: r.flossing === 1,
      mouthwash: r.mouthwash === 1,
    }));
  } catch (error) {
    console.error("Errore recupero sessioni giornaliere:", error);
    return [];
  }
};

// Aggiorna una sessione esistente
export const updateSession = (id: number, startTime: number, endTime: number): void => {
  try {
    const duration = Math.floor((endTime - startTime) / 1000);
    const dateStr = getLocalDateString(new Date(startTime));
    
    db.runSync(
      'UPDATE sessions SET startTime = ?, endTime = ?, durationSeconds = ?, date = ? WHERE id = ?',
      [startTime, endTime, duration, dateStr, id]
    );
    
    console.log("Sessione aggiornata:", id, duration, "secondi");
  } catch (error) {
    console.error("Errore aggiornamento sessione:", error);
  }
};

// Aggiorna i dati di pulizia di una sessione
export const updateSessionCleaning = (
  id: number, 
  brushing: boolean, 
  flossing: boolean, 
  mouthwash: boolean,
  cleaningTaskId: number | null
): void => {
  try {
    db.runSync(
      'UPDATE sessions SET brushing = ?, flossing = ?, mouthwash = ?, cleaningTaskId = ? WHERE id = ?',
      [brushing ? 1 : 0, flossing ? 1 : 0, mouthwash ? 1 : 0, cleaningTaskId, id]
    );
    console.log("Pulizia sessione aggiornata:", id);
  } catch (error) {
    console.error("Errore aggiornamento pulizia sessione:", error);
  }
};

// Elimina una sessione
export const deleteSession = (id: number): void => {
  try {
    db.runSync('DELETE FROM sessions WHERE id = ?', [id]);
    console.log("Sessione eliminata:", id);
  } catch (error) {
    console.error("Errore eliminazione sessione:", error);
  }
};

// ==================== CLEANING TASKS ====================

// Ottiene tutti i task di pulizia attivi
export const getCleaningTasks = (): CleaningTask[] => {
  try {
    const result = db.getAllSync(`
      SELECT * FROM cleaning_tasks WHERE isActive = 1 ORDER BY scheduledTime ASC
    `) as any[];
    
    return result.map(r => ({
      ...r,
      requiresBrushing: r.requiresBrushing === 1,
      requiresFlossing: r.requiresFlossing === 1,
      requiresMouthwash: r.requiresMouthwash === 1,
      isActive: r.isActive === 1,
    }));
  } catch (error) {
    console.error("Errore recupero cleaning tasks:", error);
    return [];
  }
};

// Ottiene tutti i task di pulizia (inclusi inattivi)
export const getAllCleaningTasks = (): CleaningTask[] => {
  try {
    const result = db.getAllSync(`
      SELECT * FROM cleaning_tasks ORDER BY scheduledTime ASC
    `) as any[];
    
    return result.map(r => ({
      ...r,
      requiresBrushing: r.requiresBrushing === 1,
      requiresFlossing: r.requiresFlossing === 1,
      requiresMouthwash: r.requiresMouthwash === 1,
      isActive: r.isActive === 1,
    }));
  } catch (error) {
    console.error("Errore recupero all cleaning tasks:", error);
    return [];
  }
};

// Aggiunge un nuovo task di pulizia
export const addCleaningTask = (
  name: string,
  scheduledTime: string,
  requiresBrushing: boolean,
  requiresFlossing: boolean,
  requiresMouthwash: boolean
): number => {
  try {
    const result = db.runSync(
      'INSERT INTO cleaning_tasks (name, scheduledTime, requiresBrushing, requiresFlossing, requiresMouthwash, isActive) VALUES (?, ?, ?, ?, ?, 1)',
      [name, scheduledTime, requiresBrushing ? 1 : 0, requiresFlossing ? 1 : 0, requiresMouthwash ? 1 : 0]
    );
    console.log("Cleaning task aggiunto:", name);
    return result.lastInsertRowId;
  } catch (error) {
    console.error("Errore aggiunta cleaning task:", error);
    return -1;
  }
};

// Aggiorna un task di pulizia
export const updateCleaningTask = (
  id: number,
  name: string,
  scheduledTime: string,
  requiresBrushing: boolean,
  requiresFlossing: boolean,
  requiresMouthwash: boolean
): void => {
  try {
    db.runSync(
      'UPDATE cleaning_tasks SET name = ?, scheduledTime = ?, requiresBrushing = ?, requiresFlossing = ?, requiresMouthwash = ? WHERE id = ?',
      [name, scheduledTime, requiresBrushing ? 1 : 0, requiresFlossing ? 1 : 0, requiresMouthwash ? 1 : 0, id]
    );
    console.log("Cleaning task aggiornato:", id);
  } catch (error) {
    console.error("Errore aggiornamento cleaning task:", error);
  }
};

// Elimina (disattiva) un task di pulizia
export const deleteCleaningTask = (id: number): void => {
  try {
    db.runSync('UPDATE cleaning_tasks SET isActive = 0 WHERE id = ?', [id]);
    console.log("Cleaning task disattivato:", id);
  } catch (error) {
    console.error("Errore disattivazione cleaning task:", error);
  }
};

// Elimina permanentemente un task di pulizia
export const permanentlyDeleteCleaningTask = (id: number): void => {
  try {
    db.runSync('DELETE FROM cleaning_tasks WHERE id = ?', [id]);
    console.log("Cleaning task eliminato:", id);
  } catch (error) {
    console.error("Errore eliminazione cleaning task:", error);
  }
};

// Verifica se i task di pulizia di un giorno sono stati completati
export const getDayCleaningStatus = (date: Date): DayCleaningStatus => {
  try {
    const dateStr = getLocalDateString(date);
    const tasks = getCleaningTasks();
    
    if (tasks.length === 0) {
      return { date: dateStr, allTasksCompleted: true, completedTasks: 0, totalTasks: 0 };
    }
    
    // Ottieni le sessioni del giorno con i loro task associati
    const sessions = db.getAllSync(`
      SELECT cleaningTaskId, brushing, flossing, mouthwash 
      FROM sessions 
      WHERE date = ? AND cleaningTaskId IS NOT NULL
    `, [dateStr]) as any[];
    
    let completedTasks = 0;
    
    for (const task of tasks) {
      // Trova se c'è una sessione associata a questo task
      const session = sessions.find(s => s.cleaningTaskId === task.id);
      
      if (session) {
        // Verifica se tutti i requisiti del task sono stati soddisfatti
        const brushingOk = !task.requiresBrushing || session.brushing === 1;
        const flossingOk = !task.requiresFlossing || session.flossing === 1;
        const mouthwashOk = !task.requiresMouthwash || session.mouthwash === 1;
        
        if (brushingOk && flossingOk && mouthwashOk) {
          completedTasks++;
        }
      }
    }
    
    return {
      date: dateStr,
      allTasksCompleted: completedTasks >= tasks.length,
      completedTasks,
      totalTasks: tasks.length
    };
  } catch (error) {
    console.error("Errore verifica cleaning status:", error);
    return { date: getLocalDateString(date), allTasksCompleted: true, completedTasks: 0, totalTasks: 0 };
  }
};

// Ottieni lo stato di completamento pulizia per un range di date
export const getCleaningStatusForRange = (startDate: Date, endDate: Date): Map<string, DayCleaningStatus> => {
  const result = new Map<string, DayCleaningStatus>();
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const status = getDayCleaningStatus(current);
    result.set(status.date, status);
    current.setDate(current.getDate() + 1);
  }
  
  return result;
};