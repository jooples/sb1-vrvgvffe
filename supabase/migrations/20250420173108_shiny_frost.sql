/*
  # Create custom maps storage bucket

  1. Storage
    - Creates a new storage bucket called 'custom-maps' for storing event map images
  
  2. Security
    - Enables public access for reading map images
    - Allows authenticated users to upload and delete their own map images
*/

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('custom-maps', 'custom-maps', true);

-- Allow public access to read files (since maps need to be publicly viewable)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'custom-maps');

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload maps"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'custom-maps' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update their own files
CREATE POLICY "Users can update their own maps"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'custom-maps' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'custom-maps' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own maps"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'custom-maps' AND
  (storage.foldername(name))[1] = auth.uid()::text
);