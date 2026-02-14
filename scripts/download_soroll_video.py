import os
import sys
import yt_dlp

def download_video(url, output_path):
    ydl_opts = {
        'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        'outtmpl': os.path.join(output_path, '%(title)s.%(ext)s'),
        'noplaylist': True,
        'retries': 10,
        'fragment_retries': 10,
        'concurrent_fragment_downloads': 5,
    }

    print(f"Starting download to {output_path}...")
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
        print("Download complete!")
    except Exception as e:
        print(f"Error downloading video: {e}")
        sys.exit(1)

if __name__ == '__main__':
    video_url = "https://www.youtube.com/watch?v=yw4WXw9kiDg"
    
    # Define output directory relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Construct path to assets/video - going up one level from scripts/
    output_dir = os.path.join(script_dir, '../assets/video') 
    
    # Ensure output directory exists
    if not os.path.exists(output_dir):
        try:
            os.makedirs(output_dir)
            print(f"Created directory: {output_dir}")
        except OSError as e:
            print(f"Error creating directory {output_dir}: {e}")
            sys.exit(1)

    print(f"Downloading video from {video_url} to {output_dir}")
    download_video(video_url, output_dir)
