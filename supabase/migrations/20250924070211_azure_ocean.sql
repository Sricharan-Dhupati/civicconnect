/*
  # Create notification logs table

  1. New Tables
    - `notification_logs`
      - `id` (uuid, primary key)
      - `issue_id` (uuid, foreign key to issues)
      - `notification_type` (text)
      - `sms_sent` (boolean)
      - `email_sent` (boolean)
      - `target_phone` (text)
      - `target_email` (text)
      - `sent_at` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `notification_logs` table
    - Add policy for authenticated users to view logs
    - Add policy for system to insert logs

  3. Purpose
    - Track all notification attempts for test category reports
    - Provide audit trail for SMS and email delivery
    - Help debug notification issues
*/

CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  sms_sent boolean DEFAULT false,
  email_sent boolean DEFAULT false,
  target_phone text,
  target_email text,
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for notification_logs
CREATE POLICY "Authenticated users can view notification logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "System can insert notification logs"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notification_logs_issue_id ON public.notification_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_type ON public.notification_logs(notification_type);