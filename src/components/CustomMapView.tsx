import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface CustomMapViewProps {
  imageUrl: string;
  markers?: Array<{
    position: [number, number];
    popup?: string;
  }>;
  onClick?: (position: [number, number]) => void;
  className?: string;
}

export function CustomMapView({ imageUrl, markers = [], onClick, className = '' }: CustomMapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    // Load image to get dimensions
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  useEffect(() => {
    if (!mapRef.current || !imageSize) return;

    // Clean up previous map instance
    if (leafletMap.current) {
      leafletMap.current.remove();
    }

    // Create map instance
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomControl: true,
    });

    // Calculate bounds based on image dimensions
    const bounds = [[0, 0], [imageSize.height, imageSize.width]] as L.LatLngBoundsExpression;
    const image = L.imageOverlay(imageUrl, bounds);
    image.addTo(map);
    map.fitBounds(bounds);

    // Add markers
    markers.forEach(marker => {
      L.marker(marker.position)
        .addTo(map)
        .bindPopup(marker.popup || '');
    });

    // Handle click events
    if (onClick) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        onClick([lat, lng]);
      });
    }

    leafletMap.current = map;

    return () => {
      map.remove();
    };
  }, [imageUrl, imageSize, markers, onClick]);

  return <div ref={mapRef} className={`${className} relative`} />;
}