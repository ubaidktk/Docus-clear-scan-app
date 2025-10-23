// FIX: `useRef` was not imported, causing an error. Added it to the import statement from 'react'.
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Page, FilterSettings, OcrData, SearchMode, SearchResult } from './types';
import ThumbnailPanel from './components/ThumbnailPanel';
import EditorPanel from './components/EditorPanel';
import ControlsPanel from './components/ControlsPanel';
import Dropzone from './components/Dropzone';
import { WebcamIcon, LogoIcon, UndoIcon, RedoIcon, PrintIcon, FolderIcon, CloseIcon, MaximizeIcon, MinimizeIcon } from './components/Icons';
import WebcamCapture from './components/WebcamCapture';
import EditModal from './components/EditModal';
import Spinner from './components/Spinner';
import { applyPreset, applyRotation, getFilteredImageData, applySharpen } from './services/imageProcessor';
import { extractTextFromImageLocal } from './services/ocrService';
import { useDebouncedCallback } from 'use-debounce';
import { saveDocument, loadDocument } from './services/storageService';
import RecentsManager from './components/DocumentManager';


const DEFAULT_FILTER_SETTINGS: FilterSettings = {
  brightness: 100,
  contrast: 100,
  grayscale: 0,
  rotation: 0,
  sharpen: 0,
};

type EditMode = 'none' | 'crop' | 'erase';
type MenuState = 'none' | 'file' | 'edit' | 'tools';

const TitleBar: React.FC = () => (
    <div className="flex items-center justify-between p-2 bg-slate-900 border-b border-black/30 shadow-md flex-shrink-0" style={{'--webkit-app-region': 'drag'} as React.CSSProperties}>
        <div className="flex items-center gap-2">
            <LogoIcon />
            <h1 className="text-sm font-bold text-white">DocuClean</h1>
        </div>
        <div className="flex items-center gap-2" style={{'--webkit-app-region': 'no-drag'} as React.CSSProperties}>
            <button onClick={() => window.electronAPI.minimizeWindow()} className="p-2 rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-700 transition" title="Minimize"><MinimizeIcon/></button>
            <button onClick={() => window.electronAPI.maximizeWindow()} className="p-2 rounded-full w-6 h-6 flex items-center justify-center hover:bg-slate-700 transition" title="Maximize"><MaximizeIcon/></button>
            <button onClick={() => window.electronAPI.closeWindow()} className="p-2 rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-500 transition" title="Close"><CloseIcon/></button>
        </div>
    </div>
);

const MenuBar: React.FC<{
    onRecents: () => void;
    onPrint: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onWebcam: () => void;
    canUndo: boolean;
    canRedo: boolean;
    canPrint: boolean;
}> = ({ onRecents, onPrint, onUndo, onRedo, onWebcam, canUndo, canRedo, canPrint }) => {
    const [openMenu, setOpenMenu] = useState<MenuState>('none');
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenMenu('none');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);

    const handleMenuClick = (menu: MenuState) => {
        setOpenMenu(openMenu === menu ? 'none' : menu);
    };

    const runAction = (action: () => void) => {
        action();
        setOpenMenu('none');
    }

    return (
        <div ref={menuRef} className="relative flex items-center gap-1 p-1 bg-slate-800 border-b border-slate-700 text-sm flex-shrink-0">
            {/* File Menu */}
            <div className="relative">
                <button onClick={() => handleMenuClick('file')} className={`px-2 py-1 rounded ${openMenu === 'file' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>File</button>
                {openMenu === 'file' && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-10">
                         <button onClick={() => runAction(onPrint)} disabled={!canPrint} className="flex justify-between w-full text-left px-3 py-1.5 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">Print <span className="text-slate-400">Ctrl+P</span></button>
                    </div>
                )}
            </div>
             {/* Edit Menu */}
            <div className="relative">
                <button onClick={() => handleMenuClick('edit')} className={`px-2 py-1 rounded ${openMenu === 'edit' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>Edit</button>
                {openMenu === 'edit' && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-10">
                         <button onClick={() => runAction(onUndo)} disabled={!canUndo} className="flex justify-between w-full text-left px-3 py-1.5 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">Undo <span className="text-slate-400">Ctrl+Z</span></button>
                         <button onClick={() => runAction(onRedo)} disabled={!canRedo} className="flex justify-between w-full text-left px-3 py-1.5 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed">Redo <span className="text-slate-400">Ctrl+Y</span></button>
                    </div>
                )}
            </div>
            {/* Tools Menu */}
            <div className="relative">
                <button onClick={() => handleMenuClick('tools')} className={`px-2 py-1 rounded ${openMenu === 'tools' ? 'bg-slate-700' : 'hover:bg-slate-700'}`}>Tools</button>
                {openMenu === 'tools' && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-slate-700 border border-slate-600 rounded-md shadow-lg z-10">
                         <button onClick={() => runAction(onWebcam)} className="flex justify-between w-full text-left px-3 py-1.5 hover:bg-indigo-600">Scan from Webcam<span className="text-slate-400">Ctrl+W</span></button>
                    </div>
                )}
            </div>
             <button onClick={() => runAction(onRecents)} className="px-2 py-1 rounded hover:bg-slate-700">Recent</button>
        </div>
    );
};

const StatusBar: React.FC<{pageCount: number; selectedPageIndex: number | null, ocrLanguage: string}> = ({pageCount, selectedPageIndex, ocrLanguage}) => (
    <div className="flex items-center justify-between text-xs px-3 py-1 bg-slate-900 border-t border-black/30 flex-shrink-0 text-slate-400">
        <div>{pageCount} Pages</div>
        <div>{selectedPageIndex !== null ? `Page ${selectedPageIndex + 1} Selected` : 'No selection'}</div>
        <div>Language: {ocrLanguage === 'eng' ? 'English' : 'Urdu'}</div>
    </div>
);


const App: React.FC = () => {
  const [history, setHistory] = useState<{
    past: Page[][];
    present: Page[];
    future: Page[][];
  }>({ past: [], present: [], future: [] });

  const { present: pages } = history;
  
  const [selectedPageIndex, setSelectedPageIndex] = useState<number | null>(null);
  const [lastSelectedContinuousIndex, setLastSelectedContinuousIndex] = useState<number | null>(null);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [editMode, setEditMode] = useState<EditMode>('none');
  const [editingPageIndex, setEditingPageIndex] = useState<number | null>(null);
  const [editingImageSrc, setEditingImageSrc] = useState<string | null>(null);
  const [isGeneratingEditSource, setIsGeneratingEditSource] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [ocrLanguage, setOcrLanguage] = useState('eng');
  const [cropQueue, setCropQueue] = useState<number[]>([]);
  const [cropQueueTotal, setCropQueueTotal] = useState(0);

  const [searchMode, setSearchMode] = useState<SearchMode>('name');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentSearchResultIndex, setCurrentSearchResultIndex] = useState<number | null>(null);
  const [isMassIndexing, setIsMassIndexing] = useState(false);
  const [isRecentsManagerOpen, setIsRecentsManagerOpen] = useState(false);
  
  // Load today's session on initial render.
  useEffect(() => {
    try {
        const getTodayKey = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const day = now.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        const todayKey = getTodayKey();
        const todaySessionPages = loadDocument(todayKey);

        if (todaySessionPages) {
             const parsedPages = todaySessionPages
                .filter(p => p && p.id && p.originalSrc && p.name && p.filterSettings)
                .map((p: Page) => ({...p, isSelected: false, isIndexing: false}));
            
            if (parsedPages.length > 0) {
                setHistory({ past: [], present: parsedPages, future: [] });
                setSelectedPageIndex(0);
                setLastSelectedContinuousIndex(0);
            }
        } // If no session for today, it starts blank, which is correct.


        const savedLang = localStorage.getItem('docuCleanOcrLang');
        if (savedLang) {
            setOcrLanguage(savedLang);
        }
    } catch (error) {
        console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Debounced auto-save
  const debouncedSave = useDebouncedCallback((pagesToSave: Page[]) => {
    saveDocument(pagesToSave);
  }, 1500);

  useEffect(() => {
    if (pages.length > 0 && !isRecentsManagerOpen) {
      debouncedSave(pages);
    }
  }, [pages, isRecentsManagerOpen, debouncedSave]);

  // Save language to localStorage whenever it changes
  useEffect(() => {
    try {
        localStorage.setItem('docuCleanOcrLang', ocrLanguage);
    } catch (error) {
        console.error("Failed to save OCR language to localStorage", error);
    }
  }, [ocrLanguage]);
  
  const pushToHistory = (newPresent: Page[]) => {
     setHistory(h => {
        if (JSON.stringify(h.present) === JSON.stringify(newPresent)) return h;
        return {
            past: [...h.past, h.present],
            present: newPresent,
            future: []
        };
     });
  };

  const setPresent = (updater: Page[] | ((current: Page[]) => Page[])) => {
      setHistory(h => ({ ...h, present: typeof updater === 'function' ? updater(h.present) : updater }));
  }

  const undo = useCallback(() => {
    if (history.past.length === 0) return;
    const previous = history.past[history.past.length - 1];
    const newPast = history.past.slice(0, history.past.length - 1);
    setHistory({
      past: newPast,
      present: previous,
      future: [history.present, ...history.future]
    });
    if (selectedPageIndex !== null && selectedPageIndex >= previous.length) {
      setSelectedPageIndex(previous.length > 0 ? previous.length - 1 : null);
    }
  }, [history, selectedPageIndex]);
  
  const redo = useCallback(() => {
    if (history.future.length === 0) return;
    const next = history.future[0];
    const newFuture = history.future.slice(1);
    setHistory({
      past: [...history.past, history.present],
      present: next,
      future: newFuture
    });
    if (selectedPageIndex !== null && selectedPageIndex >= next.length) {
      setSelectedPageIndex(next.length > 0 ? next.length - 1 : null);
    }
  }, [history, selectedPageIndex]);

  const addPages = (files: File[]) => {
    const newPages: Page[] = [];
    let readCount = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') {
          newPages.push({
            id: crypto.randomUUID(),
            originalSrc: e.target.result,
            name: file.name,
            filterSettings: { ...DEFAULT_FILTER_SETTINGS },
          });
        }
        readCount++;
        if (readCount === files.length) {
          const updatedPages = [...pages, ...newPages];
          pushToHistory(updatedPages);
          if (selectedPageIndex === null) {
            setSelectedPageIndex(pages.length);
            setLastSelectedContinuousIndex(pages.length);
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };
  
  const addPageFromWebcam = (imageDataUrl: string) => {
    const newPage: Page = {
      id: crypto.randomUUID(),
      originalSrc: imageDataUrl,
      name: `Capture-${new Date().toISOString()}.jpg`,
      filterSettings: { ...DEFAULT_FILTER_SETTINGS },
    };
    pushToHistory([...pages, newPage]);
    setSelectedPageIndex(pages.length);
    setLastSelectedContinuousIndex(pages.length);
    setIsWebcamOpen(false);
  };

  const handleSelectPage = (index: number, isCtrl: boolean, isShift: boolean) => {
    setSelectedPageIndex(index);
    
    const newPages = [...pages];
    if (isShift && lastSelectedContinuousIndex !== null) {
        const start = Math.min(index, lastSelectedContinuousIndex);
        const end = Math.max(index, lastSelectedContinuousIndex);
        for(let i = 0; i < newPages.length; i++) {
            newPages[i].isSelected = i >= start && i <= end;
        }
    } else if (isCtrl) {
        newPages[index].isSelected = !newPages[index].isSelected;
        setLastSelectedContinuousIndex(index);
    } else {
        for(let i = 0; i < newPages.length; i++) {
            newPages[i].isSelected = i === index;
        }
        setLastSelectedContinuousIndex(index);
    }
    setPresent(newPages);
  };

  const handleDeletePage = useCallback((index: number) => {
    const updatedPages = pages.filter((_, i) => i !== index);
    pushToHistory(updatedPages);

    if (selectedPageIndex === index) {
      setSelectedPageIndex(updatedPages.length > 0 ? Math.max(0, index - 1) : null);
    } else if (selectedPageIndex !== null && selectedPageIndex > index) {
      setSelectedPageIndex(selectedPageIndex - 1);
    }
  }, [pages, selectedPageIndex]);

  const handleDuplicatePage = (index: number) => {
    const pageToDuplicate = pages[index];
    const duplicatedPage: Page = {
      ...pageToDuplicate,
      id: crypto.randomUUID(),
      name: `${pageToDuplicate.name.replace(/\.[^/.]+$/, "")}-copy.${pageToDuplicate.name.split('.').pop()}`
    };
    const updatedPages = [...pages.slice(0, index + 1), duplicatedPage, ...pages.slice(index + 1)];
    pushToHistory(updatedPages);
    setSelectedPageIndex(index + 1);
  };

  const handleRenamePage = (pageIndex: number, newName: string) => {
    const updatedPages = pages.map((page, index) => 
      index === pageIndex ? { ...page, name: newName } : page
    );
    pushToHistory(updatedPages);
  };

  const handleApplyPreset = useCallback(async (preset: 'auto-enhance' | 'bw' | 'text-enhance' | 'shadow-remove') => {
    const selectedIndices = pages.map((p, i) => p.isSelected ? i : -1).filter(i => i !== -1);
    if (selectedIndices.length === 0) return;

    setIsGeneratingEditSource(true);
    try {
        const newSrcPromises = selectedIndices.map(index => {
            const pageToProcess = pages[index];
            return applyPreset(pageToProcess.originalSrc, preset);
        });

        const newSources = await Promise.all(newSrcPromises);

        const updatedPages = [...pages];
        selectedIndices.forEach((pageIndex, arrayIndex) => {
            updatedPages[pageIndex] = {
                ...updatedPages[pageIndex],
                originalSrc: newSources[arrayIndex],
                filterSettings: { ...DEFAULT_FILTER_SETTINGS },
                ocrData: undefined // Invalidate OCR data after edit
            };
        });
        
        pushToHistory(updatedPages);
    } catch (error) {
        console.error(`Failed to apply ${preset} preset to batch:`, error);
    } finally {
        setIsGeneratingEditSource(false);
    }
  }, [pages]);

    const handleApplySharpen = async () => {
        const selectedIndices = pages.map((p, i) => p.isSelected ? i : -1).filter(i => i !== -1);
        if (selectedIndices.length === 0) return;

        setIsGeneratingEditSource(true);
        try {
            const newSrcPromises = selectedIndices.map(index => {
                const pageToProcess = pages[index];
                return applySharpen(pageToProcess.originalSrc);
            });

            const newSources = await Promise.all(newSrcPromises);

            const updatedPages = [...pages];
            selectedIndices.forEach((pageIndex, arrayIndex) => {
                updatedPages[pageIndex] = {
                    ...updatedPages[pageIndex],
                    originalSrc: newSources[arrayIndex],
                    ocrData: undefined
                };
            });

            pushToHistory(updatedPages);
        } catch (error) {
            console.error(`Failed to apply sharpen:`, error);
        } finally {
            setIsGeneratingEditSource(false);
        }
    };

    const debouncedPushToHistory = useDebouncedCallback((newPresent: Page[]) => {
        pushToHistory(newPresent);
    }, 1000);

    const handleFilterChange = (newSettings: Partial<FilterSettings>) => {
        const selectedIndices = pages.map((p, i) => p.isSelected ? i : -1).filter(i => i !== -1);
        if (selectedIndices.length === 0) return;

        const updatedPages = pages.map((page, index) => {
            if (selectedIndices.includes(index)) {
                const updatedSettings = { ...page.filterSettings, ...newSettings };
                if (newSettings.brightness !== undefined) updatedSettings.brightness = Math.round(newSettings.brightness);
                if (newSettings.contrast !== undefined) updatedSettings.contrast = Math.round(newSettings.contrast);
                if (newSettings.grayscale !== undefined) updatedSettings.grayscale = Math.round(newSettings.grayscale);
                return { ...page, filterSettings: updatedSettings };
            }
            return page;
        });
        setPresent(updatedPages);
        debouncedPushToHistory(updatedPages);
    };


  const handleRotate = async () => {
    if (selectedPageIndex === null) return;
    setIsGeneratingEditSource(true);
    try {
        const pageToProcess = pages[selectedPageIndex];
        const newSrc = await applyRotation(pageToProcess.originalSrc, 90);

        const updatedPages = pages.map((page, index) =>
            index === selectedPageIndex ? {
                ...page,
                originalSrc: newSrc,
                filterSettings: { ...page.filterSettings, rotation: 0 },
                ocrData: undefined // Invalidate OCR data
            } : page
        );
        pushToHistory(updatedPages);

    } catch (error) {
        console.error("Failed to apply rotation:", error);
    } finally {
        setIsGeneratingEditSource(false);
    }
  }

  const handleOcrDataUpdate = (data: OcrData) => {
    if (selectedPageIndex === null) return;
    const updatedPages = pages.map((p, i) => i === selectedPageIndex ? {...p, ocrData: data, isIndexing: false } : p);
    // Don't push to history for OCR updates, it's metadata
    setPresent(updatedPages);
  };

  const openEditModal = useCallback(async (mode: EditMode) => {
    const selectedIndices = pages.map((p, i) => p.isSelected ? i : -1).filter(i => i !== -1);
    if (selectedIndices.length === 0) return;
    
    setEditMode(mode);
    setCropQueue(selectedIndices);
    setCropQueueTotal(selectedIndices.length);
  }, [pages]);

  useEffect(() => {
    const processNextInQueue = async () => {
        if (cropQueue.length === 0 || editMode !== 'crop') return;
        
        const nextIndex = cropQueue[0];
        if (pages[nextIndex]) {
            setIsGeneratingEditSource(true);
            try {
                const filteredSrc = await getFilteredImageData(pages[nextIndex]);
                setEditingImageSrc(filteredSrc);
                setEditingPageIndex(nextIndex);
            } catch (error) {
                console.error("Failed to process next crop item:", error);
                setCropQueue([]); 
                setCropQueueTotal(0);
                setEditMode('none');
            } finally {
                setIsGeneratingEditSource(false);
            }
        }
    };
    if(cropQueue.length > 0 && editingPageIndex === null && editMode === 'crop') {
        processNextInQueue();
    }
  }, [cropQueue, pages, editMode, editingPageIndex]);


  const handlePageEditApply = (newSrc: string) => {
    if (editingPageIndex === null) return;
    const updatedPages = pages.map((page, index) => 
      index === editingPageIndex ? {
        ...page, 
        originalSrc: newSrc,
        filterSettings: { ...DEFAULT_FILTER_SETTINGS },
        ocrData: undefined // Invalidate OCR data
      } : page
    );
    pushToHistory(updatedPages);

    setEditingPageIndex(null);
    setEditingImageSrc(null);

    const newQueue = cropQueue.slice(1);
    setCropQueue(newQueue); 

    if (newQueue.length === 0) {
        setEditMode('none');
        setCropQueueTotal(0);
    }
  };

  const reorderPages = (startIndex: number, endIndex: number) => {
    const result: Page[] = Array.from(pages);
    const [removed] = result.splice(startIndex, 1);
    
    if (removed) {
      result.splice(endIndex, 0, removed);
      pushToHistory(result);

      if (selectedPageIndex === startIndex) {
          setSelectedPageIndex(endIndex);
      } else if (selectedPageIndex !== null && selectedPageIndex >= endIndex && selectedPageIndex < startIndex) {
          setSelectedPageIndex(selectedPageIndex + 1);
      } else if (selectedPageIndex !== null && selectedPageIndex <= endIndex && selectedPageIndex > startIndex) {
          setSelectedPageIndex(selectedPageIndex - 1);
      }
    }
  };

  const handlePrint = useCallback(async () => {
    if (selectedPageIndex === null || !pages[selectedPageIndex]) return;
    const dataUrl = await getFilteredImageData(pages[selectedPageIndex]);
    const printWindow = window.open('', '_blank');
    printWindow?.document.write(`
      <html>
        <head><title>Print</title></head>
        <body style="margin:0; padding:0;" onload="window.print(); window.close();">
          <img src="${dataUrl}" style="width:100%; height:auto;"/>
        </body>
      </html>
    `);
    printWindow?.document.close();
  }, [pages, selectedPageIndex]);

    const indexUnscannedPages = useCallback(async () => {
        const pagesToIndex = pages
            .map((p, i) => ({ page: p, index: i }))
            .filter(({ page }) => !page.ocrData && !page.isIndexing);

        if (pagesToIndex.length === 0) return;

        setIsMassIndexing(true);
        setPresent(currentPages => {
            const newPages = [...currentPages];
            pagesToIndex.forEach(({ index }) => {
                if (newPages[index]) newPages[index].isIndexing = true;
            });
            return newPages;
        });

        for (const { page, index } of pagesToIndex) {
            try {
                const data = await extractTextFromImageLocal(page, ocrLanguage, () => {});
                setPresent(currentPages => {
                    const newPages = [...currentPages];
                    if (newPages[index]) {
                      newPages[index] = { ...newPages[index], ocrData: data, isIndexing: false };
                    }
                    return newPages;
                });
            } catch (error) {
                console.error(`Background OCR failed for page ${index}`, error);
                setPresent(currentPages => {
                    const newPages = [...currentPages];
                    if (newPages[index]) newPages[index].isIndexing = false;
                    return newPages;
                });
            }
        }
        setIsMassIndexing(false);
    }, [pages, ocrLanguage]);

    useEffect(() => {
        if (searchMode === 'deep') {
            indexUnscannedPages();
        }
    }, [searchMode, indexUnscannedPages]);
    
    useEffect(() => {
      if (searchMode !== 'deep' || !searchTerm.trim() || isMassIndexing) {
        setSearchResults([]);
        setCurrentSearchResultIndex(null);
        return;
      }

      const newResults: SearchResult[] = [];
      const queryWords = searchTerm.trim().toLowerCase().split(/\s+/).filter(w => w);

      if(queryWords.length === 0) return;

      pages.forEach((page, pageIndex) => {
        if (!page.ocrData || page.ocrData.words.length === 0) return;

        const pageWords = page.ocrData.words;
        const pageText = pageWords.map(w => w.text.toLowerCase()).join(' ');

        if(pageText.includes(queryWords.join(' '))) {
            for (let i = 0; i <= pageWords.length - queryWords.length; i++) {
                let isMatch = true;
                const matchedWordIndices: number[] = [];
                for (let j = 0; j < queryWords.length; j++) {
                    if (pageWords[i + j].text.toLowerCase().includes(queryWords[j])) {
                    matchedWordIndices.push(i + j);
                    } else {
                    isMatch = false;
                    break;
                    }
                }

                if (isMatch) {
                    const wordMatches = matchedWordIndices.map(wordIndex => ({
                        wordIndex,
                        bbox: pageWords[wordIndex].bbox
                    }));
                    
                    newResults.push({ pageIndex, wordMatches });
                    i += queryWords.length - 1;
                }
            }
        }
      });

      setSearchResults(newResults);
      setCurrentSearchResultIndex(newResults.length > 0 ? 0 : null);
    }, [searchTerm, pages, searchMode, isMassIndexing]);

    useEffect(() => {
        if (currentSearchResultIndex !== null && searchResults[currentSearchResultIndex]) {
            const targetPageIndex = searchResults[currentSearchResultIndex].pageIndex;
            if (selectedPageIndex !== targetPageIndex) {
                handleSelectPage(targetPageIndex, false, false);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSearchResultIndex, searchResults]);

    const handleNavigateSearch = (direction: 'next' | 'prev') => {
        if (searchResults.length === 0 || currentSearchResultIndex === null) return;
        const newIndex = direction === 'next'
            ? (currentSearchResultIndex + 1) % searchResults.length
            : (currentSearchResultIndex - 1 + searchResults.length) % searchResults.length;
        setCurrentSearchResultIndex(newIndex);
    };

    const handleLoadDocument = (pagesToLoad: Page[], dateKey: string) => {
      const parsedPages = pagesToLoad
          .filter(p => p && p.id && p.originalSrc && p.name && p.filterSettings)
          .map((p: Page) => ({ ...p, isSelected: false, isIndexing: false }));
  
      setHistory({ past: [], present: parsedPages, future: [] });
      setSelectedPageIndex(parsedPages.length > 0 ? 0 : null);
      setLastSelectedContinuousIndex(parsedPages.length > 0 ? 0 : null);
      localStorage.setItem('docuCleanLastActive', dateKey);
      setIsRecentsManagerOpen(false);
  };
  
    // Keyboard shortcuts handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Ignore shortcuts if user is typing in an input or textarea
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                redo();
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedPageIndex !== null) {
                    handleDeletePage(selectedPageIndex);
                }
            } else if (e.ctrlKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                if(pages.length > 0 && selectedPageIndex !== null) handlePrint();
            } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
                e.preventDefault();
                setIsWebcamOpen(true);
            } else if (e.ctrlKey && e.key === '1') {
                e.preventDefault();
                handleApplyPreset('auto-enhance');
            } else if (e.ctrlKey && e.key === '2') {
                e.preventDefault();
                handleApplyPreset('bw');
            } else if (e.ctrlKey && e.key === '3') {
                e.preventDefault();
                handleApplyPreset('text-enhance');
            } else if (e.ctrlKey && e.key === '4') {
                e.preventDefault();
                handleApplyPreset('shadow-remove');
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [undo, redo, selectedPageIndex, handleDeletePage, handlePrint, handleApplyPreset, pages]);


  const selectedPage = selectedPageIndex !== null ? pages[selectedPageIndex] : null;
  const editingPage = editingPageIndex !== null ? pages[editingPageIndex] : null;
  const selectedPages = useMemo(() => pages.filter(p => p.isSelected), [pages]);
  const cropQueueIndex = cropQueueTotal > 0 ? cropQueueTotal - cropQueue.length : 0;
  const currentSearchResult = currentSearchResultIndex !== null ? searchResults[currentSearchResultIndex] : null;

  return (
    <div className="flex items-center justify-center min-h-screen p-4 font-sans">
        <div className="w-full h-[calc(100vh-2rem)] max-w-7xl flex flex-col bg-slate-800 rounded-lg shadow-2xl border border-black/20 overflow-hidden">
            <TitleBar />
            <MenuBar 
                onRecents={() => setIsRecentsManagerOpen(true)}
                onPrint={handlePrint}
                onUndo={undo}
                onRedo={redo}
                onWebcam={() => setIsWebcamOpen(true)}
                canUndo={history.past.length > 0}
                canRedo={history.future.length > 0}
                canPrint={!!selectedPage}
            />
            <div className="flex flex-grow overflow-hidden">
                {pages.length === 0 && !isRecentsManagerOpen ? (
                <div className="flex-grow flex items-center justify-center">
                    <Dropzone onFilesAdded={addPages} />
                </div>
                ) : (
                <>
                    <ThumbnailPanel 
                        pages={pages}
                        selectedPageIndex={selectedPageIndex} 
                        onSelectPage={handleSelectPage}
                        onDeletePage={handleDeletePage}
                        onDuplicatePage={handleDuplicatePage}
                        onRenamePage={handleRenamePage}
                        onAddPages={addPages}
                        onReorderPages={reorderPages}
                        searchTerm={searchTerm}
                        onSearchTermChange={setSearchTerm}
                        searchMode={searchMode}
                        onSearchModeChange={setSearchMode}
                        searchResults={searchResults}
                        currentSearchResultIndex={currentSearchResultIndex}
                        onNavigateSearch={handleNavigateSearch}
                        isIndexing={isMassIndexing}
                    />
                    <EditorPanel 
                        page={selectedPage}
                        selectedPageIndex={selectedPageIndex}
                        searchResults={searchResults}
                        currentSearchResult={currentSearchResult}
                    />
                    <ControlsPanel 
                        page={selectedPage}
                        selectedPages={selectedPages}
                        onOcrDataUpdate={handleOcrDataUpdate}
                        pages={pages}
                        onSetEditMode={openEditModal}
                        onApplyPreset={handleApplyPreset}
                        onRotate={handleRotate}
                        ocrLanguage={ocrLanguage}
                        onOcrLanguageChange={setOcrLanguage}
                        onFilterChange={handleFilterChange}
                        onApplySharpen={handleApplySharpen}
                    />
                </>
                )}
            </div>
            <StatusBar pageCount={pages.length} selectedPageIndex={selectedPageIndex} ocrLanguage={ocrLanguage} />
            {isWebcamOpen && (
                <WebcamCapture
                onCapture={addPageFromWebcam}
                onClose={() => setIsWebcamOpen(false)}
                />
            )}
            {(isGeneratingEditSource || isMassIndexing) && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4 text-white">
                    <Spinner />
                    <p className="mt-2">{isMassIndexing ? 'Indexing pages for deep search...' : 'Processing image...'}</p>
                </div>
            )}
            {editMode === 'crop' && editingPage && editingImageSrc && (
                <EditModal 
                    page={{...editingPage, originalSrc: editingImageSrc}}
                    onApply={handlePageEditApply}
                    onClose={() => {
                        setEditMode('none');
                        setEditingImageSrc(null);
                        setEditingPageIndex(null);
                        setCropQueue([]);
                        setCropQueueTotal(0);
                    }}
                    cropQueueIndex={cropQueueIndex}
                    cropQueueTotal={cropQueueTotal}
                />
            )}
            {isRecentsManagerOpen && (
                <RecentsManager 
                    onLoadDocument={handleLoadDocument}
                    onClose={() => setIsRecentsManagerOpen(false)}
                />
            )}
        </div>
    </div>
  );
};

export default App;