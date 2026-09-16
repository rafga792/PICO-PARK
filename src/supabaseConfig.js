const SUPABASE_URL = 'https://jfzdummmhwnrzssdzdoa.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmemR1bW1taHducnpzc2R6ZG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1MTQ5NTIsImV4cCI6MjEwNTA5MDk1Mn0.gua_DG8DwXUjBDSIfBZRFk8lSa8BpsAOeFPCggAQKmY';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
        params: {
            eventsPerSecond: 30,
        },
    },
});
