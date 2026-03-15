import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import Spinner from './Spinner';

// 设置 PDF.js 的 Worker 路径，直接指向 node_modules 中的构建版本
// Vite 会自动处理这个路径
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ url }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let pdfDoc: any = null;
    const renderPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const loadingTask = pdfjs.getDocument(url);
        pdfDoc = await loadingTask.promise;
        setNumPages(pdfDoc.numPages);
        
        if (containerRef.current) {
          containerRef.current.innerHTML = ''; // 清空之前的渲染内容
          
          // 渲染所有页面到一个垂直容器中
          for (let i = 1; i <= pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 }); // 设置缩放比例
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            canvas.style.marginBottom = '20px';
            canvas.style.boxShadow = '0 10px 15px -3px rgb(0 0 0 / 0.1)';
            canvas.style.borderRadius = '8px';
            canvas.style.width = '100%';
            canvas.style.height = 'auto';
            
            containerRef.current.appendChild(canvas);
            
            await page.render({
              canvasContext: context!,
              viewport: viewport
            }).promise;
          }
        }
        setLoading(false);
      } catch (err: any) {
        console.error('PDF Render Error:', err);
        setError('无法加载 PDF 文件内容。');
        setLoading(false);
      }
    };

    renderPdf();

    return () => {
      if (pdfDoc) pdfDoc.destroy();
    };
  }, [url]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 dark:bg-slate-800 overflow-auto custom-scrollbar p-4 md:p-8">
      {loading && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
          <Spinner />
          <p className="text-xs font-bold uppercase tracking-widest">Rendering PDF Layers...</p>
        </div>
      )}
      {error && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-500">
          <span className="material-icons-outlined text-4xl mb-2">error_outline</span>
          <p className="text-sm font-bold">{error}</p>
        </div>
      )}
      <div ref={containerRef} className="max-w-4xl mx-auto w-full flex flex-col items-center" />
      {!loading && !error && (
        <div className="mt-4 text-center pb-8">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">End of Document • {numPages} Pages</span>
        </div>
      )}
    </div>
  );
};

export default PdfViewer;
