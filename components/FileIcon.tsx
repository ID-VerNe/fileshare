import React from 'react';
import type { DriveItem } from '../types';

const FolderIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
);

const FileIconGeneric = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
);

const ImageIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
);

const DocumentIcon = ({ className }: { className: string }) => (
     <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
);

const ArchiveIcon = ({ className }: { className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 8H5a2 2 0 00-2 2v2a2 2 0 002 2h14a2 2 0 002-2v-2a2 2 0 00-2-2z" />
    </svg>
);

interface FileTypeIconProps {
  item: DriveItem;
  view: 'list' | 'grid';
}

const FileTypeIcon: React.FC<FileTypeIconProps> = ({ item, view }) => {
  const isList = view === 'list';
  const thumbnailUrl = isList 
    ? item.thumbnails?.[0]?.small?.url
    : item.thumbnails?.[0]?.medium?.url || item.thumbnails?.[0]?.small?.url;

  const mimeType = item.file?.mimeType || '';
  let IconComponent: React.FC<{ className: string }>;
  let colorClass: string;

  if (item.folder) {
    IconComponent = FolderIcon;
    colorClass = 'text-yellow-500';
  } else if (mimeType.startsWith('image/')) {
    IconComponent = ImageIcon;
    colorClass = 'text-purple-500';
  } else if (mimeType.includes('document') || mimeType.includes('pdf') || mimeType.includes('text')) {
    IconComponent = DocumentIcon;
    colorClass = 'text-blue-500';
  } else if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) {
    IconComponent = ArchiveIcon;
    colorClass = 'text-red-500';
  } else {
    IconComponent = FileIconGeneric;
    colorClass = 'text-gray-500';
  }

  if (isList) {
    if (thumbnailUrl) {
      return <img src={thumbnailUrl} alt={item.name} className="h-6 w-6 object-cover rounded-sm flex-shrink-0" />;
    }
    return <IconComponent className={`h-6 w-6 ${colorClass} flex-shrink-0`} />;
  } else { // Grid view
    const gridWrapperClass = "w-full h-32 flex items-center justify-center bg-gray-100 dark:bg-gray-700/50 rounded-t-md overflow-hidden";
    if (thumbnailUrl) {
      return (
        <div className={gridWrapperClass}>
          <img src={thumbnailUrl} alt={item.name} className="max-h-full max-w-full object-contain" />
        </div>
      );
    }
    return (
      <div className={gridWrapperClass}>
        <IconComponent className={`h-16 w-16 ${colorClass}`} />
      </div>
    );
  }
};

export default FileTypeIcon;
