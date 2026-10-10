const { readFileSync } = require('node:fs');
const { SourceTextModule, createContext } = require('node:vm');

let worker;
const originalFetch = global.fetch;
const videos = [
  { snippet: { title: '日本語の曲 🎵', resourceId: { videoId: 'first' } } },
  { snippet: { title: 'Second', resourceId: { videoId: 'second' } } }
];

beforeAll(async () => {
  const module = new SourceTextModule(readFileSync('src/index.js', 'utf8'), {
    context: createContext({ URL, Request, Response, fetch: (...args) => global.fetch(...args) })
  });
  await module.link(() => { throw new Error('Unexpected import'); });
  await module.evaluate();
  worker = module.namespace.default;
});
beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ items: videos })));
});
afterAll(() => { global.fetch = originalFetch; });

function convert(params = {}) {
  return worker.fetch(new Request('https://example.test/convert?' + new URLSearchParams({
    url: 'https://www.youtube.com/playlist?list=example', ...params
  })), { YOUTUBE_API_KEY: 'test-key' });
}

test('serves format selection and Vizvid options', async () => {
  const response = await worker.fetch(new Request('https://example.test/'), {});
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('value="both"');
  expect(html).toContain('id="vizvidOptions" hidden');
  expect(html).toContain('id="playerIndex"');
  // Compile the embedded script to catch syntax errors in the generated page.
  new Function(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
});

test('preserves the default iwaSync schema and filename', async () => {
  const response = await convert({ mode: '1' });
  expect(response.headers.get('content-disposition')).toContain('playlist.json');
  expect(await response.json()).toEqual({ tracks: videos.map(item => ({
    mode: 1, title: item.snippet.title,
    url: 'https://www.youtube.com/watch?v=' + item.snippet.resourceId.videoId
  })) });
});

test('matches the attached Vizvid schema with default options', async () => {
  const response = await convert({ format: 'vizvid', playlistTitle: 'ぽたぽよ注目曲' });
  expect(response.headers.get('content-disposition')).toContain('vizvid_playlist.json');
  expect(await response.json()).toEqual([{
    title: 'ぽたぽよ注目曲', entries: [
      { title: '日本語の曲 🎵', url: 'https://www.youtube.com/watch?v=first', urlForQuest: '', playerIndex: 0 },
      { title: 'Second', url: 'https://www.youtube.com/watch?v=second', urlForQuest: '', playerIndex: 0 }
    ]
  }]);
});

test('generates both files from one paginated fetch and applies reverse order and options', async () => {
  global.fetch
    .mockReset()
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [videos[0]], nextPageToken: 'page2' })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [videos[1]] })));
  const response = await convert({ format: 'both', ascending: 'true', mode: '1', playerIndex: '2', questSameUrl: 'true' });
  const { files } = await response.json();
  expect(files.map(file => file.filename)).toEqual(['iwasync_playlist.json', 'vizvid_playlist.json']);
  expect(files[0].data.tracks.map(track => track.title)).toEqual(['Second', '日本語の曲 🎵']);
  expect(files[1].data[0].title).toBe('YouTubeプレイリスト');
  expect(files[1].data[0].entries.map(entry => entry.title)).toEqual(['Second', '日本語の曲 🎵']);
  expect(files[1].data[0].entries[0]).toEqual({ title: 'Second', url: 'https://www.youtube.com/watch?v=second', urlForQuest: 'https://www.youtube.com/watch?v=second', playerIndex: 2 });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(new URL(global.fetch.mock.calls[1][0]).searchParams.get('pageToken')).toBe('page2');
});

test.each(['-1', '1.5', 'abc', 'Infinity', '9007199254740992'])('rejects invalid Vizvid playerIndex %s', async playerIndex => {
  expect((await convert({ format: 'vizvid', playerIndex })).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('rejects unsupported formats', async () => {
  expect((await convert({ format: 'unknown' })).status).toBe(400);
  expect(global.fetch).not.toHaveBeenCalled();
});

test('handles missing URL, missing list ID, unknown paths and upstream errors', async () => {
  expect((await worker.fetch(new Request('https://example.test/convert'), {})).status).toBe(400);
  expect((await convert({ url: 'https://www.youtube.com/watch?v=first' })).status).toBe(400);
  expect((await worker.fetch(new Request('https://example.test/missing'), {})).status).toBe(404);
  global.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Quota exceeded' } }), { status: 403 }));
  const response = await convert({ format: 'vizvid' });
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'YouTube APIエラー: Quota exceeded' });
});
