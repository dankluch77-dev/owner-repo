#!/usr/bin/env bash
# Assembles reel 001 from four 9:16 clips (build/clips/1..4.mp4) and the overlay PNGs.
# Usage: node render-overlays.js && ./build.sh
set -euo pipefail
cd "$(dirname "$0")"

B=build
SEG=3.2      # seconds kept from each clip
END=2.0      # end card length
FPS=24      # match the Kling source frame rate
# Where each clip's best section starts (seconds into the source clip)
START=(1.5 0.8 1.6 1.8)
HOOK_OUT=2.7 # hook text fades out here (on clip 1)

norm="scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=$FPS,setsar=1,format=yuv420p,eq=contrast=1.04:saturation=1.06"

filter=""
for i in 0 1 2 3; do
  n=$((i + 1))
  filter+="[$i:v]trim=start=${START[$i]}:duration=$SEG,setpts=PTS-STARTPTS,$norm[c$n];"
  filter+="[c$n][$((i + 5)):v]overlay=0:0:format=auto[s$n];"
done
# Hook over clip 1: visible from the first frame (it is the thumbnail), fades out before the cut
filter+="[4:v]format=rgba,fade=t=out:st=$HOOK_OUT:d=0.35:alpha=1[hook];"
filter+="[s1][hook]overlay=0:0:format=auto:shortest=1[v1];"
filter+="[9:v]scale=1080:1920,fps=$FPS,setsar=1,format=yuv420p,trim=duration=$END,fade=t=in:st=0:d=0.25[endc];"
filter+="[v1][s2][s3][s4][endc]concat=n=5:v=1:a=0[v]"

total=$(awk "BEGIN{print 4*$SEG+$END}")

ffmpeg -y -hide_banner -loglevel error \
  -i $B/clips/1.mp4 -i $B/clips/2.mp4 -i $B/clips/3.mp4 -i $B/clips/4.mp4 \
  -loop 1 -t $SEG -i $B/hook.png \
  -loop 1 -t $SEG -i $B/shot01.png -loop 1 -t $SEG -i $B/shot02.png \
  -loop 1 -t $SEG -i $B/shot03.png -loop 1 -t $SEG -i $B/shot04.png \
  -loop 1 -t $END -i $B/end.png \
  -f lavfi -t "$total" -i anullsrc=r=48000:cl=stereo \
  -filter_complex "$filter" -map "[v]" -map 10:a \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -r $FPS \
  -c:a aac -b:a 128k -shortest -movflags +faststart \
  vavermo-001-never-filmed.mp4

ffprobe -v error -show_entries format=duration:stream=width,height,codec_name -of compact vavermo-001-never-filmed.mp4
