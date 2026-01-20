import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Modal, Alert, Switch } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BarChart } from 'react-native-gifted-charts';
import { getDayStats, getWeekStats, getMonthStats, DailyStat, PeriodStats, getDaySessions, updateSession, updateSessionCleaning, deleteSession, Session, addSession, getCleaningTasks, CleaningTask, getDayCleaningStatus } from '../../db/database';
import { useTimerStore } from '../../store/useTimerStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, Gesture, ScrollView, GestureHandlerRootView } from 'react-native-gesture-handler';
import DateTimePicker from '@react-native-community/datetimepicker';
import Reanimated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withTiming, 
  runOnJS,
  withSequence 
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 50;

// --- HELPER FUNCTIONS ---

const formatHoursMinutes = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const getMonday = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatWeekRange = (monday: Date): string => {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.getDate()} - ${sunday.getDate()} ${sunday.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' })}`;
};

const formatMonth = (year: number, month: number): string => {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

const formatYAxisLabel = (label: string): string => {
  const value = parseFloat(label);
  if (isNaN(value)) return label;
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
};

const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

// --- COMPONENTE PRINCIPALE ---

export default function HistoryScreen() {
  const { dailyGoalHours, reloadTodaySeconds, isAlignersOut } = useTimerStore();
  const { colors, isDark } = useAppTheme();
  const dailyGoalMinutes = 0; 
  
  // Stati
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedWeekStart, setSelectedWeekStart] = useState(getMonday(new Date()));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Refs per accedere allo stato corrente dentro le funzioni runOnJS
  const viewModeRef = useRef(viewMode);
  const selectedDateRef = useRef(selectedDate);
  const selectedWeekStartRef = useRef(selectedWeekStart);
  const selectedMonthRef = useRef(selectedMonth);
  const selectedYearRef = useRef(selectedYear);
  
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { selectedWeekStartRef.current = selectedWeekStart; }, [selectedWeekStart]);
  useEffect(() => { selectedMonthRef.current = selectedMonth; }, [selectedMonth]);
  useEffect(() => { selectedYearRef.current = selectedYear; }, [selectedYear]);
  
  // Dati
  const [stats, setStats] = useState<PeriodStats>({ data: [], totalSeconds: 0, averageSeconds: 0, daysWithData: 0 });
  const [chartData, setChartData] = useState<any[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [chartVersion, setChartVersion] = useState(0); // Per forzare re-render del grafico
  
  // Stato per modifica sessioni
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tempStartTime, setTempStartTime] = useState<Date>(new Date());
  const [tempEndTime, setTempEndTime] = useState<Date>(new Date());
  
  // Stato per aggiunta nuova sessione
  const [showAddSession, setShowAddSession] = useState(false);
  const [newSessionStart, setNewSessionStart] = useState<Date>(new Date());
  const [newSessionEnd, setNewSessionEnd] = useState<Date>(new Date());
  const [showNewStartPicker, setShowNewStartPicker] = useState(false);
  const [showNewEndPicker, setShowNewEndPicker] = useState(false);
  
  // Stato per dati pulizia sessione
  const [editBrushing, setEditBrushing] = useState(false);
  const [editFlossing, setEditFlossing] = useState(false);
  const [editMouthwash, setEditMouthwash] = useState(false);
  const [editTaskId, setEditTaskId] = useState<number | null>(null);
  const [cleaningTasks, setCleaningTasks] = useState<CleaningTask[]>([]);
  
  // Limiti
  const goalInMinutes = dailyGoalHours * 60 + dailyGoalMinutes;
  const dailyLimitMinutes = 24 * 60 - goalInMinutes;
  const dailyLimitHours = dailyLimitMinutes / 60;

  // --- REANIMATED SETUP ---
  const translateX = useSharedValue(0);
  const opacityValue = useSharedValue(1);
  const isLocked = useSharedValue(false);

  // 1. Funzione logica JS (chiamata dal thread UI)
  const navigatePeriod = useCallback((direction: number) => {
    const currentViewMode = viewModeRef.current;
    
    switch (currentViewMode) {
      case 'day':
        const currentDate = new Date(selectedDateRef.current);
        currentDate.setDate(currentDate.getDate() + direction);
        setSelectedDate(new Date(currentDate));
        break;
      case 'week':
        const currentWeek = new Date(selectedWeekStartRef.current);
        currentWeek.setDate(currentWeek.getDate() + (direction * 7));
        setSelectedWeekStart(new Date(currentWeek));
        break;
      case 'month':
        let newMonth = selectedMonthRef.current + direction;
        let newYear = selectedYearRef.current;
        if (newMonth > 11) {
          newMonth = 0;
          newYear++;
        } else if (newMonth < 0) {
          newMonth = 11;
          newYear--;
        }
        setSelectedMonth(newMonth);
        setSelectedYear(newYear);
        break;
    }
  }, []);

  // 2. Definizione Gesture
  const panGesture = useMemo(() => Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      if (isLocked.value) return;

      translateX.value = event.translationX * 0.5;
      opacityValue.value = 1 - Math.min(Math.abs(event.translationX) / SCREEN_WIDTH, 0.3);
    })
    .onEnd((event) => {
      if (isLocked.value) return;

      if (Math.abs(event.translationX) > SWIPE_THRESHOLD || Math.abs(event.velocityX) > 500) {
        const direction = event.translationX > 0 ? -1 : 1;
        
        // BLOCCA SWIPE
        isLocked.value = true;
        
        // Animazione Swipe Via
        translateX.value = withSequence(
          withTiming(direction * -SCREEN_WIDTH * 0.2, { duration: 100 }),
          withTiming(direction * SCREEN_WIDTH * 0.2, { duration: 0 }),
          withTiming(0, { duration: 150 }, (finished) => {
            if (finished) {
              isLocked.value = false; // SBLOCCA
            }
          })
        );
        
        opacityValue.value = withSequence(
          withTiming(0.4, { duration: 100 }),
          withTiming(1, { duration: 150 })
        );
        
        // Esegui logica JS
        runOnJS(navigatePeriod)(direction);
      } else {
        // Reset elastico
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        opacityValue.value = withTiming(1, { duration: 200 });
      }
    }), [navigatePeriod]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacityValue.value
  }));

  // 3. Navigazione Pulsanti (Chevron)
  const navigateWithAnimation = useCallback((direction: number) => {
    // Animazione veloce
    translateX.value = withSequence(
      withTiming(direction * -SCREEN_WIDTH * 0.2, { duration: 100 }),
      withTiming(direction * SCREEN_WIDTH * 0.2, { duration: 0 }),
      withTiming(0, { duration: 150 })
    );
    
    opacityValue.value = withSequence(
      withTiming(0.4, { duration: 100 }),
      withTiming(1, { duration: 150 })
    );
    
    navigatePeriod(direction);
  }, [navigatePeriod]);

  // --- CARICAMENTO DATI ---

  // Converti le date in stringhe per un confronto affidabile nell'useEffect
  const selectedDateStr = selectedDate.toISOString();
  const selectedWeekStartStr = selectedWeekStart.toISOString();

  const loadData = useCallback(() => {
    const currentViewMode = viewModeRef.current;
    const currentSelectedDate = selectedDateRef.current;
    const currentSelectedWeekStart = selectedWeekStartRef.current;
    const currentSelectedMonth = selectedMonthRef.current;
    const currentSelectedYear = selectedYearRef.current;
    
    let periodStats: PeriodStats;
    
    switch (currentViewMode) {
      case 'day':
        periodStats = getDayStats(currentSelectedDate);
        // Carica anche le sessioni per la vista giornaliera
        const daySessions = getDaySessions(currentSelectedDate);
        setSessions(daySessions);
        break;
      case 'week':
        periodStats = getWeekStats(currentSelectedWeekStart);
        setSessions([]);
        break;
      case 'month':
        periodStats = getMonthStats(currentSelectedYear, currentSelectedMonth);
        setSessions([]);
        break;
    }
    
    setStats(periodStats);
    
    // FIX BARRE GRIGIE: Se value=0, frontColor='transparent'
    
    if (currentViewMode === 'day') {
      if (periodStats.totalSeconds > 0) {
        const hours = periodStats.totalSeconds / 3600;
        const isUnderLimit = hours <= dailyLimitHours;
        setChartData([{
          value: hours,
          label: 'Oggi',
          frontColor: isUnderLimit ? '#4ADDBA' : '#FF7F7F',
          topLabelComponent: () => (
            <Text style={{ color: isUnderLimit ? '#2ecc71' : '#e74c3c', fontSize: 12, marginBottom: 5, fontWeight: '600' }}>
              {formatHoursMinutes(periodStats.totalSeconds)}
            </Text>
          ),
        }]);
      } else {
        setChartData([]);
      }
    } else if (currentViewMode === 'week') {
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(currentSelectedWeekStart);
        dayDate.setDate(currentSelectedWeekStart.getDate() + i);
        // Usa formato locale per evitare problemi di timezone
        const year = dayDate.getFullYear();
        const month = String(dayDate.getMonth() + 1).padStart(2, '0');
        const day = String(dayDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        
        const dayStats = periodStats.data.find((d: DailyStat) => d.date === dateStr);
        const seconds = dayStats?.totalSeconds || 0;
        const hours = seconds / 3600;
        const isUnderLimit = hours <= dailyLimitHours;
        
        // Verifica completamento task pulizia per questo giorno
        const cleaningStatus = getDayCleaningStatus(dayDate);
        const hasCleaningTasks = cleaningStatus.totalTasks > 0;
        const allCleaningDone = cleaningStatus.allTasksCompleted;
        
        weekData.push({
          value: hours,
          label: WEEKDAYS[i],
          // Se 0 -> transparent, altrimenti il colore giusto
          frontColor: seconds === 0 ? 'transparent' : (isUnderLimit ? '#4ADDBA' : '#FF7F7F'),
          topLabelComponent: seconds > 0 ? () => (
            <Text style={{ color: isUnderLimit ? '#2ecc71' : '#e74c3c', fontSize: 9, marginBottom: 3, fontWeight: '600' }}>
              {formatHoursMinutes(seconds)}
            </Text>
          ) : undefined,
          // Indicatore pulizia sotto la barra
          cleaningStatus: hasCleaningTasks ? (allCleaningDone ? 'complete' : 'incomplete') : 'none',
        });
      }
      setChartData(weekData);
    } else {
      // Vista Mese
      const daysInMonth = getDaysInMonth(currentSelectedYear, currentSelectedMonth);
      const monthData = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentSelectedYear}-${String(currentSelectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayStats = periodStats.data.find((d: DailyStat) => d.date === dateStr);
        const seconds = dayStats?.totalSeconds || 0;
        const hours = seconds / 3600;
        const isUnderLimit = hours <= dailyLimitHours;
        
        const showLabel = day === 1 || day % 5 === 0 || day === daysInMonth;
        
        // Verifica completamento task pulizia per questo giorno
        const dayDateObj = new Date(currentSelectedYear, currentSelectedMonth, day);
        const cleaningStatus = getDayCleaningStatus(dayDateObj);
        const hasCleaningTasks = cleaningStatus.totalTasks > 0;
        const allCleaningDone = cleaningStatus.allTasksCompleted;
        
        monthData.push({
          value: hours,
          label: showLabel ? String(day) : '',
          // Se 0 -> transparent
          frontColor: seconds === 0 ? 'transparent' : (isUnderLimit ? '#4ADDBA' : '#FF7F7F'),
          // Indicatore pulizia sotto la barra
          cleaningStatus: hasCleaningTasks ? (allCleaningDone ? 'complete' : 'incomplete') : 'none',
        });
      }
      setChartData(monthData);
    }
    
    // Incrementa la versione per forzare il re-render del grafico
    setChartVersion(v => v + 1);
  }, [dailyLimitHours]);

  // Ricarica i dati quando la schermata riceve il focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Ricarica i dati quando cambiano i parametri di visualizzazione
  useEffect(() => {
    loadData();
  }, [viewMode, selectedDateStr, selectedWeekStartStr, selectedMonth, selectedYear, loadData]);

  // --- GESTIONE SESSIONI ---
  
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const openEditSession = (session: Session) => {
    setEditingSession(session);
    setTempStartTime(new Date(session.startTime));
    setTempEndTime(new Date(session.endTime));
    // Carica i dati di pulizia della sessione
    setEditBrushing(session.brushing);
    setEditFlossing(session.flossing);
    setEditMouthwash(session.mouthwash);
    setEditTaskId(session.cleaningTaskId);
    // Carica i task disponibili
    setCleaningTasks(getCleaningTasks());
  };

  const handleStartTimeChange = (event: any, date?: Date) => {
    setShowStartPicker(false);
    if (date && editingSession) {
      // Assicurati che l'orario di inizio sia prima dell'orario di fine
      if (date.getTime() < tempEndTime.getTime()) {
        setTempStartTime(date);
      } else {
        Alert.alert('Errore', 'L\'orario di inizio deve essere prima dell\'orario di fine');
      }
    }
  };

  const handleEndTimeChange = (event: any, date?: Date) => {
    setShowEndPicker(false);
    if (date && editingSession) {
      // Assicurati che l'orario di fine sia dopo l'orario di inizio
      if (date.getTime() > tempStartTime.getTime()) {
        setTempEndTime(date);
      } else {
        Alert.alert('Errore', 'L\'orario di fine deve essere dopo l\'orario di inizio');
      }
    }
  };

  const saveSessionChanges = () => {
    if (editingSession) {
      updateSession(editingSession.id, tempStartTime.getTime(), tempEndTime.getTime());
      updateSessionCleaning(editingSession.id, editBrushing, editFlossing, editMouthwash, editTaskId);
      setEditingSession(null);
      reloadTodaySeconds(); // Aggiorna il timer nella home
      loadData(); // Ricarica i dati
    }
  };

  const confirmDeleteSession = (session: Session) => {
    Alert.alert(
      'Elimina Sessione',
      `Vuoi eliminare questa sessione?\n${formatTime(session.startTime)} - ${formatTime(session.endTime)}`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: () => {
            deleteSession(session.id);
            reloadTodaySeconds(); // Aggiorna il timer nella home
            loadData();
          }
        }
      ]
    );
  };

  // --- AGGIUNTA NUOVA SESSIONE ---
  
  const openAddSession = () => {
    // Imposta orari di default per la nuova sessione (ultima ora)
    const now = new Date(selectedDate);
    now.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
    const oneHourAgo = new Date(now);
    oneHourAgo.setHours(now.getHours() - 1);
    
    setNewSessionStart(oneHourAgo);
    setNewSessionEnd(now);
    setShowAddSession(true);
  };

  const handleNewStartTimeChange = (event: any, date?: Date) => {
    setShowNewStartPicker(false);
    if (date) {
      if (date.getTime() < newSessionEnd.getTime()) {
        setNewSessionStart(date);
      } else {
        Alert.alert('Errore', 'L\'orario di inizio deve essere prima dell\'orario di fine');
      }
    }
  };

  const handleNewEndTimeChange = (event: any, date?: Date) => {
    setShowNewEndPicker(false);
    if (date) {
      if (date.getTime() > newSessionStart.getTime()) {
        setNewSessionEnd(date);
      } else {
        Alert.alert('Errore', 'L\'orario di fine deve essere dopo l\'orario di inizio');
      }
    }
  };

  const saveNewSession = () => {
    // Crea la sessione con la data selezionata
    const startTime = new Date(selectedDate);
    startTime.setHours(newSessionStart.getHours(), newSessionStart.getMinutes(), 0, 0);
    
    const endTime = new Date(selectedDate);
    endTime.setHours(newSessionEnd.getHours(), newSessionEnd.getMinutes(), 0, 0);
    
    // Validazione: orario fine dopo orario inizio
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert('Errore', 'L\'orario di fine deve essere dopo l\'orario di inizio');
      return;
    }
    
    // Validazione: non nel futuro
    const now = new Date();
    if (endTime.getTime() > now.getTime()) {
      Alert.alert('Errore', 'Non puoi creare sessioni nel futuro');
      return;
    }
    
    // Validazione: se è oggi e il timer è attivo, non permettere
    const today = new Date();
    const isToday = selectedDate.toDateString() === today.toDateString();
    if (isToday && isAlignersOut) {
      Alert.alert('Errore', 'Non puoi aggiungere sessioni mentre il timer è attivo.\nRimetti prima l\'apparecchio.');
      return;
    }
    
    // Validazione: non sovrapporre sessioni esistenti
    const hasOverlap = sessions.some(session => {
      const sessionStart = session.startTime;
      const sessionEnd = session.endTime;
      // Controlla sovrapposizione
      return (startTime.getTime() < sessionEnd && endTime.getTime() > sessionStart);
    });
    
    if (hasOverlap) {
      Alert.alert('Errore', 'La sessione si sovrappone a una sessione esistente');
      return;
    }
    
    addSession(startTime.getTime(), endTime.getTime());
    setShowAddSession(false);
    reloadTodaySeconds();
    loadData();
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setSelectedWeekStart(getMonday(today));
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  };

  const getPeriodLabel = (): string => {
    switch (viewMode) {
      case 'day':
        return formatDate(selectedDate);
      case 'week':
        return formatWeekRange(selectedWeekStart);
      case 'month':
        return formatMonth(selectedYear, selectedMonth);
    }
  };

  const isAverageGood = stats.averageSeconds / 3600 <= dailyLimitHours;

  // Colori dinamici per il grafico
  const chartBarGood = colors.chartBar;
  const chartBarBad = colors.chartBarOver;

  // Chiave unica per forzare re-render del grafico quando cambiano i dati
  const chartKey = useMemo(() => {
    return `chart-${viewMode}-${chartVersion}`;
  }, [viewMode, chartVersion]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tempo Senza Apparecchio</Text>
        
        {/* Tab selector */}
        <View style={[styles.viewSelector, { backgroundColor: colors.separator }]}>
          {(['day', 'week', 'month'] as const).map((mode) => (
            <TouchableOpacity 
              key={mode}
              style={[styles.viewTab, viewMode === mode && { backgroundColor: colors.cardBackground }]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewTabText, { color: colors.textTertiary }, viewMode === mode && { color: colors.text, fontWeight: '600' }]}>
                {mode === 'day' ? 'Giorno' : mode === 'week' ? 'Settimana' : 'Mese'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Navigazione */}
        <View style={styles.periodNav}>
          <TouchableOpacity style={styles.navButton} onPress={() => navigateWithAnimation(-1)}>
            <Ionicons name="chevron-back" size={24} color={colors.tint} />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.periodLabelContainer} onPress={goToToday}>
            <Text style={[styles.periodLabel, { color: colors.text }]}>{getPeriodLabel()}</Text>
            <Text style={[styles.todayHint, { color: colors.tint }]}>Tocca per tornare a oggi</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.navButton} onPress={() => navigateWithAnimation(1)}>
            <Ionicons name="chevron-forward" size={24} color={colors.tint} />
          </TouchableOpacity>
        </View>

        {/* Swipe Container */}
        <GestureDetector gesture={panGesture}>
          <Reanimated.View style={[styles.swipeContainer, animatedStyle]}>
            
            {/* Scheda Riepilogo */}
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>
                {viewMode === 'day' ? 'Totale Giorno' : 'Media Giornaliera'}
              </Text>
              <Text style={[styles.summaryValue, { color: isAverageGood ? colors.success : colors.error }]}>
                {formatHoursMinutes(viewMode === 'day' ? stats.totalSeconds : stats.averageSeconds)}
              </Text>
              <Text style={[styles.summarySub, { color: colors.textTertiary }]}>
                Limite: {formatHoursMinutes(dailyLimitMinutes * 60)}
              </Text>
              {viewMode !== 'day' && stats.daysWithData > 0 && (
                <Text style={[styles.daysInfo, { color: colors.textTertiary }]}>
                  Dati disponibili per {stats.daysWithData} {stats.daysWithData === 1 ? 'giorno' : 'giorni'}
                </Text>
              )}
              <Text style={[styles.goalHint, { color: isAverageGood ? colors.success : colors.error }]}>
                {isAverageGood 
                  ? '✓ Ottimo! Stai rispettando il limite' 
                  : '⚠ Attenzione! Stai superando il limite'}
              </Text>
            </View>

            {/* Il Grafico */}
            <View style={[styles.chartContainer, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>
                {viewMode === 'day' ? 'Dettaglio Giorno' : viewMode === 'week' ? 'Dettaglio Settimana' : 'Dettaglio Mese'}
              </Text>
              {chartData.length > 0 ? (
                <BarChart
                  key={chartKey}
                  data={chartData.map(d => ({
                    ...d,
                    frontColor: d.frontColor === 'transparent' ? 'transparent' : (d.frontColor === '#4ADDBA' ? chartBarGood : chartBarBad)
                  }))}
                  barWidth={viewMode === 'day' ? 60 : viewMode === 'week' ? Math.floor((SCREEN_WIDTH - 100) / 7) - 6 : Math.floor((SCREEN_WIDTH - 80) / chartData.length) - 2}
                  spacing={viewMode === 'day' ? 20 : viewMode === 'week' ? 6 : 2}
                  noOfSections={4}
                  disableScroll={true}
                  width={SCREEN_WIDTH - 80}
                  barBorderRadius={viewMode === 'month' ? 2 : 4}
                  frontColor={colors.tint}
                  yAxisThickness={0}
                  xAxisThickness={0}
                  maxValue={Math.max(dailyLimitHours * 2, 1)}
                  isAnimated
                  animationDuration={300}
                  rulesColor={colors.chartRule}
                  rulesType="solid"
                  yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                  formatYLabel={formatYAxisLabel}
                  xAxisLabelTextStyle={{ color: colors.textTertiary, textAlign: 'center', fontSize: viewMode === 'month' ? 9 : 11, width: viewMode === 'month' ? 40: undefined, marginLeft: viewMode === 'month' ? -12 : 0 }}
                  showReferenceLine1
                  referenceLine1Position={dailyLimitHours}
                  referenceLine1Config={{
                    color: colors.error,
                    dashWidth: 5,
                    dashGap: 3
                  }}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textTertiary} />
                  <Text style={{ color: colors.textTertiary, marginTop: 10 }}>Nessun dato per questo periodo</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 5 }}>Usa il timer per iniziare!</Text>
                </View>
              )}
            </View>

            {/* Calendario Pulizia (solo per settimana e mese) */}
            {viewMode !== 'day' && chartData.some((d: any) => d.cleaningStatus && d.cleaningStatus !== 'none') && (
              <View style={[styles.cleaningCalendarContainer, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.chartTitle, { color: colors.textSecondary }]}>
                  Stato Pulizia {viewMode === 'week' ? 'Settimanale' : 'Mensile'}
                </Text>
                
                {viewMode === 'week' ? (
                  // Calendario settimanale
                  <View style={styles.weekCalendar}>
                    {chartData.map((d: any, index: number) => {
                      const dayDate = new Date(selectedWeekStart);
                      dayDate.setDate(selectedWeekStart.getDate() + index);
                      const dayNum = dayDate.getDate();
                      const isToday = dayDate.toDateString() === new Date().toDateString();
                      
                      return (
                        <TouchableOpacity 
                          key={index}
                          style={[
                            styles.weekDayCell,
                            { backgroundColor: isToday ? colors.tint + '20' : colors.background },
                            isToday && { borderColor: colors.tint, borderWidth: 2 }
                          ]}
                          onPress={() => {
                            setSelectedDate(new Date(dayDate));
                            setViewMode('day');
                          }}
                        >
                          <Text style={[styles.weekDayLabel, { color: colors.textTertiary }]}>
                            {WEEKDAYS[index]}
                          </Text>
                          <Text style={[styles.weekDayNum, { color: colors.text }]}>
                            {dayNum}
                          </Text>
                          <View style={styles.cleaningStatusIcon}>
                            {d.cleaningStatus === 'complete' && (
                              <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                            )}
                            {d.cleaningStatus === 'incomplete' && (
                              <Ionicons name="close-circle" size={22} color={colors.error} />
                            )}
                            {d.cleaningStatus === 'none' && (
                              <Ionicons name="remove-circle-outline" size={22} color={colors.textTertiary} />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  // Calendario mensile
                  <View style={styles.monthCalendar}>
                    {/* Header giorni settimana */}
                    <View style={styles.monthCalendarHeader}>
                      {WEEKDAYS.map((day, i) => (
                        <Text key={i} style={[styles.monthCalendarHeaderText, { color: colors.textTertiary }]}>
                          {day.charAt(0)}
                        </Text>
                      ))}
                    </View>
                    
                    {/* Griglia giorni */}
                    <View style={styles.monthCalendarGrid}>
                      {(() => {
                        const firstDay = new Date(selectedYear, selectedMonth, 1);
                        // In JS getDay() ritorna 0=Dom, 1=Lun... Noi vogliamo Lun=0
                        let startOffset = firstDay.getDay() - 1;
                        if (startOffset < 0) startOffset = 6; // Domenica diventa 6
                        
                        const cells = [];
                        // Celle vuote prima del primo giorno
                        for (let i = 0; i < startOffset; i++) {
                          cells.push(<View key={`empty-${i}`} style={styles.monthDayCell} />);
                        }
                        // Celle dei giorni
                        chartData.forEach((d: any, index: number) => {
                          const dayNum = index + 1;
                          const dayDate = new Date(selectedYear, selectedMonth, dayNum);
                          const isToday = dayDate.toDateString() === new Date().toDateString();
                          
                          cells.push(
                            <TouchableOpacity 
                              key={dayNum}
                              style={[
                                styles.monthDayCell,
                                { backgroundColor: isToday ? colors.tint + '20' : 'transparent' },
                                isToday && { borderColor: colors.tint, borderWidth: 1, borderRadius: 8 }
                              ]}
                              onPress={() => {
                                setSelectedDate(new Date(dayDate));
                                setViewMode('day');
                              }}
                            >
                              <Text style={[styles.monthDayNum, { color: colors.text }, isToday && { fontWeight: 'bold' }]}>
                                {dayNum}
                              </Text>
                              {d.cleaningStatus === 'complete' && (
                                <View style={[styles.monthStatusDot, { backgroundColor: colors.success }]} />
                              )}
                              {d.cleaningStatus === 'incomplete' && (
                                <View style={[styles.monthStatusDot, { backgroundColor: colors.error }]} />
                              )}
                            </TouchableOpacity>
                          );
                        });
                        return cells;
                      })()}
                    </View>
                  </View>
                )}
                
                {/* Legenda */}
                <View style={styles.cleaningLegend}>
                  <View style={styles.cleaningLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                    <Text style={[styles.cleaningLegendText, { color: colors.textTertiary }]}>Completa</Text>
                  </View>
                  <View style={styles.cleaningLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                    <Text style={[styles.cleaningLegendText, { color: colors.textTertiary }]}>Incompleta</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Lista sessioni (solo vista giorno) */}
            {viewMode === 'day' && (
              <View style={[styles.sessionsContainer, { backgroundColor: colors.cardBackground }]}>
                <View style={styles.sessionsHeader}>
                  <Text style={[styles.chartTitle, { color: colors.textSecondary, marginBottom: 0 }]}>Sessioni Registrate</Text>
                  <TouchableOpacity 
                    style={[styles.addButton, { backgroundColor: colors.tint }]}
                    onPress={openAddSession}
                  >
                    <Ionicons name="add" size={22} color="white" />
                  </TouchableOpacity>
                </View>
                {sessions.length > 0 ? (
                  <>
                    {sessions.map((session) => (
                      <View 
                        key={session.id} 
                        style={[styles.sessionRow, { borderBottomColor: colors.separator }]}
                      >
                        <TouchableOpacity 
                          style={styles.sessionInfo}
                          onPress={() => openEditSession(session)}
                        >
                          <View style={styles.sessionTimes}>
                            <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
                            <Text style={[styles.sessionTimeText, { color: colors.text }]}>
                              {formatTime(session.startTime)} - {formatTime(session.endTime)}
                            </Text>
                          </View>
                          <View style={styles.sessionDetails}>
                            <Text style={[styles.sessionDurationText, { color: colors.tint }]}>
                              {formatDuration(session.durationSeconds)}
                            </Text>
                            {/* Icone pulizia */}
                            {(session.brushing || session.flossing || session.mouthwash) && (
                              <View style={styles.sessionCleaningIcons}>
                                {session.brushing && (
                                  <Ionicons name="brush" size={14} color={colors.success} />
                                )}
                                {session.flossing && (
                                  <Ionicons name="git-commit" size={14} color="#f9a825" />
                                )}
                                {session.mouthwash && (
                                  <Ionicons name="water" size={14} color="#2196f3" />
                                )}
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.deleteButton, { backgroundColor: colors.error + '15' }]}
                          onPress={() => confirmDeleteSession(session)}
                        >
                          <Ionicons name="trash-outline" size={20} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    <Text style={[styles.sessionHint, { color: colors.textTertiary }]}>
                      Tocca una sessione per modificarla
                    </Text>
                  </>
                ) : (
                  <View style={styles.noSessionsContainer}>
                    <Ionicons name="time-outline" size={32} color={colors.textTertiary} />
                    <Text style={[styles.noSessionsText, { color: colors.textTertiary }]}>
                      Nessuna sessione registrata
                    </Text>
                    <Text style={[styles.noSessionsHint, { color: colors.textTertiary }]}>
                      Tocca + per aggiungere una sessione
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Reanimated.View>
        </GestureDetector>

        <Text style={[styles.infoText, { color: colors.textTertiary }]}>
          ← Scorri per cambiare periodo →
          {'\n'}Meno tempo senza apparecchio = migliori risultati!
        </Text>

        {/* Modal per modifica sessione */}
        <Modal
          visible={editingSession !== null}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => setEditingSession(null)}>
                  <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Modifica Sessione</Text>
                <TouchableOpacity onPress={saveSessionChanges}>
                  <Text style={[styles.modalDone, { color: colors.tint }]}>Salva</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <TouchableOpacity 
                  style={[styles.timePickerRow, { backgroundColor: colors.background }]}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Text style={[styles.timePickerLabel, { color: colors.text }]}>Inizio</Text>
                  <Text style={[styles.timePickerValue, { color: colors.tint }]}>{formatTime(tempStartTime.getTime())}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.timePickerRow, { backgroundColor: colors.background }]}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Text style={[styles.timePickerLabel, { color: colors.text }]}>Fine</Text>
                  <Text style={[styles.timePickerValue, { color: colors.tint }]}>{formatTime(tempEndTime.getTime())}</Text>
                </TouchableOpacity>

                <View style={[styles.durationPreview, { backgroundColor: colors.background }]}>
                  <Text style={[styles.durationPreviewLabel, { color: colors.textTertiary }]}>Durata</Text>
                  <Text style={[styles.durationPreviewValue, { color: colors.text }]}>
                    {formatDuration(Math.floor((tempEndTime.getTime() - tempStartTime.getTime()) / 1000))}
                  </Text>
                </View>

                {/* Sezione Pulizia */}
                <Text style={[styles.cleaningSectionTitle, { color: colors.textSecondary }]}>PULIZIA</Text>
                
                <View style={[styles.cleaningToggleRow, { backgroundColor: colors.background }]}>
                  <View style={styles.cleaningToggleLabel}>
                    <Ionicons name="brush" size={20} color={colors.success} />
                    <Text style={[styles.cleaningToggleText, { color: colors.text }]}>Spazzolino</Text>
                  </View>
                  <Switch
                    value={editBrushing}
                    onValueChange={setEditBrushing}
                    trackColor={{ false: colors.separator, true: colors.success }}
                    thumbColor="white"
                  />
                </View>

                <View style={[styles.cleaningToggleRow, { backgroundColor: colors.background }]}>
                  <View style={styles.cleaningToggleLabel}>
                    <Ionicons name="git-commit" size={20} color="#f9a825" />
                    <Text style={[styles.cleaningToggleText, { color: colors.text }]}>Filo</Text>
                  </View>
                  <Switch
                    value={editFlossing}
                    onValueChange={setEditFlossing}
                    trackColor={{ false: colors.separator, true: '#f9a825' }}
                    thumbColor="white"
                  />
                </View>

                <View style={[styles.cleaningToggleRow, { backgroundColor: colors.background }]}>
                  <View style={styles.cleaningToggleLabel}>
                    <Ionicons name="water" size={20} color="#2196f3" />
                    <Text style={[styles.cleaningToggleText, { color: colors.text }]}>Collutorio</Text>
                  </View>
                  <Switch
                    value={editMouthwash}
                    onValueChange={setEditMouthwash}
                    trackColor={{ false: colors.separator, true: '#2196f3' }}
                    thumbColor="white"
                  />
                </View>

                {cleaningTasks.length > 0 && (
                  <>
                    <Text style={[styles.cleaningSectionTitle, { color: colors.textSecondary, marginTop: 15 }]}>TASK ASSOCIATO</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taskChipsContainer}>
                      <TouchableOpacity 
                        style={[
                          styles.taskChipEdit,
                          { backgroundColor: editTaskId === null ? colors.tint : colors.separator }
                        ]}
                        onPress={() => setEditTaskId(null)}
                      >
                        <Text style={[
                          styles.taskChipEditText,
                          { color: editTaskId === null ? 'white' : colors.textTertiary }
                        ]}>
                          Nessuno
                        </Text>
                      </TouchableOpacity>
                      {cleaningTasks.map(task => (
                        <TouchableOpacity 
                          key={task.id}
                          style={[
                            styles.taskChipEdit,
                            { backgroundColor: editTaskId === task.id ? colors.tint : colors.separator }
                          ]}
                          onPress={() => setEditTaskId(task.id)}
                        >
                          <Text style={[
                            styles.taskChipEditText,
                            { color: editTaskId === task.id ? 'white' : colors.textTertiary }
                          ]}>
                            {task.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>

        {showStartPicker && (
          <DateTimePicker
            value={tempStartTime}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={handleStartTimeChange}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={tempEndTime}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={handleEndTimeChange}
          />
        )}

        {/* Modal per aggiunta nuova sessione */}
        <Modal
          visible={showAddSession}
          animationType="slide"
          transparent={true}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.modalHeader, { backgroundColor: colors.background }]}>
                <TouchableOpacity onPress={() => setShowAddSession(false)}>
                  <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Nuova Sessione</Text>
                <TouchableOpacity onPress={saveNewSession}>
                  <Text style={[styles.modalDone, { color: colors.tint }]}>Aggiungi</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.modalBody}>
                <Text style={[styles.dateInfoText, { color: colors.textTertiary }]}>
                  Data: {formatDate(selectedDate)}
                </Text>
                
                <TouchableOpacity 
                  style={[styles.timePickerRow, { backgroundColor: colors.background }]}
                  onPress={() => setShowNewStartPicker(true)}
                >
                  <Text style={[styles.timePickerLabel, { color: colors.text }]}>Inizio</Text>
                  <Text style={[styles.timePickerValue, { color: colors.tint }]}>{formatTime(newSessionStart.getTime())}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.timePickerRow, { backgroundColor: colors.background }]}
                  onPress={() => setShowNewEndPicker(true)}
                >
                  <Text style={[styles.timePickerLabel, { color: colors.text }]}>Fine</Text>
                  <Text style={[styles.timePickerValue, { color: colors.tint }]}>{formatTime(newSessionEnd.getTime())}</Text>
                </TouchableOpacity>

                <View style={[styles.durationPreview, { backgroundColor: colors.background }]}>
                  <Text style={[styles.durationPreviewLabel, { color: colors.textTertiary }]}>Durata</Text>
                  <Text style={[styles.durationPreviewValue, { color: colors.text }]}>
                    {formatDuration(Math.floor((newSessionEnd.getTime() - newSessionStart.getTime()) / 1000))}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {showNewStartPicker && (
          <DateTimePicker
            value={newSessionStart}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={handleNewStartTimeChange}
          />
        )}

        {showNewEndPicker && (
          <DateTimePicker
            value={newSessionEnd}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={handleNewEndTimeChange}
          />
        )}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 15, color: '#333', marginTop: 40 },
  
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e5ea',
    borderRadius: 10,
    padding: 3,
    marginBottom: 15
  },
  viewTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8
  },
  viewTabActive: {
    backgroundColor: 'white'
  },
  viewTabText: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '500'
  },
  viewTabTextActive: {
    color: '#000',
    fontWeight: '600'
  },

  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15
  },
  navButton: {
    padding: 10
  },
  periodLabelContainer: {
    flex: 1,
    alignItems: 'center'
  },
  periodLabel: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    textTransform: 'capitalize'
  },
  todayHint: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 2
  },

  swipeContainer: {
    overflow: 'hidden'
  },
  
  summaryCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryLabel: { fontSize: 14, color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  summaryValue: { fontSize: 42, fontWeight: '900', marginVertical: 5 },
  summarySub: { fontSize: 14, color: '#888', fontWeight: '500' },
  daysInfo: { fontSize: 12, color: '#aaa', marginTop: 5 },
  goalHint: { fontSize: 13, marginTop: 10, fontWeight: '600' },

  chartContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: { fontSize: 16, fontWeight: '600', color: '#555', marginBottom: 15, alignSelf: 'flex-start' },
  emptyState: { height: 200, justifyContent: 'center', alignItems: 'center' },
  infoText: { marginTop: 20, color: '#999', fontSize: 12, fontStyle: 'italic', textAlign: 'center', lineHeight: 18, marginBottom: 30 },

  // Calendario pulizia
  cleaningCalendarContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  weekCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    marginHorizontal: 2,
    borderRadius: 10,
  },
  weekDayLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  weekDayNum: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  cleaningStatusIcon: {
    marginTop: 2,
  },
  monthCalendar: {
    width: '100%',
  },
  monthCalendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  monthCalendarHeaderText: {
    width: 32,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  monthCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  monthDayCell: {
    width: `${100/7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  monthDayNum: {
    fontSize: 13,
  },
  monthStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  cleaningLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  cleaningLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cleaningLegendText: {
    fontSize: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Stili per le sessioni
  sessionsContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noSessionsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noSessionsText: {
    fontSize: 15,
    marginTop: 10,
  },
  noSessionsHint: {
    fontSize: 12,
    marginTop: 5,
  },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 10,
  },
  sessionInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTimes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTimeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  sessionDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionDurationText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sessionDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sessionCleaningIcons: {
    flexDirection: 'row',
    gap: 4,
  },
  deleteButton: {
    padding: 10,
    borderRadius: 8,
  },
  sessionHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  // Modal stili
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalCancel: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalDone: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
    gap: 15,
  },
  dateInfoText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
  },
  timePickerLabel: {
    fontSize: 17,
  },
  timePickerValue: {
    fontSize: 17,
    fontWeight: '500',
  },
  durationPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  durationPreviewLabel: {
    fontSize: 15,
  },
  durationPreviewValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  // Stili per la sezione pulizia nel modal
  cleaningSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 8,
  },
  cleaningToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  cleaningToggleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cleaningToggleText: {
    fontSize: 16,
  },
  taskChipsContainer: {
    flexDirection: 'row',
    marginTop: 5,
  },
  taskChipEdit: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  taskChipEditText: {
    fontSize: 13,
    fontWeight: '500',
  },
});