import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface CustomMapViewProps {
  imageUrl: string;
  markers?: Array<{
    position: [number, number];
    popup?: string;
    isSelected?: boolean;
  }>;
  onClick?: (position: [number, number]) => void;
  className?: string;
}

export function CustomMapView({ imageUrl, markers = [], onClick, className = '' }: CustomMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load image to get dimensions
    setIsLoading(true);
    setError(null);
    
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Handle CORS issues
    
    img.onload = () => {
      console.log('Image loaded:', img.width, 'x', img.height);
      setImageSize({ width: img.width, height: img.height });
      setError(null);
      setIsLoading(false);
    };
    
    img.onerror = (e) => {
      console.error('Image load error:', e);
      setError('Failed to load custom map image');
      setImageSize(null);
      setIsLoading(false);
    };
    
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!mapRef.current || !imageSize || isLoading) return;

    try {
      console.log('Creating map with image size:', imageSize);
      
      // Clean up previous map instance
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }

      // Create map instance
      const map = L.map(mapRef.current, {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 4,
        zoomControl: true,
        attributionControl: false,
      });

      // Calculate bounds based on image dimensions
      // Note: Leaflet uses [lat, lng] format, so we need to swap width/height
      const bounds = [
        [0, 0], 
        [imageSize.height, imageSize.width]
      ] as L.LatLngBoundsExpression;
      
      console.log('Map bounds:', bounds);
      
      const image = L.imageOverlay(imageUrl, bounds);
      image.addTo(map);
      
      // Fit bounds with padding
      map.fitBounds(bounds, { padding: [20, 20] });

      // Add custom markers
      console.log('Adding markers:', markers);
      markers.forEach((marker, index) => {
        try {
          const markerElement = document.createElement('div');
          markerElement.className = `custom-marker ${marker.isSelected ? 'selected' : ''}`;
          markerElement.innerHTML = `
            <div class="marker-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                  fill="${marker.isSelected ? '#ef4444' : '#3b82f6'}"/>
              </svg>
            </div>
          `;
          
          const customIcon = L.divIcon({
            html: markerElement,
            className: 'custom-marker-container',
            iconSize: [24, 24],
            iconAnchor: [12, 24],
          });

          console.log(`Adding marker ${index} at position:`, marker.position);
          const leafletMarker = L.marker(marker.position, { icon: customIcon }).addTo(map);
          
          if (marker.popup) {
            leafletMarker.bindPopup(marker.popup);
          }
        } catch (markerError) {
          console.error(`Error adding marker ${index}:`, markerError);
        }
      });

      // Handle click events
      if (onClick) {
        map.on('click', (e: L.LeafletMouseEvent) => {
          const { lat, lng } = e.latlng;
          console.log('Map clicked at:', lat, lng);
          onClick([lat, lng]);
        });
      }

      leafletMap.current = map;
      console.log('Map created successfully');

      return () => {
        if (leafletMap.current) {
          leafletMap.current.remove();
          leafletMap.current = null;
        }
      };
    } catch (err) {
      console.error('Error creating custom map:', err);
      setError('Failed to create custom map');
    }
  }, [imageUrl, imageSize, markers, onClick, isLoading]);

  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-2"></div>
          <p className="text-sm">Loading custom map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100`}>
        <div className="text-center text-gray-500">
          <p className="text-sm">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-2 px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={mapRef} className={`${className} relative`} />
      <style>{`
        .custom-marker-container {
          background: transparent;
          border: none;
        }
        .custom-marker {
          cursor: pointer;
          transition: transform 0.2s;
        }
        .custom-marker:hover {
          transform: scale(1.1);
        }
        .custom-marker.selected .marker-icon svg path {
          fill: #ef4444;
        }
      `}</style>
    </>
  );
}