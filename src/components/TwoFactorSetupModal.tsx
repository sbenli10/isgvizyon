import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Copy, CheckCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect } from 'react';

interface TwoFactorSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factorId: string; // ✅ YENİ
  qrCodeUri: string;
  secret: string;
  onSuccess: () => void;
}

export function TwoFactorSetupModal({
  open,
  onOpenChange,
  factorId, // ✅ YENİ
  qrCodeUri,
  secret,
  onSuccess,
}: TwoFactorSetupModalProps) {
  const [verificationCode, setVerificationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  useEffect(() => {
    if (qrCodeUri) {
      QRCode.toDataURL(qrCodeUri).then(setQrCodeDataUrl);
    }
  }, [qrCodeUri]);

  const handleVerify = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      toast.error('❌ Lütfen 6 haneli kodu girin');
      return;
    }

    setVerifying(true);
    try {
      console.log('🔐 Verifying code with factor ID:', factorId);
      console.log('🔐 Verification code:', verificationCode);

      // ✅ Factor ID artık prop'tan geliyor
      if (!factorId) {
        throw new Error('Factor ID bulunamadı');
      }

      // ✅ Challenge oluştur
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        console.error('❌ Challenge error:', challengeError);
        throw challengeError;
      }

      console.log('✅ Challenge created:', challengeData);

      // ✅ Verify challenge
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) {
        console.error('❌ Verify error:', verifyError);
        throw verifyError;
      }

      console.log('✅ Verification successful:', verifyData);

      // ✅ Update profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            two_factor_enabled: true,
            two_factor_method: 'totp',
          })
          .eq('id', user.id);

        if (profileError) {
          console.error('Profile update error:', profileError);
        }
      }

      toast.success('✅ 2FA başarıyla aktif edildi!', {
        description: 'Artık giriş yaparken kod gerekecek',
      });

      onSuccess();
      onOpenChange(false);
      setVerificationCode('');
    } catch (err: any) {
      console.error('❌ 2FA verify error:', err);
      
      let errorMessage = 'Doğrulama başarısız';
      let errorDescription = err.message;

      if (err.message?.includes('Invalid code')) {
        errorMessage = 'Geçersiz kod';
        errorDescription = 'Lütfen Google Authenticator\'dan güncel kodu girin';
      } else if (err.message?.includes('expired')) {
        errorMessage = 'Kod süresi doldu';
        errorDescription = 'Yeni bir kod deneyin';
      } else if (err.message?.includes('Factor ID')) {
        errorMessage = 'Teknik hata';
        errorDescription = 'Lütfen 2FA\'yı kapatıp tekrar açın';
      }

      toast.error(`❌ ${errorMessage}`, {
        description: errorDescription,
        duration: 5000,
      });
    } finally {
      setVerifying(false);
    }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast.success('✅ Secret kopyalandı');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📱 İki Faktörlü Doğrulama Kurulumu
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Step 1: Scan QR */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">1️⃣ QR Kodu Tarayın</p>
            <p className="text-xs text-muted-foreground">
              Google Authenticator veya benzeri bir uygulama ile aşağıdaki QR kodu tarayın
            </p>
            {qrCodeDataUrl && (
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCodeDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
            )}
          </div>

          {/* Step 2: Manual Entry */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">2️⃣ Veya Manuel Girin</p>
            <div className="flex gap-2">
              <Input
                value={secret}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copySecret}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Step 3: Verify */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">3️⃣ Doğrulama Kodunu Girin</p>
            <Label>Uygulamadan 6 haneli kodu girin</Label>
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              className="text-center text-2xl tracking-widest font-mono"
              maxLength={6}
              autoFocus
            />
            <p className="text-xs text-muted-foreground text-center">
              {verificationCode.length}/6 karakter
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setVerificationCode('');
              }}
              className="flex-1"
              disabled={verifying}
            >
              İptal
            </Button>
            <Button
              onClick={handleVerify}
              disabled={verifying || verificationCode.length !== 6}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Doğrulanıyor...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Doğrula ve Aktif Et
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}