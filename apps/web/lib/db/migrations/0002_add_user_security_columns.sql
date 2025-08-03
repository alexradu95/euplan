-- Migration: Add security columns to user table
-- Add failed login attempts tracking and account locking functionality

-- Add failed_login_attempts column with default value 0
ALTER TABLE "user" ADD COLUMN "failed_login_attempts" integer DEFAULT 0;

-- Add locked_until column for account locking functionality  
ALTER TABLE "user" ADD COLUMN "locked_until" timestamp;
