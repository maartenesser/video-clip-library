# Video Processing Scripts

This directory contains scripts for local video processing when Cloudflare Containers is not available.

## Prerequisites

1. **FFmpeg** - Required for video processing
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg
   ```

2. **Python 3.9+** with dependencies
   ```bash
   pip install -r scripts/requirements.txt
   ```

3. **OpenAI API Key** - Required for transcription (Whisper) and tagging (GPT-4o-mini)
   - Get your API key from https://platform.openai.com/api-keys
   - Add it to `apps/web/.env.local`:
     ```
     OPENAI_API_KEY=sk-your-api-key-here
     ```

## Usage

### Process all pending videos
```bash
python scripts/process_videos.py
```

### Process a specific video
```bash
python scripts/process_videos.py <source_id>
```

## What the script does

1. **Fetches** pending sources from the Supabase database
2. **Downloads** the source video from Cloudflare R2
3. **Transcribes** the audio using OpenAI Whisper API
4. **Detects scenes** using PySceneDetect
5. **Splits** the video into 3-20 second clips
6. **Tags** each clip using GPT-4o-mini (hook, product_benefit, proof, etc.)
7. **Uploads** clips and thumbnails to R2
8. **Saves** clip data with tags to the database

## Cost Estimates

For a typical 5-10 minute video:
- **Whisper API**: ~$0.03-0.06 per video
- **GPT-4o-mini**: ~$0.01-0.02 per video (for tagging 5-15 clips)

Total: ~$0.04-0.08 per video processed

## Troubleshooting

### "OPENAI_API_KEY not set"
Add your OpenAI API key to `apps/web/.env.local`

### "FFmpeg not found"
Install FFmpeg using the instructions above

### Processing fails
Check the error message. Common issues:
- Video file corrupted or not accessible in R2
- OpenAI API rate limits
- Insufficient disk space for temporary files
