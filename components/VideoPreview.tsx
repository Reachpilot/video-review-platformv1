'use client';

import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon, CalendarIcon, ClockIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { Fragment, useState, useEffect } from 'react';
import { Comment, Video } from '@/types';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import { replaceVideoFile } from '@/lib/videoService';

interface VideoPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  video: Video | null;
  onUpdate?: (video: Video) => void;
  onDelete?: (id: string) => void;
  isMpu?: boolean;
}

export default function VideoPreview({ isOpen, onClose, video, onUpdate, onDelete, isMpu = false }: VideoPreviewProps) {
  const [localScheduledDate, setLocalScheduledDate] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);
  const [correctionNote, setCorrectionNote] = useState('');
  const [correctionTimestamp, setCorrectionTimestamp] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [isReplacingVideo, setIsReplacingVideo] = useState(false);
  const [localTitle, setLocalTitle] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [metadataSavedAt, setMetadataSavedAt] = useState<number | null>(null);

  const getVideoDurationFromFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';

      tempVideo.onloadedmetadata = () => {
        window.URL.revokeObjectURL(tempVideo.src);
        const duration = tempVideo.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };

      tempVideo.onerror = () => {
        console.error('Failed to read video duration');
        resolve('0:00');
      };

      tempVideo.src = URL.createObjectURL(file);
    });
  };

  const generateThumbnailFromFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const tempVideo = document.createElement('video');
      let resolved = false;

      const cleanup = () => {
        tempVideo.onloadeddata = null;
        tempVideo.onseeked = null;
        tempVideo.onerror = null;
        URL.revokeObjectURL(tempVideo.src);
      };

      const finish = (data: string) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(data);
      };

      const capture = () => {
        if (!tempVideo.videoWidth || !tempVideo.videoHeight) {
          finish('');
          return;
        }

        const maxWidth = 640;
        const scale = tempVideo.videoWidth > maxWidth ? maxWidth / tempVideo.videoWidth : 1;
        const canvasWidth = Math.round(tempVideo.videoWidth * scale);
        const canvasHeight = Math.round(tempVideo.videoHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish('');
          return;
        }

        ctx.drawImage(tempVideo, 0, 0, canvasWidth, canvasHeight);
        finish(canvas.toDataURL('image/jpeg'));
      };

      tempVideo.preload = 'auto';
      tempVideo.muted = true;
      tempVideo.src = URL.createObjectURL(file);
      tempVideo.onloadeddata = () => {
        if (tempVideo.readyState >= 2) {
          const desiredTime = 3;
          const targetTime = tempVideo.duration > desiredTime ? desiredTime : Math.max(tempVideo.duration - 0.1, 0);
          try {
            tempVideo.currentTime = targetTime;
          } catch (error) {
            capture();
          }
        }
      };
      tempVideo.onseeked = capture;
      tempVideo.onerror = () => finish('');
      setTimeout(() => finish(''), 2000);
    });
  };

  const handleReplaceVideo = async () => {
    if (!video || !replacementFile) {
      alert('Bitte wählen Sie zuerst eine Videodatei aus.');
      return;
    }

    try {
      setIsReplacingVideo(true);
      const duration = await getVideoDurationFromFile(replacementFile);
      const thumbnail = await generateThumbnailFromFile(replacementFile);
      const updatedVideo = await replaceVideoFile(video, replacementFile, duration, thumbnail, isMpu);
      onUpdate?.(updatedVideo);
      setReplacementFile(null);
      alert('Video wurde erfolgreich ausgetauscht.');
    } catch (error) {
      console.error('Video replacement failed', error);
      alert('Das Video konnte nicht ausgetauscht werden. Bitte erneut versuchen.');
    } finally {
      setIsReplacingVideo(false);
    }
  };

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  useEffect(() => {
    if (video?.scheduledDate) {
      // Format the date for the datetime-local input
      const date = new Date(video.scheduledDate);
      const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm");
      setLocalScheduledDate(formattedDate);
    } else {
      setLocalScheduledDate('');
    }
    setCorrectionNote('');
    setCorrectionTimestamp('');
    setLocalTitle(video?.title || '');
    setLocalDescription(video?.description || '');
    setMetadataSavedAt(null);
  }, [video]);

  if (!video) return null;

  const hasMetadataChanges =
    localTitle.trim() !== (video.title || '').trim() || (localDescription || '') !== (video.description || '');

  const handleMetadataSave = async () => {
    if (!video) return;
    const nextTitle = localTitle.trim() || video.title;
    const nextDescription = localDescription;

    if (nextTitle.length === 0) {
      alert('Titel darf nicht leer sein.');
      return;
    }

    try {
      setIsSavingMetadata(true);
      const updatedVideo = {
        ...video,
        title: nextTitle,
        description: nextDescription,
      };
      await (onUpdate ? Promise.resolve(onUpdate(updatedVideo)) : Promise.resolve());
      setMetadataSavedAt(Date.now());
    } catch (error) {
      console.error('Failed to update metadata', error);
      alert('Titel/Beschreibung konnten nicht gespeichert werden.');
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleScheduleUpdate = () => {
    if (!video || !localScheduledDate) return;
    
    // Ensure the date is in the correct format (YYYY-MM-DDTHH:MM)
    let scheduledDate = localScheduledDate;
    
    // If only date is provided, set a default time (e.g., 09:00)
    if (scheduledDate && !scheduledDate.includes('T')) {
      scheduledDate = `${scheduledDate}T09:00`;
    }
    
    const updatedVideo = { 
      ...video, 
      scheduledDate: scheduledDate || null
    };
    
    onUpdate?.(updatedVideo);
    
    // Show feedback
    alert(`Video scheduled for ${new Date(scheduledDate).toLocaleString()}`);
  };

  const parseTimestamp = (input: string) => {
    if (!input) return null;
    const parts = input.split(':').map(part => part.trim()).filter(Boolean);
    if (parts.length === 0 || parts.length > 3) return null;
    const numbers = parts.map(Number);
    if (numbers.some((num) => Number.isNaN(num) || num < 0)) return null;

    let seconds = 0;
    if (numbers.length === 3) {
      seconds = numbers[0] * 3600 + numbers[1] * 60 + numbers[2];
    } else if (numbers.length === 2) {
      seconds = numbers[0] * 60 + numbers[1];
    } else {
      seconds = numbers[0];
    }

    return seconds;
  };

  const formatTimestampLabel = (totalSeconds: number) => {
    if (Number.isNaN(totalSeconds) || totalSeconds < 0) return '00:00';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const mm = minutes.toString().padStart(2, '0');
    const ss = seconds.toString().padStart(2, '0');
    return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  const handleAddCorrection = async () => {
    if (!video) return;
    if (!correctionNote.trim()) {
      alert('Bitte eine Korrekturbeschreibung eingeben.');
      return;
    }

    const parsedTimestamp = parseTimestamp(correctionTimestamp.trim());
    if (parsedTimestamp === null) {
      alert('Bitte einen gültigen Timestamp im Format mm:ss oder hh:mm:ss eingeben.');
      return;
    }

    const comment: Comment = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `comment-${Date.now()}`,
      text: correctionNote.trim(),
      timestamp: Date.now(),
      time: parsedTimestamp,
      userId: 'Reviewer',
      createdAt: new Date().toISOString(),
    };

    const updatedVideo = {
      ...video,
      comments: [...(video.comments || []), comment],
    };

    try {
      setIsSubmittingCorrection(true);
      await onUpdate?.(updatedVideo);
      setCorrectionNote('');
      setCorrectionTimestamp('');
    } catch (error) {
      console.error('Failed to add correction', error);
      alert('Die Korrektur konnte nicht gespeichert werden.');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const getDownloadName = (video?: Video | null) => {
    if (!video) return 'video.mp4';
    const titleBase = (video.title || '').trim();
    const sanitizedTitle = titleBase ? titleBase.replace(/\s+/g, '-') : '';
    const fileName = video.fileName || video.filePath?.split('/').pop() || '';
    const extMatch = fileName.match(/\.([a-zA-Z0-9]+)$/);
    const extension = extMatch ? extMatch[0] : '.mp4';

    if (sanitizedTitle) {
      return `${sanitizedTitle}${extension}`;
    }

    if (fileName) {
      return fileName;
    }

    return `video${extension}`;
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
                <div className="absolute top-0 right-0 pt-4 pr-4 flex items-center space-x-2">
                  {video && (
                    <a
                      href={video.filePath}
                      download={getDownloadName(video)}
                      className="inline-flex items-center space-x-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
                    >
                      <ArrowDownTrayIcon className="h-4 w-4" />
                      <span>Download</span>
                    </a>
                  )}
                  <button
                    type="button"
                    className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">Schließen</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>
                <div>
                  <div className="mt-3 text-center sm:mt-0 sm:text-left">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      {video.title}
                    </Dialog.Title>
                    <div className="mt-2 flex flex-col sm:flex-row gap-6">
                      <div className="relative w-full sm:w-1/2 bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '9/16', maxHeight: '80vh' }}>
                        <video
                          ref={(el) => {
                            if (el) {
                              // Auto-resize video to fit container while maintaining 9:16 aspect ratio
                              const updateSize = () => {
                                const container = el.parentElement;
                                if (container) {
                                  const containerRatio = 9 / 16; // 9:16 aspect ratio
                                  const videoRatio = el.videoWidth / el.videoHeight;
                                  
                                  if (containerRatio > videoRatio) {
                                    // Container is wider than video for 9:16
                                    el.style.width = 'auto';
                                    el.style.height = '100%';
                                    el.style.maxHeight = 'none';
                                    el.style.position = 'absolute';
                                    el.style.left = '50%';
                                    el.style.top = '0';
                                    el.style.transform = 'translateX(-50%)';
                                  } else {
                                    // Container is taller than video for 9:16
                                    el.style.width = '100%';
                                    el.style.height = 'auto';
                                    el.style.maxWidth = 'none';
                                    el.style.position = 'absolute';
                                    el.style.top = '50%';
                                    el.style.left = '0';
                                    el.style.transform = 'translateY(-50%)';
                                  }
                                }
                              };
                              
                              el.addEventListener('loadedmetadata', updateSize);
                              window.addEventListener('resize', updateSize);
                              
                              // Initial update
                              if (el.readyState >= 2) { // HAVE_CURRENT_DATA or greater
                                updateSize();
                              }
                              
                              // Cleanup
                              return () => {
                                el.removeEventListener('loadedmetadata', updateSize);
                                window.removeEventListener('resize', updateSize);
                              };
                            }
                          }}
                          src={video.filePath}
                          controls
                          className="max-w-full max-h-full object-contain"
                          autoPlay
                          playsInline
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                            backgroundColor: '#000'
                          }}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                      <div className="w-full sm:w-1/2 space-y-4 overflow-y-auto" style={{ maxHeight: '80vh' }}>
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="video-title" className="block text-sm font-medium text-gray-700">
                              Titel
                            </label>
                            <input
                              id="video-title"
                              type="text"
                              value={localTitle}
                              onChange={(e) => setLocalTitle(e.target.value)}
                              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              maxLength={120}
                            />
                          </div>
                          <div>
                            <label htmlFor="video-description" className="block text-sm font-medium text-gray-700">
                              Beschreibung
                            </label>
                            <textarea
                              id="video-description"
                              rows={4}
                              value={localDescription}
                              onChange={(e) => setLocalDescription(e.target.value)}
                              className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="Beschreibe das Video..."
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                              {hasMetadataChanges ? 'Änderungen nicht gespeichert' : metadataSavedAt ? 'Alle Änderungen gespeichert' : 'Keine Änderungen'}
                            </div>
                            <button
                              type="button"
                              onClick={handleMetadataSave}
                              disabled={!hasMetadataChanges || isSavingMetadata}
                              className="inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isSavingMetadata ? 'Speichert…' : 'Titel & Beschreibung speichern'}
                            </button>
                          </div>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-4">
                          <div className="flex flex-col space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-gray-900 flex items-center">
                                <CalendarIcon className="h-5 w-5 mr-2 text-gray-500" />
                                Schedule Video
                              </h4>
                              {video.scheduledDate && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                  Scheduled
                                </span>
                              )}
                            </div>
                            
                            <div className="flex flex-col space-y-2">
                              <div className="relative">
                                <input
                                  type="date"
                                  className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  value={localScheduledDate ? localScheduledDate.split('T')[0] : ''}
                                  min={format(new Date(), 'yyyy-MM-dd')}
                                  onChange={(e) => {
                                    const date = e.target.value;
                                    const time = localScheduledDate ? localScheduledDate.split('T')[1] : '09:00';
                                    setLocalScheduledDate(date ? `${date}T${time}` : '');
                                  }}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                                </div>
                              </div>
                              
                              <div className="relative">
                                <input
                                  type="time"
                                  className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-10 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                  value={localScheduledDate ? localScheduledDate.split('T')[1] || '09:00' : '09:00'}
                                  onChange={(e) => {
                                    const time = e.target.value;
                                    const date = localScheduledDate ? localScheduledDate.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
                                    setLocalScheduledDate(`${date}T${time}`);
                                  }}
                                />
                                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                  <ClockIcon className="h-5 w-5 text-gray-400" />
                                </div>
                              </div>
                              
                              <div className="flex space-x-2 pt-1">
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
                                    setLocalScheduledDate(format(inOneHour, "yyyy-MM-dd'T'HH:mm"));
                                  }}
                                  className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-3 rounded-md transition-colors"
                                >
                                  In 1 hour
                                </button>
                                <button
                                  onClick={() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    tomorrow.setHours(9, 0, 0, 0);
                                    setLocalScheduledDate(format(tomorrow, "yyyy-MM-dd'T'HH:mm"));
                                  }}
                                  className="flex-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1.5 px-3 rounded-md transition-colors"
                                >
                                  Tomorrow 9 AM
                                </button>
                              </div>
                              
                              <div className="pt-1">
                                <button
                                  onClick={handleScheduleUpdate}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center"
                                >
                                  {video.scheduledDate ? 'Update Schedule' : 'Schedule Video'}
                                </button>
                                {video.scheduledDate && (
                                  <button
                                    onClick={() => {
                                      setLocalScheduledDate('');
                                      const updatedVideo = { ...video, scheduledDate: null };
                                      onUpdate?.(updatedVideo);
                                    }}
                                    className="w-full mt-2 text-red-600 hover:text-red-800 text-sm py-1.5"
                                  >
                                    Remove Schedule
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {video.scheduledDate && (
                            <div className="mt-3 p-3 bg-blue-50 rounded-md">
                              <p className="text-sm text-blue-800">
                                Scheduled for {format(parseISO(video.scheduledDate), 'EEEE, MMMM d, yyyy', { locale: de })} at{' '}
                                {format(parseISO(video.scheduledDate), 'h:mm a', { locale: de })}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="border-t border-gray-200 pt-4 space-y-4">
                          <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-900">Video austauschen</h4>
                                <p className="text-sm text-gray-500">Neue Datei hochladen, Titel &amp; Beschreibung bleiben.</p>
                              </div>
                              <span className="text-xs uppercase tracking-wide text-gray-400">Beta</span>
                            </div>
                            <div className="mt-3 grid gap-3 sm:grid-cols-3">
                              <label className="sm:col-span-2 flex flex-col rounded-lg border border-dashed border-gray-300 p-3 hover:border-blue-400 transition-colors">
                                <span className="text-xs font-medium text-gray-600 mb-1">Videodatei wählen</span>
                                <input
                                  type="file"
                                  accept="video/mp4,video/webm,video/quicktime"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    setReplacementFile(file);
                                  }}
                                  className="text-xs text-gray-500"
                                />
                                <span className="text-[11px] text-gray-400 mt-1">MP4, WebM oder MOV bis 100MB</span>
                              </label>
                              <button
                                type="button"
                                onClick={handleReplaceVideo}
                                disabled={!replacementFile || isReplacingVideo}
                                className="h-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium shadow focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isReplacingVideo ? 'Wird aktualisiert…' : 'Video ersetzen'}
                              </button>
                            </div>
                            {replacementFile && (
                              <div className="mt-2 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                <span className="truncate">{replacementFile.name}</span>
                                <span>{(replacementFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-medium text-gray-900">Korrekturen &amp; Timestamps</h4>
                            <span className="text-xs text-gray-500">{(video.comments || []).length} Einträge</span>
                          </div>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Timestamp (mm:ss)</label>
                              <input
                                type="text"
                                placeholder="z.B. 01:23"
                                value={correctionTimestamp}
                                onChange={(e) => setCorrectionTimestamp(e.target.value)}
                                className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium text-gray-700">Korrekturbeschreibung</label>
                              <textarea
                                rows={3}
                                value={correctionNote}
                                onChange={(e) => setCorrectionNote(e.target.value)}
                                placeholder="Beschreibe hier, was angepasst werden soll."
                                className="block w-full rounded-md border border-gray-300 py-2 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleAddCorrection}
                              disabled={isSubmittingCorrection}
                              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                            >
                              {isSubmittingCorrection ? 'Speichern…' : 'Korrektur hinzufügen'}
                            </button>
                          </div>

                          <div className="mt-6 space-y-3">
                            {(video.comments || []).length === 0 ? (
                              <p className="text-sm text-gray-500">Noch keine Korrekturen vorhanden.</p>
                            ) : (
                              <ul className="space-y-3">
                                {(video.comments || [])
                                  .slice()
                                  .sort((a, b) => a.time - b.time)
                                  .map((comment) => (
                                    <li key={comment.id} className="p-3 border border-gray-200 rounded-lg">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                                          {formatTimestampLabel(comment.time)}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                          {comment.createdAt ? new Date(comment.createdAt).toLocaleDateString('de-DE') : ''}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 whitespace-pre-line">{comment.text}</p>
                                    </li>
                                  ))}
                              </ul>
                            )}
                            {video && (
                              <div className="flex justify-end pt-2">
                                <button
                                  type="button"
                                  onClick={() => onDelete?.(video.id)}
                                  className="rounded-full border border-red-200 bg-white px-5 py-2 text-sm font-medium text-red-600 shadow-sm hover:bg-red-50 transition-colors"
                                >
                                  Delete Video
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-4">
                        {video.scheduledDate && (
                          <div className="p-3 bg-gray-50 rounded-md">
                            <h4 className="font-medium text-gray-900">Scheduled for</h4>
                            <p className="text-gray-600">
                              {new Date(video.scheduledDate).toLocaleDateString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
