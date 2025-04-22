export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  // ルートアクセス時のHTML表示
	  if (url.pathname === '/') {
		return new Response(html, {
		  headers: { 'Content-Type': 'text/html; charset=UTF-8' }
		});
	  }
  
	  // 変換処理
	  if (url.pathname === '/convert') {
		try {
		  const playlistUrl = url.searchParams.get('url');
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
  
		  // JSON形式変換
		  const converted = {
			tracks: allItems.map(item => ({
			  mode: 1,
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
  
  // エラーレスポンス生成関数
  function errorResponse(status, message) {
	return new Response(JSON.stringify({ error: message }), {
	  status,
	  headers: { 'Content-Type': 'application/json; charset=UTF-8' }
	});
  }
  
  // HTMLインターフェース
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
	<meta charset="UTF-8">
	<title>YouTubeプレイリスト変換ツール</title>
	<style>
	  body { font-family: Arial, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
	  input { width: 100%; padding: 0.5rem; margin: 0.5rem 0; }
	  button { background: #007bff; color: white; border: none; padding: 0.5rem 1rem; cursor: pointer; }
	  .loading { display: none; color: #666; margin-top: 1rem; }
	</style>
  </head>
  <body>
	<h1>YouTubeプレイリスト変換ツール</h1>
	<input type="text" id="playlistUrl" placeholder="YouTubeプレイリストのURLを貼り付けてください">
	<button onclick="convert()">JSONを生成</button>
	<div id="loading" class="loading">処理中...</div>
	
	<script>
	  async function convert() {
		const url = document.getElementById('playlistUrl').value;
		const loading = document.getElementById('loading');
		
		try {
		  loading.style.display = 'block';
		  const response = await fetch('/convert?url=' + encodeURIComponent(url));
		  
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
  