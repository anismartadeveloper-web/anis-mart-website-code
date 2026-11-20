'use client'

import { useEffect } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'

type Coordinates = { latitude: number; longitude: number }

const markerIcon = L.divIcon({
  className: 'store-map-marker',
  html: '<span class="store-map-marker__dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

function MapEvents({ onChange }: { onChange: (location: Coordinates) => void }) {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    },
  })
  return null
}

function MapCenter({ latitude, longitude }: Coordinates) {
  const map = useMap()
  useEffect(() => {
    map.setView([latitude, longitude], map.getZoom(), { animate: true })
  }, [latitude, longitude, map])
  return null
}

export function LocationPickerMap({ latitude, longitude, onChange, className, showMarker = true }: Coordinates & {
  onChange: (location: Coordinates) => void
  className?: string
  showMarker?: boolean
}) {
  return (
    <div className={className}>
      <MapContainer center={[latitude, longitude]} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onChange={onChange} />
        <MapCenter latitude={latitude} longitude={longitude} />
        {showMarker && <Marker
          position={[latitude, longitude]}
          icon={markerIcon}
          draggable
          eventHandlers={{
            dragend(event) {
              const point = event.target.getLatLng()
              onChange({ latitude: point.lat, longitude: point.lng })
            },
          }}
        />}
      </MapContainer>
    </div>
  )
}
