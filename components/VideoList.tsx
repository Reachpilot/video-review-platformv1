'use client';

import { useState } from 'react';
import { Video } from '@/types';
import VideoCard from './VideoCard';

interface VideoListProps {
  videos?: Video[];
  onStatusChange?: (id: string, status: string) => void;
}

export default function VideoList({ videos = [], onStatusChange }: VideoListProps) {
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredVideos = statusFilter === 'all' 
    ? videos 
    : videos.filter(video => video.status === statusFilter);

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 mb-4">
          <svg 
            className="mx-auto h-12 w-12" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1} 
              d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" 
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">No videos yet</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by uploading a video.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
          Filter by status
        </label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending Review</option>
          <option value="needs_revision">Needs Revision</option>
          <option value="approved">Approved</option>
        </select>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredVideos.map((video) => (
          <VideoCard 
            key={video.id} 
            video={video} 
            onStatusChange={onStatusChange} 
          />
        ))}
      </div>
    </div>
  );
}
