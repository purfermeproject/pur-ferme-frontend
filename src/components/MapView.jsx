import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function MapView({ lat, lon, name }) {
  if (!lat || !lon) return null;

  return (
    <MapContainer
      center={[lat, lon]}
      zoom={11}
      style={{ height: "100%", width: "100%", borderRadius: "10px", minHeight: "340px" }}
      key={`${lat}-${lon}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lon]}>
        <Popup>
          <strong>📍 {name}</strong><br />
          {lat.toFixed(4)}°N, {lon.toFixed(4)}°E
        </Popup>
      </Marker>
      <Circle
        center={[lat, lon]}
        radius={3000}
        pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.1 }}
      />
    </MapContainer>
  );
}
