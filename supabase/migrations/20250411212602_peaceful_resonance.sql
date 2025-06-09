/*
  # Add Messages Table for Volunteer Communication

  1. New Tables
    - `messages`
      - `id` (uuid, primary key)
      - `title` (text)
      - `content` (text)
      - `volunteer_id` (uuid, references volunteer_signups)
      - `phone_number` (text, for non-volunteer messages)
      - `status` (text) - can be 'pending', 'in_progress', 'resolved', or 'ignored'
      - `created_at` (timestamptz)
      - `position_id` (uuid, references volunteer_positions)
      - `event_id` (uuid, references events)

  2. Security
    - Enable RLS on messages table
    - Add policies for authenticated users and public access
*/

CREATE TYPE message_status AS ENUM ('pending', 'in_progress', 'resolved', 'ignored');

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  volunteer_id uuid REFERENCES volunteer_signups(id),
  phone_number text,
  status message_status DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  position_id uuid REFERENCES volunteer_positions(id) NOT NULL,
  event_id uuid REFERENCES events(id) NOT NULL
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert messages (for check-in page)
CREATE POLICY "Anyone can insert messages"
  ON messages
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Allow event organizers to read messages for their events
CREATE POLICY "Users can read messages for their events"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = messages.event_id
      AND events.user_id = auth.uid()
    )
  );

-- Allow event organizers to update message status
CREATE POLICY "Users can update message status for their events"
  ON messages
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = messages.event_id
      AND events.user_id = auth.uid()
    )
  );