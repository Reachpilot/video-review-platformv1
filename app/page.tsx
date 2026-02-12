'use client';

import { useState, useEffect } from 'react';
import { CloudArrowUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import VideoTable from '@/components/VideoTable';
import UploadButton from '@/components/UploadButton';
import { Video } from '@/types';
import { getVideos } from '@/lib/videoService';

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('');
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch videos on component mount
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const fetchedVideos = await getVideos();
        setVideos(fetchedVideos);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchVideos();
  }, []);
  
  // Calculate stats
  const stats = {
    total: videos.length,
    pending: videos.filter(v => v.status === 'pending').length,
    needs_revision: videos.filter(v => v.status === 'needs_revision').length,
    approved: videos.filter(v => v.status === 'approved').length,
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-28">
            <div className="flex items-center">
              <img 
                src="/images/tnt-studio-logo.png" 
                alt="TNT Studio Logo" 
                className="h-24 w-auto"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  const fallback = document.createElement('h1');
                  fallback.className = 'text-xl font-semibold text-gray-900';
                  fallback.textContent = 'TNT Studio';
                  target.parentNode?.insertBefore(fallback, target.nextSibling);
                }}
              />
            </div>
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Search videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <UploadButton 
                onVideoUploaded={(video) => {
                  console.log('New video uploaded, updating state...', video);
                  setVideos(prev => [video, ...prev]);
                }} 
              />
              <button
                onClick={async () => {
                  if (window.confirm('Möchten Sie sich wirklich abmelden?')) {
                    try {
                      await fetch('/api/auth/logout', { method: 'POST' });
                      window.location.href = '/login';
                    } catch (error) {
                      console.error('Logout failed:', error);
                      window.location.href = '/login';
                    }
                  }
                }}
                className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[
            { name: 'Total Videos', value: stats.total, status: 'total' },
            { name: 'Pending Review', value: stats.pending, status: 'pending' },
            { name: 'Needs Revision', value: stats.needs_revision, status: 'needs_revision' },
            { name: 'Approved', value: stats.approved, status: 'approved' },
          ].map((stat) => (
            <div key={stat.name} className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <div className="flex items-center">
                  <div className={`flex-shrink-0 rounded-md p-3 ${
                    stat.status === 'total' ? 'bg-blue-500' :
                    stat.status === 'pending' ? 'bg-yellow-500' :
                    stat.status === 'needs_revision' ? 'bg-orange-500' : 'bg-green-500'
                  }`}>
                    <CloudArrowUpIcon className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">{stat.name}</dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Video Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <VideoTable 
            videos={videos} 
            onVideoUpdated={(updatedVideo) => {
              setVideos(prev => 
                prev.map(v => v.id === updatedVideo.id ? updatedVideo : v)
              );
            }}
            onVideoDeleted={(id) => {
              setVideos(prev => prev.filter(v => v.id !== id));
            }}
          />
        </div>
      </main>
    </div>
  );
}
