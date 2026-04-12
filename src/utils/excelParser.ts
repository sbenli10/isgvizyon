import * as XLSX from 'xlsx';
import type { Employee } from '@/types/companies';

export interface ParsedEmployee {
  first_name: string;
  last_name: string;
  tc_number?: string | null;
  job_title: string;
  department?: string | null;
  start_date?: string | null;
  employment_type?: string | null; // ✅ Eklendi
  birth_date?: string | null; // ✅ Eklendi
  gender?: string | null; // ✅ Eklendi
  email?: string | null;
  phone?: string | null;
}

export function parseEmployeeExcel(file: File): Promise<ParsedEmployee[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // İlk sheet'i al
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        
        // JSON'a çevir
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
        
        // Header'ı oku (ilk satır)
        const headers = jsonData[0];
        
        // Data satırlarını işle
        const employees: ParsedEmployee[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;
          
          const employee: any = {};
          
          headers.forEach((header: string, index: number) => {
            const normalizedHeader = header.toString().toLowerCase().trim();
            const value = row[index];
            
            // Eşleştirme kuralları
            if (normalizedHeader.includes('tc') || normalizedHeader.includes('kimlik')) {
              employee.tc_number = value?.toString();
            } else if (normalizedHeader.includes('ad') || normalizedHeader.includes('isim') || normalizedHeader.includes('first')) {
              employee.first_name = value?.toString();
            } else if (normalizedHeader.includes('soyad') || normalizedHeader.includes('last')) {
              employee.last_name = value?.toString();
            } else if (normalizedHeader.includes('görev') || normalizedHeader.includes('pozisyon') || normalizedHeader.includes('title')) {
              employee.job_title = value?.toString();
            } else if (normalizedHeader.includes('bölüm') || normalizedHeader.includes('departman') || normalizedHeader.includes('department')) {
              employee.department = value?.toString();
            } else if (normalizedHeader.includes('başlangıç') || normalizedHeader.includes('giriş') || normalizedHeader.includes('start')) {
              employee.start_date = value ? new Date(value).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
            } else if (normalizedHeader.includes('telefon') || normalizedHeader.includes('phone')) {
              employee.phone = value?.toString();
            } else if (normalizedHeader.includes('email') || normalizedHeader.includes('eposta')) {
              employee.email = value?.toString();
            }
          });
          
          // Zorunlu alanları kontrol et
          if (employee.first_name && employee.last_name && employee.job_title) {
            if (!employee.start_date) {
              employee.start_date = new Date().toISOString().split('T')[0];
            }
            employees.push(employee);
          }
        }
        
        resolve(employees);
      } catch (error) {
        reject(new Error('Excel dosyası okunamadı: ' + (error as Error).message));
      }
    };
    
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsArrayBuffer(file);
  });
}

// Excel şablon oluşturma
export function downloadEmployeeTemplate() {
  const template = [
    ['TC Kimlik No', 'Ad', 'Soyad', 'Görev', 'Bölüm', 'Başlangıç Tarihi', 'Telefon', 'E-posta'],
    ['12345678901', 'Ali', 'Yılmaz', 'Mühendis', 'Üretim', '2024-01-15', '0555 123 4567', 'ali@example.com'],
    ['98765432109', 'Ayşe', 'Kaya', 'Teknisyen', 'Bakım', '2024-02-01', '0555 987 6543', 'ayse@example.com'],
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(template);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Çalışanlar');
  
  XLSX.writeFile(wb, 'calisanlar-sablonu.xlsx');
}