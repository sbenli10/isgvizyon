/*
  # Create Inspections Table with Photo Evidence Support

  1. New Tables
    - `inspections`
      - `id` (uuid, primary key)
      - `site_name` (text) - Name of the inspection site
      - `inspector_name` (text) - Name of the inspector
      - `inspection_date` (date) - Date of inspection
      - `status` (text) - Status: completed, in-progress, overdue, scheduled
      - `risk_level` (text) - Risk level: low, medium, high, critical
      - `score` (integer) - Compliance score (0-100)
      - `observations` (text) - Inspection observations/notes
      - `photo_url` (text) - URL to photo evidence in storage
      - `user_id` (uuid) - Reference to user who created the inspection
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `inspections` table
    - Add policies for authenticated users to:
      - Read their own inspections
      - Create new inspections
      - Update their own inspections
*/

-- Create inspections table
CREATE TABLE IF NOT EXISTS inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL,
  inspector_name text NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'scheduled',
  risk_level text NOT NULL DEFAULT 'low',
  score integer,
  observations text,
  photo_url text,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own inspections
CREATE POLICY "Users can read own inspections"
  ON inspections
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can create inspections
CREATE POLICY "Users can create inspections"
  ON inspections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own inspections
CREATE POLICY "Users can update own inspections"
  ON inspections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own inspections
CREATE POLICY "Users can delete own inspections"
  ON inspections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS inspections_user_id_idx ON inspections(user_id);
CREATE INDEX IF NOT EXISTS inspections_inspection_date_idx ON inspections(inspection_date DESC);