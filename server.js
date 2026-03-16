const express       = require('express');
const cors          = require('cors');
const axios         = require('axios');
const ytdl          = require('@distube/ytdl-core');
const ffmpeg        = require('fluent-ffmpeg');
const ffmpegBin     = require('ffmpeg-static');
const { PassThrough } = require('stream');
const path          = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// API klíč — buď z prostředí (Render envVars) nebo napevno
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyCC_5X2ouF7NqGwhUKXuUrKiJa63fVZw74';

ffmpeg.setFfmpegPath(ffmpegBin);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── SEARCH ───────────────────────────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const { q, pageToken } = req.query;
  if (!q?.trim()) return res.status(400).json({ error: 'Chybí vyhledávací dotaz.' });

  try {
    const params = {
      part: 'snippet',
      q: q.trim(),
      type: 'video',
      maxResults: 12,
      key: YOUTUBE_API_KEY,
      fields: 'nextPageToken,prevPageToken,pageInfo,items(id/videoId,snippet(title,channelTitle,thumbnails/high,publishedAt))'
    };
    if (pageToken) params.pageToken = pageToken;

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', { params });
    const ids = searchRes.data.items.map(i => i.id.videoId).join(',');

    const detailRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        part: 'contentDetails,statistics',
        id: ids,
        key: YOUTUBE_API_KEY,
        fields: 'items(id,contentDetails/duration,statistics/viewCount)'
      }
    });

    const meta = {};
    detailRes.data.items.forEach(v => {
      meta[v.id] = {
        duration: parseDuration(v.contentDetails.duration),
        views: parseInt(v.statistics?.viewCount || 0)
      };
    });

    const items = searchRes.data.items.map(item => ({
      videoId:   item.id.videoId,
      title:     item.snippet.title,
      channel:   item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url || '',
      duration:  meta[item.id.videoId]?.duration || '-',
      views:     meta[item.id.videoId]?.views || 0,
      url:       `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

    res.json({
      items,
      nextPageToken: searchRes.data.nextPageToken || null,
      prevPageToken: searchRes.data.prevPageToken || null,
      totalResults:  searchRes.data.pageInfo?.totalResults || 0
    });
  } catch (err) {
    console.error('Search error:', err.response?.data || err.message);
    if (err.response?.status === 403)
      return res.status(403).json({ error: 'Neplatný nebo vyčerpaný YouTube API klíč.' });
    res.status(500).json({ error: 'Chyba vyhledávání: ' + (err.response?.data?.error?.message || err.message) });
  }
});

// ─── DOWNLOAD / CONVERT ───────────────────────────────────────────────────
app.get('/api/download', async (req, res) => {
  const { videoId, title } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Chybí ID videa.' });

  const url      = `https://www.youtube.com/watch?v=${videoId}`;
  const safeName = (title || videoId).replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 120);

  try {
    const info        = await ytdl.getInfo(url);
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
    const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName + '.mp3')}`);
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const pass = new PassThrough();
    ffmpeg(audioStream)
      .audioFrequency(44100)
      .audioBitrate(320)
      .audioChannels(2)
      .format('mp3')
      .on('error', err => {
        console.error('ffmpeg error:', err.message);
        if (!res.headersSent) res.status(500).json({ error: 'Chyba konverze: ' + err.message });
        else res.destroy();
      })
      .pipe(pass);
    pass.pipe(res);

  } catch (err) {
    console.error('Download error:', err.message);
    if (!res.headersSent) {
      if (err.message?.includes('private')) return res.status(403).json({ error: 'Toto video je soukromé.' });
      if (err.message?.includes('age'))     return res.status(403).json({ error: 'Toto video je věkově omezené.' });
      res.status(500).json({ error: 'Nelze stáhnout: ' + err.message });
    }
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ffmpeg: ffmpegBin }));

app.listen(PORT, () => console.log(`SoundRip bezi na portu ${PORT}`));

function parseDuration(iso) {
  if (!iso) return '-';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '-';
  const h = +(m[1]||0), min = +(m[2]||0), s = +(m[3]||0);
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${min}:${String(s).padStart(2,'0')}`;
}
