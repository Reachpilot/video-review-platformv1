#!/bin/bash

# Script to generate thumbnails for all videos in public/uploads/videos

VIDEOS_DIR="public/uploads/videos"
THUMBNAILS_DIR="public/uploads/videos/thumbnails"

# Create thumbnails directory if it doesn't exist
mkdir -p "$THUMBNAILS_DIR"

echo "Generating thumbnails for videos in $VIDEOS_DIR"

# Find all video files (mp4, mov, webm, mkv, avi)
find "$VIDEOS_DIR" -type f \( -name "*.mp4" -o -name "*.mov" -o -name "*.webm" -o -name "*.mkv" -o -name "*.avi" \) | while read -r video_path; do
    # Get filename without extension
    filename=$(basename "$video_path")
    name="${filename%.*}"

    # Create slug from filename (lowercase, replace spaces/special chars with dash)
    slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//;s/-$//')

    thumbnail_path="$THUMBNAILS_DIR/${slug}.jpg"

    # Check if thumbnail exists and is newer than video
    if [ -f "$thumbnail_path" ] && [ "$thumbnail_path" -nt "$video_path" ]; then
        echo "Thumbnail already up to date: $slug.jpg"
        continue
    fi

    echo "Generating thumbnail for: $filename -> $slug.jpg"

    # Generate thumbnail using ffmpeg
    ffmpeg -y -i "$video_path" -vf "scale=360:-1" -frames:v 1 "$thumbnail_path" 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "✓ Generated: $slug.jpg"
    else
        echo "✗ Failed: $slug.jpg"
    fi
done

echo "Thumbnail generation completed"
