import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { MapPin, Edit2, Trash2, QrCode } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { CustomMapView } from '../components/CustomMapView';
import L from 'leaflet';

// Fix for Leaflet marker icons in production
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Position {
  id: string;
  event_id: string;
  name: string;
  needed: number;
  filled: number;
  description: string | null;
  skill_level: string | null;
  latitude: number;
  longitude: number;
}

interface Event {
  id: string;
  name: string;
  custom_map_url: string | null;
}

interface PositionFormData {
  event_id: string;
  name: string;
  needed: number;
  description: string;
  skill_level: string;
  latitude: number;
  longitude: number;
}

// Component to handle map marker placement for OpenStreetMap
function MapMarker({ position, setPosition }: { 
  position: [number, number] | null;
  setPosition: (pos: [number, number]) => void;
}) {
  const map = useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position ? (
    <Marker position={position}>
      <Popup>Selected Position</Popup>
    </Marker>
  ) : null;
}

// Component to handle map view updates for OpenStreetMap
function MapUpdater({ positions, selectedEventId }: { 
  positions: Position[]; 
  selectedEventId: string | null;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (positions.length > 0) {
      const eventPositions = selectedEventId 
        ? positions.filter(p => p.event_id === selectedEventId)
        : positions;
      
      if (eventPositions.length > 0) {
        const latitudes = eventPositions.map(p => p.latitude);
        const longitudes = eventPositions.map(p => p.longitude);
        
        const minLat = Math.min(...latitudes);
        const maxLat = Math.max(...latitudes);
        const minLng = Math.min(...longitudes);
        const maxLng = Math.max(...longitudes);
        
        const bounds = L.latLngBounds(
          L.latLng(minLat, minLng),
          L.latLng(maxLat, maxLng)
        );
        
        map.fitBounds(bounds, { padding: [50, 50] });
      } else {
        map.setView([0, 0], 2);
      }
    }
  }, [map, positions, selectedEventId]);

  return null;
}

export function VolunteerPositionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [showQRCode, setShowQRCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [customMapSelectedPosition, setCustomMapSelectedPosition] = useState<[number, number] | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<PositionFormData>();
  const formValues = watch();
  const selectedEventId = watch('event_id');

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          
          if (mapRef.current && !selectedPosition) {
            mapRef.current.setView([latitude, longitude], 13);
          }
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Unable to get your location. Please select position on map.');
        }
      );
    }
  }, [selectedPosition]);

  // Update form when marker is placed
  useEffect(() => {
    if (selectedPosition) {
      setValue('latitude', selectedPosition[0]);
      setValue('longitude', selectedPosition[1]);
    }
  }, [selectedPosition, setValue]);

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, name, custom_map_url')
          .eq('user_id', user?.id)
          .order('date', { ascending: true });
        if (error) throw error;
        return data as Event[];
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
  });

  // Defensive: ensure events is always an array
  const safeEvents = Array.isArray(events) ? events : [];
  const selectedEvent = safeEvents.find(e => e.id === selectedEventId);

  const { data: positions, isLoading, error } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            *,
            event:events(name)
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching positions:', error);
        throw error;
      }
    },
  });

  // Convert image coordinates to approximate real-world coordinates for custom maps
  const convertImageToRealWorld = (imagePos: [number, number]): [number, number] => {
    try {
      // This is a simplified conversion - in a real app, you'd need proper coordinate mapping
      // For now, we'll use a basic conversion that assumes the image represents a small area
      const baseLat = 40.7128; // Example: New York City latitude
      const baseLng = -74.0060; // Example: New York City longitude
      const scale = 0.01; // Scale factor for conversion
      
      if (!Array.isArray(imagePos) || imagePos.length !== 2 || 
          typeof imagePos[0] !== 'number' || typeof imagePos[1] !== 'number' ||
          isNaN(imagePos[0]) || isNaN(imagePos[1])) {
        throw new Error('Invalid image coordinates');
      }
      
      const result: [number, number] = [
        baseLat + (imagePos[0] * scale),
        baseLng + (imagePos[1] * scale)
      ];
      
      console.log('Converted image coordinates:', imagePos, 'to real world:', result);
      return result;
    } catch (error) {
      console.error('Error converting image to real world coordinates:', error);
      return [40.7128, -74.0060]; // Return default coordinates
    }
  };

  // Convert real-world coordinates to approximate image coordinates for custom maps
  const convertRealWorldToImage = (realWorldPos: [number, number]): [number, number] => {
    try {
      // Reverse of convertImageToRealWorld
      const baseLat = 40.7128;
      const baseLng = -74.0060;
      const scale = 0.01;
      
      if (!Array.isArray(realWorldPos) || realWorldPos.length !== 2 || 
          typeof realWorldPos[0] !== 'number' || typeof realWorldPos[1] !== 'number' ||
          isNaN(realWorldPos[0]) || isNaN(realWorldPos[1])) {
        throw new Error('Invalid real world coordinates');
      }
      
      const result: [number, number] = [
        (realWorldPos[0] - baseLat) / scale,
        (realWorldPos[1] - baseLng) / scale
      ];
      
      console.log('Converted real world coordinates:', realWorldPos, 'to image:', result);
      return result;
    } catch (error) {
      console.error('Error converting real world to image coordinates:', error);
      return [0, 0]; // Return default image coordinates
    }
  };

  // Set form values when editing position
  useEffect(() => {
    if (editingPosition) {
      setValue('event_id', editingPosition.event_id);
      setValue('name', editingPosition.name);
      setValue('needed', editingPosition.needed);
      setValue('description', editingPosition.description || '');
      setValue('skill_level', editingPosition.skill_level || '');
      setValue('latitude', editingPosition.latitude);
      setValue('longitude', editingPosition.longitude);
      
      // Set selected position for both custom and regular maps
      setSelectedPosition([editingPosition.latitude, editingPosition.longitude]);
      
      // For custom maps, try to convert real-world coordinates to image coordinates
      const event = safeEvents.find(e => e.id === editingPosition.event_id);
      if (event?.custom_map_url) {
        // Convert real-world coordinates to approximate image coordinates
        const imagePos = convertRealWorldToImage([editingPosition.latitude, editingPosition.longitude]);
        setCustomMapSelectedPosition(imagePos);
      } else {
        setCustomMapSelectedPosition(null);
      }
    } else {
      setSelectedPosition(null);
      setCustomMapSelectedPosition(null);
    }
  }, [editingPosition, setValue, safeEvents]);

  const createMutation = useMutation({
    mutationFn: async (data: PositionFormData) => {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .insert([{ 
            ...data, 
            user_id: user?.id,
            filled: 0
          }]);
        if (error) throw error;
      } catch (error) {
        console.error('Error creating position:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position created successfully');
      reset();
      setSelectedPosition(null);
      setCustomMapSelectedPosition(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create position');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Position>) => {
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating position:', error);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position updated successfully');
      setEditingPosition(null);
      reset();
      setSelectedPosition(null);
      setCustomMapSelectedPosition(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update position');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('volunteer_positions')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting position:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Position deleted successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete position');
    },
  });

  const onSubmit = (data: PositionFormData) => {
    if (!selectedPosition) {
      toast.error('Please select a position on the map');
      return;
    }
    
    if (editingPosition) {
      updateMutation.mutate({ ...data, id: editingPosition.id });
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-4">
        <p className="text-red-600">Error loading positions. Please try again later.</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['positions'] })}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  // Defensive: ensure positions is always an array
  const filteredPositions = Array.isArray(positions)
    ? (selectedEventId ? positions.filter(p => p.event_id === selectedEventId) : positions)
    : [];

  // Handle custom map click
  const handleCustomMapClick = (imagePos: [number, number]) => {
    try {
      if (!Array.isArray(imagePos) || imagePos.length !== 2 || 
          typeof imagePos[0] !== 'number' || typeof imagePos[1] !== 'number' ||
          isNaN(imagePos[0]) || isNaN(imagePos[1])) {
        console.error('Invalid image position received:', imagePos);
        return;
      }
      
      setCustomMapSelectedPosition(imagePos);
      const realWorldPos = convertImageToRealWorld(imagePos);
      setSelectedPosition(realWorldPos);
    } catch (error) {
      console.error('Error handling custom map click:', error);
      toast.error('Error selecting position on map');
    }
  };

  // Clear custom map selection when switching events
  useEffect(() => {
    setCustomMapSelectedPosition(null);
  }, [selectedEventId]);

  // Create markers for custom map
  const customMapMarkers = Array.isArray(filteredPositions)
    ? filteredPositions
        .filter(position => 
          typeof position.latitude === 'number' && 
          typeof position.longitude === 'number' &&
          !isNaN(position.latitude) && 
          !isNaN(position.longitude)
        )
        .map(position => {
          try {
            return {
              position: convertRealWorldToImage([position.latitude, position.longitude]),
              popup: `${position.name} (${position.filled}/${position.needed})`,
              isSelected: false
            };
          } catch (error) {
            console.error('Error converting position coordinates:', error);
            return null;
          }
        })
        .filter((marker): marker is { position: [number, number]; popup: string; isSelected: boolean } => marker !== null)
    : [];

  // Add selected position marker for custom map
  if (customMapSelectedPosition && Array.isArray(customMapSelectedPosition) && customMapSelectedPosition.length === 2) {
    try {
      customMapMarkers.push({
        position: customMapSelectedPosition,
        popup: 'Selected Position',
        isSelected: true
      });
    } catch (error) {
      console.error('Error adding selected position marker:', error);
    }
  }

  const markers = Array.isArray(filteredPositions)
    ? filteredPositions.map(position => ({
        position: [position.latitude, position.longitude] as [number, number],
        popup: `${position.name} (${position.filled}/${position.needed})`
      }))
    : [];

  if (selectedPosition && !selectedEvent?.custom_map_url) {
    markers.push({
      position: selectedPosition,
      popup: 'Selected Position'
    });
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingPosition ? 'Edit Volunteer Position' : 'Create New Volunteer Position'}
        </h2>
        
        {/* Map for position selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Position on Map</label>
          <div className="h-[400px] rounded-lg overflow-hidden border border-gray-300">
            {selectedEvent?.custom_map_url ? (
              <div className="relative h-full">
                <CustomMapView
                  imageUrl={selectedEvent.custom_map_url}
                  markers={customMapMarkers}
                  onClick={(pos) => handleCustomMapClick(pos)}
                  className="h-full w-full"
                />
                {Array.isArray(customMapSelectedPosition) && customMapSelectedPosition.length === 2 && (
                  <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md">
                    <h4 className="font-medium text-sm text-gray-900 mb-2">Selected Position:</h4>
                    <div className="text-xs text-gray-600">
                      <p>Image Coordinates: ({customMapSelectedPosition[0]?.toFixed(2)}, {customMapSelectedPosition[1]?.toFixed(2)})</p>
                      {Array.isArray(selectedPosition) && selectedPosition.length === 2 && (
                        <p>Real World: ({selectedPosition[0]?.toFixed(6)}, {selectedPosition[1]?.toFixed(6)})</p>
                      )}
                    </div>
                  </div>
                )}
                {Array.isArray(filteredPositions) && filteredPositions.length > 0 && (
                  <div className="absolute top-4 left-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md max-h-48 overflow-y-auto">
                    <h4 className="font-medium text-sm text-gray-900 mb-2">Existing Positions:</h4>
                    <div className="space-y-1">
                      {filteredPositions.map((position) => (
                        <div key={position.id} className="text-xs text-gray-600">
                          <span className="font-medium">{position.name}</span>
                          <span className={`ml-2 ${
                            position.filled >= position.needed ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ({position.filled}/{position.needed})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <MapContainer
                center={userLocation ? [userLocation.lat, userLocation.lng] : [0, 0]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                ref={mapRef}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <MapMarker
                  position={selectedPosition}
                  setPosition={setSelectedPosition}
                />
                <MapUpdater 
                  positions={Array.isArray(positions) ? positions : []} 
                  selectedEventId={selectedEventId}
                />
                {Array.isArray(filteredPositions) && filteredPositions.filter(p => !editingPosition || p.id !== editingPosition.id)
                  .map((position) => (
                  <Marker
                    key={position.id}
                    position={[position.latitude, position.longitude]}
                  >
                    <Popup>
                      <div className="p-2">
                        <h3 className="font-medium">{position.name}</h3>
                        <p className="text-sm text-gray-600">
                          {position.filled}/{position.needed} Volunteers
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Event</label>
            <select
              {...register('event_id', { required: 'Event is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select an event</option>
              {safeEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name} {event.custom_map_url ? '(Custom Map)' : ''}
                </option>
              ))}
            </select>
            {errors.event_id && (
              <p className="mt-1 text-sm text-red-600">{errors.event_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position Name</label>
            <input
              {...register('name', { required: 'Position name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Number of Volunteers Needed</label>
            <input
              type="number"
              min="1"
              {...register('needed', { 
                required: 'Number of volunteers is required',
                min: {
                  value: 1,
                  message: 'At least 1 volunteer is required'
                },
                valueAsNumber: true
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.needed && (
              <p className="mt-1 text-sm text-red-600">{errors.needed.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description (Optional)</label>
            <textarea
              {...register('description')}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Skill Level (Optional)</label>
            <input
              type="text"
              {...register('skill_level')}
              placeholder="Enter skill level requirements"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                {...register('latitude', { 
                  required: 'Latitude is required',
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                readOnly
              />
              {errors.latitude && (
                <p className="mt-1 text-sm text-red-600">{errors.latitude.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                {...register('longitude', { 
                  required: 'Longitude is required',
                  valueAsNumber: true
                })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                readOnly
              />
              {errors.longitude && (
                <p className="mt-1 text-sm text-red-600">{errors.longitude.message}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            {editingPosition && (
              <button
                type="button"
                onClick={() => {
                  setEditingPosition(null);
                  reset();
                  setSelectedPosition(null);
                  setCustomMapSelectedPosition(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Processing...' : (editingPosition ? 'Update Position' : 'Create Position')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Volunteer Positions
          </h3>
        </div>
        <div className="border-t border-gray-200">
          {(() => {
            // Group positions by event
            const positionsByEvent = Array.isArray(positions) 
              ? positions.reduce((acc, position) => {
                  const eventName = position.event?.name || 'Unknown Event';
                  if (!acc[eventName]) {
                    acc[eventName] = [];
                  }
                  acc[eventName].push(position);
                  return acc;
                }, {} as Record<string, typeof positions>)
              : {};

            // Sort events alphabetically
            const sortedEvents = Object.keys(positionsByEvent).sort();

            if (sortedEvents.length === 0) {
              return (
                <div className="px-4 py-4 sm:px-6 text-center text-gray-500">
                  No positions found. Create one above!
                </div>
              );
            }

            return sortedEvents.map((eventName, eventIndex) => {
              const eventPositions = positionsByEvent[eventName];
              // Sort positions within each event by name
              const sortedPositions = eventPositions.sort((a: Position, b: Position) => a.name.localeCompare(b.name));

              return (
                <div key={eventName} className={eventIndex > 0 ? 'border-t border-gray-200' : ''}>
                  {/* Event Header */}
                  <div className="bg-gray-50 px-4 py-3 sm:px-6">
                    <h4 className="text-md font-medium text-gray-900 flex items-center">
                      <MapPin className="h-4 w-4 text-gray-500 mr-2" />
                      {eventName}
                      <span className="ml-2 text-sm font-normal text-gray-500">
                        ({eventPositions.length} position{eventPositions.length !== 1 ? 's' : ''})
                      </span>
                    </h4>
                  </div>
                  
                  {/* Positions for this event */}
                  <ul className="divide-y divide-gray-200">
                    {sortedPositions.map((position: Position) => (
                      <li key={position.id} className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="ml-6">
                              <p className="text-sm font-medium text-indigo-600">{position.name}</p>
                              <p className="text-sm text-gray-500">
                                Volunteers: {position.filled}/{position.needed}
                              </p>
                              {position.description && (
                                <p className="text-sm text-gray-500">{position.description}</p>
                              )}
                              {position.skill_level && (
                                <p className="text-sm text-gray-500">Skill Level: {position.skill_level}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={() => setShowQRCode(position.id)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Generate QR Code"
                            >
                              <QrCode className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => setEditingPosition(position)}
                              className="text-gray-400 hover:text-gray-500"
                              title="Edit position"
                            >
                              <Edit2 className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this position?')) {
                                  deleteMutation.mutate(position.id);
                                }
                              }}
                              className="text-gray-400 hover:text-gray-500"
                              title="Delete position"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            });
          })()}
        </div>
      </div>

      {showQRCode && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Check-In QR Code</h2>
              <button 
                onClick={() => setShowQRCode(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG 
                  value={`${window.location.origin}/checkin?position=${showQRCode}`}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <p className="mt-4 text-sm text-gray-600 text-center">
                Scan this QR code to check in volunteers at this position.
              </p>
              <p className="mt-2 text-xs text-gray-500 text-center">
                URL: 
                <a 
                  href={`${window.location.origin}/checkin?position=${showQRCode}`} 
                  className="ml-1 text-indigo-600 hover:text-indigo-500"
                >
                  {`${window.location.origin}/checkin?position=${showQRCode}`}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}