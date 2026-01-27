-- Migration: Add goal_type column to savings_goals table
-- This migration adds the goal_type column if it doesn't exist

-- Add goal_type column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'savings_goals' 
        AND column_name = 'goal_type'
    ) THEN
        ALTER TABLE savings_goals 
        ADD COLUMN goal_type VARCHAR(20) NOT NULL DEFAULT 'expense';
        
        -- Add check constraint
        ALTER TABLE savings_goals
        ADD CONSTRAINT chk_goal_type CHECK (goal_type IN ('expense', 'income'));
        
        RAISE NOTICE 'Column goal_type added successfully';
    ELSE
        RAISE NOTICE 'Column goal_type already exists';
    END IF;
END $$;

