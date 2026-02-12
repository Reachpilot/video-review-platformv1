'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useForm } from 'react-hook-form';
import { PlusIcon, XMarkIcon, CloudArrowUpIcon } from '@heroicons/react/24/outline';
import { uploadVideo } from '@/lib/videoService';
import { Video } from '@/types';

type FormData = {
  title: string;
  description: string;
};

interface UploadButtonProps {
  onOpenChange?: (isOpen: boolean) => void;
  onVideoUploaded?: (video: Video) => void;
  isMpu?: boolean;
}

export default function UploadButton({ onOpenChange, onVideoUploaded, isMpu = false }: UploadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const { register, handleSubmit, reset } = useForm<FormData>();
  
  const { getRootProps, getInputProps, isDragActive, open: openFileDialog } = useDropzone({
    accept: {
      'video/*': ['.mp4', '.webm', '.mov']
    },
    multiple: false,
    noClick: true,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
    onDropRejected: () => {
      alert('Bitte nur MP4, WebM oder MOV Dateien hochladen (max. 100MB).');
    }
  });

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
    if (!open) {
      reset();
      setSelectedFile(null);
    }
  };

  const getVideoDuration = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = video.duration;
        const minutes = Math.floor(duration / 60);
        const seconds = Math.floor(duration % 60);
        resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      };
      
      video.onerror = () => {
        console.error('Error getting video duration');
        resolve('0:00');
      };
      
      video.src = URL.createObjectURL(file);
    });
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      let resolved = false;

      const cleanup = () => {
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        URL.revokeObjectURL(video.src);
      };

      const finish = (data: string) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(data);
      };

      const captureFrame = () => {
        if (!video.videoWidth || !video.videoHeight) {
          finish('');
          return;
        }

        const maxWidth = 640;
        const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
        const canvasWidth = Math.round(video.videoWidth * scale);
        const canvasHeight = Math.round(video.videoHeight * scale);
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          finish('');
          return;
        }

        ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
        finish(canvas.toDataURL('image/jpeg'));
      };

      video.preload = 'auto';
      video.muted = true;
      video.src = URL.createObjectURL(file);
      video.onloadeddata = () => {
        if (video.readyState >= 2) {
          const desiredTime = 3;
          const targetTime = video.duration > desiredTime ? desiredTime : Math.max(video.duration - 0.1, 0);
          try {
            video.currentTime = targetTime;
          } catch (error) {
            captureFrame();
          }
        }
      };
      video.onseeked = captureFrame;
      video.onerror = () => finish('');
      setTimeout(() => finish(''), 2000);
    });
  };

  const onSubmit = async (formData: FormData) => {
    if (!selectedFile) {
      console.error('No file selected');
      alert('Please select a file to upload');
      return;
    }
    
    console.log('Starting upload...', { 
      file: selectedFile, 
      title: formData.title,
      size: selectedFile.size,
      type: selectedFile.type
    });
    
    setIsUploading(true);
    
    try {
      // Get video duration
      const duration = await getVideoDuration(selectedFile);
      console.log('Video duration:', duration);
      const thumbnailDataUrl = await generateThumbnail(selectedFile);
      
      // Upload the video using the video service
      console.log('Calling uploadVideo service...');
      const video = await uploadVideo(
        selectedFile,
        formData.title || selectedFile.name.replace(/\.[^/.]+$/, ''),
        formData.description || '',
        duration,
        thumbnailDataUrl,
        isMpu
      );
      
      console.log('Upload successful:', video);
      
      // Notify parent component about the new video
      if (onVideoUploaded) {
        console.log('Notifying parent component about new video');
        onVideoUploaded(video);
      } else {
        console.warn('No onVideoUploaded handler provided');
      }
      
      // Show success message
      alert('Video uploaded successfully!');
      
      // Reset form and close modal after a short delay
      setTimeout(() => {
        console.log('Resetting form and closing modal');
        reset();
        setSelectedFile(null);
        handleOpenChange(false);
      }, 1000);
    } catch (error) {
      console.error('Upload failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during upload';
      console.error('Error details:', { error });
      alert(`Upload failed: ${errorMessage}`);
    } finally {
      console.log('Upload process completed');
      setIsUploading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          console.log('Upload button clicked');
          handleOpenChange(true);
        }}
        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
        Upload Video
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Upload Video</h2>
                <button
                  onClick={() => handleOpenChange(false)}
                  className="text-gray-400 hover:text-gray-500"
                  disabled={isUploading}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6">
                  <div 
                    {...getRootProps()} 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                    }`}
                  >
                    <input {...getInputProps()} />
                    {selectedFile ? (
                      <div className="space-y-2">
                        <p className="font-medium text-gray-900">{selectedFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-500"
                        >
                          Change file
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-2 text-center">
                          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                          <p className="text-sm text-gray-600">Ziehe ein Video hierher oder wähle eine Datei aus.</p>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              openFileDialog();
                            }}
                            className="inline-flex items-center px-3 py-1.5 border border-blue-600 text-sm font-medium rounded-md text-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          >
                            Upload a video
                          </button>
                          <p className="text-xs text-gray-500">MP4, WebM oder MOV bis 100MB</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {isUploading && (
                    <div className="mt-2 flex items-center text-sm text-gray-600">
                      <svg className="animate-spin h-4 w-4 mr-2 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z"></path>
                      </svg>
                      Video wird hochgeladen...
                    </div>
                  )}

                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="title"
                      {...register('title', { required: true })}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={isUploading}
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      {...register('description')}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      disabled={isUploading}
                    />
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => handleOpenChange(false)}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                      disabled={isUploading}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!selectedFile || isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Upload Video'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
