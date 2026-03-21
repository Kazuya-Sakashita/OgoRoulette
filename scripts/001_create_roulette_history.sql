-- Create roulette_sessions table to store game sessions
CREATE TABLE IF NOT EXISTS roulette_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  winner_name TEXT NOT NULL,
  participants TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  total_amount INTEGER DEFAULT 0,
  note TEXT
);

-- Enable RLS
ALTER TABLE roulette_sessions ENABLE ROW LEVEL SECURITY;

-- Policies for roulette_sessions
CREATE POLICY "Users can view their own sessions" 
  ON roulette_sessions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own sessions" 
  ON roulette_sessions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions" 
  ON roulette_sessions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sessions" 
  ON roulette_sessions FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_roulette_sessions_user_id ON roulette_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_roulette_sessions_created_at ON roulette_sessions(created_at DESC);
