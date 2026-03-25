/**
 * Supabase Client Configuration
 *
 * This module provides:
 * 1. Supabase client initialization
 * 2. Authentication state management helpers
 * 3. API helper functions for all endpoints
 * 4. Error handling and response interceptors
 *
 * Requirements: 1.1, 14.1
 */
import { createClient } from '@supabase/supabase-js';
// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
}
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
// ============================================================================
// Authentication Helpers
// ============================================================================
/**
 * Get the current session
 */
export async function getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
        console.error('Error getting session:', error);
        return null;
    }
    return session;
}
/**
 * Get the current user
 */
export async function getUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Error getting user:', error);
        return null;
    }
    return user;
}
/**
 * Sign out the current user
 */
export async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        throw new Error(`Sign out failed: ${error.message}`);
    }
}
/**
 * Check if user is authenticated
 */
export async function isAuthenticated() {
    const session = await getSession();
    return session !== null;
}
/**
 * Get the current access token
 */
export async function getAccessToken() {
    const session = await getSession();
    return session?.access_token || null;
}
export default supabase;
