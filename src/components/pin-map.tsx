"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { divIcon, type LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";

const pin = divIcon({
  className: "",
  html: '<div style="width:22px;height:22px;border-radius:50%;background:#ff6a00;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.28)"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

export default function PinMap({
  latitude,
  longitude,
  tileUrl,
  attribution,
  onMove,
}: {
  latitude: number;
  longitude: number;
  tileUrl: string;
  attribution: string;
  onMove: (latitude: number, longitude: number) => void;
}) {
  const center: LatLngExpression = [latitude, longitude];
  return (
    <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution={attribution} url={tileUrl} />
      <Marker
        position={center}
        icon={pin}
        draggable
        eventHandlers={{ dragend: (event) => onMove(event.target.getLatLng().lat, event.target.getLatLng().lng) }}
      />
      <MapClick onMove={onMove} />
      <Recenter latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}

function MapClick({ onMove }: { onMove: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      onMove(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

function Recenter({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [map, latitude, longitude]);
  return null;
}
