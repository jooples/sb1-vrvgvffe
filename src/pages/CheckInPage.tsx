import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { CheckCircle, AlertCircle, Info, MapPin, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Volunteer {
  id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
  organization: string | null;
}

interface Position {
  id: string;
  name: string;
  description: string;
  skill_level: string;
  latitude: number;
  longitude: number;
  event: {
    id: string;
    name: string;
    date: string;
    time: string;
    location: string;
  };
}

function MessageForm({ 
  position, 
  selectedVolunteer, 
  volunteers 
}: { 
  position: Position; 
  selectedVolunteer: string;
  volunteers: Volunteer[];
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [messageFrom, setMessageFrom] = useState(selectedVolunteer || 'other');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);

    try {
      const messageData = {
        title,
        content,
        volunteer_id: messageFrom !== 'other' ? messageFrom : null,
        phone_number: messageFrom === 'other' ? phoneNumber : null,
        position_id: position.id,
        event_id: position.event.id,
      };

      const { error } = await supabase
        .from('messages')
        .insert([messageData]);

      if (error) throw error;

      toast.success('Message sent successfully');
      setTitle('');
      setContent('');
      setPhoneNumber('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-8 bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Send Message to Organizer</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Sending as</label>
          <select
            value={messageFrom}
            onChange={(e) => setMessageFrom(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {volunteers.map((volunteer) => (
              <option key={volunteer.id} value={volunteer.id}>
                {volunteer.volunteer_name}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </div>

        {messageFrom === 'other' && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              required={messageFrom === 'other'}
              placeholder="Enter your phone number"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
            placeholder="Message title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Message</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
            placeholder="Enter your message"
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
        >
          {isSending ? 'Sending...' : 'Send Message'}
        </button>
      </form>
    </div>
  );
}

interface ConfirmationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  volunteer: Volunteer | null;
  isCheckIn: boolean;
  isLoading: boolean;
}

function ConfirmationPopup({ 
  isOpen, 
  onClose, 
  onConfirm, 
  volunteer, 
  isCheckIn, 
  isLoading 
}: ConfirmationPopupProps) {
  if (!isOpen || !volunteer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Confirm {isCheckIn ? 'Check-In' : 'Check-Out'}
          </h3>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-3 mb-6">
          <div>
            <p className="text-sm font-medium text-gray-500">Name</p>
            <p className="text-base text-gray-900">{volunteer.volunteer_name}</p>
          </div>
          
          {volunteer.organization && (
            <div>
              <p className="text-sm font-medium text-gray-500">Organization</p>
              <p className="text-base text-gray-900">{volunteer.organization}</p>
            </div>
          )}
          
          <div>
            <p className="text-sm font-medium text-gray-500">Shift Time</p>
            <p className="text-base text-gray-900">
              {volunteer.start_time} - {volunteer.end_time}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
              isCheckIn
                ? 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                : 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
            }`}
          >
            {isLoading ? 'Processing...' : `Confirm ${isCheckIn ? 'Check-In' : 'Check-Out'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CheckInPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedVolunteer, setSelectedVolunteer] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [confirmationPopup, setConfirmationPopup] = useState<{
    isOpen: boolean;
    volunteer: Volunteer | null;
    isCheckIn: boolean;
  }>({
    isOpen: false,
    volunteer: null,
    isCheckIn: true
  });
  const [debugInfo, setDebugInfo] = useState<{
    positionId: string | null;
    positionFound: boolean;
    volunteersFound: boolean;
    error: string | null;
    userLocation: string | null;
  }>({
    positionId: null,
    positionFound: false,
    volunteersFound: false,
    error: null,
    userLocation: null
  });
  
  const positionId = searchParams.get('position');
  
  useEffect(() => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ lat: latitude, lng: longitude });
          setDebugInfo(prev => ({
            ...prev,
            userLocation: `${latitude}, ${longitude}`
          }));
          setIsLoading(false);
        },
        (error) => {
          console.error('Geolocation error:', error);
          setLocationError(`Unable to get your location: ${error.message}`);
          setIsLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser');
    }
  }, []);
  
  useEffect(() => {
    setDebugInfo(prev => ({
      ...prev,
      positionId: positionId
    }));
    
    console.log('Position ID from URL:', positionId);
    
    if (!positionId) {
      setDebugInfo(prev => ({
        ...prev,
        error: 'No position ID provided in URL'
      }));
      toast.error('Invalid QR code: No position ID');
      navigate('/', { replace: true });
    }
  }, [positionId, navigate]);

  const { data: position, isLoading: positionLoading, error: positionError } = useQuery({
    queryKey: ['position', positionId],
    queryFn: async () => {
      if (!positionId) {
        const error = new Error('No position ID provided');
        console.error(error);
        setDebugInfo(prev => ({
          ...prev,
          error: error.message
        }));
        throw error;
      }
      
      console.log('Fetching position with ID:', positionId);
      
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            id,
            name,
            description,
            skill_level,
            latitude,
            longitude,
            event:events(
              id,
              name,
              date,
              time,
              location
            )
          `)
          .eq('id', positionId)
          .single();

        if (error) {
          console.error('Supabase error fetching position:', error);
          setDebugInfo(prev => ({
            ...prev,
            error: `Database error: ${error.message}`
          }));
          throw error;
        }
        
        if (!data) {
          const notFoundError = new Error('Position not found');
          console.error(notFoundError);
          setDebugInfo(prev => ({
            ...prev,
            error: notFoundError.message
          }));
          throw notFoundError;
        }
        
        console.log('Position found:', data);
        setDebugInfo(prev => ({
          ...prev,
          positionFound: true
        }));
        
        return {
          ...data,
          event: Array.isArray(data.event) ? data.event[0] : data.event
        } as Position;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching position');
        console.error('Error in position query:', error);
        setDebugInfo(prev => ({
          ...prev,
          error: error.message
        }));
        throw error;
      }
    },
    enabled: !!positionId,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60 * 5,
  });

  const { data: volunteers, isLoading: volunteersLoading, error: volunteersError } = useQuery({
    queryKey: ['volunteers', positionId],
    queryFn: async () => {
      if (!positionId) {
        const error = new Error('No position ID provided');
        console.error(error);
        throw error;
      }

      console.log('Fetching volunteers for position ID:', positionId);
      
      try {
        const { data, error } = await supabase
          .from('volunteer_signups')
          .select('*')
          .eq('position_id', positionId)
          .order('start_time', { ascending: true });

        if (error) {
          console.error('Supabase error fetching volunteers:', error);
          throw error;
        }
        
        console.log('Volunteers found:', data?.length || 0);
        setDebugInfo(prev => ({
          ...prev,
          volunteersFound: (data?.length || 0) > 0
        }));
        
        return data as Volunteer[];
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Unknown error fetching volunteers');
        console.error('Error in volunteers query:', error);
        throw error;
      }
    },
    enabled: !!positionId,
    retry: 3,
    retryDelay: 1000,
    staleTime: 1000 * 60,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ volunteerId, arrived }: { volunteerId: string; arrived: boolean }) => {
      console.log(`${arrived ? 'Checking in' : 'Checking out'} volunteer with ID:`, volunteerId);
      setIsLoading(true);
      
      try {
        // Update volunteer signup arrival status
        const { error: signupError } = await supabase
          .from('volunteer_signups')
          .update({ arrived })
          .eq('id', volunteerId);
          
        if (signupError) {
          console.error('Supabase error updating volunteer status:', signupError);
          throw signupError;
        }

        // Update the filled count for the position
        if (arrived) {
          // Volunteer is checking in - increment filled count
          const { error: incrementError } = await supabase
            .rpc('increment_filled_count', { position_id: position?.id });
            
          if (incrementError) {
            console.error('Supabase error incrementing filled count:', incrementError);
            throw incrementError;
          }
        } else {
          // Volunteer is checking out - decrement filled count
          const { error: decrementError } = await supabase
            .rpc('decrement_filled_count', { position_id: position?.id });
            
          if (decrementError) {
            console.error('Supabase error decrementing filled count:', decrementError);
            throw decrementError;
          }
        }
        
        console.log(`Volunteer ${arrived ? 'check-in' : 'check-out'} successful`);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(`Unknown error ${arrived ? 'checking in' : 'checking out'} volunteer`);
        console.error('Error in check-in mutation:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers', positionId] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['positions', position?.event?.id] });
      toast.success('Volunteer status updated!');
      setSelectedVolunteer('');
      setConfirmationPopup({ isOpen: false, volunteer: null, isCheckIn: true });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update volunteer status');
    },
  });

  const handleCheckInClick = (volunteer: Volunteer) => {
    setConfirmationPopup({
      isOpen: true,
      volunteer,
      isCheckIn: !volunteer.arrived
    });
  };

  const handleConfirmCheckIn = () => {
    if (confirmationPopup.volunteer) {
      checkInMutation.mutate({
        volunteerId: confirmationPopup.volunteer.id,
        arrived: confirmationPopup.isCheckIn
      });
    }
  };

  const handleCloseConfirmation = () => {
    setConfirmationPopup({ isOpen: false, volunteer: null, isCheckIn: true });
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  const isNearPosition = () => {
    if (!userLocation || !position?.latitude || !position?.longitude) {
      return true;
    }
    
    const distance = calculateDistance(
      userLocation.lat, 
      userLocation.lng, 
      position.latitude, 
      position.longitude
    );
    
    return distance <= 200;
  };

  const showDebugInfo = () => {
    return (
      <div className="mt-8 p-4 border border-gray-300 rounded-md bg-gray-50">
        <h3 className="text-sm font-medium text-gray-700 flex items-center">
          <Info className="h-4 w-4 mr-1" />
          Debug Information
        </h3>
        <div className="mt-2 text-xs text-gray-600 space-y-1">
          <p>Position ID: {debugInfo.positionId || 'None'}</p>
          <p>Position Found: {debugInfo.positionFound ? 'Yes' : 'No'}</p>
          <p>Volunteers Found: {debugInfo.volunteersFound ? 'Yes' : 'No'}</p>
          <p>User Location: {debugInfo.userLocation || 'Not available'}</p>
          <p>Error: {debugInfo.error || 'None'}</p>
          <p>Loading State: {positionLoading || volunteersLoading || isLoading ? 'Loading...' : 'Complete'}</p>
        </div>
      </div>
    );
  };

  if (positionLoading || volunteersLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-600">Loading check-in information...</p>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  if (positionError || volunteersError) {
    const errorMessage = positionError instanceof Error 
      ? positionError.message 
      : volunteersError instanceof Error 
        ? volunteersError.message 
        : 'Unknown error';
        
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-2">Failed to load check-in information</p>
          <p className="text-sm text-red-600 mb-4">{errorMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md w-full">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 mb-2">Position not found</p>
          <p className="text-sm text-gray-500 mb-4">
            The position ID provided in the QR code does not exist or is no longer available.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Go Home
          </button>
        </div>
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
      </div>
    );
  }

  const nearPosition = isNearPosition();

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white p-8 rounded-lg shadow">
          <div>
            <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-100">
              <CheckCircle className="h-6 w-6 text-indigo-600" />
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Volunteer Check-In
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">{position.event.name}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {new Date(`${position.event.date} ${position.event.time}`).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">{position.event.location}</p>
            </div>

            <div>
              <h4 className="text-md font-medium text-gray-900">Position Details</h4>
              <p className="text-sm text-gray-500">{position.name}</p>
              {position.description && (
                <p className="text-sm text-gray-500">{position.description}</p>
              )}
              {position.skill_level && (
                <p className="text-sm text-gray-500">Skill Level: {position.skill_level}</p>
              )}
              
              {userLocation && position.latitude && position.longitude && (
                <div className="mt-2 flex items-center">
                  <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                  <p className={`text-sm ${nearPosition ? 'text-green-600' : 'text-orange-500'}`}>
                    {nearPosition 
                      ? 'You are near the check-in location' 
                      : 'You appear to be away from the check-in location'}
                  </p>
                </div>
              )}
              
              {locationError && (
                <p className="text-sm text-orange-500 mt-2">
                  {locationError} (You can still check in)
                </p>
              )}
            </div>

            {volunteers && volunteers.length > 0 ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select a volunteer to toggle check-in status
                </label>
                <div className="space-y-2">
                  {volunteers.map((volunteer) => (
                    <div key={volunteer.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${volunteer.arrived ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {volunteer.volunteer_name}
                              {volunteer.organization && ` - ${volunteer.organization}`}
                            </p>
                            <p className="text-xs text-gray-500">
                              {volunteer.start_time} - {volunteer.end_time}
                            </p>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckInClick(volunteer)}
                        disabled={isLoading}
                        className={`px-3 py-1 text-xs font-medium rounded-md ${
                          volunteer.arrived
                            ? 'bg-red-100 text-red-700 hover:bg-red-200'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {isLoading ? 'Processing...' : (volunteer.arrived ? 'Check Out' : 'Check In')}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500">
                  No volunteers assigned to this position yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {position && volunteers && (
          <MessageForm
            position={position}
            selectedVolunteer={selectedVolunteer}
            volunteers={volunteers}
          />
        )}
        
        {process.env.NODE_ENV !== 'production' && showDebugInfo()}
        
        <ConfirmationPopup
          isOpen={confirmationPopup.isOpen}
          onClose={handleCloseConfirmation}
          onConfirm={handleConfirmCheckIn}
          volunteer={confirmationPopup.volunteer}
          isCheckIn={confirmationPopup.isCheckIn}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}