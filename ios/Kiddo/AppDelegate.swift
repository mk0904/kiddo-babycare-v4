import Expo
import FreshchatSDK
import UserNotifications

import React
import ReactAppDependencyProvider

// @generated begin react-native-maps-import - expo prebuild (DO NOT MODIFY) sync-bee50fec513f89284e0fa3f5d935afdde33af98f
#if canImport(GoogleMaps)
import GoogleMaps
#endif
// @generated end react-native-maps-import
@UIApplicationMain
public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?
  weak var expoNotificationDelegate: UNUserNotificationCenterDelegate?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

// @generated begin react-native-maps-init - expo prebuild (DO NOT MODIFY) sync-e4e629baad07ae7a72274994b38790e5b053399d
#if canImport(GoogleMaps)
GMSServices.provideAPIKey("PLACEHOLDER_GOOGLE_MAPS_KEY")
#endif
// @generated end react-native-maps-init

    // Handle Freshchat notification from cold launch (killed state)
    // Must extract the remote notification dict from launchOptions — NOT pass raw launchOptions
    if let remoteNotifDict = launchOptions?[UIApplication.LaunchOptionsKey.remoteNotification] as? [AnyHashable: Any],
       Freshchat.sharedInstance().isFreshchatNotification(remoteNotifDict) {
        Freshchat.sharedInstance().handleRemoteNotification(remoteNotifDict, andAppstate: application.applicationState)
    }

    let result = super.application(application, didFinishLaunchingWithOptions: launchOptions)

    // Capture Expo/CleverTap delegate set by super.application, then take over as delegate
    expoNotificationDelegate = UNUserNotificationCenter.current().delegate
    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().requestAuthorization(options:[.badge, .alert, .sound]){ (granted, error) in }
    UIApplication.shared.registerForRemoteNotifications()

    // CleverTap may asynchronously re-set the delegate after super.application returns.
    // Re-assert ourselves on the next run loop pass to guarantee we remain the delegate.
    DispatchQueue.main.async {
      if UNUserNotificationCenter.current().delegate !== self {
        // CleverTap overwrote — save it as expo delegate and re-assert
        self.expoNotificationDelegate = UNUserNotificationCenter.current().delegate
        UNUserNotificationCenter.current().delegate = self
      }
    }

    return result
  }

  public override func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    Freshchat.sharedInstance().setPushRegistrationToken(deviceToken)
  }

  public override func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable : Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    if Freshchat.sharedInstance().isFreshchatNotification(userInfo) {
        Freshchat.sharedInstance().handleRemoteNotification(userInfo, andAppstate: application.applicationState)
        completionHandler(.newData)
    } else {
        super.application(application, didReceiveRemoteNotification: userInfo, fetchCompletionHandler: completionHandler)
    }
  }

  // MARK: - UNUserNotificationCenterDelegate
  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let dictionary = response.notification.request.content.userInfo
    let appstate = UIApplication.shared.applicationState
    if Freshchat.sharedInstance().isFreshchatNotification(dictionary) {
        Freshchat.sharedInstance().handleRemoteNotification(dictionary, andAppstate: appstate)
        completionHandler()
    } else if let expoDelegate = expoNotificationDelegate, expoDelegate.responds(to: #selector(userNotificationCenter(_:didReceive:withCompletionHandler:))) {
        expoDelegate.userNotificationCenter?(center, didReceive: response, withCompletionHandler: completionHandler)
    } else {
        completionHandler()
    }
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
      let dictionary = notification.request.content.userInfo
      if Freshchat.sharedInstance().isFreshchatNotification(dictionary) {
          Freshchat.sharedInstance().handleRemoteNotification(dictionary, andAppstate: UIApplication.shared.applicationState)
          completionHandler([.alert, .sound, .badge])
      } else if let expoDelegate = expoNotificationDelegate, expoDelegate.responds(to: #selector(userNotificationCenter(_:willPresent:withCompletionHandler:))) {
          expoDelegate.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: completionHandler)
      } else {
          completionHandler([])
      }
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    let settings = RCTBundleURLProvider.sharedSettings()
    #if targetEnvironment(simulator)
    settings.jsLocation = "127.0.0.1"
    #endif
    return settings.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
