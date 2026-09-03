import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Crosshair } from 'lucide-react';
import { searchAddresses, reverseGeocode } from '../../lib/geocoding';

const CEBU_CENTER = [10.3157, 123.8854];

const pickerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function MapClickHandler({ onPositionChange }) {
  useMapEvents({
    click(e) {
      onPositionChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToPosition({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, 16, { duration: 1.5 });
    }
  }, [center, map]);
  return null;
}

export default function LocationPicker({ latitude, longitude, address, onChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [positionLabel, setPositionLabel] = useState('');
  const searchRef = useRef(null);
  const debounceRef = useRef(null);

  const currentLat = latitude || CEBU_CENTER[0];
  const currentLng = longitude || CEBU_CENTER[1];
  const hasPosition = latitude != null && longitude != null;

  // Reverse geocode when position changes
  useEffect(() => {
    if (!hasPosition) return;
    let cancelled = false;
    const fetchLabel = async () => {
      const result = await reverseGeocode(currentLat, currentLng);
      if (!cancelled && result) {
        setPositionLabel(result.displayName);
      }
    };
    fetchLabel();
    return () => { cancelled = true; };
  }, [currentLat, currentLng, hasPosition]);

  // Geocode address prop on mount / change
  useEffect(() => {
    if (!address || hasPosition) return;
    let cancelled = false;
    const geocodeAddress = async () => {
      const results = await searchAddresses(address);
      if (!cancelled && results.length > 0) {
        onChange(results[0].lat, results[0].lng);
      }
    };
    geocodeAddress();
    return () => { cancelled = true; };
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchAddresses(value);
      setSuggestions(results);
    }, 500);
  };

  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.displayName);
    setShowSuggestions(false);
    setSuggestions([]);
    onChange(suggestion.lat, suggestion.lng);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        <MapPin className="w-4 h-4 inline mr-1" />
        Business Location
      </label>

      {/* Address Search */}
      <div className="relative" ref={searchRef}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          placeholder="Search address or click on the map..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 border-b border-gray-100 last:border-0"
              >
                {s.displayName}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Current Location Button */}
      <button
        type="button"
        onClick={handleUseCurrentLocation}
        className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
      >
        <Crosshair className="w-3.5 h-3.5" />
        Use my current location
      </button>

      {/* Map */}
      <div className="h-80 rounded-lg overflow-hidden border border-gray-300">
        <MapContainer
          center={[currentLat, currentLng]}
          zoom={hasPosition ? 16 : 12}
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPositionChange={onChange} />
          <FlyToPosition center={hasPosition ? [currentLat, currentLng] : null} />
          {hasPosition && (
            <Marker position={[currentLat, currentLng]} icon={pickerIcon} />
          )}
        </MapContainer>
      </div>

      {/* Position Label */}
      {hasPosition && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
          <div className="font-medium text-gray-700 mb-0.5">Selected Location</div>
          {positionLabel ? (
            <p className="line-clamp-2">{positionLabel}</p>
          ) : (
            <p>Lat: {currentLat.toFixed(6)}, Lng: {currentLng.toFixed(6)}</p>
          )}
        </div>
      )}

      {!hasPosition && (
        <p className="text-xs text-gray-400 italic">
          Click on the map or search above to set the business location
        </p>
      )}
    </div>
  );
}
