import { Capacitor } from '@capacitor/core'
import { App as CapacitorApp } from '@capacitor/app'
import { SplashScreen } from '@capacitor/splash-screen'
import { StatusBar, Style } from '@capacitor/status-bar'
import { PushNotifications } from '@capacitor/push-notifications'

function setupBackButton() {
  CapacitorApp.addListener('backButton', () => {
    if (window.history.state && window.history.state.idx > 0) {
      window.history.back()
    } else {
      CapacitorApp.exitApp()
    }
  })
}

function setupStatusBar() {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {})
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
}

function setupPushNotifications() {
  PushNotifications.addListener('registration', () => {})
  PushNotifications.addListener('registrationError', () => {})
  PushNotifications.addListener('pushNotificationReceived', () => {})
  PushNotifications.addListener('pushNotificationActionPerformed', () => {})

  PushNotifications.checkPermissions().then((result) => {
    if (result.receive === 'prompt') {
      return PushNotifications.requestPermissions()
    }
    return result
  }).then((result) => {
    if (result.receive === 'granted') {
      PushNotifications.register()
    }
  }).catch(() => {})
}

export function initNativeShell() {
  if (!Capacitor.isNativePlatform()) {
    return
  }

  setupBackButton()
  setupStatusBar()
  setupPushNotifications()
  SplashScreen.hide().catch(() => {})
}
