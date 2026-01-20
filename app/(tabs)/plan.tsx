import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Modal, 
  TextInput,
  Alert,
  Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTimerStore, TrayPlan } from '../../store/useTimerStore';
import { useCleaningStore } from '../../store/useCleaningStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { CleaningTask } from '../../db/database';

export default function PlanScreen() {
  const store = useTimerStore();
  const cleaningStore = useCleaningStore();
  const { colors, isDark } = useAppTheme();
  
  // Tipo di piano visualizzato
  const [planType, setPlanType] = useState<'treatment' | 'cleaning'>('treatment');
  
  const { 
    upperTrays, 
    lowerTrays, 
    currentUpperTray, 
    currentLowerTray,
    setupPlan,
    updateTrayDate,
    setCurrentTray
  } = store;

  // Modal setup piano trattamento
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [upperCount, setUpperCount] = useState('14');
  const [lowerCount, setLowerCount] = useState('14');
  const [daysPerTray, setDaysPerTray] = useState('14');
  const [startDate, setStartDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);

  // Modal modifica singola mascherina
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTray, setEditingTray] = useState<{ isUpper: boolean; index: number; tray: TrayPlan } | null>(null);
  const [editDate, setEditDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);

  // Visualizzazione tab mascherine (superiori/inferiori)
  const [activeTab, setActiveTab] = useState<'upper' | 'lower'>('upper');
  
  // ========== PIANO PULIZIA ==========
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<CleaningTask | null>(null);
  const [taskName, setTaskName] = useState('');
  const [taskTime, setTaskTime] = useState(new Date());
  const [showTaskTimePicker, setShowTaskTimePicker] = useState(false);
  const [taskBrushing, setTaskBrushing] = useState(true);
  const [taskFlossing, setTaskFlossing] = useState(false);
  const [taskMouthwash, setTaskMouthwash] = useState(false);
  
  // Carica i task all'avvio
  useEffect(() => {
    cleaningStore.loadTasks();
  }, []);

  const hasPlan = upperTrays.length > 0 || lowerTrays.length > 0;

  const handleSetupPlan = () => {
    const upper = parseInt(upperCount) || 0;
    const lower = parseInt(lowerCount) || 0;
    const days = parseInt(daysPerTray) || 14;

    if (upper === 0 && lower === 0) {
      Alert.alert('Errore', 'Inserisci almeno un numero di mascherine');
      return;
    }

    setupPlan(upper, lower, days, startDate.toISOString());
    setShowSetupModal(false);
    Alert.alert('Piano creato!', `Piano con ${upper} mascherine superiori e ${lower} inferiori creato.`);
  };

  const handleEditTray = (isUpper: boolean, index: number, tray: TrayPlan) => {
    setEditingTray({ isUpper, index, tray });
    setEditDate(new Date(tray.startDate));
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (editingTray) {
      updateTrayDate(editingTray.isUpper, editingTray.index, editDate.toISOString());
      setShowEditModal(false);
      setEditingTray(null);
    }
  };

  const handleSetCurrent = (isUpper: boolean, trayNumber: number) => {
    setCurrentTray(isUpper, trayNumber);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const isCurrentTray = (isUpper: boolean, trayNumber: number) => {
    return isUpper ? currentUpperTray === trayNumber : currentLowerTray === trayNumber;
  };

  const isPastTray = (isUpper: boolean, trayNumber: number) => {
    return isUpper ? trayNumber < currentUpperTray : trayNumber < currentLowerTray;
  };

  // ========== FUNZIONI PIANO PULIZIA ==========
  
  const openAddTask = () => {
    setEditingTask(null);
    setTaskName('');
    setTaskTime(new Date());
    setTaskBrushing(true);
    setTaskFlossing(false);
    setTaskMouthwash(false);
    setShowTaskModal(true);
  };
  
  const openEditTask = (task: CleaningTask) => {
    setEditingTask(task);
    setTaskName(task.name);
    const [hours, minutes] = task.scheduledTime.split(':').map(Number);
    const time = new Date();
    time.setHours(hours, minutes, 0, 0);
    setTaskTime(time);
    setTaskBrushing(task.requiresBrushing);
    setTaskFlossing(task.requiresFlossing);
    setTaskMouthwash(task.requiresMouthwash);
    setShowTaskModal(true);
  };
  
  const handleSaveTask = () => {
    if (!taskName.trim()) {
      Alert.alert('Errore', 'Inserisci un nome per il task');
      return;
    }
    
    if (!taskBrushing && !taskFlossing && !taskMouthwash) {
      Alert.alert('Errore', 'Seleziona almeno un\'azione di pulizia');
      return;
    }
    
    const scheduledTime = `${taskTime.getHours().toString().padStart(2, '0')}:${taskTime.getMinutes().toString().padStart(2, '0')}`;
    
    if (editingTask) {
      cleaningStore.updateTask(editingTask.id, taskName, scheduledTime, taskBrushing, taskFlossing, taskMouthwash);
    } else {
      cleaningStore.addTask(taskName, scheduledTime, taskBrushing, taskFlossing, taskMouthwash);
    }
    
    setShowTaskModal(false);
  };
  
  const handleDeleteTask = (task: CleaningTask) => {
    Alert.alert(
      'Elimina Task',
      `Vuoi eliminare "${task.name}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        { 
          text: 'Elimina', 
          style: 'destructive',
          onPress: () => cleaningStore.removeTask(task.id)
        }
      ]
    );
  };

  const renderTrayItem = (tray: TrayPlan, index: number, isUpper: boolean) => {
    const isCurrent = isCurrentTray(isUpper, tray.trayNumber);
    const isPast = isPastTray(isUpper, tray.trayNumber);

    return (
      <TouchableOpacity 
        key={`${isUpper ? 'upper' : 'lower'}-${tray.trayNumber}`}
        style={[
          styles.trayItem,
          { backgroundColor: colors.cardBackground },
          isCurrent && { backgroundColor: isDark ? '#1a3a5c' : '#e8f4ff' },
          isPast && { backgroundColor: isDark ? '#1c1c1e' : '#f8f8f8' }
        ]}
        onPress={() => handleEditTray(isUpper, index, tray)}
        onLongPress={() => {
          Alert.alert(
            'Imposta come attuale',
            `Vuoi segnare la mascherina ${tray.trayNumber} come quella attuale?`,
            [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Sì', onPress: () => handleSetCurrent(isUpper, tray.trayNumber) }
            ]
          );
        }}
      >
        <View style={styles.trayLeft}>
          <View style={[
            styles.trayNumber, 
            { backgroundColor: colors.separator },
            isCurrent && styles.trayNumberCurrent, 
            isPast && styles.trayNumberPast
          ]}>
            {isPast ? (
              <Ionicons name="checkmark" size={16} color="white" />
            ) : (
              <Text style={[styles.trayNumberText, { color: colors.textTertiary }, (isCurrent || isPast) && styles.trayNumberTextActive]}>
                {tray.trayNumber}
              </Text>
            )}
          </View>
          <View>
            <Text style={[styles.trayTitle, { color: colors.text }, isPast && { color: colors.textTertiary }]}>
              Mascherina {tray.trayNumber}
            </Text>
            <Text style={[styles.trayDate, { color: colors.textTertiary }, isPast && { color: colors.textTertiary }]}>
              {formatDate(tray.startDate)}
            </Text>
          </View>
        </View>
        {isCurrent && (
          <View style={[styles.currentBadge, { backgroundColor: colors.tint }]}>
            <Text style={styles.currentBadgeText}>ATTUALE</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  // Render item task di pulizia
  const renderTaskItem = (task: CleaningTask) => {
    return (
      <TouchableOpacity 
        key={task.id}
        style={[styles.taskItem, { backgroundColor: colors.cardBackground }]}
        onPress={() => openEditTask(task)}
        onLongPress={() => handleDeleteTask(task)}
      >
        <View style={styles.taskLeft}>
          <View style={[styles.taskTimeBox, { backgroundColor: colors.tint }]}>
            <Text style={styles.taskTimeText}>{task.scheduledTime}</Text>
          </View>
          <View style={styles.taskInfo}>
            <Text style={[styles.taskName, { color: colors.text }]}>{task.name}</Text>
            <View style={styles.taskIcons}>
              {task.requiresBrushing && (
                <View style={[styles.taskIconBadge, { backgroundColor: isDark ? '#1a3a1a' : '#e8f5e9' }]}>
                  <Ionicons name="brush" size={14} color={colors.success} />
                </View>
              )}
              {task.requiresFlossing && (
                <View style={[styles.taskIconBadge, { backgroundColor: isDark ? '#3a3a1a' : '#fff8e1' }]}>
                  <Ionicons name="git-commit" size={14} color="#f9a825" />
                </View>
              )}
              {task.requiresMouthwash && (
                <View style={[styles.taskIconBadge, { backgroundColor: isDark ? '#1a1a3a' : '#e3f2fd' }]}>
                  <Ionicons name="water" size={14} color="#2196f3" />
                </View>
              )}
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.header, { color: colors.text }]}>Piano</Text>
      
      {/* Selettore tipo piano */}
      <View style={[styles.planTypeSelector, { backgroundColor: colors.separator }]}>
        <TouchableOpacity 
          style={[styles.planTypeTab, planType === 'treatment' && { backgroundColor: colors.cardBackground }]}
          onPress={() => setPlanType('treatment')}
        >
          <Ionicons 
            name="fitness" 
            size={18} 
            color={planType === 'treatment' ? colors.tint : colors.textTertiary} 
          />
          <Text style={[
            styles.planTypeText, 
            { color: colors.textTertiary }, 
            planType === 'treatment' && { color: colors.text, fontWeight: '600' }
          ]}>
            Trattamento
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.planTypeTab, planType === 'cleaning' && { backgroundColor: colors.cardBackground }]}
          onPress={() => setPlanType('cleaning')}
        >
          <Ionicons 
            name="sparkles" 
            size={18} 
            color={planType === 'cleaning' ? colors.tint : colors.textTertiary} 
          />
          <Text style={[
            styles.planTypeText, 
            { color: colors.textTertiary }, 
            planType === 'cleaning' && { color: colors.text, fontWeight: '600' }
          ]}>
            Pulizia
          </Text>
        </TouchableOpacity>
      </View>

      {/* === PIANO TRATTAMENTO === */}
      {planType === 'treatment' && (
        <>
          {!hasPlan ? (
        // Stato vuoto
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={80} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Nessun piano impostato</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
            Crea il tuo piano per tenere traccia delle mascherine
          </Text>
          <TouchableOpacity 
            style={[styles.setupButton, { backgroundColor: colors.tint }]}
            onPress={() => setShowSetupModal(true)}
          >
            <Ionicons name="add" size={24} color="white" />
            <Text style={styles.setupButtonText}>Crea Piano</Text>
          </TouchableOpacity>
        </View>
      ) : (
        // Piano esistente
        <>
          {/* Header con progresso */}
          <View style={[styles.progressCard, { backgroundColor: colors.cardBackground }]}>
            <View style={styles.progressRow}>
              <View style={styles.progressItem}>
                <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>Superiori</Text>
                <Text style={[styles.progressValue, { color: colors.tint }]}>
                  {currentUpperTray}/{upperTrays.length}
                </Text>
              </View>
              <View style={[styles.progressDivider, { backgroundColor: colors.separator }]} />
              <View style={styles.progressItem}>
                <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>Inferiori</Text>
                <Text style={[styles.progressValue, { color: colors.tint }]}>
                  {currentLowerTray}/{lowerTrays.length}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.resetButton}
              onPress={() => setShowSetupModal(true)}
            >
              <Ionicons name="refresh" size={16} color={colors.tint} />
              <Text style={[styles.resetButtonText, { color: colors.tint }]}>Reimposta Piano</Text>
            </TouchableOpacity>
          </View>

          {/* Tab selector */}
          <View style={[styles.tabContainer, { backgroundColor: colors.separator }]}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'upper' && { backgroundColor: colors.cardBackground }]}
              onPress={() => setActiveTab('upper')}
            >
              <Text style={[styles.tabText, { color: colors.textTertiary }, activeTab === 'upper' && { color: colors.text }]}>
                Superiori ({upperTrays.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'lower' && { backgroundColor: colors.cardBackground }]}
              onPress={() => setActiveTab('lower')}
            >
              <Text style={[styles.tabText, { color: colors.textTertiary }, activeTab === 'lower' && { color: colors.text }]}>
                Inferiori ({lowerTrays.length})
              </Text>
            </TouchableOpacity>
          </View>

          {/* Lista mascherine */}
          <ScrollView style={styles.trayList}>
            {activeTab === 'upper' ? (
              upperTrays.length > 0 ? (
                upperTrays.map((tray, index) => renderTrayItem(tray, index, true))
              ) : (
                <Text style={[styles.noTraysText, { color: colors.textTertiary }]}>Nessuna mascherina superiore nel piano</Text>
              )
            ) : (
              lowerTrays.length > 0 ? (
                lowerTrays.map((tray, index) => renderTrayItem(tray, index, false))
              ) : (
                <Text style={[styles.noTraysText, { color: colors.textTertiary }]}>Nessuna mascherina inferiore nel piano</Text>
              )
            )}
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>
              Tocca per modificare la data • Tieni premuto per impostare come attuale
            </Text>
          </ScrollView>
        </>
      )}
      </>
      )}

      {/* === PIANO PULIZIA === */}
      {planType === 'cleaning' && (
        <>
          {cleaningStore.tasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={80} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Nessun task di pulizia</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                Crea i tuoi task per tenere traccia dell'igiene orale
              </Text>
              <TouchableOpacity 
                style={[styles.setupButton, { backgroundColor: colors.tint }]}
                onPress={openAddTask}
              >
                <Ionicons name="add" size={24} color="white" />
                <Text style={styles.setupButtonText}>Aggiungi Task</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.trayList}>
              <View style={styles.taskListHeader}>
                <Text style={[styles.taskListTitle, { color: colors.textSecondary }]}>
                  TASK GIORNALIERI
                </Text>
                <TouchableOpacity onPress={openAddTask}>
                  <Ionicons name="add-circle" size={28} color={colors.tint} />
                </TouchableOpacity>
              </View>
              
              {cleaningStore.tasks.map(renderTaskItem)}
              
              <View style={[styles.legendBox, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.legendTitle, { color: colors.text }]}>Legenda</Text>
                <View style={styles.legendRow}>
                  <Ionicons name="brush" size={16} color={colors.success} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>Spazzolino</Text>
                </View>
                <View style={styles.legendRow}>
                  <Ionicons name="git-commit" size={16} color="#f9a825" />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>Filo interdentale</Text>
                </View>
                <View style={styles.legendRow}>
                  <Ionicons name="water" size={16} color="#2196f3" />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>Collutorio</Text>
                </View>
              </View>
              
              <Text style={[styles.hintText, { color: colors.textTertiary }]}>
                Tocca per modificare • Tieni premuto per eliminare
              </Text>
            </ScrollView>
          )}
        </>
      )}

      {/* Modal Setup Piano */}
      <Modal
        visible={showSetupModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
            <TouchableOpacity onPress={() => setShowSetupModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Imposta Piano</Text>
            <TouchableOpacity onPress={handleSetupPlan}>
              <Text style={[styles.modalDone, { color: colors.tint }]}>Crea</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>NUMERO MASCHERINE</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Mascherine Superiori</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.tint }]}
                  value={upperCount}
                  onChangeText={setUpperCount}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              <View style={[styles.modalSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Mascherine Inferiori</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.tint }]}
                  value={lowerCount}
                  onChangeText={setLowerCount}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>DURATA</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalRow}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>Giorni per mascherina</Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.tint }]}
                  value={daysPerTray}
                  onChangeText={setDaysPerTray}
                  keyboardType="number-pad"
                  placeholder="14"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>DATA INIZIO</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity 
                style={styles.modalRow}
                onPress={() => setShowStartDatePicker(true)}
              >
                <Text style={[styles.modalLabel, { color: colors.text }]}>Prima mascherina</Text>
                <Text style={[styles.modalDateText, { color: colors.tint }]}>{startDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            {showStartDatePicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartDatePicker(false);
                  if (date) setStartDate(date);
                }}
              />
            )}

            <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
              Il piano verrà calcolato automaticamente a partire dalla data di inizio
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Modifica Mascherina */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Mascherina {editingTray?.tray.trayNumber}
            </Text>
            <TouchableOpacity onPress={handleSaveEdit}>
              <Text style={[styles.modalDone, { color: colors.tint }]}>Salva</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>DATA INIZIO</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity 
                style={styles.modalRow}
                onPress={() => setShowEditDatePicker(true)}
              >
                <Text style={[styles.modalLabel, { color: colors.text }]}>Data</Text>
                <Text style={[styles.modalDateText, { color: colors.tint }]}>{editDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
            </View>

            {showEditDatePicker && (
              <DateTimePicker
                value={editDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowEditDatePicker(false);
                  if (date) setEditDate(date);
                }}
              />
            )}

            <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
              ⚠️ Modificando questa data, tutte le mascherine successive verranno spostate di conseguenza
            </Text>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Task Pulizia */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator }]}>
            <TouchableOpacity onPress={() => setShowTaskModal(false)}>
              <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingTask ? 'Modifica Task' : 'Nuovo Task'}
            </Text>
            <TouchableOpacity onPress={handleSaveTask}>
              <Text style={[styles.modalDone, { color: colors.tint }]}>Salva</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>NOME TASK</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalRow}>
                <TextInput
                  style={[styles.modalInputFull, { color: colors.text }]}
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholder="Es. Pulizia mattina"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>ORARIO PROMEMORIA</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <TouchableOpacity 
                style={styles.modalRow}
                onPress={() => setShowTaskTimePicker(true)}
              >
                <Text style={[styles.modalLabel, { color: colors.text }]}>Orario</Text>
                <Text style={[styles.modalDateText, { color: colors.tint }]}>
                  {taskTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>

            {showTaskTimePicker && (
              <DateTimePicker
                value={taskTime}
                mode="time"
                display="default"
                is24Hour={true}
                onChange={(event, date) => {
                  setShowTaskTimePicker(false);
                  if (date) setTaskTime(date);
                }}
              />
            )}

            <Text style={[styles.modalSectionTitle, { color: colors.textSecondary }]}>AZIONI RICHIESTE</Text>
            <View style={[styles.modalSection, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.modalRow}>
                <View style={styles.switchLabel}>
                  <Ionicons name="brush" size={20} color={colors.success} style={{ marginRight: 10 }} />
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Spazzolino</Text>
                </View>
                <Switch
                  value={taskBrushing}
                  onValueChange={setTaskBrushing}
                  trackColor={{ false: colors.separator, true: colors.success }}
                  thumbColor="white"
                />
              </View>
              <View style={[styles.modalSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.modalRow}>
                <View style={styles.switchLabel}>
                  <Ionicons name="git-commit" size={20} color="#f9a825" style={{ marginRight: 10 }} />
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Filo interdentale</Text>
                </View>
                <Switch
                  value={taskFlossing}
                  onValueChange={setTaskFlossing}
                  trackColor={{ false: colors.separator, true: '#f9a825' }}
                  thumbColor="white"
                />
              </View>
              <View style={[styles.modalSeparator, { backgroundColor: colors.separator }]} />
              <View style={styles.modalRow}>
                <View style={styles.switchLabel}>
                  <Ionicons name="water" size={20} color="#2196f3" style={{ marginRight: 10 }} />
                  <Text style={[styles.modalLabel, { color: colors.text }]}>Collutorio</Text>
                </View>
                <Switch
                  value={taskMouthwash}
                  onValueChange={setTaskMouthwash}
                  trackColor={{ false: colors.separator, true: '#2196f3' }}
                  thumbColor="white"
                />
              </View>
            </View>

            <Text style={[styles.modalHint, { color: colors.textTertiary }]}>
              Seleziona le azioni di igiene richieste per questo task
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7' },
  header: { fontSize: 34, fontWeight: 'bold', marginBottom: 15, marginTop: 60, paddingHorizontal: 20, color: '#000' },

  // Plan type selector
  planTypeSelector: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    backgroundColor: '#e5e5ea', 
    borderRadius: 10, 
    padding: 3,
    marginBottom: 15
  },
  planTypeTab: { 
    flex: 1, 
    flexDirection: 'row',
    paddingVertical: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    borderRadius: 8,
    gap: 6
  },
  planTypeText: { fontSize: 15, color: '#8e8e93' },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 22, fontWeight: '600', color: '#333', marginTop: 20 },
  emptySubtitle: { fontSize: 16, color: '#8e8e93', textAlign: 'center', marginTop: 10 },
  setupButton: { 
    flexDirection: 'row', 
    backgroundColor: '#007AFF', 
    paddingHorizontal: 30, 
    paddingVertical: 15, 
    borderRadius: 12, 
    marginTop: 30,
    alignItems: 'center',
    gap: 8
  },
  setupButtonText: { color: 'white', fontSize: 17, fontWeight: '600' },

  // Progress card
  progressCard: { 
    backgroundColor: 'white', 
    marginHorizontal: 20, 
    borderRadius: 12, 
    padding: 20,
    marginBottom: 15
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  progressItem: { alignItems: 'center' },
  progressLabel: { fontSize: 13, color: '#8e8e93', textTransform: 'uppercase' },
  progressValue: { fontSize: 32, fontWeight: '700', color: '#007AFF', marginTop: 5 },
  progressDivider: { width: 1, height: 40, backgroundColor: '#e5e5ea' },
  resetButton: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 15,
    gap: 5
  },
  resetButtonText: { color: '#007AFF', fontSize: 15 },

  // Tabs
  tabContainer: { 
    flexDirection: 'row', 
    marginHorizontal: 20, 
    backgroundColor: '#e5e5ea', 
    borderRadius: 8, 
    padding: 2 
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: 'white' },
  tabText: { fontSize: 14, color: '#8e8e93', fontWeight: '500' },
  tabTextActive: { color: '#000' },

  // Tray list
  trayList: { flex: 1, marginTop: 15 },
  trayItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    marginHorizontal: 20,
    marginBottom: 1,
    padding: 15
  },
  trayItemCurrent: { backgroundColor: '#e8f4ff' },
  trayItemPast: { backgroundColor: '#f8f8f8' },
  trayLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  trayNumber: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#e5e5ea', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  trayNumberCurrent: { backgroundColor: '#007AFF' },
  trayNumberPast: { backgroundColor: '#34c759' },
  trayNumberText: { fontSize: 14, fontWeight: '600', color: '#8e8e93' },
  trayNumberTextActive: { color: 'white' },
  trayTitle: { fontSize: 16, fontWeight: '500', color: '#000' },
  trayTitlePast: { color: '#8e8e93' },
  trayDate: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  trayDatePast: { color: '#c7c7cc' },
  currentBadge: { 
    backgroundColor: '#007AFF', 
    paddingHorizontal: 8, 
    paddingVertical: 3, 
    borderRadius: 4,
    marginRight: 10
  },
  currentBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
  noTraysText: { textAlign: 'center', color: '#8e8e93', marginTop: 40 },
  hintText: { textAlign: 'center', color: '#8e8e93', fontSize: 12, marginTop: 20, marginBottom: 40 },

  // Task items (cleaning)
  taskItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 15,
    borderRadius: 10,
  },
  taskLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  taskTimeBox: { 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 8,
    minWidth: 60,
    alignItems: 'center'
  },
  taskTimeText: { color: 'white', fontWeight: '700', fontSize: 14 },
  taskInfo: { flex: 1 },
  taskName: { fontSize: 16, fontWeight: '500' },
  taskIcons: { flexDirection: 'row', gap: 6, marginTop: 6 },
  taskIconBadge: { 
    width: 26, 
    height: 26, 
    borderRadius: 13, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  taskListHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10
  },
  taskListTitle: { 
    fontSize: 13, 
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  
  // Legend box
  legendBox: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 10
  },
  legendTitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  legendText: { fontSize: 14 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f2f2f7' },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea'
  },
  modalCancel: { fontSize: 17, color: '#007AFF' },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalDone: { fontSize: 17, color: '#007AFF', fontWeight: '600' },
  modalContent: { flex: 1, padding: 20 },
  modalSectionTitle: { 
    fontSize: 13, 
    color: '#6d6d72', 
    marginBottom: 8, 
    marginLeft: 15,
    textTransform: 'uppercase' 
  },
  modalSection: { backgroundColor: 'white', borderRadius: 10, marginBottom: 25 },
  modalRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 15 
  },
  modalSeparator: { height: 1, backgroundColor: '#e5e5ea', marginLeft: 15 },
  modalLabel: { fontSize: 17, color: '#000' },
  modalInput: { fontSize: 17, color: '#007AFF', textAlign: 'right', minWidth: 60 },
  modalInputFull: { fontSize: 17, flex: 1 },
  modalDateText: { fontSize: 17, color: '#007AFF' },
  modalHint: { fontSize: 13, color: '#8e8e93', textAlign: 'center', marginTop: 10 },
  switchLabel: { flexDirection: 'row', alignItems: 'center' }
});
