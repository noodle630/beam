"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
exports.debugLog = debugLog;
if (typeof window === 'undefined' && !process.env.NEXT_RUNTIME) {
    try {
        require('dotenv/config');
    }
    catch (e) {
        console.log('Note: dotenv not available, relying on system environment variables');
    }
}
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables for Supabase admin client:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Set' : '❌ Missing');
    console.error('');
    console.error('📝 Please ensure these are set in your .env file.');
    console.error('💡 For compiled scripts, you may need to set system environment variables.');
    throw new Error('Missing required Supabase configuration for admin operations');
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});
function debugLog(message, data) {
    if (process.env.DEBUG_MCP) {
        console.log(`[MCP] ${message}`, data || '');
    }
}
