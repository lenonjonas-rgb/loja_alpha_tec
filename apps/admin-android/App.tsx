import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, AppState, BackHandler, Linking, Platform, Pressable, SafeAreaView, StatusBar, StyleSheet, Text, View } from 'react-native'
import { WebView } from 'react-native-webview'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'

const ADMIN_URL = process.env.EXPO_PUBLIC_ADMIN_URL || 'https://lojaalphatec.com.br/admin'
const ADMIN_ORIGIN = new URL(ADMIN_URL).origin

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export default function App() {
  const webViewRef = useRef<WebView>(null)
  const appStateRef = useRef(AppState.currentState)
  const expoPushTokenRef = useRef('')
  const expoPushErrorRef = useRef('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      webViewRef.current?.goBack()
      return true
    })
    return () => subscription.remove()
  }, [canGoBack])

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const wasInactive = appStateRef.current === 'background' || appStateRef.current === 'inactive'
      appStateRef.current = nextState
      if (wasInactive && nextState === 'active') webViewRef.current?.reload()
    })
    return () => subscription.remove()
  }, [])

  useEffect(() => {
    let active = true
    async function registerForPushNotifications() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('admin-events', {
          name: 'Atividade da loja',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#d5322f',
        })
      }
      const currentPermission = await Notifications.getPermissionsAsync()
      const permission = currentPermission.granted ? currentPermission : await Notifications.requestPermissionsAsync()
      if (!permission.granted) {
        expoPushErrorRef.current = 'Ative as notificações nas configurações do Android para receber alertas.'
        sendPushErrorToAdminPage(expoPushErrorRef.current)
        return
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId
      if (!projectId) throw new Error('EAS projectId não configurado.')
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data
      if (!active) return
      expoPushTokenRef.current = token
      expoPushErrorRef.current = ''
      sendPushTokenToAdminPage(token)
    }

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(() => {
      webViewRef.current?.reload()
    })
    void registerForPushNotifications().catch((error) => {
      console.warn('Não foi possível ativar notificações:', error)
      expoPushErrorRef.current = 'Notificações nativas indisponíveis. Verifique a configuração FCM do app.'
      sendPushErrorToAdminPage(expoPushErrorRef.current)
    })
    return () => {
      active = false
      responseSubscription.remove()
    }
  }, [])

  function handleNavigationRequest(request: { url: string }) {
    if (request.url.startsWith('about:')) return true
    try {
      const target = new URL(request.url)
      if (target.origin === ADMIN_ORIGIN && target.pathname.startsWith('/admin')) return true
      void Linking.openURL(request.url).catch(() => undefined)
    } catch {
      return false
    }
    return false
  }

  function reload() {
    setLoadError('')
    setIsLoading(true)
    webViewRef.current?.reload()
  }

  function sendPushTokenToAdminPage(token: string) {
    webViewRef.current?.injectJavaScript(`window.__alphaTecReceiveNativePushToken?.(${JSON.stringify(token)});true;`)
  }

  function sendPushErrorToAdminPage(message: string) {
    webViewRef.current?.injectJavaScript(`window.__alphaTecReceiveNativePushError?.(${JSON.stringify(message)});true;`)
  }

  function handleWebViewMessage(message: string) {
    try {
      const payload = JSON.parse(message)
      if (payload.type === 'request-admin-push-token' && expoPushTokenRef.current) {
        sendPushTokenToAdminPage(expoPushTokenRef.current)
      } else if (payload.type === 'request-admin-push-token' && expoPushErrorRef.current) {
        sendPushErrorToAdminPage(expoPushErrorRef.current)
      }
    } catch {
      return
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#202225" />
      <View style={styles.toolbar}>
        <View>
          <Text style={styles.brand}>ALPHA TEC</Text>
          <Text style={styles.subtitle}>PAINEL ADMINISTRATIVO</Text>
        </View>
      </View>

      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          source={{ uri: ADMIN_URL }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          pullToRefreshEnabled={Platform.OS === 'android'}
          overScrollMode="never"
          onMessage={(event) => handleWebViewMessage(event.nativeEvent.data)}
          onShouldStartLoadWithRequest={handleNavigationRequest}
          onNavigationStateChange={(navigation) => setCanGoBack(navigation.canGoBack)}
          onLoadStart={() => { setIsLoading(true); setLoadError('') }}
          onLoadEnd={() => setIsLoading(false)}
          onError={(event) => {
            setIsLoading(false)
            setLoadError(event.nativeEvent.description || 'Verifique sua conexão e tente novamente.')
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setIsLoading(false)
              setLoadError('O servidor está temporariamente indisponível.')
            }
          }}
        />

        {isLoading && !loadError && <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#d5322f" size="large" />
          <Text style={styles.loadingText}>Conectando ao painel...</Text>
        </View>}

        {loadError ? <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>Painel indisponível</Text>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable accessibilityRole="button" onPress={reload} style={styles.retryButton}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </Pressable>
        </View> : null}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f4f5f6',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0,
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: '#202225',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 16,
  },
  brand: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtitle: { color: '#c5c9cd', fontSize: 9, fontWeight: '700', marginTop: 3 },
  webContainer: { flex: 1, position: 'relative' },
  webView: { backgroundColor: '#f4f5f6', flex: 1 },
  loadingOverlay: { alignItems: 'center', backgroundColor: '#f4f5f6', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  loadingText: { color: '#4d5154', fontSize: 12, marginTop: 12 },
  errorOverlay: { alignItems: 'center', backgroundColor: '#f4f5f6', bottom: 0, justifyContent: 'center', left: 0, padding: 28, position: 'absolute', right: 0, top: 0 },
  errorTitle: { color: '#202225', fontSize: 19, fontWeight: '800' },
  errorText: { color: '#686c70', fontSize: 13, lineHeight: 19, marginTop: 8, textAlign: 'center' },
  retryButton: { backgroundColor: '#d5322f', borderRadius: 4, marginTop: 20, minHeight: 44, justifyContent: 'center', paddingHorizontal: 18 },
  retryText: { color: '#fff', fontSize: 12, fontWeight: '800' },
})
