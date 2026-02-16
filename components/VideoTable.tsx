'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Video } from '@/types';
import { deleteVideo, saveVideo, updateVideoStatus } from '@/lib/videoService';
import { format } from 'date-fns';
import VideoPreview from './VideoPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';

  // Status icon components
  const StatusIcons = {
    pending: (
      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    needs_revision: (
      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    approved: (
      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )
  };

  // Helper functions for status styling
  const getStatusColor = (status: string, type: 'bg' | 'text' | 'border' | 'hover') => {
    const colors = {
      pending: {
        bg: 'bg-yellow-50',
        text: 'text-yellow-700',
        border: 'border-yellow-100',
        hover: 'hover:bg-yellow-100',
        label: 'Pending'
      },
      needs_revision: {
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-100',
        hover: 'hover:bg-red-100',
        label: 'Needs Revision'
      },
      approved: {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-100',
        hover: 'hover:bg-green-100',
        label: 'Approved'
      },
      default: {
        bg: 'bg-gray-50',
        text: 'text-gray-500',
        border: 'border-gray-200',
        hover: 'hover:bg-gray-100',
        label: 'Unknown'
      }
    };
    return colors[status as keyof typeof colors]?.[type] || colors.default[type];
  };

  // Get status display component
  const getStatusDisplay = (status: VideoStatus) => {
    const statusInfo = {
      pending: {
        icon: StatusIcons.pending,
        label: 'Pending',
        color: 'yellow'
      },
      needs_revision: {
        icon: StatusIcons.needs_revision,
        label: 'Needs Revision',
        color: 'red'
      },
      approved: {
        icon: StatusIcons.approved,
        label: 'Approved',
        color: 'green'
      }
    };

    const currentStatus = statusInfo[status] || { label: status, color: 'gray' };
    
    return (
      <div className={`flex items-center ${getStatusColor(status, 'text')}`}>
        {currentStatus.icon || StatusIcons.pending}
        <span>{currentStatus.label}</span>
      </div>
    );
  };
import { 
  CheckCircleIcon, 
  ClockIcon, 
  ExclamationCircleIcon, 
  PlayIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ArrowsUpDownIcon
} from '@heroicons/react/24/outline';

type SortField = 'title' | 'uploadedAt' | 'scheduledDate' | 'status' | 'uploader' | 'duration';
type SortDirection = 'asc' | 'desc';
type VideoStatus = 'pending' | 'needs_revision' | 'approved';

interface VideoTableProps {
  videos: Video[]
  onVideoUpdated?: (video: Video) => void
  onVideoDeleted?: (id: string) => void
  isMpu?: boolean
}

export default function VideoTable({ videos = [], onVideoUpdated, onVideoDeleted, isMpu = false }: VideoTableProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | VideoStatus>('all');
  const [sortField, setSortField] = useState<SortField>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<Video | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const videoRefs = useRef<{[key: string]: HTMLVideoElement | null}>({});
  
  // Handle status update
  const handleStatusChange = async (id: string, newStatus: 'pending' | 'needs_revision' | 'approved') => {
    try {
      setIsUpdating(true);
      const updatedVideo = await updateVideoStatus(id, newStatus, isMpu);
      onVideoUpdated?.(updatedVideo);
      return updatedVideo;
    } catch (error) {
      console.error('Error updating video status:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle video update (for scheduled date, etc.)
  const handleVideoUpdate = async (updatedVideo: Video): Promise<Video | undefined> => {
    try {
      setIsUpdating(true);
      const persisted = await saveVideo(updatedVideo, isMpu);
      if (onVideoUpdated) {
        onVideoUpdated(persisted);
      }
      setPreviewVideo(persisted);
      return persisted;
    } catch (error) {
      console.error('Error updating video:', error);
      return undefined;
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!isPreviewOpen) return;
    const video = previewVideo;
    if (!video) return;
    const confirmed = window.confirm(`Möchten Sie "${video.title || 'dieses Video'}" wirklich löschen?`);
    if (!confirmed) return;

    try {
      setIsUpdating(true);
      await deleteVideo(videoId, isMpu);
      onVideoDeleted?.(videoId);
      if (previewVideo?.id === videoId) {
        setIsPreviewOpen(false);
        setPreviewVideo(null);
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      alert('Video konnte nicht gelöscht werden.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Apply sorting and filtering
  const sortedAndFilteredVideos = useMemo(() => {
    return [...videos]
      .filter(video => 
        video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.uploader.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => {
        let comparison = 0;
        
        switch (sortField) {
          case 'title':
          case 'uploader':
          case 'status':
          case 'duration':
            comparison = String(a[sortField] || '').localeCompare(String(b[sortField] || ''));
            break;
          case 'uploadedAt':
            comparison = new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime();
            break;
          case 'scheduledDate':
            const aDate = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
            const bDate = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
            comparison = aDate - bDate;
            break;
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
  }, [videos, searchQuery, sortField, sortDirection]);

  // Status badge component with custom icons
  const StatusBadge = ({ status }: { status: VideoStatus }) => {
    const statusConfig = {
      pending: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        icon: StatusIcons.pending
      },
      needs_revision: {
        bg: 'bg-red-100',
        text: 'text-red-800',
        icon: StatusIcons.needs_revision
      },
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-800',
        icon: StatusIcons.approved
      }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const label = status.replace('_', ' ');

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.icon}
        <span className="ml-1">{label}</span>
      </span>
    );
  };

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowsUpDownIcon className="ml-1 h-4 w-4 text-gray-400" />;
    }
    
    return sortDirection === 'asc' ? 
      <ArrowUpIcon className="ml-1 h-4 w-4 text-gray-700" /> : 
      <ArrowDownIcon className="ml-1 h-4 w-4 text-gray-700" />;
  };

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    let result = [...videos];

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(video => video.status === statusFilter);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        video =>
          video.title.toLowerCase().includes(query) ||
          (video.description?.toLowerCase().includes(query) || '') ||
          video.uploader.toLowerCase().includes(query) ||
          (video.scheduledDate?.toLowerCase().includes(query) || '')
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aValue, bValue;

      switch (sortField) {
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'uploader':
          aValue = a.uploader;
          bValue = b.uploader;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'duration':
          // Simple duration comparison (MM:SS format)
          const [aMin, aSec] = (a.duration || '0:00').split(':').map(Number);
          const [bMin, bSec] = (b.duration || '0:00').split(':').map(Number);
          aValue = aMin * 60 + aSec;
          bValue = bMin * 60 + bSec;
          break;
        case 'scheduledDate':
          aValue = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
          bValue = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
          break;
        case 'uploadedAt':
        default:
          aValue = new Date(a.uploadedAt).getTime();
          bValue = new Date(b.uploadedAt).getTime();
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return result;
  }, [videos, statusFilter, searchQuery, sortField, sortDirection]);

  if (isUpdating) {
    return (
      <div className="flex justify-center items-center h-64">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 rounded-full"></div>
            <motion.div
              className="absolute top-0 left-0 w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="mt-4 text-gray-600">Videos werden geladen...</p>
        </motion.div>
      </div>
    );
  }
  
  if (filteredAndSortedVideos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto h-24 w-24 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </div>
        <h3 className="mt-2 text-lg font-medium text-gray-900">No videos yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by uploading your first video.
        </p>
      </div>
    );
  }

  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not scheduled';
    try {
      return new Date(dateString).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const captureFrame = (videoEl: HTMLVideoElement) => {
    if (!videoEl.videoWidth || !videoEl.videoHeight) return null;
    const maxWidth = 320;
    const scale = videoEl.videoWidth > maxWidth ? maxWidth / videoEl.videoWidth : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(videoEl.videoWidth * scale);
    canvas.height = Math.round(videoEl.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg');
  };

  // Get video thumbnail or generate from video
  const getThumbnail = (video: Video) => {
    const renderImage = (src?: string) => (
      <div className="w-24 max-w-[120px] overflow-hidden rounded-md border border-gray-200 bg-gray-50">
        <img
          src={src || DEFAULT_THUMBNAIL}
          alt={video.title}
          className="w-full h-auto object-contain"
          onError={(e) => {
            const videoEl = videoRefs.current[video.id];
            if (videoEl) {
              const dataUrl = captureFrame(videoEl);
              if (dataUrl) {
                (e.target as HTMLImageElement).src = dataUrl;
                return;
              }
            }
            (e.target as HTMLImageElement).src = DEFAULT_THUMBNAIL;
          }}
        />
      </div>
    );

    if (video.thumbnailUrl) {
      return renderImage(video.thumbnailUrl);
    }

    return (
      <div className="relative w-24 max-w-[120px] overflow-hidden rounded-md border border-dashed border-gray-300 bg-gray-50 group">
        <video
          ref={el => {
            if (el) videoRefs.current[video.id] = el;
          }}
          src={video.filePath}
          className="absolute inset-0 w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity"
          onLoadedData={(e) => {
            const target = e.target as HTMLVideoElement;
            setTimeout(() => {
              const thumbnailUrl = captureFrame(target);
              if (thumbnailUrl) {
                const updatedVideo = { ...video, thumbnailUrl };
                (async () => {
                  try {
                    const persisted = await saveVideo(updatedVideo, isMpu);
                    onVideoUpdated?.(persisted);
                  } catch (error) {
                    console.error('Failed to persist thumbnail update', error);
                  }
                })();
              }
            }, 800);
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
          <PlayIcon className="h-6 w-6 mb-1 text-gray-400 group-hover:text-blue-600 transition-colors" />
          <span className="text-xs">Generating preview…</span>
        </div>
      </div>
    );
  };
  
  // Handle preview button click
  const handlePreviewClick = (video: Video) => {
    setPreviewVideo(video);
    setIsPreviewOpen(true);
  };

  return (
    <div className="flex flex-col relative">
      {/* Video Preview Modal */}
      {previewVideo && (
        <VideoPreview 
          isOpen={isPreviewOpen} 
          onClose={() => setIsPreviewOpen(false)} 
          video={previewVideo}
          onUpdate={handleVideoUpdate}
          onDelete={(id) => handleDeleteVideo(id)}
          isMpu={isMpu}
        />
      )}
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="flex-1 max-w-md">
          <label htmlFor="search" className="sr-only">Search</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
            Status:
          </label>
          <select
            className="block w-full pl-3 pr-10 py-1 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            value={statusFilter}
            onChange={(e) => {
              const status = e.target.value as VideoStatus | 'all';
              setStatusFilter(status);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      {/* Video Table */}
      <div className="-my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="py-2 align-middle inline-block min-w-full sm:px-6 lg:px-8">
          <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center">
                      Status
                      <SortIndicator field="status" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center">
                      Title
                      <SortIndicator field="title" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('uploadedAt')}
                  >
                    <div className="flex items-center">
                      Uploaded
                      <SortIndicator field="uploadedAt" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('scheduledDate')}
                  >
                    <div className="flex items-center">
                      Scheduled on
                      <SortIndicator field="scheduledDate" />
                    </div>
                  </th>
                  <th 
                    scope="col" 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center">
                      Duration
                      <SortIndicator field="duration" />
                    </div>
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedVideos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      No videos found. Try adjusting your search or filters.
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedVideos.map((video) => {
                    const thumbnail = getThumbnail(video);
                    return (
                      <tr key={video.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="relative w-40">
                              <select
                                value={video.status}
                                onChange={(e) => handleStatusChange(video.id, e.target.value as VideoStatus)}
                                className={`appearance-none block w-full pl-3 pr-8 py-2 text-sm border rounded-md shadow-sm focus:ring-2 focus:ring-offset-2 focus:outline-none transition-all duration-200 ease-in-out cursor-pointer ${getStatusColor(video.status, 'bg')} ${getStatusColor(video.status, 'text')} ${getStatusColor(video.status, 'border')} ${getStatusColor(video.status, 'hover')}`}
                              >
                                <option value="pending" className="bg-white text-yellow-700">
                                  <div className="flex items-center">
                                    {StatusIcons.pending}
                                    <span>Pending</span>
                                  </div>
                                </option>
                                <option value="needs_revision" className="bg-white text-red-700">
                                  <div className="flex items-center">
                                    {StatusIcons.needs_revision}
                                    <span>Needs Revision</span>
                                  </div>
                                </option>
                                <option value="approved" className="bg-white text-green-700">
                                  <div className="flex items-center">
                                    {StatusIcons.approved}
                                    <span>Approved</span>
                                  </div>
                                </option>
                              </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2">
                              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                              </svg>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-4">
                            <div className="flex-shrink-0">
                              {thumbnail}
                            </div>
                            <div className="text-sm font-medium text-gray-900">{video.title}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {format(new Date(video.uploadedAt), 'dd.MM.yyyy HH:mm')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {video.scheduledDate ? formatDate(video.scheduledDate) : 'Not scheduled'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {video.duration || '0:00'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-900 transition-colors whitespace-nowrap"
                            onClick={() => handlePreviewClick(video)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Pagination */}
      {sortedAndFilteredVideos.length > 0 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 mt-4">
          <div className="flex-1 flex justify-between sm:hidden">
            <button className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Previous
            </button>
            <button className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{videos.length}</span> of{' '}
                <span className="font-medium">{videos.length}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Previous</span>
                  <ArrowUpIcon className="h-5 w-5" aria-hidden="true" />
                </button>
                <button className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50">
                  <span className="sr-only">Next</span>
                  <ArrowDownIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
