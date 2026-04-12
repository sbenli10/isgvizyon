import { supabase } from '@/integrations/supabase/client';

function parseUserAgent() {
  const ua = navigator.userAgent;

  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  // OS detection
  let os = 'Unknown';
  let deviceType: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web' = 'web';
  
  if (ua.includes('Windows')) {
    os = 'Windows';
    deviceType = 'windows';
  } else if (ua.includes('Mac')) {
    os = 'macOS';
    deviceType = 'macos';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
    deviceType = 'linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
    deviceType = 'android';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
    deviceType = 'ios';
  }

  return {
    browser,
    os,
    deviceType,
    deviceName: `${browser} / ${os}`,
  };
}

// ✅ DÜZELTME: Aynı cihaz için tek session
export async function recordSession(userId: string) {
  try {
    const { browser, os, deviceType, deviceName } = parseUserAgent();

    // Get IP
    let ip = 'Unknown';
    try {
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      ip = ipData.ip;
    } catch (ipErr) {
      console.warn('IP fetch failed, using placeholder');
    }

    console.log('📱 Recording session:', { deviceName, deviceType, browser, os, ip });

    // ✅ 1. Aynı cihazın session'ını kontrol et
    const { data: existingSessions, error: checkError } = await supabase
      .from('user_sessions')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('device_name', deviceName)
      .eq('ip_address', ip);

    if (checkError) {
      console.error('Session check error:', checkError);
      throw checkError;
    }

    // ✅ 2. Eğer aynı cihazdan son 1 saat içinde session varsa, güncelle
    if (existingSessions && existingSessions.length > 0) {
      const recentSession = existingSessions[0];
      const sessionAge = Date.now() - new Date(recentSession.created_at).getTime();
      const oneHour = 60 * 60 * 1000;

      if (sessionAge < oneHour) {
        // Mevcut session'ı güncelle (yeni kayıt oluşturma)
        console.log('♻️ Updating existing session:', recentSession.id);

        const { error: updateError } = await supabase
          .from('user_sessions')
          .update({
            last_activity: new Date().toISOString(),
            is_current: true,
          })
          .eq('id', recentSession.id);

        if (updateError) {
          console.error('Session update error:', updateError);
          throw updateError;
        }

        // Diğer session'ları "not current" yap
        await supabase
          .from('user_sessions')
          .update({ is_current: false })
          .eq('user_id', userId)
          .neq('id', recentSession.id);

        console.log('✅ Session updated');
        return;
      } else {
        // Eski session'ları sil (1 saatten eski)
        console.log('🗑️ Cleaning old sessions...');
        await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', userId)
          .eq('device_name', deviceName)
          .eq('ip_address', ip);
      }
    }

    // ✅ 3. Yeni session oluştur
    console.log('➕ Creating new session...');

    const { error: insertError } = await supabase
      .from('user_sessions')
      .insert({
        user_id: userId,
        device_name: deviceName,
        device_type: deviceType,
        browser: browser,
        ip_address: ip,
        user_agent: navigator.userAgent,
        is_current: true,
      });

    if (insertError) {
      console.error('❌ Session insert error:', insertError);
      throw insertError;
    }

    // ✅ 4. Diğer session'ları "not current" yap
    await supabase
      .from('user_sessions')
      .update({ is_current: false })
      .eq('user_id', userId)
      .neq('device_name', deviceName);

    console.log('✅ Session recorded');
  } catch (err) {
    console.error('❌ Session record error:', err);
  }
}

export async function terminateSession(sessionId: string) {
  try {
    console.log('🔴 Terminating session:', sessionId);

    const { error } = await supabase
      .from('user_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;

    console.log('✅ Session terminated');
    return true;
  } catch (err) {
    console.error('❌ Session termination error:', err);
    return false;
  }
}

export function getDeviceInfo() {
  return parseUserAgent();
}