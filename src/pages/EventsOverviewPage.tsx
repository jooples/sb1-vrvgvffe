import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { AlertCircle, Users, MapPin, Bell, CheckCircle, XCircle, MessageSquare, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, isValid, parseISO } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { CustomMapView } from '../components/CustomMapView';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for Leaflet marker icons in production
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  custom_map_url?: string | null;
}

interface Position {
  id: string;
  name: string;
  needed: number;
  filled: number;
  latitude: number;
  longitude: number;
  event: {
    id: string;
    name: string;
    date: string;
    time: string;
  };
}

interface Issue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  position?: {
    id: string;
    name: string;
    event: {
      name: string;
    };
  };
}

interface Message {
  id: string;
  title: string;
  content: string;
  volunteer_id: string | null;
  phone_number: string | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'ignored';
  created_at: string;
  position: {
    id: string;
    name: string;
    event: {
      name: string;
    };
  };
  volunteer?: {
    volunteer_name: string;
    phone_number: string;
  };
}

// Helper function to safely format dates
const safeFormatDate = (dateString: string | null | undefined, formatString: string): string => {
  if (!dateString) return 'No date';
  const date = parseISO(dateString);
  return isValid(date) ? format(date, formatString) : 'Invalid date';
};

// Component to handle map view updates
function MapUpdater({ positions, selectedEventId }: { positions: Position[], selectedEventId: string | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (selectedEventId && positions.length > 0) {
      const eventPositions = positions.filter(p => p.event.id === selectedEventId);
      
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
      }
    } else if (positions.length > 0) {
      const latitudes = positions.map(p => p.latitude);
      const longitudes = positions.map(p => p.longitude);
      
      const centerLat = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
      const centerLng = (Math.min(...longitudes) + Math.max(...longitudes)) / 2;
      
      map.setView([centerLat, centerLng], 13);
    }
  }, [map, positions, selectedEventId]);

  return null;
}

export function EventsOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    searchParams.get('eventId')
  );
  const [issues, setIssues] = useState<Issue[]>([]);
  const mapRef = useRef<L.Map | null>(null);
  const queryClient = useQueryClient();

  // Fetch all events
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, time, custom_map_url')
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data as Event[];
    },
  });

  // Fetch all positions
  const { data: positions } = useQuery({
    queryKey: ['positions', selectedEventId],
    queryFn: async () => {
      const query = supabase
        .from('volunteer_positions')
        .select(`
          id,
          name,
          needed,
          filled,
          latitude,
          longitude,
          event:events(
            id,
            name,
            date,
            time
          )
        `);

      if (selectedEventId) {
        query.eq('event_id', selectedEventId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data as any[]).map(item => ({
        ...item,
        event: Array.isArray(item.event) ? item.event[0] : item.event
      })) as Position[];
    },
  });

  // Fetch messages
  const { data: messages } = useQuery({
    queryKey: ['messages', selectedEventId],
    queryFn: async () => {
      const query = supabase
        .from('messages')
        .select(`
          *,
          position:volunteer_positions(
            id,
            name,
            event:events(name)
          ),
          volunteer:volunteer_signups(
            volunteer_name,
            phone_number
          )
        `)
        .in('status', ['pending', 'in_progress']);

      if (selectedEventId) {
        query.eq('event_id', selectedEventId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Message[];
    },
  });

  // Add mutation for updating message status
  const updateMessageStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Message['status'] }) => {
      const { error } = await supabase
        .from('messages')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      toast.success('Message status updated');
    },
    onError: (error) => {
      toast.error('Failed to update message status');
      console.error('Error updating message status:', error);
    },
  });

  // Update URL when event selection changes
  useEffect(() => {
    if (selectedEventId) {
      setSearchParams({ eventId: selectedEventId });
    } else {
      setSearchParams({});
    }
  }, [selectedEventId, setSearchParams]);

  // Set up real-time subscriptions for issues
  useEffect(() => {
    const addIssue = (newIssue: Issue) => {
      setIssues(prev => [newIssue, ...prev].slice(0, 100));
    };

    const signupsChannel = supabase.channel('volunteer-signups')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'volunteer_signups',
      }, async (payload) => {
        if (payload.eventType === 'INSERT') {
          const { data: position } = await supabase
            .from('volunteer_positions')
            .select('name, event:events(name)')
            .eq('id', payload.new.position_id)
            .single();

          if (!selectedEventId || (position?.event as any)?.id === selectedEventId) {
            addIssue({
              id: crypto.randomUUID(),
              type: 'info',
              message: `New volunteer ${payload.new.volunteer_name} signed up for ${position?.name}`,
              timestamp: new Date().toISOString(),
              position: position as any,
            });
          }
        }
      });

    const staffingInterval = setInterval(() => {
      if (positions) {
        positions.forEach(position => {
          if (position.filled < position.needed) {
            addIssue({
              id: crypto.randomUUID(),
              type: 'warning',
              message: `Position ${position.name} is understaffed (${position.filled}/${position.needed})`,
              timestamp: new Date().toISOString(),
              position: {
                id: position.id,
                name: position.name,
                event: position.event,
              },
            });
          }
        });
      }
    }, 60000);

    signupsChannel.subscribe();

    return () => {
      signupsChannel.unsubscribe();
      clearInterval(staffingInterval);
    };
  }, [positions, selectedEventId]);

  if (!events || !positions) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const filteredPositions = selectedEventId
    ? positions.filter(p => p.event.id === selectedEventId)
    : positions;

  // Get the selected event for custom map
  const selectedEvent = selectedEventId && events 
    ? events.find(e => e.id === selectedEventId) 
    : null;

  // Convert real-world coordinates to image coordinates for custom maps
  const convertRealWorldToImage = (realWorldPos: [number, number], _eventId?: string): [number, number] => {
    try {
      // This is a simplified conversion - in a real app, you'd need proper coordinate mapping
      // For now, we'll use a basic conversion that assumes the image represents a small area
      // You could extend this to use event-specific coordinate mappings stored in the database
      
      if (!Array.isArray(realWorldPos) || realWorldPos.length !== 2 || 
          typeof realWorldPos[0] !== 'number' || typeof realWorldPos[1] !== 'number' ||
          isNaN(realWorldPos[0]) || isNaN(realWorldPos[1])) {
        throw new Error('Invalid real world coordinates');
      }

      // Default coordinate system - you can customize this per event
      const baseLat = 40.7128; // Example: New York City latitude
      const baseLng = -74.0060; // Example: New York City longitude
      const scale = 0.01; // Scale factor for conversion
      
      // For now, use the same conversion for all events
      // In the future, you could store coordinate mapping parameters in the events table
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

  // Create markers for custom map
  const customMapMarkers = selectedEvent?.custom_map_url && Array.isArray(filteredPositions)
    ? filteredPositions
        .filter(position => 
          typeof position.latitude === 'number' && 
          typeof position.longitude === 'number' &&
          !isNaN(position.latitude) && 
          !isNaN(position.longitude)
        )
        .map(position => {
          try {
            // Determine position status
            const ratio = position.filled / position.needed;
            let status: 'filled' | 'partial' | 'needs' = 'needs';
            if (ratio === 1) {
              status = 'filled';
            } else if (ratio > 0) {
              status = 'partial';
            }

            return {
              position: convertRealWorldToImage([position.latitude, position.longitude], selectedEventId || undefined),
              popup: `${position.name} (${position.filled}/${position.needed})`,
              isSelected: false,
              status: status
            };
          } catch (error) {
            console.error('Error converting position coordinates:', error);
            return null;
          }
        })
        .filter((marker): marker is { position: [number, number]; popup: string; isSelected: boolean; status: 'filled' | 'partial' | 'needs' } => marker !== null)
    : [];

  const renderLiveUpdates = () => {
    const allUpdates = [
      ...(issues || []),
      ...(messages || []).map(message => ({
        id: message.id,
        type: 'message' as const,
        message: message.title,
        content: message.content,
        timestamp: message.created_at,
        position: message.position,
        status: message.status,
        volunteer: message.volunteer,
        phone_number: message.phone_number
      }))
    ].sort((a, b) => {
      const dateA = parseISO(a.timestamp);
      const dateB = parseISO(b.timestamp);
      return isValid(dateB) && isValid(dateA) ? dateB.getTime() - dateA.getTime() : 0;
    });

    return (
      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        {allUpdates.map((update) => {
          if ('type' in update && update.type === 'message') {
            return (
              <div
                key={update.id}
                className="p-4 rounded-lg bg-white border border-gray-200 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <MessageSquare className="h-5 w-5 text-indigo-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{update.message}</p>
                      <p className="text-sm text-gray-600 mt-1">{update.content}</p>
                      {update.volunteer ? (
                        <p className="text-sm text-gray-500 mt-1">
                          From: {update.volunteer.volunteer_name} ({update.volunteer.phone_number})
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500 mt-1">
                          From: Unknown ({update.phone_number})
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {safeFormatDate(update.timestamp, 'PPp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => updateMessageStatus.mutate({ id: update.id, status: 'in_progress' })}
                      className={`p-1 rounded-full ${
                        update.status === 'in_progress' ? 'bg-yellow-100 text-yellow-600' : 'hover:bg-gray-100'
                      }`}
                      title="Mark as in progress"
                    >
                      <AlertCircle className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updateMessageStatus.mutate({ id: update.id, status: 'resolved' })}
                      className={`p-1 rounded-full ${
                        update.status === 'resolved' ? 'bg-green-100 text-green-600' : 'hover:bg-gray-100'
                      }`}
                      title="Mark as resolved"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => updateMessageStatus.mutate({ id: update.id, status: 'ignored' })}
                      className={`p-1 rounded-full ${
                        update.status === 'ignored' ? 'bg-red-100 text-red-600' : 'hover:bg-gray-100'
                      }`}
                      title="Ignore message"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={update.id}
              className={`p-4 rounded-lg ${
                update.type === 'error' ? 'bg-red-50' :
                update.type === 'warning' ? 'bg-yellow-50' : 'bg-blue-50'
              }`}
            >
              <div className="flex items-start">
                {update.type === 'error' ? (
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                ) : update.type === 'warning' ? (
                  <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5 mr-2" />
                ) : (
                  <Bell className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                )}
                <div>
                  <p className={`text-sm ${
                    update.type === 'error' ? 'text-red-800' :
                    update.type === 'warning' ? 'text-yellow-800' : 'text-blue-800'
                  }`}>
                    {update.message}
                  </p>
                  {update.position && (
                    <p className="text-xs text-gray-500 mt-1">
                      {update.position.event.name} - {update.position.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {safeFormatDate(update.timestamp, 'PPp')}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        {allUpdates.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No updates to report
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Events Overview</h1>
          <select
            value={selectedEventId || ''}
            onChange={(e) => setSelectedEventId(e.target.value || null)}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Events</option>
            {events?.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} - {safeFormatDate(event.date, 'PP')}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-blue-500 mr-2" />
              <h2 className="text-lg font-semibold text-blue-700">Total Positions</h2>
            </div>
            <p className="text-3xl font-bold text-blue-900 mt-2">{filteredPositions.length}</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 text-green-500 mr-2" />
              <h2 className="text-lg font-semibold text-green-700">Filled Positions</h2>
            </div>
            <p className="text-3xl font-bold text-green-900 mt-2">
              {filteredPositions.filter(p => p.filled >= p.needed).length}
            </p>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center">
              <AlertCircle className="h-6 w-6 text-red-500 mr-2" />
              <h2 className="text-lg font-semibold text-red-700">Needs Volunteers</h2>
            </div>
            <p className="text-3xl font-bold text-red-900 mt-2">
              {filteredPositions.filter(p => p.filled < p.needed).length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Position Locations</h2>
              {selectedEvent?.custom_map_url && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  <MapPin className="h-3 w-3 mr-1" />
                  Custom Map
                </span>
              )}
            </div>
            <div className="h-[600px] rounded-lg overflow-hidden">
              {selectedEvent?.custom_map_url ? (
                <div className="relative h-full">
                  <CustomMapView
                    imageUrl={selectedEvent.custom_map_url}
                    markers={customMapMarkers}
                    className="h-full w-full"
                  />
                  {filteredPositions.length > 0 && (
                    <div className="absolute top-4 right-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md">
                      <h4 className="font-medium text-sm text-gray-900 mb-2">Positions on this map:</h4>
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
                  {/* Legend for marker colors */}
                  <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 p-3 rounded-lg shadow-md">
                    <h4 className="font-medium text-sm text-gray-900 mb-2">Legend:</h4>
                    <div className="space-y-1">
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                        <span>Fully Staffed</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                        <span>Partially Staffed</span>
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                        <span>Needs Volunteers</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <MapContainer
                  center={[0, 0]}
                  zoom={2}
                  style={{ height: '100%', width: '100%' }}
                  ref={mapRef}
                >
                  <MapUpdater positions={positions} selectedEventId={selectedEventId} />
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {filteredPositions.map((position) => (
                    <Marker
                      key={position.id}
                      position={[position.latitude, position.longitude]}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-medium">{position.name}</h3>
                          <p className="text-sm text-gray-600">{position.event.name}</p>
                          <p className="text-sm text-gray-600">
                            {safeFormatDate(`${position.event.date} ${position.event.time}`, 'PPp')}
                          </p>
                          <p className={`text-sm ${
                            position.filled >= position.needed ? 'text-green-600' : 'text-red-600'
                          }`}>
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
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Live Updates</h2>
            {renderLiveUpdates()}
          </div>
        </div>
      </div>
    </div>
  );
}