// @ts-nocheck TODO remove when fixed
import { Loader } from '@googlemaps/js-api-loader';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GoogleMapsOverlay } from "@deck.gl/google-maps";
import { TripsLayer } from "deck.gl";

let map: google.maps.Map;
let webGLOverlayView;
const webToggle = localStorage.getItem('webToggle');
const storedLatitude = localStorage.getItem('mapCenterLatitude');
const storedLongitude = localStorage.getItem('mapCenterLongitude');
const defaultLatitude = 0;
const defaultLongitude = 0;
const latitude = storedLatitude !== null ? parseFloat(storedLatitude) : defaultLatitude;
const longitude = storedLongitude !== null ? parseFloat(storedLongitude) : defaultLongitude;
let trafficLayer: google.maps.TrafficLayer;
let isTrafficLayerVisible = false;
let transitLayer: google.maps.TransitLayer;
let isTransitLayerVisible = false;
let bicyclingLayer: google.maps.BicyclingLayer;
let isBicyclingLayerVisible = false;
let isPanoLayerVisible = false;
let isSplitVisible=false;
let isDrawVisible=false;
let latestOverlay=null;
let latestOverlayList=[];

let animateOverlay ;
let isAnimateOverlayVisible = false;
let animateRequestID;
const GoogleMapsOverlay = deck.GoogleMapsOverlay;
let TripsLayer = deck.TripsLayer;
const DATA_URL = "https://raw.githubusercontent.com/visgl/deck.gl-data/master/examples/trips/trips-v7.json";
const LOOP_LENGTH = 1800;
const VENDOR_COLORS = [
  [255, 0, 0], // vendor #0
  [0, 0, 255], // vendor #1
];
let currentTime = 0;
let props = {
  id: "trips",
  data: DATA_URL,
  getPath: (d: Data) => d.path,
  getTimestamps: (d: Data) => d.timestamps,
  getColor: (d: Data) => VENDOR_COLORS[d.vendor],
  opacity: 1,
  widthMinPixels: 2,
  trailLength: 180,
  currentTime: 0,
  shadowEnabled: true,
};
let panorama;
let mapLeft, mapRight;


interface Data {
  vendor: number;
  path: [number, number][];
  timestamps: number[];
}

const apiOptions = {
  apiKey: 'AIzaSyD6AUm1Y6hvKr3tSgSjzkpr9UK0wuCL5iI',
  version: "beta"
};

const mapOptions = {
  "tilt": 0,
  "heading": 0,
  "zoom": 17,
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
      altitude: 100
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
        center: { lat: 40.7246, lng: -74.0006793 },
        zoom: 10,
        mapTypeId: "roadmap",
        mapId: '5ad462e9fa6ea70e',
      }
  );
  const sv = new google.maps.StreetViewService();
  panorama = new google.maps.StreetViewPanorama(
      document.getElementById("pano")
  );
  sv.getPanorama({ location: map.getCenter(), radius: 50 }).then(processSVData);

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

  function Animate() {
    if (!animateOverlay) {
      animateOverlay = new GoogleMapsOverlay({});
    }
    if (isAnimateOverlayVisible) {
      map.setTilt(0);
      animateOverlay.setMap(map);
      cancelAnimationFrame(animateRequestID);
      currentTime = 0;
      isAnimateOverlayVisible = false;
    } else {
      map.setTilt(45);
      animateOverlay.setMap(map);
      let animate = () => {
        currentTime = (currentTime + 1) % LOOP_LENGTH;
        let tripsLayer = new TripsLayer({
          ...props, currentTime,
        });
        animateOverlay.setProps({
          layers: [tripsLayer],
        });
        animateRequestID = window.requestAnimationFrame(animate);
      };
      window.requestAnimationFrame(animate);
      isAnimateOverlayVisible = true;
    }
  }
  window.Animate = Animate;

  function Panorama(): void {
    let mapElement: HTMLElement = document.getElementById("map")!;
    let panoElement: HTMLElement = document.getElementById("pano")!;

    if (isPanoLayerVisible) {
      mapElement.style.width = "50%";
      mapElement.style.height = "100%";
      mapElement.style.float = "left";
      mapElement.classList.add("hidden");
      panoElement.style.width = "50%";
      panoElement.style.height = "100%";
      panoElement.style.float = "left";
      panoElement.classList.add("hidden");
      isPanoLayerVisible = false;
    } else {
      mapElement.style.width = "";
      mapElement.style.height = "";
      mapElement.style.float = "";
      mapElement.classList.remove("hidden");
      panoElement.style.width = "";
      panoElement.style.height = "";
      panoElement.style.float = "";
      panoElement.classList.remove("hidden");
      isPanoLayerVisible = true;
    }
  }
  window.Panorama = Panorama;

  function mapReset(): void {
    location.reload();
  }
  window.mapReset = mapReset;

  function toggleSplit() {
    if (isSplitVisible) {
      map.addListener("click", (event) => {
        sv.getPanorama({ location: event.latLng, radius: 50 })
            .then(processSVData)
            .catch((e) =>
                console.error("Street View data not found for this location.")
            );
      });
      splitMapInit()
      isSplitVisible = false;
    } else {
      map.removeListener("click", handleMapClick);
      isSplitVisible = true;
    }
  }
  window.toggleSplit = toggleSplit;

  let drawingManager;
  let marker = [];
  let polygons = [];
  let polylines = [];
  let rectangles = [];
  let circles = [];

  drawingManager = new google.maps.drawing.DrawingManager({
    drawingMode: google.maps.drawing.OverlayType.MARKER,
    drawingControl: true,
    drawingControlOptions: {
      position: google.maps.ControlPosition.TOP_CENTER,
      drawingModes: [
        google.maps.drawing.OverlayType.MARKER,
        google.maps.drawing.OverlayType.CIRCLE,
        google.maps.drawing.OverlayType.POLYGON,
        google.maps.drawing.OverlayType.POLYLINE,
        google.maps.drawing.OverlayType.RECTANGLE,
      ],
    },
    markerOptions: {
      icon: "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png",
    },
    circleOptions: {
      fillColor: "#ffff00",
      fillOpacity: 1,
      strokeWeight: 5,
      clickable: false,
      editable: true,
      zIndex: 1,
    },
  });


  google.maps.event.addListener(drawingManager, 'overlaycomplete', function(event) {
    console.log(drawingManager.drawingMode)
    let overlay = event.overlay;
    let overlayType = event.type;

    switch (overlayType) {
      case google.maps.drawing.OverlayType.MARKER:
        marker.push(overlay);
        break;
      case google.maps.drawing.OverlayType.POLYGON:
        polygons.push(overlay);
        break;
      case google.maps.drawing.OverlayType.POLYLINE:
        polylines.push(overlay);
        break;
      case google.maps.drawing.OverlayType.RECTANGLE:
        rectangles.push(overlay);
        break;
      case google.maps.drawing.OverlayType.CIRCLE:
        circles.push(overlay);
        overlay.setOptions({ editable: false });
        break;
      default:
        break;
    }
    google.maps.event.addListener(overlay, 'click', function(event) {
      latestOverlayList.push(overlay);
      overlay.setOptions({ editable: true });
    });
  });
  drawingManager.setMap(map);
  function toggleDraw() {
    if (isDrawVisible) {
      drawingManager.setMap(map)
      isDrawVisible = false;
    } else {
      drawingManager.setMap(null);
      isDrawVisible = true;
    }
  }
  window.toggleDraw = toggleDraw;
}

document.addEventListener('keydown', function(event) {
  let element;
  if (event.key === 'Delete' && latestOverlayList.length > 0) {
    for (element of latestOverlayList) {
      let overlayType = element.type;
      switch (overlayType) {
        case google.maps.drawing.OverlayType.MARKER:
          marker.splice(marker.indexOf(element), 1);
          break;
        case google.maps.drawing.OverlayType.POLYGON:
          polygons.splice(polygons.indexOf(element), 1);
          break;
        case google.maps.drawing.OverlayType.POLYLINE:
          polylines.splice(polylines.indexOf(element), 1);
          break;
        case google.maps.drawing.OverlayType.RECTANGLE:
          rectangles.splice(rectangles.indexOf(element), 1);
          break;
        case google.maps.drawing.OverlayType.CIRCLE:
          circles.splice(circles.indexOf(element), 1);
          break;
        default:
          break;
      }
      element.setMap(null);
      element=null;
    }
  }
});

function processSVData({ data }) {
  const location = data.location;
  const marker = new google.maps.Marker({
    position: location.latLng,
    map,
    title: location.description,
  });

  panorama.setPano(location.pano);
  panorama.setPov({
    heading: 270,
    pitch: 0,
  });
  panorama.setVisible(true);
  marker.addListener("click", () => {
    const markerPanoID = location.pano;
    panorama.setPano(markerPanoID);
    panorama.setPov({
      heading: 270,
      pitch: 0,
    });
    panorama.setVisible(true);
  });
}

function splitMapInit(){
  const mapOptions = {
    center: { lat: 44.5250489, lng: -110.83819 },
    zoom: 18,
    scaleControl: false,
    streetViewControl: false,
  };

  // instantiate the map on the left with control positioning
  mapLeft = new google.maps.Map(document.getElementById("map-left"), {
    ...mapOptions,
    mapTypeId: "satellite",
    tilt: 0,
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.LEFT_BOTTOM,
    },
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.LEFT_TOP,
    },
    zoomControlOptions: {
      position: google.maps.ControlPosition.LEFT_BOTTOM,
    },
  });
  // instantiate the map on the right with control positioning
  mapRight = new google.maps.Map(document.getElementById("map-right"), {
    ...mapOptions,
    fullscreenControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
    mapTypeControlOptions: {
      position: google.maps.ControlPosition.RIGHT_TOP,
    },
    zoomControlOptions: {
      position: google.maps.ControlPosition.RIGHT_BOTTOM,
    },
  });

  // helper function to keep maps in sync
  function sync(...maps) {
    let center, zoom;

    function update(changedMap) {
      maps.forEach((m) => {
        if (m === changedMap) {
          return;
        }
        m.setCenter(center);
        m.setZoom(zoom);
      });
    }

    maps.forEach((m) => {
      m.addListener("bounds_changed", () => {
        const changedCenter = m.getCenter();
        const changedZoom = m.getZoom();

        if (changedCenter !== center || changedZoom !== zoom) {
          center = changedCenter;
          zoom = changedZoom;
          update(m);
        }
      });
    });
  }

  sync(mapLeft, mapRight);

  function handleContainerResize() {
    const width = document.getElementById("container").offsetWidth;

    document.getElementById("map-left").style.width = `${width}px`;
    document.getElementById("map-right").style.width = `${width}px`;
  }

  // trigger to set map container size since using absolute
  handleContainerResize();
  // add event listener
  window.addEventListener("resize", handleContainerResize);
  //@ts-ignore
  Split(["#left", "#right"], {
    sizes: [50, 50],
  });
}

window.initAutocomplete = initAutocomplete;
export {};
