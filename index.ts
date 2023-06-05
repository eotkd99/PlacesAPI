// @ts-nocheck TODO remove when fixed
import { Loader } from '@googlemaps/js-api-loader';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';

let map: google.maps.Map;
let webGLOverlayView;
const webToggle = localStorage.getItem('webToggle');
const storedLatitude = localStorage.getItem('mapCenterLatitude');
const storedLongitude = localStorage.getItem('mapCenterLongitude');
const defaultLatitude = 0;
const defaultLongitude = 0;
const latitude = storedLatitude !== null ? parseFloat(storedLatitude) : defaultLatitude;
const longitude = storedLongitude !== null ? parseFloat(storedLongitude) : defaultLongitude;
let trafficLayer: google.maps.TransitLayer;
let isTrafficLayerVisible = false;
let transitLayer: google.maps.TransitLayer;
let isTransitLayerVisible = false;
let bicyclingLayer: google.maps.BicyclingLayer;
let isBicyclingLayerVisible = false;

const apiOptions = {
  apiKey: 'AIzaSyD6AUm1Y6hvKr3tSgSjzkpr9UK0wuCL5iI',
  version: "beta"
};

const mapOptions = {
  "tilt": 0,
  "heading": 0,
  "zoom": 18,
  center: { lat: latitude, lng: longitude },
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
    renderer = new THREE.WebGLRenderer({
      canvas: gl.canvas,
      context: gl,
      ...gl.getContextAttributes(),
    });
    renderer.autoClear = false;
    webGLOverlayView.onRemove = () => {
      scene = null;
      renderer = null;
      camera = null;
      loader = null;
    };
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
    const latLngAltitudeLiteral = {
      lat: mapOptions.center.lat,
      lng: mapOptions.center.lng,
      altitude: 120
    }

    const matrix = transformer.fromLatLngAltitude(latLngAltitudeLiteral);
    camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);

    webGLOverlayView.requestRedraw();
    renderer.render(scene, camera);

    renderer.resetState();
  }
}


function initAutocomplete() {
  map = new google.maps.Map(document.getElementById("map") as HTMLElement, {
        center: { lat: 35.1796, lng: 129.0756 },
        zoom: 10,
        mapTypeId: "roadmap",
      }
  );

  const input = document.getElementById("pac-input") as HTMLInputElement;
  const searchBox = new google.maps.places.SearchBox(input);
  let markers: google.maps.Marker[] = [];

  map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
  map.addListener("bounds_changed", () => {
    searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
  });
  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();
    if (places.length == 0) return;
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
      if (place.geometry.viewport) bounds.union(place.geometry.viewport);
      else bounds.extend(place.geometry.location);
    });

    const center = bounds.getCenter();
    const latitude = center.lat();
    const longitude = center.lng();
    localStorage.setItem('mapCenterLatitude', latitude);
    localStorage.setItem('mapCenterLongitude', longitude);

    map.fitBounds(bounds);
  });

  if(webToggle==1){
    (async () => {
      const map = await initMap();
      initWebGLOverlayView(map);
      webGLOverlayView.setMap(map);
    })();
  }
  function toggleWebGL() {
    if (localStorage.getItem('webToggle')==1) {
      // webToggle 값을 로컬 스토리지에 저장
      localStorage.setItem('webToggle', 0);
      location.reload();
    } else {
      // webToggle 값을 로컬 스토리지에 저장
      localStorage.setItem('webToggle', 1);
      location.reload();
    }
  }
  window.toggleWebGL = toggleWebGL;

  function toggleTraffic() {
    if (!trafficLayer) {
      trafficLayer = new google.maps.TrafficLayer();
    }
    if (isTrafficLayerVisible) {
      trafficLayer.setMap(null);
      isTrafficLayerVisible = false;
    } else {
      trafficLayer.setMap(map);
      isTrafficLayerVisible = true;
    }
  }
  window.toggleTraffic = toggleTraffic;

  function toggleTransitLayer() {
    if (!transitLayer) {
      transitLayer = new google.maps.TransitLayer();
    }
    if (isTransitLayerVisible) {
      transitLayer.setMap(null);
      isTransitLayerVisible = false;
    } else {
      transitLayer.setMap(map);
      isTransitLayerVisible = true;
    }
  }
  window.toggleTransitLayer = toggleTransitLayer;

  function toggleBicycling() {
    if (!bicyclingLayer) {
      bicyclingLayer = new google.maps.BicyclingLayer();
    }
    if (isBicyclingLayerVisible) {
      bicyclingLayer.setMap(null);
      isBicyclingLayerVisible = false;
    } else {
      bicyclingLayer.setMap(map);
      isBicyclingLayerVisible = true;
    }
  }
  window.toggleBicycling = toggleBicycling;
}

declare global {
  interface Window {
    initAutocomplete: () => void;
    toggleTraffic: () => void;
    toggleWebGL: () => void;
    toggleTransitLayer: () => void;
    toggleBicycling: () => void;
  }
}
window.initAutocomplete = initAutocomplete;
export {};
