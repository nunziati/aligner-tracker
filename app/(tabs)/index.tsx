import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTimerStore } from '../../store/useTimerStore';
import { useCleaningStore } from '../../store/useCleaningStore';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Ionicons } from '@expo/vector-icons';

export default function TrackerScreen() {
  const { isAlignersOut, secondsRemaining, toggleAligners, tick } = useTimerStore();
  const cleaningStore = useCleaningStore();
  const { colors, isDark } = useAppTheme();

  // Carica i task all'avvio
  useEffect(() => {
    cleaningStore.loadTasks();
  }, []);

  useEffect(() => {
    let interval: number | undefined;
    if (isAlignersOut) {
      interval = setInterval(() => tick(), 1000);
    }
    return () => clearInterval(interval);
  }, [isAlignersOut]);

  // Formattazione tempo con gestione dei numeri negativi (se sfori il budget)
  const formatTime = (seconds: number) => {
    const isNegative = seconds < 0;
    const absSeconds = Math.abs(seconds);
    
    const hrs = Math.floor(absSeconds / 3600);
    const mins = Math.floor((absSeconds % 3600) / 60);
    const secs = absSeconds % 60;
    
    const timeString = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return isNegative ? `-${timeString}` : timeString;
  };

  // Stato: tempo negativo = sforato il limite
  const isOvertime = secondsRemaining < 0;
  
  // Colori dinamici in base allo stato
  const getStatusColor = () => {
    if (!isAlignersOut) return colors.success;
    if (isOvertime) return colors.error;
    return colors.warning;
  };
  
  const getBgColor = () => {
    if (!isAlignersOut) return colors.successLight;
    if (isOvertime) return colors.errorLight;
    return colors.warningLight;
  };
  
  const statusColor = getStatusColor();
  const bgColor = getBgColor();
  
  // Colore del cerchio interno per overtime (più rosso)
  const circleBackground = isOvertime 
    ? (isDark ? '#3d1515' : '#ffe5e5') 
    : colors.cardBackground;

  // Handler per rimettere l'apparecchio con dati pulizia
  const handleToggle = () => {
    if (isAlignersOut) {
      // Quando rimette l'apparecchio, passa i dati di pulizia
      const cleaningData = cleaningStore.getCurrentCleaningState();
      toggleAligners(cleaningData);
      // Resetta lo stato pulizia per la prossima sessione
      cleaningStore.resetCurrentSession();
    } else {
      // Quando toglie l'apparecchio
      toggleAligners();
    }
  };

  return (
    <ScrollView 
      style={[styles.scrollContainer, { backgroundColor: bgColor }]}
      contentContainerStyle={styles.contentContainer}
    >
      
      <Text style={[styles.statusTitle, { color: isOvertime ? colors.error : colors.text }]}>
        {isAlignersOut 
          ? (isOvertime ? "⚠️ TEMPO SCADUTO ⚠️" : "APPARECCHIO TOLTO") 
          : "APPARECCHIO INSERITO"}
      </Text>
      
      <Text style={[styles.statusSubtitle, { color: isOvertime ? colors.error : colors.textSecondary }]}>
        {isAlignersOut 
          ? (isOvertime 
              ? "Hai superato il limite! Rimetti subito l'apparecchio!" 
              : "Il tempo a disposizione sta scadendo!") 
          : "Stai trattando i tuoi denti correttamente."}
      </Text>

      {/* Cerchio del Timer */}
      <View style={[
        styles.timerCircle, 
        { borderColor: statusColor, backgroundColor: circleBackground },
        isOvertime && styles.timerCircleOvertime
      ]}>
        <Ionicons 
          name={isOvertime ? "alert-circle" : (isAlignersOut ? "restaurant" : "checkmark-circle")} 
          size={40} 
          color={statusColor} 
          style={{ marginBottom: 10 }}
        />
        <Text style={[styles.timerLabel, { color: statusColor }]}>
          {isOvertime ? "⛔ TEMPO SFORATO" : "TEMPO RIMASTO"}
        </Text>
        <Text style={[styles.timerText, { color: statusColor }]}>
          {formatTime(secondsRemaining)}
        </Text>
        {isOvertime && (
          <Text style={[styles.overtimeWarning, { color: colors.error }]}>
            RIMETTI L'APPARECCHIO!
          </Text>
        )}
      </View>

      {/* Sezione Pulizia - Solo quando apparecchio è tolto */}
      {isAlignersOut && (
        <View style={[styles.cleaningSection, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.cleaningSectionTitle, { color: colors.textSecondary }]}>
            AZIONI DI PULIZIA
          </Text>
          
          <View style={styles.cleaningButtons}>
            <TouchableOpacity 
              style={[
                styles.cleaningButton,
                { backgroundColor: cleaningStore.currentBrushing ? colors.success : colors.separator }
              ]}
              onPress={() => cleaningStore.setBrushing(!cleaningStore.currentBrushing)}
            >
              <Ionicons 
                name="brush" 
                size={24} 
                color={cleaningStore.currentBrushing ? 'white' : colors.textTertiary} 
              />
              <Text style={[
                styles.cleaningButtonText,
                { color: cleaningStore.currentBrushing ? 'white' : colors.textTertiary }
              ]}>
                Spazzolino
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.cleaningButton,
                { backgroundColor: cleaningStore.currentFlossing ? '#f9a825' : colors.separator }
              ]}
              onPress={() => cleaningStore.setFlossing(!cleaningStore.currentFlossing)}
            >
              <Ionicons 
                name="git-commit" 
                size={24} 
                color={cleaningStore.currentFlossing ? 'white' : colors.textTertiary} 
              />
              <Text style={[
                styles.cleaningButtonText,
                { color: cleaningStore.currentFlossing ? 'white' : colors.textTertiary }
              ]}>
                Filo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.cleaningButton,
                { backgroundColor: cleaningStore.currentMouthwash ? '#2196f3' : colors.separator }
              ]}
              onPress={() => cleaningStore.setMouthwash(!cleaningStore.currentMouthwash)}
            >
              <Ionicons 
                name="water" 
                size={24} 
                color={cleaningStore.currentMouthwash ? 'white' : colors.textTertiary} 
              />
              <Text style={[
                styles.cleaningButtonText,
                { color: cleaningStore.currentMouthwash ? 'white' : colors.textTertiary }
              ]}>
                Collutorio
              </Text>
            </TouchableOpacity>
          </View>

          {/* Task selector */}
          {cleaningStore.tasks.length > 0 && (
            <>
              <Text style={[styles.taskSelectorLabel, { color: colors.textSecondary }]}>
                ASSOCIA A UN TASK
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.taskSelector}>
                <TouchableOpacity 
                  style={[
                    styles.taskChip,
                    { backgroundColor: cleaningStore.currentTaskId === null ? colors.tint : colors.separator }
                  ]}
                  onPress={() => cleaningStore.setCurrentTaskId(null)}
                >
                  <Text style={[
                    styles.taskChipText,
                    { color: cleaningStore.currentTaskId === null ? 'white' : colors.textTertiary }
                  ]}>
                    Nessuno
                  </Text>
                </TouchableOpacity>
                {cleaningStore.tasks.map(task => (
                  <TouchableOpacity 
                    key={task.id}
                    style={[
                      styles.taskChip,
                      { backgroundColor: cleaningStore.currentTaskId === task.id ? colors.tint : colors.separator }
                    ]}
                    onPress={() => cleaningStore.setCurrentTaskId(task.id)}
                  >
                    <Text style={[
                      styles.taskChipText,
                      { color: cleaningStore.currentTaskId === task.id ? 'white' : colors.textTertiary }
                    ]}>
                      {task.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {/* Bottone Azione */}
      <TouchableOpacity 
        style={[
          styles.button, 
          { backgroundColor: isAlignersOut ? colors.success : colors.warning }
        ]} 
        onPress={handleToggle}
      >
        <Text style={styles.buttonText}>
          {isAlignersOut ? "RIMETTI APPARECCHIO" : "TOGLI APPARECCHIO"}
        </Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  contentContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  
  statusTitle: { fontSize: 22, fontWeight: '900', marginBottom: 5, letterSpacing: 1 },
  statusSubtitle: { fontSize: 14, marginBottom: 40, textAlign: 'center', paddingHorizontal: 20 },

  timerCircle: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  timerCircleOvertime: {
    borderWidth: 14,
    shadowColor: "#e74c3c",
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
  },
  overtimeWarning: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 10,
    letterSpacing: 1,
  },

  timerLabel: { fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 5 },
  timerText: { fontSize: 56, fontWeight: 'bold', fontVariant: ['tabular-nums'] },

  // Cleaning section
  cleaningSection: {
    width: '90%',
    borderRadius: 16,
    padding: 16,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cleaningSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
  },
  cleaningButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  cleaningButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  cleaningButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  taskSelector: {
    flexDirection: 'row',
  },
  taskChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  taskChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  button: { 
    paddingVertical: 18, 
    paddingHorizontal: 40, 
    borderRadius: 50,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 5,
  },
  
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
});