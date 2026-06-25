import CoreLocation
import Foundation

/// In-process CoreLocation for the RMDATA main process (uses app Location Services permission).
private final class LocationEngine: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var outLat: UnsafeMutablePointer<Double>?
  private var outLng: UnsafeMutablePointer<Double>?
  private var gotFix = false
  private var denied = false
  private var failed = false

  override init() {
    super.init()
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyBest
  }

  func run(outLat: UnsafeMutablePointer<Double>, outLng: UnsafeMutablePointer<Double>, timeoutSec: Double) -> Int32 {
    self.outLat = outLat
    self.outLng = outLng
    gotFix = false
    denied = false
    failed = false

    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.startUpdatingLocation()
    case .notDetermined:
      manager.requestWhenInUseAuthorization()
    case .denied, .restricted:
      return 2
    @unknown default:
      return 5
    }

    let deadline = Date().addingTimeInterval(max(5, timeoutSec))
    while Date() < deadline {
      RunLoop.main.run(until: Date(timeIntervalSinceNow: 0.05))
      if gotFix { return 0 }
      if denied { return 2 }
      if failed { return 4 }
    }

    manager.stopUpdatingLocation()
    return 3
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.startUpdatingLocation()
    case .denied, .restricted:
      denied = true
    default:
      break
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    guard loc.horizontalAccuracy >= 0 else { return }
    outLat?.pointee = loc.coordinate.latitude
    outLng?.pointee = loc.coordinate.longitude
    gotFix = true
    manager.stopUpdatingLocation()
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    let code = (error as NSError).code
    if code == CLError.locationUnknown.rawValue { return }
    failed = true
  }
}

private let engine = LocationEngine()

/// Returns 0 on success; writes lat/lng to out pointers.
@_cdecl("rmdata_location_get")
public func rmdata_location_get(
  _ outLat: UnsafeMutablePointer<Double>,
  _ outLng: UnsafeMutablePointer<Double>,
  _ timeoutSec: Double
) -> Int32 {
  if Thread.isMainThread {
    return engine.run(outLat: outLat, outLng: outLng, timeoutSec: timeoutSec)
  }
  var code: Int32 = 1
  DispatchQueue.main.sync {
    code = engine.run(outLat: outLat, outLng: outLng, timeoutSec: timeoutSec)
  }
  return code
}
