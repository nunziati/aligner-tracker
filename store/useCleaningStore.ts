import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  CleaningTask, 
  getCleaningTasks, 
  addCleaningTask as dbAddTask,
  updateCleaningTask as dbUpdateTask,
  deleteCleaningTask as dbDeleteTask 
} from '../db/database';

interface CleaningState {
  // Stato corrente della sessione di pulizia
  currentBrushing: boolean;
  currentFlossing: boolean;
  currentMouthwash: boolean;
  currentTaskId: number | null;
  
  // Cache dei task (per evitare query continue)
  tasks: CleaningTask[];
  
  // Azioni per la sessione corrente
  setBrushing: (value: boolean) => void;
  setFlossing: (value: boolean) => void;
  setMouthwash: (value: boolean) => void;
  setCurrentTaskId: (id: number | null) => void;
  resetCurrentSession: () => void;
  
  // Azioni per gestire i task
  loadTasks: () => void;
  addTask: (name: string, scheduledTime: string, requiresBrushing: boolean, requiresFlossing: boolean, requiresMouthwash: boolean) => void;
  updateTask: (id: number, name: string, scheduledTime: string, requiresBrushing: boolean, requiresFlossing: boolean, requiresMouthwash: boolean) => void;
  removeTask: (id: number) => void;
  
  // Getter per lo stato corrente
  getCurrentCleaningState: () => { brushing: boolean; flossing: boolean; mouthwash: boolean; taskId: number | null };
}

export const useCleaningStore = create<CleaningState>()(
  persist(
    (set, get) => ({
      currentBrushing: false,
      currentFlossing: false,
      currentMouthwash: false,
      currentTaskId: null,
      tasks: [],
      
      setBrushing: (value: boolean) => set({ currentBrushing: value }),
      setFlossing: (value: boolean) => set({ currentFlossing: value }),
      setMouthwash: (value: boolean) => set({ currentMouthwash: value }),
      setCurrentTaskId: (id: number | null) => {
        // Seleziona solo il task, l'utente deve attivare manualmente i sotto-task completati
        set({ currentTaskId: id });
      },
      
      resetCurrentSession: () => set({
        currentBrushing: false,
        currentFlossing: false,
        currentMouthwash: false,
        currentTaskId: null,
      }),
      
      loadTasks: () => {
        const tasks = getCleaningTasks();
        set({ tasks });
      },
      
      addTask: (name, scheduledTime, requiresBrushing, requiresFlossing, requiresMouthwash) => {
        dbAddTask(name, scheduledTime, requiresBrushing, requiresFlossing, requiresMouthwash);
        get().loadTasks();
      },
      
      updateTask: (id, name, scheduledTime, requiresBrushing, requiresFlossing, requiresMouthwash) => {
        dbUpdateTask(id, name, scheduledTime, requiresBrushing, requiresFlossing, requiresMouthwash);
        get().loadTasks();
      },
      
      removeTask: (id) => {
        dbDeleteTask(id);
        get().loadTasks();
      },
      
      getCurrentCleaningState: () => ({
        brushing: get().currentBrushing,
        flossing: get().currentFlossing,
        mouthwash: get().currentMouthwash,
        taskId: get().currentTaskId,
      }),
    }),
    {
      name: 'cleaning-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Non persistiamo lo stato della sessione corrente, solo i task cached
        tasks: state.tasks,
      }),
    }
  )
);
