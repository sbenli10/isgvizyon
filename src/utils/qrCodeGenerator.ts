import QRCode from 'qrcode';

export async function generateQRCode(data: string): Promise<string> {
  try {
    const qrDataUrl = await QRCode.toDataURL(data, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    return qrDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    throw error;
  }
}

export function generateADEPUrl(adepId: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/adep/${adepId}`;
}