import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { Users, Edit2, Trash2, CheckCircle, XCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Volunteer {
  id: string;
  position_id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  arrived: boolean;
  other_notes: string | null;
  organization: string | null;
}

interface VolunteerFormData {
  position_id: string;
  volunteer_name: string;
  phone_number: string;
  start_time: string;
  end_time: string;
  other_notes: string;
  organization: string;
}

interface Position {
  id: string;
  name: string;
  event: { name: string };
  needed: number;
  filled: number;
  latitude: number;
  longitude: number;
}

export function AssignVolunteersPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingVolunteer, setEditingVolunteer] = useState<Volunteer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedOrganization, setSelectedOrganization] = useState('');

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<VolunteerFormData>();

  const { data: positions } = useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_positions')
          .select(`
            id,
            name,
            needed,
            filled,
            latitude,
            longitude,
            event:events(name)
          `)
          .eq('user_id', user?.id);
        if (error) throw error;
        return (data as any[]).map(item => ({
          ...item,
          event: Array.isArray(item.event) ? item.event[0] : item.event
        })) as Position[];
      } catch (error) {
        console.error('Error fetching positions:', error);
        throw error;
      }
    },
  });

  const { data: volunteers } = useQuery({
    queryKey: ['volunteers'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('volunteer_signups')
          .select(`
            id,
            volunteer_name,
            phone_number,
            start_time,
            end_time,
            arrived,
            other_notes,
            organization,
            position_id,
            position:volunteer_positions(
              name,
              event:events(name)
            )
          `);
        if (error) throw error;
        return (data as any[]).map(item => ({
          ...item,
          position: {
            ...item.position,
            event: Array.isArray(item.position.event) ? item.position.event[0] : item.position.event
          }
        }));
      } catch (error) {
        console.error('Error fetching volunteers:', error);
        throw error;
      }
    },
  });

  // Filter volunteers based on search and filter criteria
  const filteredVolunteers = useMemo(() => {
    if (!volunteers) return [];

    return volunteers.filter(volunteer => {
      // Search by name
      const matchesSearch = searchTerm === '' || 
        volunteer.volunteer_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filter by event
      const matchesEvent = selectedEvent === '' || 
        volunteer.position.event?.name === selectedEvent;
      
      // Filter by position
      const matchesPosition = selectedPosition === '' || 
        volunteer.position.name === selectedPosition;
      
      // Filter by organization
      const matchesOrganization = selectedOrganization === '' || 
        volunteer.organization === selectedOrganization;

      return matchesSearch && matchesEvent && matchesPosition && matchesOrganization;
    });
  }, [volunteers, searchTerm, selectedEvent, selectedPosition, selectedOrganization]);

  // Get unique values for filter dropdowns
  const uniqueEvents = useMemo(() => {
    if (!volunteers) return [];
    const events = volunteers.map(v => v.position.event?.name).filter(Boolean);
    return Array.from(new Set(events)).sort();
  }, [volunteers]);

  const uniquePositions = useMemo(() => {
    if (!volunteers) return [];
    const positions = volunteers.map(v => v.position.name).filter(Boolean);
    return Array.from(new Set(positions)).sort();
  }, [volunteers]);

  const uniqueOrganizations = useMemo(() => {
    if (!volunteers) return [];
    const organizations = volunteers.map(v => v.organization).filter(Boolean);
    return Array.from(new Set(organizations)).sort();
  }, [volunteers]);

  useEffect(() => {
    if (editingVolunteer) {
      console.log('Setting form values for editing volunteer:', editingVolunteer);
      setValue('position_id', editingVolunteer.position_id);
      setValue('volunteer_name', editingVolunteer.volunteer_name);
      setValue('phone_number', editingVolunteer.phone_number);
      setValue('start_time', editingVolunteer.start_time);
      setValue('end_time', editingVolunteer.end_time);
      setValue('other_notes', editingVolunteer.other_notes || '');
      setValue('organization', editingVolunteer.organization || '');
    }
  }, [editingVolunteer, setValue]);

  const createMutation = useMutation({
    mutationFn: async (data: VolunteerFormData) => {
      setIsSubmitting(true);
      console.log('Creating volunteer with data:', data);
      
      // Validate required fields
      if (!data.position_id || !data.volunteer_name || !data.phone_number || !data.start_time || !data.end_time) {
        throw new Error('Missing required fields');
      }
      
      try {
        const insertData = {
          position_id: data.position_id,
          volunteer_name: data.volunteer_name,
          phone_number: data.phone_number,
          start_time: data.start_time,
          end_time: data.end_time,
          arrived: false,
          other_notes: data.other_notes || null,
          organization: data.organization || null
        };

        const { data: signup, error: signupError } = await supabase
          .from('volunteer_signups')
          .insert([insertData])
          .select('id')
          .single();
        
        if (signupError) throw signupError;

        // Increment the filled count for the position
        const { error: incrementError } = await supabase
          .rpc('increment_filled_count', { position_id: data.position_id });
          
        if (incrementError) {
          console.error('Error incrementing filled count:', incrementError);
          // Don't throw error for RPC function failure, just log it
          console.warn('Continuing despite RPC function failure');
        }

        return signup;
      } catch (error) {
        console.error('Error creating volunteer assignment:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          data: error
        });
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Volunteer assigned successfully');
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to assign volunteer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Volunteer>) => {
      setIsSubmitting(true);
      console.log('Updating volunteer with data:', data);
      try {
        // If position_id is changing, we need to update the filled counts
        if (data.position_id && editingVolunteer && data.position_id !== editingVolunteer.position_id) {
          // Decrement the old position's filled count
          const { error: decrementError } = await supabase
            .rpc('decrement_filled_count', { position_id: editingVolunteer.position_id });
          
          if (decrementError) {
            console.error('Error decrementing filled count for old position:', decrementError);
            console.warn('Continuing despite RPC function failure');
          }

          // Increment the new position's filled count
          const { error: incrementError } = await supabase
            .rpc('increment_filled_count', { position_id: data.position_id });
          
          if (incrementError) {
            console.error('Error incrementing filled count for new position:', incrementError);
            console.warn('Continuing despite RPC function failure');
          }
        }

        // Prepare update data
        const updateData = { ...data };
        delete updateData.id; // Remove id from update data

        const { error } = await supabase
          .from('volunteer_signups')
          .update(updateData)
          .eq('id', data.id)
          .select('id');
        if (error) throw error;
      } catch (error) {
        console.error('Error updating volunteer:', error);
        console.error('Error details:', {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          data: error
        });
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer updated successfully');
      setEditingVolunteer(null);
      reset();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update volunteer');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, position_id }: { id: string; position_id: string }) => {
      try {
        const { error: deleteError } = await supabase
          .from('volunteer_signups')
          .delete()
          .eq('id', id);
        
        if (deleteError) throw deleteError;

        // Decrement the filled count for the position
        const { error: decrementError } = await supabase
          .rpc('decrement_filled_count', { position_id });
          
        if (decrementError) {
          console.error('Error decrementing filled count:', decrementError);
          console.warn('Continuing despite RPC function failure');
        }
      } catch (error) {
        console.error('Error deleting volunteer:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Volunteer removed successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to remove volunteer');
    },
  });

  const toggleArrivalMutation = useMutation({
    mutationFn: async ({ id, arrived, position_id }: { id: string; arrived: boolean; position_id: string }) => {
      try {
        // Update volunteer signup arrival status
        const { error } = await supabase
          .from('volunteer_signups')
          .update({ arrived })
          .eq('id', id)
          .select('id');
        if (error) throw error;

        // Update the filled count for the position
        if (arrived) {
          // Volunteer is checking in - increment filled count
          const { error: incrementError } = await supabase
            .rpc('increment_filled_count', { position_id });
          
          if (incrementError) {
            console.error('Error incrementing filled count:', incrementError);
            console.warn('Continuing despite RPC function failure');
          }
        } else {
          // Volunteer is unchecking - decrement filled count
          const { error: decrementError } = await supabase
            .rpc('decrement_filled_count', { position_id });
          
          if (decrementError) {
            console.error('Error decrementing filled count:', decrementError);
            console.warn('Continuing despite RPC function failure');
          }
        }
      } catch (error) {
        console.error('Error toggling volunteer arrival:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      toast.success('Volunteer status updated');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update volunteer status');
    },
  });

  const onSubmit = (data: VolunteerFormData) => {
    if (editingVolunteer) {
      // Only update fields that have changed
      const updates: Partial<Volunteer> = { id: editingVolunteer.id };
      if (data.volunteer_name !== editingVolunteer.volunteer_name) updates.volunteer_name = data.volunteer_name;
      if (data.phone_number !== editingVolunteer.phone_number) updates.phone_number = data.phone_number;
      if (data.start_time !== editingVolunteer.start_time) updates.start_time = data.start_time;
      if (data.end_time !== editingVolunteer.end_time) updates.end_time = data.end_time;
      if (data.position_id !== editingVolunteer.position_id) updates.position_id = data.position_id;
      if (data.other_notes !== (editingVolunteer.other_notes || '')) updates.other_notes = data.other_notes || null;
      if (data.organization !== (editingVolunteer.organization || '')) updates.organization = data.organization || null;
      
      updateMutation.mutate(updates);
    } else {
      createMutation.mutate(data);
    }
  };

  if (!positions || !volunteers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium mb-4">
          {editingVolunteer ? 'Edit Volunteer Assignment' : 'Assign New Volunteer'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Position</label>
            <select
              {...register('position_id', { required: 'Position is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a position</option>
              {positions?.map((position) => (
                <option 
                  key={position.id} 
                  value={position.id}
                >
                  {position.event.name} - {position.name}
                </option>
              ))}
            </select>
            {errors.position_id && (
              <p className="mt-1 text-sm text-red-600">{errors.position_id.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Volunteer Name</label>
            <input
              {...register('volunteer_name', { required: 'Volunteer name is required' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.volunteer_name && (
              <p className="mt-1 text-sm text-red-600">{errors.volunteer_name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Organization (Optional)</label>
            <input
              {...register('organization')}
              placeholder="Enter organization name..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Phone Number</label>
            <input
              {...register('phone_number', { 
                required: 'Phone number is required',
                pattern: {
                  value: /^[0-9+\-\s()]*$/,
                  message: 'Please enter a valid phone number'
                }
              })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
            {errors.phone_number && (
              <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Time</label>
              <input
                type="time"
                {...register('start_time', { required: 'Start time is required' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.start_time && (
                <p className="mt-1 text-sm text-red-600">{errors.start_time.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">End Time</label>
              <input
                type="time"
                {...register('end_time', { required: 'End time is required' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              {errors.end_time && (
                <p className="mt-1 text-sm text-red-600">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Other Notes (Optional)</label>
            <textarea
              {...register('other_notes')}
              rows={3}
              placeholder="Enter any additional notes about this volunteer..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          <div className="flex justify-end space-x-3">
            {editingVolunteer && (
              <button
                type="button"
                onClick={() => {
                  setEditingVolunteer(null);
                  reset();
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
              {isSubmitting ? 'Processing...' : (editingVolunteer ? 'Update Assignment' : 'Assign Volunteer')}
            </button>
          </div>
        </form>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-gray-400 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filter & Search Volunteers</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search by name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search by Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter volunteer name..."
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          {/* Filter by event */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Event
            </label>
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Events</option>
              {uniqueEvents.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Position
            </label>
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Positions</option>
              {uniquePositions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by organization */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Organization
            </label>
            <select
              value={selectedOrganization}
              onChange={(e) => setSelectedOrganization(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Organizations</option>
              {uniqueOrganizations.map((organization) => (
                <option key={organization} value={organization}>
                  {organization}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear filters button */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedEvent('');
              setSelectedPosition('');
              setSelectedOrganization('');
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Clear All Filters
          </button>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredVolunteers.length} of {volunteers?.length || 0} volunteers
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Assigned Volunteers
          </h3>
        </div>
        <div className="border-t border-gray-200">
          <ul className="divide-y divide-gray-200">
            {filteredVolunteers?.map((volunteer) => (
              <li key={volunteer.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-indigo-600">
                        {volunteer.volunteer_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.position.event?.name} - {volunteer.position.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.phone_number}
                      </p>
                      <p className="text-sm text-gray-500">
                        {volunteer.start_time} - {volunteer.end_time}
                      </p>
                      {volunteer.organization && volunteer.organization.trim() && (
                        <p className="text-sm text-gray-500">
                          <span className="font-medium">Organization:</span> {volunteer.organization}
                        </p>
                      )}
                      {volunteer.other_notes && volunteer.other_notes.trim() && (
                        <p className="text-sm text-gray-500 italic">
                          <span className="font-medium">Notes:</span> {volunteer.other_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => toggleArrivalMutation.mutate({ 
                        id: volunteer.id, 
                        arrived: !volunteer.arrived,
                        position_id: volunteer.position_id
                      })}
                      className={`${
                        volunteer.arrived ? 'text-green-500' : 'text-gray-400'
                      } hover:text-gray-500`}
                      title={volunteer.arrived ? 'Checked in' : 'Not checked in'}
                    >
                      {volunteer.arrived ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <XCircle className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingVolunteer(volunteer)}
                      className="text-gray-400 hover:text-gray-500"
                      title="Edit volunteer"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Are you sure you want to remove this volunteer?')) {
                          deleteMutation.mutate({ 
                            id: volunteer.id, 
                            position_id: volunteer.position_id 
                          });
                        }
                      }}
                      className="text-gray-400 hover:text-gray-500"
                      title="Remove volunteer"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {filteredVolunteers?.length === 0 && (
              <li className="px-4 py-4 sm:px-6 text-center text-gray-500">
                {volunteers?.length === 0 
                  ? 'No volunteers assigned yet.' 
                  : 'No volunteers match the current filters.'}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}