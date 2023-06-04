// @ts-nocheck TODO remove when fixed
import { getPoints } from './getPoints';
let map: google.maps.Map;
let heatmap;

function initAutocomplete() {
  map = new google.maps.Map(
      document.getElementById("map") as HTMLElement,
      {
        center: { lat: 35.1796, lng: 129.0756 },
        zoom: 10,
        mapTypeId: "roadmap",
      }
  );

  const input = document.getElementById("pac-input") as HTMLInputElement;
  const searchBox = new google.maps.places.SearchBox(input);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

  map.addListener("bounds_changed", () => {
    searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
  });

  let markers: google.maps.Marker[] = [];

  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();

    if (places.length == 0) {
      return;
    }

    // Clear out the old markers.
    markers.forEach((marker) => {
      marker.setMap(null);
    });
    markers = [];

    // For each place, get the icon, name and location.
    const bounds = new google.maps.LatLngBounds();

    places.forEach((place) => {
      if (!place.geometry || !place.geometry.location) {
        console.log("Returned place contains no geometry");
        return;
      }

      const icon = {
        url: place.icon as string,
        size: new google.maps.Size(71, 71),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(17, 34),
        scaledSize: new google.maps.Size(25, 25),
      };

      markers.push(
          new google.maps.Marker({
            map,
            icon,
            title: place.name,
            position: place.geometry.location,
          })
      );

      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
  });

  //트래픽 레이어 설정
  const trafficLayer = new google.maps.TrafficLayer();

  trafficLayer.setMap(map);

  let toggleTrafficLayer = false;

  function toggleTraffic() {
    if (toggleTrafficLayer) {
      trafficLayer.setMap(null);
      toggleTrafficLayer = false;
    } else {
      trafficLayer.setMap(map);
      toggleTrafficLayer = true;
    }
  }
  window.toggleTraffic = toggleTraffic;

}


declare global {
  interface Window {
    initAutocomplete: () => void;
    toggleTraffic: () => void;
  }
}

window.initAutocomplete = initAutocomplete;
export {};
