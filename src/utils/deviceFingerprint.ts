import { supabase } from '@/integrations/supabase/client';

// ✅ Generate unique device fingerprint
export function generateDeviceFingerprint(): string {
  const ua = navigator.userAgent;
  const screen = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const language = navigator.language;
  const platform = navigator.platform;
  
  // Combine all data
  const data = `${ua}|${screen}|${timezone}|${language}|${platform}`;
  
  // Simple hash (browser-compatible)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

// ✅ Get device info
export function getDeviceInfo() {
  const ua = navigator.userAgent;
  
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';
  
  let os = 'Unknown';
  let deviceType = 'web';
  if (ua.includes('Windows')) { os = 'Windows'; deviceType = 'windows'; }
  else if (ua.includes('Mac')) { os = 'macOS'; deviceType = 'macos'; }
  else if (ua.includes('Linux')) { os = 'Linux'; deviceType = 'linux'; }
  else if (ua.includes('Android')) { os = 'Android'; deviceType = 'android'; }
  else if (ua.includes('iPhone') || ua.includes('iPad')) { os = 'iOS'; deviceType = 'ios'; }
  
  return {
    browser,
    os,
    deviceType,
    deviceName: `${browser} / ${os}`,
    userAgent: ua,
  };
}

// ✅ FIX: isDeviceTrusted fonksiyonunu güncelle
export async function isDeviceTrusted(userId: string): Promise<boolean> {
  try {
    const fingerprint = generateDeviceFingerprint();
    
    console.log('🔍 Checking device trust:', fingerprint);
    
    // ✅ .single() yerine .maybeSingle() kullan (406 hatasını önler)
    const { data, error } = await supabase
      .from('trusted_devices')
      .select('id, expires_at, is_active')
      .eq('user_id', userId)
      .eq('device_fingerprint', fingerprint)
      .eq('is_active', true)
      .maybeSingle(); // ✅ DEĞIŞIKLIK BURASI
    
    if (error) {
      console.error('Device trust check error:', error);
      return false;
    }
    
    if (!data) {
      console.log('❌ Device not trusted');
      return false;
    }
    
    // Check if expired
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    if (now > expiresAt) {
      console.log('⏰ Device trust expired');
      
      await supabase
        .from('trusted_devices')
        .update({ is_active: false })
        .eq('id', data.id);
      
      return false;
    }
    
    // Update last used
    await supabase
      .from('trusted_devices')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);
    
    console.log('✅ Device is trusted');
    return true;
  } catch (err) {
    console.error('Device trust check error:', err);
    return false;
  }
}

// ✅ Trust current device
export async function trustCurrentDevice(userId: string): Promise<boolean> {
  try {
    const fingerprint = generateDeviceFingerprint();
    const deviceInfo = getDeviceInfo();
    
    console.log('💚 Trusting device:', fingerprint);
    
    // Get IP
    let ip = 'Unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ip = ipData.ip;
    } catch (e) {
      console.warn('IP fetch failed');
    }
    
    const { error } = await supabase
      .from('trusted_devices')
      .upsert({
        user_id: userId,
        device_fingerprint: fingerprint,
        device_name: deviceInfo.deviceName,
        device_type: deviceInfo.deviceType,
        ip_address: ip,
        user_agent: deviceInfo.userAgent,
        trusted_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        is_active: true,
      }, {
        onConflict: 'user_id,device_fingerprint',
      });
    
    if (error) throw error;
    
    console.log('✅ Device trusted');
    return true;
  } catch (err) {
    console.error('Trust device error:', err);
    return false;
  }
}

// ✅ Remove device trust
export async function untrustDevice(deviceId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('trusted_devices')
      .delete()
      .eq('id', deviceId);
    
    if (error) throw error;
    
    console.log('✅ Device untrusted');
    return true;
  } catch (err) {
    console.error('Untrust device error:', err);
    return false;
  }
}