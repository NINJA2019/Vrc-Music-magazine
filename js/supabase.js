// Supabase client configuration
const SUPA_URL = 'https://rnlgcvrmkdysqvpvfmol.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubGdjdnJta2R5c3F2cHZmbW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NjI1NjAsImV4cCI6MjA5MDQzODU2MH0.VKTpIjUloWoqMDdQ8_S_J4qETOPrIpDBvzPiYunqj3k';

function initSupabase() {
  return supabase.createClient(SUPA_URL, SUPA_KEY);
}

// Client-side image resize before upload
async function resizeImage(file, maxW = 800) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(b => resolve(b), 'image/webp', 0.82);
    };
    img.src = URL.createObjectURL(file);
  });
}
