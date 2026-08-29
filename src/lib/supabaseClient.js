import { createClient } from '@supabase/supabase-js';

// Your Supabase credentials - hardcoded as fallback
const SUPABASE_URL = 'https://gqrksycwbtnejihwjswj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcmtzeWN3YnRuZWppaHdqc3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTAyNjMsImV4cCI6MjEwMzEyNjI2M30.W_-NTXfB2fzlHOUCFPVruRB8vD4K8CCdQ6h2NZIDyVs';

// Try to use environment variables first, fallback to hardcoded values
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

console.log('🔌 Connecting to Supabase...');
console.log('📡 URL:', supabaseUrl);
console.log('🔑 Key:', supabaseAnonKey ? '✅ Set' : '❌ Missing');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper to handle Supabase responses consistently
export const handleSupabaseResponse = (response) => {
  if (response.error) throw response.error;
  return response.data;
};

// Storage buckets
export const STORAGE_BUCKETS = {
  TEAM_LOGOS: 'team-logos',
  PLAYER_PHOTOS: 'player-photos',
};

// Upload image to Supabase Storage
export const uploadImage = async (bucket, file, path) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });
  
  if (error) throw error;
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);
    
  return urlData.publicUrl;
};

// Delete image from Supabase Storage
export const deleteImage = async (bucket, path) => {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);
  
  if (error) throw error;
};