import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { format, isValid, parseISO } from 'date-fns';
import { Calendar, Edit2, Trash2, Eye, Map, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Event {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  custom_map_url?: string | null;
}

interface EventFormData {
  name: string;
  date: string;
  time: string;
  location: string;
  custom_map_url?: string | null;
}

export function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<EventFormData>();
  const customMapUrl = watch('custom_map_url');

  useEffect(() => {
    if (editingEvent) {
      setValue('name', editingEvent.name);
      setValue('date', editingEvent.date);
      setValue('time', editingEvent.time);
      setValue('location', editingEvent.location);
      setValue('custom_map_url', editingEvent.custom_map_url || '');
    }
  }, [editingEvent, setValue]);

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('date', { ascending: true });

        if (error) throw error;
        return data;
      } catch (error) {
        console.error('Error fetching events:', error);
        throw error;
      }
    },
    retry: 3,
    retryDelay: 1000,
  });

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('custom-maps')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('custom-maps')
        .getPublicUrl(filePath);

      setValue('custom_map_url', publicUrl);
      toast.success('Map image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload map image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeCustomMap = async () => {
    if (editingEvent?.custom_map_url) {
      try {
        const filePath = editingEvent.custom_map_url.split('/').pop();
        if (filePath) {
          await supabase.storage
            .from('custom-maps')
            .remove([`${user?.id}/${filePath}`]);
        }
      } catch (error) {
        console.error('Error removing custom map:', error);
      }
    }
    setValue('custom_map_url', null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      try {
        const { error } = await supabase
          .from('events')
          .insert([{ ...data, user_id: user?.id }]);
        if (error) throw error;
      } catch (error) {
        console.error('Error creating event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event created successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create event');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Event) => {
      try {
        const { error } = await supabase
          .from('events')
          .update(data)
          .eq('id', data.id);
        if (error) throw error;
      } catch (error) {
        console.error('Error updating event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event updated successfully');
      setEditingEvent(null);
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update event');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', id);
        if (error) throw error;
      } catch (error) {
        console.error('Error deleting event:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast.success('Event deleted successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete event');
    },
  });

  const onSubmit = (data: EventFormData) => {
    if (editingEvent) {
      updateMutation.mutate({ ...data, id: editingEvent.id });
    } else {
      createMutation.mutate(data);
    }
  };

  const formatEventDateTime = (date: string, time: string) => {
    try {
      const dateTimeString = `${date}T${time}:00Z`;
      const parsedDate = parseISO(dateTimeString);
      
      if (!isValid(parsedDate)) {
        return `${date} ${time}`;
      }
      
      return format(parsedDate, 'PPp');
    } catch (err) {
      console.error('Error formatting date/time:', err);
      return `${date} ${time}`;
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
        <p className="text-red-600">Error loading events. Please try again later.</p>
        <button 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['events'] })}
          className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingEvent ? 'Edit Event' : 'Create New Event'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Event Name</label>
            <input
              {...register('name', { required: 'Event name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              {...register('date', { required: 'Date is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Time</label>
            <input
              type="time"
              {...register('time', { required: 'Time is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.time && (
              <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Location</label>
            <input
              {...register('location', { required: 'Location is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.location && (
              <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Custom Map Image</label>
            <div className="mt-1 flex items-center space-x-4">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              {isUploading && (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              )}
              {customMapUrl && (
                <button
                  type="button"
                  onClick={removeCustomMap}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Remove Map
                </button>
              )}
            </div>
            {customMapUrl && (
              <div className="mt-2">
                <img
                  src={customMapUrl}
                  alt="Custom map"
                  className="max-h-48 rounded-lg object-cover"
                />
              </div>
            )}
            <input type="hidden" {...register('custom_map_url')} />
          </div>

          <div className="flex justify-end space-x-3">
            {editingEvent && (
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(null);
                  reset();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {editingEvent ? 'Update Event' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Upcoming Events
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {events?.map((event) => (
              <li key={event.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-indigo-600">{event.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatEventDateTime(event.date, event.time)}
                      </p>
                      <p className="text-sm text-gray-500">{event.location}</p>
                      {event.custom_map_url && (
                        <p className="text-sm text-gray-500 flex items-center mt-1">
                          <Map className="h-4 w-4 mr-1 text-gray-400" />
                          Custom map available
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigate(`/overview?eventId=${event.id}`)}
                      className="text-gray-400 hover:text-gray-500"
                      title="View event overview"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setEditingEvent(event)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit event"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this event?')) {
                          deleteMutation.mutate(event.id);
                        }
                      }}
                      className="text-gray-400 hover:text-gray-500"
                      title="Delete event"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {events?.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                No events found. Create one above!
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}