import imageCompression from 'browser-image-compression';

export const optimizeImage = async (file: File): Promise<File> => {
  // Eğer dosya bir görsel değilse (PDF, Excel vs.) olduğu gibi geri döndür
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Sıkıştırma kuralları
  const options = {
    maxSizeMB: 0.6,          // Maksimum 600 KB boyut
    maxWidthOrHeight: 1920,  // Full HD boyutlarına küçült
    useWebWorker: true,      // Kullanıcının ekranını dondurma
    fileType: 'image/jpeg',  // PNG'leri JPEG'e çevirerek ekstra alan kazan
    initialQuality: 0.85     // Gözle görülür kalite kaybı olmadan %85 kalite
  };

  try {
    // Sıkıştırma işlemini başlat
    const compressedBlob = await imageCompression(file, options);
    
    // Blob nesnesini tekrar File nesnesine çevir ve orijinal adını koru
    return new File([compressedBlob], file.name.replace(/\.[^/.]+$/, ".jpg"), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Görsel sıkıştırılamadı, orijinal dosya kullanılacak:", error);
    return file; // Hata olursa sistemi çökertme, ham dosyayı yükle
  }
};