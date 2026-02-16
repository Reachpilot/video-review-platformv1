'use client';

import { Video } from '@/types';
import Link from 'next/link';
import { format } from 'date-fns';
import { PlayIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';

interface VideoCardProps {
  video: Video;
  onStatusChange?: (id: string, status: string) => void;
}

export default function VideoCard({ video, onStatusChange }: VideoCardProps) {
  const statusIcons = {
    pending: <ClockIcon className="h-4 w-4 text-yellow-500" />,
    needs_revision: <ExclamationCircleIcon className="h-4 w-4 text-red-500" />,
    approved: <CheckCircleIcon className="h-4 w-4 text-green-500" />,
    uploaded: <ArrowUpTrayIcon className="h-4 w-4 text-purple-500" />,
  };

  const statusText = {
    pending: 'Pending Review',
    needs_revision: 'Needs Revision',
    approved: 'Approved',
    uploaded: 'Uploaded',
  };

  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <Link href={`/videos/${video.id}`} className="block">
        <div className="relative aspect-video bg-gray-100">
          {video.thumbnailUrl ? (
            <img 
              src={video.thumbnailUrl} 
              alt={video.title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <PlayIcon className="h-12 w-12 text-white opacity-75" />
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
            2:45
          </div>
        </div>
        
        <div className="p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-1 line-clamp-2">
            {video.title || 'Untitled Video'}
          </h3>
          <p className="text-sm text-gray-500 mb-3 line-clamp-2">
            {video.description || 'No description'}
          </p>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-1">
              {statusIcons[video.status as keyof typeof statusIcons]}
              <span className="text-gray-600">
                {statusText[video.status as keyof typeof statusText]}
              </span>
            </div>
            <span className="text-gray-400">
              {format(new Date(video.uploadedAt), 'MMM d, yyyy')}
            </span>
          </div>
        </div>
      </Link>
      
      <div className="px-4 pb-4">
        <select
          value={video.status}
          onChange={(e) => onStatusChange?.(video.id, e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="pending">Pending Review</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="approved">Approved</option>
          <option value="uploaded">Uploaded</option>
        </select>
      </div>
    </div>
  );
}
