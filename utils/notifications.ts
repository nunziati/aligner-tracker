// utils/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';

// 1. Configurazione: Cosa fare se arriva una notifica a app aperta?
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 2. Funzione per chiedere il permesso all'utente
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      Alert.alert('Attenzione', 'Senza permessi non potrò ricordarti di rimettere l\'apparecchio!');
      return false;
    }
    return true;
  } else {
    // Sui simulatori le notifiche a volte non vanno, meglio usare un device fisico
    console.log('Must use physical device for Push Notifications');
    return false;
  }
}

// 3. Programma il promemoria "Rimetti l'apparecchio"
export async function scheduleReturnReminder(seconds: number = 3600) { // Default 1 ora
  // Prima cancelliamo eventuali vecchi reminder per non averne doppi
  await cancelReturnReminder();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "⏳ Tempo scaduto?",
      body: "È passata un'ora. Se hai finito di mangiare, rimetti le mascherine!",
      sound: true,
    },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: seconds, 
      repeats: false 
    },
  });
  console.log(`Notifica programmata tra ${seconds} secondi (ID: ${id})`);
  return id;
}

// 4. Cancella il promemoria
export async function cancelReturnReminder() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("Notifiche pendenti cancellate");
}