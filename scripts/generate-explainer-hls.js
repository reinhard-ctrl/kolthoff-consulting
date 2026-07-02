#!/usr/bin/env node
/** Build adaptive HLS renditions from the marketing explainer source MP4. */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const source = path.join(root, 'apps/public/assets/Ops_Excellence_for_SMEs.mp4');
const outDir = path.join(root, 'apps/public/assets/explainer-hls');
const masterPath = path.join(outDir, 'master.m3u8');

function hasFfmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isUpToDate() {
  if (!fs.existsSync(source) || !fs.existsSync(masterPath)) return false;
  return fs.statSync(masterPath).mtimeMs >= fs.statSync(source).mtimeMs;
}

if (!fs.existsSync(source)) {
  console.warn('Explainer source MP4 missing; skipping HLS generation.');
  process.exit(0);
}

if (isUpToDate()) {
  console.log('Explainer HLS already up to date.');
  process.exit(0);
}

if (!hasFfmpeg()) {
  console.warn('ffmpeg not found; skipping HLS generation.');
  process.exit(0);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

console.log('Generating adaptive HLS renditions for explainer video...');

const cmd = [
  'ffmpeg -y',
  `-i "${source}"`,
  '-filter_complex "[0:v]split=3[v1][v2][v3];',
  '[v1]scale=1280:720[v1out];',
  '[v2]scale=854:480:force_original_aspect_ratio=decrease,pad=854:480:(ow-iw)/2:(oh-ih)/2[v2out];',
  '[v3]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2[v3out]"',
  '-map [v1out] -map 0:a:0',
  '-map [v2out] -map 0:a:0',
  '-map [v3out] -map 0:a:0',
  '-c:v libx264 -profile:v main -pix_fmt yuv420p',
  '-b:v:0 1200k -maxrate:v:0 1300k -bufsize:v:0 2600k',
  '-b:v:1 700k -maxrate:v:1 800k -bufsize:v:1 1400k',
  '-b:v:2 400k -maxrate:v:2 500k -bufsize:v:2 1000k',
  '-c:a aac -b:a 96k -ac 2',
  '-var_stream_map "v:0,a:0 v:1,a:1 v:2,a:2"',
  '-master_pl_name master.m3u8',
  '-f hls -hls_time 6 -hls_playlist_type vod',
  `-hls_segment_filename "${outDir}/stream_%v/seg_%03d.ts"`,
  `"${outDir}/stream_%v/playlist.m3u8"`,
].join(' ');

execSync(cmd, { stdio: 'inherit' });
console.log('Explainer HLS generation complete → apps/public/assets/explainer-hls/');
