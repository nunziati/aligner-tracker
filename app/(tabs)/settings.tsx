import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, Modal, FlatList, Alert } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTimerStore } from '../../store/useTimerStore';
import { useThemeStore, ThemeMode } from '../../store/useThemeStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';
import { resetDatabase } from '../../db/database';

// Componente Picker scrollabile stile Samsung
const ScrollPicker = ({ 
  data, 
  selectedValue, 
  onValueChange, 
  itemHeight = 50,
  visibleItems = 3,
  colors
}: {
  data: number[];
  selectedValue: number;
  onValueChange: (value: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  colors?: any;
}) => {
  const flatListRef = useRef<FlatList>(null);
  const initialIndex = Math.max(0, data.indexOf(selectedValue));

  const handleScrollEnd = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
    if (data[clampedIndex] !== undefined && data[clampedIndex] !== selectedValue) {
      onValueChange(data[clampedIndex]);
    }
  };

  const renderItem = ({ item, index }: { item: number; index: number }) => {
    const isSelected = item === selectedValue;
    return (
      <View style={[styles.pickerItem, { height: itemHeight }]}>
        <Text style={[
          styles.pickerItemText, 
          isSelected && styles.pickerItemTextSelected,
          colors && { color: isSelected ? colors.text : colors.textTertiary }
        ]}>
          {item.toString().padStart(2, '0')}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.pickerContainer, { height: itemHeight * visibleItems }, colors && { backgroundColor: colors.cardBackground }]}>
      <View style={[styles.pickerHighlight, { height: itemHeight, top: itemHeight * Math.floor(visibleItems / 2) }, colors && { backgroundColor: colors.pickerHighlight }]} />
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.toString()}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        initialScrollIndex={initialIndex}
        contentContainerStyle={{ 
          paddingVertical: itemHeight * Math.floor(visibleItems / 2) 
        }}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
      />
    </View>
  );
};

export default function SettingsScreen() {
  const store = useTimerStore();
  const { themeMode, setThemeMode } = useThemeStore();
  const { colors, isDark } = useAppTheme();
  
  // Stato locale per gestire i form
  const [goalHours, setGoalHours] = useState(store.dailyGoalHours);
  const [goalMinutes, setGoalMinutes] = useState(store.dailyGoalMinutes);
  const [resetHour, setResetHour] = useState(store.dayResetHour);
  const [reminderDelay, setReminderDelay] = useState(store.reminderDelayMinutes);
  const [minSessionSeconds, setMinSessionSeconds] = useState(store.minSessionSeconds);
  
  // Modal per il picker obiettivo
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [tempHours, setTempHours] = useState(store.dailyGoalHours);
  const [tempMinutes, setTempMinutes] = useState(store.dailyGoalMinutes);
  
  // Modal per il picker ritardo notifica
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [tempReminderHours, setTempReminderHours] = useState(Math.floor(store.reminderDelayMinutes / 60));
  const [tempReminderMinutes, setTempReminderMinutes] = useState(store.reminderDelayMinutes % 60);
  
  // Modal per il picker durata minima sessione
  const [showMinSessionPicker, setShowMinSessionPicker] = useState(false);
  const [tempMinSessionMinutes, setTempMinSessionMinutes] = useState(Math.floor(store.minSessionSeconds / 60));
  const [tempMinSessionSeconds, setTempMinSessionSeconds] = useState(store.minSessionSeconds % 60);
  
  // Gestione TimePicker per reset
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Dati per i picker
  const hoursData = Array.from({ length: 15 }, (_, i) => i + 10); // 10-24
  const minutesData = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ..., 55
  const reminderHoursData = Array.from({ length: 5 }, (_, i) => i); // 0-4 ore
  const reminderMinutesData = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ..., 55
  const minSessionMinutesData = Array.from({ length: 11 }, (_, i) => i); // 0-10 minuti
  const minSessionSecondsData = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, ..., 55

  // Salvataggio automatico con debounce
  const saveSettings = useCallback(() => {
    store.setDailyGoal(goalHours, goalMinutes);
    store.setDayResetHour(resetHour);
    store.setReminderDelay(reminderDelay);
    store.setMinSessionSeconds(minSessionSeconds);
  }, [goalHours, goalMinutes, resetHour, reminderDelay, minSessionSeconds]);

  // Effetto per auto-salvare quando cambiano i valori
  useEffect(() => {
    const timer = setTimeout(() => {
      saveSettings();
    }, 500);
    return () => clearTimeout(timer);
  }, [goalHours, goalMinutes, resetHour, reminderDelay, minSessionSeconds, saveSettings]);

  const onChangeTime = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setResetHour(selectedTime.getHours());
    }
  };

  const formatResetHour = (hour: number) => {
    return `${hour.toString().padStart(2, '0')}:00`;
  };

  const formatGoal = (hours: number, minutes: number) => {
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const formatReminderDelay = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  };

  const handleGoalPickerConfirm = () => {
    setGoalHours(tempHours);
    setGoalMinutes(tempMinutes);
    setShowGoalPicker(false);
  };

  const openGoalPicker = () => {
    // Assicura che i valori siano nell'array dei dati disponibili
    const clampedHours = Math.max(10, Math.min(24, goalHours));
    const roundedMinutes = Math.round(goalMinutes / 5) * 5;
    setTempHours(clampedHours);
    setTempMinutes(Math.min(55, roundedMinutes));
    setShowGoalPicker(true);
  };

  const handleReminderPickerConfirm = () => {
    const totalMinutes = tempReminderHours * 60 + tempReminderMinutes;
    // Minimo 5 minuti
    setReminderDelay(Math.max(5, totalMinutes));
    setShowReminderPicker(false);
  };

  const openReminderPicker = () => {
    const hours = Math.floor(reminderDelay / 60);
    const minutes = reminderDelay % 60;
    // Arrotonda i minuti al multiplo di 5 più vicino
    const roundedMinutes = Math.round(minutes / 5) * 5;
    setTempReminderHours(Math.min(4, hours)); // max 4 ore
    setTempReminderMinutes(Math.min(55, roundedMinutes));
    setShowReminderPicker(true);
  };

  const formatMinSessionDuration = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    if (seconds === 0) return `${minutes}m`;
    return `${minutes}m ${seconds}s`;
  };

  const handleMinSessionPickerConfirm = () => {
    const totalSeconds = tempMinSessionMinutes * 60 + tempMinSessionSeconds;
    // Minimo 5 secondi
    setMinSessionSeconds(Math.max(5, totalSeconds));
    setShowMinSessionPicker(false);
  };

  const openMinSessionPicker = () => {
    const minutes = Math.floor(minSessionSeconds / 60);
    const seconds = minSessionSeconds % 60;
    // Arrotonda i secondi al multiplo di 5 più vicino
    const roundedSeconds = Math.round(seconds / 5) * 5;
    setTempMinSessionMinutes(Math.min(10, minutes));
    setTempMinSessionSeconds(Math.min(55, roundedSeconds));
    setShowMinSessionPicker(true);
  };

  const getThemeModeLabel = (mode: ThemeMode) => {
    switch (mode) {
      case 'light': return 'Chiaro';
      case 'dark': return 'Scuro';
      case 'auto': return 'Automatico';
    }
  };

  // Stili dinamici basati sul tema
  const dynamicStyles = {
    container: { backgroundColor: colors.background },
    header: { color: colors.text },
    section: { backgroundColor: colors.cardBackground },
    sectionTitle: { color: colors.textSecondary },
    row: { backgroundColor: colors.cardBackground },
    label: { color: colors.text },
    value: { color: colors.textTertiary },
    dateText: { color: colors.tint },
    hintText: { color: colors.textTertiary },
    autoSaveText: { color: colors.textTertiary },
    pickerItemText: { color: colors.textTertiary },
    pickerItemTextSelected: { color: colors.text },
    pickerSeparator: { color: colors.text },
    modalTitle: { color: colors.text },
    modalContent: { backgroundColor: colors.background },
    modalHeader: { backgroundColor: colors.cardBackground, borderBottomColor: colors.separator },
  };

  return (
    <ScrollView style={[styles.container, dynamicStyles.container]}>
      <Text style={[styles.header, dynamicStyles.header]}>Impostazioni</Text>

      {/* SEZIONE 1: ASPETTO */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>ASPETTO</Text>
        
        {(['auto', 'light', 'dark'] as ThemeMode[]).map((mode, index) => (
          <React.Fragment key={mode}>
            {index > 0 && <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
            <TouchableOpacity 
              style={[styles.row, dynamicStyles.row]} 
              onPress={() => setThemeMode(mode)}
            >
              <Text style={[styles.label, dynamicStyles.label]}>{getThemeModeLabel(mode)}</Text>
              {themeMode === mode && (
                <Ionicons name="checkmark" size={22} color={colors.tint} />
              )}
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>

      {/* SEZIONE 2: OBIETTIVO */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>OBIETTIVO</Text>
        
        <TouchableOpacity style={[styles.row, dynamicStyles.row]} onPress={openGoalPicker}>
          <Text style={[styles.label, dynamicStyles.label]}>Obiettivo Giornaliero</Text>
          <Text style={[styles.dateText, dynamicStyles.dateText]}>{formatGoal(goalHours, goalMinutes)}</Text>
        </TouchableOpacity>
        <Text style={[styles.hintText, dynamicStyles.hintText]}>
          Tempo che l'apparecchio deve essere indossato ogni giorno
        </Text>
      </View>

      {/* SEZIONE 3: GIORNATA */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>GIORNATA</Text>
        
        <TouchableOpacity style={[styles.row, dynamicStyles.row]} onPress={() => setShowTimePicker(true)}>
          <Text style={[styles.label, dynamicStyles.label]}>Ora Reset Giornaliero</Text>
          <Text style={[styles.dateText, dynamicStyles.dateText]}>{formatResetHour(resetHour)}</Text>
        </TouchableOpacity>
        <Text style={styles.hintText}>
          A quest'ora il timer si azzera per il nuovo giorno
        </Text>

        {showTimePicker && (
          <DateTimePicker
            value={new Date(2000, 0, 1, resetHour, 0)}
            mode="time"
            display="default"
            is24Hour={true}
            onChange={onChangeTime}
          />
        )}
        <Text style={[styles.hintText, dynamicStyles.hintText]}>
          A quest'ora il timer si azzera per il nuovo giorno
        </Text>
      </View>

      {/* SEZIONE 4: NOTIFICHE */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>NOTIFICHE</Text>
        
        <TouchableOpacity style={[styles.row, dynamicStyles.row]} onPress={openReminderPicker}>
          <Text style={[styles.label, dynamicStyles.label]}>Ritardo Promemoria</Text>
          <Text style={[styles.dateText, dynamicStyles.dateText]}>{formatReminderDelay(reminderDelay)}</Text>
        </TouchableOpacity>
        <Text style={[styles.hintText, dynamicStyles.hintText]}>
          Dopo quanto tempo riceverai un promemoria per rimettere l'apparecchio
        </Text>
      </View>

      {/* SEZIONE 5: SESSIONI */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>SESSIONI</Text>
        
        <TouchableOpacity style={[styles.row, dynamicStyles.row]} onPress={openMinSessionPicker}>
          <Text style={[styles.label, dynamicStyles.label]}>Durata Minima</Text>
          <Text style={[styles.dateText, dynamicStyles.dateText]}>{formatMinSessionDuration(minSessionSeconds)}</Text>
        </TouchableOpacity>
        <Text style={[styles.hintText, dynamicStyles.hintText]}>
          Sessioni più brevi non vengono salvate e il timer viene ripristinato
        </Text>
      </View>

      {/* SEZIONE 6: DATI */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>DATI</Text>
        
        <TouchableOpacity 
          style={[styles.row, dynamicStyles.row]} 
          onPress={() => {
            Alert.alert(
              'Elimina tutti i dati',
              'Sei sicuro di voler eliminare tutte le sessioni registrate?\n\nQuesta azione è irreversibile!',
              [
                { text: 'Annulla', style: 'cancel' },
                { 
                  text: 'Elimina tutto', 
                  style: 'destructive',
                  onPress: () => {
                    resetDatabase();
                    store.reloadTodaySeconds();
                    Alert.alert('Fatto', 'Tutti i dati sono stati eliminati.');
                  }
                }
              ]
            );
          }}
        >
          <Ionicons name="trash-outline" size={22} color="#e74c3c" style={{ marginRight: 12 }} />
          <Text style={[styles.label, { color: '#e74c3c' }]}>Elimina tutti i dati</Text>
        </TouchableOpacity>
        <Text style={[styles.hintText, dynamicStyles.hintText]}>
          Elimina tutte le sessioni salvate nel database
        </Text>
      </View>

      {/* SEZIONE 7: APP INFO */}
      <View style={[styles.section, dynamicStyles.section]}>
        <Text style={[styles.sectionTitle, dynamicStyles.sectionTitle]}>INFO</Text>
        <View style={[styles.row, dynamicStyles.row]}>
          <Text style={[styles.label, dynamicStyles.label]}>Versione App</Text>
          <Text style={[styles.value, dynamicStyles.value]}>1.0.0 (Beta)</Text>
        </View>
      </View>

      <Text style={[styles.autoSaveText, dynamicStyles.autoSaveText]}>Le modifiche vengono salvate automaticamente</Text>

      {/* Modal Picker Obiettivo */}
      <Modal
        visible={showGoalPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
              <TouchableOpacity onPress={() => setShowGoalPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Obiettivo Giornaliero</Text>
              <TouchableOpacity onPress={handleGoalPickerConfirm}>
                <Text style={[styles.modalDone, { color: colors.tint }]}>Fatto</Text>
              </TouchableOpacity>
            </View>
            
            {showGoalPicker && (
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Ore</Text>
                  <ScrollPicker
                    key={`goal-hours-${tempHours}`}
                    data={hoursData}
                    selectedValue={tempHours}
                    onValueChange={setTempHours}
                    colors={colors}
                  />
                </View>
                <Text style={[styles.pickerSeparator, dynamicStyles.pickerSeparator]}>:</Text>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Minuti</Text>
                  <ScrollPicker
                    key={`goal-minutes-${tempMinutes}`}
                    data={minutesData}
                    selectedValue={tempMinutes}
                    onValueChange={setTempMinutes}
                    colors={colors}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Picker Ritardo Notifica */}
      <Modal
        visible={showReminderPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
              <TouchableOpacity onPress={() => setShowReminderPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Ritardo Promemoria</Text>
              <TouchableOpacity onPress={handleReminderPickerConfirm}>
                <Text style={[styles.modalDone, { color: colors.tint }]}>Fatto</Text>
              </TouchableOpacity>
            </View>
            
            {showReminderPicker && (
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Ore</Text>
                  <ScrollPicker
                    key={`reminder-hours-${tempReminderHours}`}
                    data={reminderHoursData}
                    selectedValue={tempReminderHours}
                    onValueChange={setTempReminderHours}
                    colors={colors}
                  />
                </View>
                <Text style={[styles.pickerSeparator, dynamicStyles.pickerSeparator]}>:</Text>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Minuti</Text>
                  <ScrollPicker
                    key={`reminder-minutes-${tempReminderMinutes}`}
                    data={reminderMinutesData}
                    selectedValue={tempReminderMinutes}
                    onValueChange={setTempReminderMinutes}
                    colors={colors}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Picker Durata Minima Sessione */}
      <Modal
        visible={showMinSessionPicker}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, dynamicStyles.modalContent]}>
            <View style={[styles.modalHeader, dynamicStyles.modalHeader]}>
              <TouchableOpacity onPress={() => setShowMinSessionPicker(false)}>
                <Text style={[styles.modalCancel, { color: colors.tint }]}>Annulla</Text>
              </TouchableOpacity>
              <Text style={[styles.modalTitle, dynamicStyles.modalTitle]}>Durata Minima</Text>
              <TouchableOpacity onPress={handleMinSessionPickerConfirm}>
                <Text style={[styles.modalDone, { color: colors.tint }]}>Fatto</Text>
              </TouchableOpacity>
            </View>
            
            {showMinSessionPicker && (
              <View style={styles.pickerRow}>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Minuti</Text>
                  <ScrollPicker
                    key={`minsession-minutes-${tempMinSessionMinutes}`}
                    data={minSessionMinutesData}
                    selectedValue={tempMinSessionMinutes}
                    onValueChange={setTempMinSessionMinutes}
                    colors={colors}
                  />
                </View>
                <Text style={[styles.pickerSeparator, dynamicStyles.pickerSeparator]}>:</Text>
                <View style={styles.pickerColumn}>
                  <Text style={[styles.pickerLabel, dynamicStyles.sectionTitle]}>Secondi</Text>
                  <ScrollPicker
                    key={`minsession-seconds-${tempMinSessionSeconds}`}
                    data={minSessionSecondsData}
                    selectedValue={tempMinSessionSeconds}
                    onValueChange={setTempMinSessionSeconds}
                    colors={colors}
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f7', padding: 20 },
  header: { fontSize: 34, fontWeight: 'bold', marginBottom: 20, marginTop: 40, color: '#000' },
  
  section: { backgroundColor: 'white', borderRadius: 10, marginBottom: 25, overflow: 'hidden' },
  sectionTitle: { fontSize: 13, color: '#6d6d72', marginLeft: 15, marginTop: 15, marginBottom: 5, textTransform: 'uppercase' },
  
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white' },
  label: { fontSize: 17, color: '#000', flex: 1 },
  value: { fontSize: 17, color: '#8e8e93' },
  dateText: { fontSize: 17, color: '#007AFF' },
  
  separator: { height: 1, backgroundColor: '#c6c6c8', marginLeft: 15 },
  
  hintText: { 
    fontSize: 12, 
    color: '#8e8e93', 
    marginLeft: 15, 
    marginRight: 15, 
    marginBottom: 10,
    marginTop: -5 
  },
  
  autoSaveText: { 
    textAlign: 'center', 
    color: '#8e8e93', 
    fontSize: 13, 
    marginTop: 10,
    marginBottom: 30 
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#f2f2f7',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea'
  },
  modalCancel: { fontSize: 17, color: '#007AFF' },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalDone: { fontSize: 17, color: '#007AFF', fontWeight: '600' },

  // Picker styles
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 10
  },
  pickerColumn: {
    alignItems: 'center'
  },
  pickerLabel: {
    fontSize: 13,
    color: '#6d6d72',
    marginBottom: 10,
    textTransform: 'uppercase'
  },
  pickerContainer: {
    width: 80,
    backgroundColor: 'white',
    borderRadius: 10,
    overflow: 'hidden'
  },
  pickerHighlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#007AFF20',
    borderRadius: 8,
    zIndex: 1,
    pointerEvents: 'none'
  },
  pickerItem: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  pickerItemText: {
    fontSize: 24,
    color: '#c7c7cc'
  },
  pickerItemTextSelected: {
    color: '#000',
    fontWeight: '600'
  },
  pickerSeparator: {
    fontSize: 32,
    fontWeight: '600',
    color: '#000',
    marginTop: 25
  }
});