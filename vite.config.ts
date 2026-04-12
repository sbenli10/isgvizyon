import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(), 
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': [
            'react', 
            'react-dom', 
            'react-router-dom'
          ],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-label',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-switch',
            '@radix-ui/react-separator',
            'lucide-react',
            'sonner'
          ],
          'document-vendor': [
            'jspdf',
            'jspdf-autotable',
            'docx',
            'mammoth',
            'file-saver'
          ],
          'charts-vendor': [
            'recharts',
            'd3-scale',
            'd3-shape'
          ],
          'supabase-vendor': [
            '@supabase/supabase-js'
          ],
          'form-vendor': [
            'react-hook-form',
            'zod'
          ],
          'utils-vendor': [
            'date-fns',
            'clsx',
            'tailwind-merge',
            'class-variance-authority'
          ],
          // ✅ YENİ: PDF.js ayrı chunk
          'pdfjs-vendor': [
            'pdfjs-dist'
          ]
        }
      }
    },
    chunkSizeWarningLimit: 1500, // 1.5MB'a çıkar
    sourcemap: mode === 'development',
    minify: 'esbuild',
    target: 'esnext',
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react'
    ]
  },
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none'
  }
}));