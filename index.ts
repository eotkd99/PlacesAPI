// @ts-nocheck TODO remove when fixed
import { Loader } from '@googlemaps/js-api-loader';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

let map: google.maps.Map;
let webGLOverlayView;

const apiOptions = {
  apiKey: 'AIzaSyD6AUm1Y6hvKr3tSgSjzkpr9UK0wuCL5iI',
  version: "beta"
};

const mapOptions = {
  "tilt": 0,
  "heading": 0,
  "zoom": 18,
  "center": { lat: 35.6594945, lng: 139.6999859 },
  "mapId": "5ad462e9fa6ea70e"
  }

async function initMap() {
  const mapDiv = document.getElementById("map");
  const apiLoader = new Loader(apiOptions);
  await apiLoader.load();
  return new google.maps.Map(mapDiv, mapOptions);
}


function initWebGLOverlayView(map) {
  webGLOverlayView = new google.maps.WebGLOverlayView();
  let scene, renderer, camera, loader;
  webGLOverlayView.onAdd = () => {
    // set up the scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera();
    const ambientLight = new THREE.AmbientLight( 0xffffff, 0.75 ); // soft white light
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.25);
    directionalLight.position.set(0.5, -1, 0.5);
    scene.add(directionalLight);

    // load the model
    loader = new GLTFLoader();
    const source = "pin.gltf";
    loader.load(
        source,
        gltf => {
          gltf.scene.scale.set(25,25,25);
          gltf.scene.rotation.x = 180 * Math.PI/180; // rotations are in radians
          scene.add(gltf.scene);
        }
    );
  }

  webGLOverlayView.onContextRestored = ({gl}) => {
    // create the three.js renderer, using the
    // maps's WebGL rendering context.
    renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes(),
    });
    renderer.autoClear = false;

    // wait to move the camera until the 3D model loads
    loader.manager.onLoad = () => {
      renderer.setAnimationLoop(() => {
        map.moveCamera({
          "tilt": mapOptions.tilt,
          "heading": mapOptions.heading,
          "zoom": mapOptions.zoom
        });

        // rotate the map 360 degrees
        if (mapOptions.tilt < 67.5) {
          mapOptions.tilt += 2
        } else if (mapOptions.heading <= 360) {
          mapOptions.heading += 3;
        } else {
          renderer.setAnimationLoop(null)
        }
      });
    }
  }

  webGLOverlayView.onDraw = ({gl, transformer}) => {
    // update camera matrix to ensure the model is georeferenced correctly on the map
    const latLngAltitudeLiteral = {
      lat: mapOptions.center.lat,
      lng: mapOptions.center.lng,
      altitude: 120
    }

    const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    webGLOverlayView.requestRedraw();
    renderer.render(scene, camera);

    // always reset the GL state
    renderer.resetState();
  }
  webGLOverlayView.setMap(map);
}

(async () => {
  if (condition) {
    const map = await initMap();
    initWebGLOverlayView(map);
  } else {
    // 다른 작업 수행
  }
})();

function initAutocomplete() {
  map = new google.maps.Map(document.getElementById("map") as HTMLElement,
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
      initWebGLOverlayView(map)
      toggleTrafficLayer = true;
    }
  }
  window.toggleTraffic = toggleTraffic;
}

declare global {
  interface Window {
    initAutocomplete: () => void;
    toggleTraffic: () => void;
    toggleWebGL: () => void;
  }
}

window.initAutocomplete = initAutocomplete;
export {};
