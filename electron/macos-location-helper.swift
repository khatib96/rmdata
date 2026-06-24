import CoreLocation
import Foundation

final class LocDelegate: NSObject, CLLocationManagerDelegate {
  private let manager = CLLocationManager()
  private var finished = false

  func start() {
    manager.delegate = self
    manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
    manager.requestWhenInUseAuthorization()
  }

  func finish(_ code: Int32) {
    guard !finished else { return }
    finished = true
    manager.stopUpdatingLocation()
    exit(code)
  }

  func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    switch manager.authorizationStatus {
    case .authorizedAlways, .authorizedWhenInUse:
      manager.startUpdatingLocation()
    case .denied, .restricted:
      fputs("DENIED\n", stderr)
      finish(2)
    case .notDetermined:
      break
    @unknown default:
      fputs("UNKNOWN_AUTH\n", stderr)
      finish(3)
    }
  }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    guard let loc = locations.last else { return }
    let lat = loc.coordinate.latitude
    let lng = loc.coordinate.longitude
    guard lat.isFinite, lng.isFinite else {
      fputs("INVALID_COORDS\n", stderr)
      finish(4)
      return
    }
    print("\(lat)|\(lng)")
    fflush(stdout)
    finish(0)
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    fputs("\(error.localizedDescription)\n", stderr)
    finish(5)
  }
}

let delegate = LocDelegate()
delegate.start()

RunLoop.main.run(until: Date(timeIntervalSinceNow: 35))
