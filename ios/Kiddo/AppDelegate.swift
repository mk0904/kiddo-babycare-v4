import Expo
import FreshchatSDK
import UserNotifications
import CleverTapSDK

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

  /**
   Every notification-centre delegate we displace, kept so all of them still get the callback.

   Three SDKs each expect to own `UNUserNotificationCenter.current().delegate`: CleverTap (via
   `CleverTap.autoIntegrate()` in ExpoAdapterCleverTap), expo-notifications, and Freshchat. The
   property is `weak` and holds exactly one object, so whoever sets it last silently disables the
   others — which is how CleverTap stopped receiving taps and stopped opening `wzrk_dl`.

   These references are STRONG on purpose. Storing a displaced delegate in a `weak` var is a bug:
   its only other owner was the property we just overwrote, so it can deallocate and the forward
   silently becomes a no-op.
   */
  var notificationDelegates: [UNUserNotificationCenterDelegate] = []

  /// Kept for source compatibility; prefer `notificationDelegates`.
  var expoNotificationDelegate: UNUserNotificationCenterDelegate? { notificationDelegates.first }

  /// Record a delegate we are about to displace.
  private func captureNotificationDelegate(_ delegate: UNUserNotificationCenterDelegate?) {
    guard let delegate = delegate, !(delegate === self) else { return }
    if notificationDelegates.contains(where: { $0 === delegate }) { return }
    notificationDelegates.append(delegate)
  }

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

    // Capture whichever SDK won the delegate race inside super.application, then take over.
    captureNotificationDelegate(UNUserNotificationCenter.current().delegate)
    UNUserNotificationCenter.current().delegate = self
    UNUserNotificationCenter.current().requestAuthorization(options:[.badge, .alert, .sound]){ (granted, error) in }
    UIApplication.shared.registerForRemoteNotifications()

    // CleverTap may asynchronously re-set the delegate after super.application returns.
    // Re-assert ourselves on the next run loop pass to guarantee we remain the delegate.
    DispatchQueue.main.async {
      if UNUserNotificationCenter.current().delegate !== self {
        // A late setter (CleverTap re-asserting after init) — add it to the fan-out rather than
        // replacing the one we already captured, which used to discard the earlier delegate.
        self.captureNotificationDelegate(UNUserNotificationCenter.current().delegate)
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

  /// CleverTap marks its own pushes with `wzrk_pn` / `wzrk_id`.
  private func isCleverTapNotification(_ userInfo: [AnyHashable: Any]) -> Bool {
    return userInfo["wzrk_pn"] != nil || userInfo["wzrk_id"] != nil || userInfo["wzrk_dl"] != nil
  }

  /**
   Fan a tap out to every displaced delegate and call `completionHandler` exactly once, after the
   last of them has finished. Forwarding the same response to several delegates means several
   completion callbacks, and calling the system's handler more than once is undefined behaviour.
   */
  private func forwardDidReceive(
    _ center: UNUserNotificationCenter,
    _ response: UNNotificationResponse,
    _ completionHandler: @escaping () -> Void
  ) {
    let selector = #selector(userNotificationCenter(_:didReceive:withCompletionHandler:))
    let targets = notificationDelegates.filter { $0.responds(to: selector) }

    guard !targets.isEmpty else {
      completionHandler()
      return
    }

    var remaining = targets.count
    var finished = false
    let done = {
      // UNUserNotificationCenter delivers on the main queue, so this counter needs no lock.
      remaining -= 1
      if remaining <= 0 && !finished {
        finished = true
        completionHandler()
      }
    }
    for target in targets {
      target.userNotificationCenter?(center, didReceive: response, withCompletionHandler: done)
    }
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let dictionary = response.notification.request.content.userInfo
    let appstate = UIApplication.shared.applicationState

    // Support chat first: Freshchat owns its own notifications end to end.
    if Freshchat.sharedInstance().isFreshchatNotification(dictionary) {
        Freshchat.sharedInstance().handleRemoteNotification(dictionary, andAppstate: appstate)
        completionHandler()
        return
    }

    // Hand CleverTap its own taps explicitly rather than relying on it still being the
    // notification-centre delegate. This is what records "Notification Clicked" and opens the
    // `wzrk_dl` deep link. The JS listener in services/deepLinkService.ts de-duplicates, so a
    // link opened here does not navigate twice.
    if isCleverTapNotification(dictionary) {
        CleverTap.sharedInstance()?.handleNotification(withData: dictionary)
    }

    forwardDidReceive(center, response, completionHandler)
  }

  public func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
      let dictionary = notification.request.content.userInfo

      if Freshchat.sharedInstance().isFreshchatNotification(dictionary) {
          Freshchat.sharedInstance().handleRemoteNotification(dictionary, andAppstate: UIApplication.shared.applicationState)
          completionHandler([.alert, .sound, .badge])
          return
      }

      // Ask each delegate how it wants the notification presented and show the union, so one
      // SDK answering "don't show" cannot suppress another SDK's notification.
      let selector = #selector(userNotificationCenter(_:willPresent:withCompletionHandler:))
      let targets = notificationDelegates.filter { $0.responds(to: selector) }

      guard !targets.isEmpty else {
          // No one to ask. `enablePushInForeground` is on in app.json, so show it.
          if #available(iOS 14.0, *) {
              completionHandler([.badge, .sound, .banner, .list])
          } else {
              completionHandler([.badge, .sound, .alert])
          }
          return
      }

      var remaining = targets.count
      var merged: UNNotificationPresentationOptions = []
      var finished = false
      let done: (UNNotificationPresentationOptions) -> Void = { options in
          merged.insert(options)
          remaining -= 1
          if remaining <= 0 && !finished {
              finished = true
              completionHandler(merged)
          }
      }
      for target in targets {
          target.userNotificationCenter?(center, willPresent: notification, withCompletionHandler: done)
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
