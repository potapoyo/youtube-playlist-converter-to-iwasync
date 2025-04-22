export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  if (url.pathname === '/') {
		return new Response(html, {
		  headers: { 'Content-Type': 'text/html; charset=UTF-8' }
		});
	  }
  
	  if (url.pathname === '/convert') {
		try {
		  const playlistUrl = url.searchParams.get('url');
		  const ascending = url.searchParams.get('ascending') === 'true';
		  const mode = parseInt(url.searchParams.get('mode') || "0", 10);
  
		  if (!playlistUrl) {
			return errorResponse(400, 'URLパラメータが指定されていません');
		  }
  
		  const playlistId = new URL(playlistUrl).searchParams.get('list');
		  if (!playlistId) {
			return errorResponse(400, '無効なプレイリストURLです');
		  }
  
		  let allItems = [];
		  let nextPageToken = null;
  
		  do {
			const apiUrl = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
			apiUrl.searchParams.set('part', 'snippet');
			apiUrl.searchParams.set('maxResults', '50');
			apiUrl.searchParams.set('playlistId', playlistId);
			apiUrl.searchParams.set('key', env.YOUTUBE_API_KEY);
			if (nextPageToken) apiUrl.searchParams.set('pageToken', nextPageToken);
  
			const response = await fetch(apiUrl.toString());
			if (!response.ok) {
			  const error = await response.json();
			  return errorResponse(500, `YouTube APIエラー: ${error.error.message}`);
			}
  
			const data = await response.json();
			allItems = [...allItems, ...data.items];
			nextPageToken = data.nextPageToken || null;
  
		  } while (nextPageToken);
  
		  if (ascending) {
			allItems = allItems.reverse();
		  }
  
		  const converted = {
			tracks: allItems.map(item => ({
			  mode: mode,
			  title: item.snippet.title,
			  url: `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
			}))
		  };
  
		  return new Response(JSON.stringify(converted, null, 2), {
			headers: {
			  'Content-Type': 'application/json; charset=UTF-8',
			  'Content-Disposition': 'attachment; filename="playlist.json"'
			}
		  });
  
		} catch (error) {
		  return errorResponse(500, `内部エラー: ${error.message}`);
		}
	  }
  
	  return errorResponse(404, 'ページが見つかりません');
	}
  };
  
  function errorResponse(status, message) {
	return new Response(JSON.stringify({ error: message }), {
	  status,
	  headers: { 'Content-Type': 'application/json; charset=UTF-8' }
	});
  }
  
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
	<meta charset="UTF-8">
	<title>YouTubeのプレイリストをiwaSync3の.jsonに変換</title>
	<style>
	  body { font-family: Arial, sans-serif; max-width: 1024px; margin: 2rem auto; padding: 0 1rem; }
	  input[type="text"] { width: 100%; padding: 0.5rem; margin: 0.5rem 0; }
	  button { background: #007bff; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; }
	  .loading { display: none; color: #666; margin-top: 1rem; }
	  label.nowrap-label { white-space: nowrap; display: inline-block; vertical-align: middle; }
	  .mode-radio-group {
		margin: 10px 0;
		display: flex;
		gap: 1em;
	  }
	  .mode-radio-group label {
		white-space: nowrap;
	  }
	</style>
	<link rel=”icon” href=“https://assets.potapoyo.com/img/yt-to-is3/favicon.ico”>
	<meta property="og:title" content="YouTubeのプレイリストをiwaSync3の.jsonに変換" />
	<meta property="og:description" content="YouTubeのプレイリストをiwaSync3の.jsonに変換します" />
	<meta property="og:url" content="https://yt-to-is3.potapoyo.com/" />
	<meta property="og:image" content="https://assets.potapoyo.com/img/yt-to-is3/ogp.webp" />
	<meta property="og:image:width" content="" />
	<meta property="og:image:height" content="" />
	<meta property="og:type" content="website" />
	<meta property="og:site_name" content="" />
	<meta property="og:locale" content="ja_JP" />\^
  </head>
  <body>
	<h1>YouTubeのプレイリストをiwaSync3の.jsonに変換</h1>
	[ここに広告を置きたい]<br>
	<a href="https://www.amazon.jp/hz/wishlist/ls/24EL6T1M89S5L?ref_=wl_share" target="_blank">なにかAmazon で買ってくれるとうれしいです。</a><br>
	<input type="text" id="playlistUrl" placeholder="YouTubeプレイリストのURLを貼り付けてください">
	<label class="nowrap-label">
	  <input type="checkbox" id="ascending"> 昇順で並び替え
	</label>
	<br>
	<div class="mode-radio-group">
	  <label><input type="radio" name="mode" value="0" checked> Videoモード</label>
	  <label><input type="radio" name="mode" value="1"> Liveモード</label>
	</div>
	<button onclick="convert()">JSONを生成</button>
	<div id="loading" class="loading">処理中...</div>
	
	<script>
	  async function convert() {
		const url = document.getElementById('playlistUrl').value;
		const ascending = document.getElementById('ascending').checked;
		const loading = document.getElementById('loading');
		const mode = document.querySelector('input[name="mode"]:checked').value;
  
		try {
		  loading.style.display = 'block';
		  const response = await fetch(\`/convert?url=\${encodeURIComponent(url)}&ascending=\${ascending}&mode=\${mode}\`);
		  
		  if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error);
		  }
  
		  const blob = await response.blob();
		  const link = document.createElement('a');
		  link.href = URL.createObjectURL(blob);
		  link.download = 'playlist.json';
		  link.click();
		  
		} catch (error) {
		  alert('エラーが発生しました: ' + error.message);
		} finally {
		  loading.style.display = 'none';
		}
	  }
	</script>
  </body>
  </html>
  `;
  