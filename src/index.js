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
          const format = url.searchParams.get('format') || 'iwasync';
          const playlistTitle = (url.searchParams.get('playlistTitle') || '').trim() || 'YouTubeプレイリスト';
          const playerIndexText = url.searchParams.get('playerIndex') || '0';
          const playerIndex = Number(playerIndexText);
          const questSameUrl = url.searchParams.get('questSameUrl') === 'true';
          if (!['iwasync', 'vizvid', 'both'].includes(format)) {
            return errorResponse(400, '無効な出力形式です');
          }
          if (format !== 'iwasync' && (!/^\d+$/.test(playerIndexText) || !Number.isSafeInteger(playerIndex))) {
            return errorResponse(400, 'プレイヤー番号は0以上の整数を指定してください');
          }

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
          const vizvid = [{
            title: playlistTitle,
            entries: allItems.map(item => {
              const videoUrl = `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`;
              return {
                title: item.snippet.title,
                url: videoUrl,
                urlForQuest: questSameUrl ? videoUrl : '',
                playerIndex
              };
            })
          }];
          const output = format === 'vizvid' ? vizvid : format === 'both' ? {
            files: [
              { filename: 'iwasync_playlist.json', data: converted },
              { filename: 'vizvid_playlist.json', data: vizvid }
            ]
          } : converted;
          const filename = format === 'vizvid' ? 'vizvid_playlist.json' : format === 'both' ? 'playlists.json' : 'playlist.json';

		  return new Response(JSON.stringify(output, null, 2), {
			headers: {
			  'Content-Type': 'application/json; charset=UTF-8',
			  'Content-Disposition': `attachment; filename="${filename}"`
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
  <html lang="ja">
  <head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>YouTubeのプレイリストをiwaSync3・VizvidのJSONに変換</title>
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
	<meta name="twitter:card" content="summary_large_image" />
	<meta property="og:title" content="YouTubeのプレイリストをiwaSync3・VizvidのJSONに変換" />
	<meta property="og:url" content="https://yt-to-is3.potapoyo.com/" />
	<meta property="og:image" content="https://assets.potapoyo.com/img/yt-to-is3/ogp.webp" />
	<meta property="og:site_name" content="ぽたぽよドットコム" />
	<meta property="og:locale" content="ja_JP" />
  </head>
  <body>
	<h1>YouTubeのプレイリストをiwaSync3・VizvidのJSONに変換</h1>
	<a href="https://www.amazon.jp/hz/wishlist/ls/24EL6T1M89S5L?ref_=wl_share" target="_blank">なにかAmazon で買ってくれるとうれしいです。</a><br>
	<br>
	YouTubeのプレイリストURLを下記欄に入れて、「JSONを生成」をクリックしてください。<br>
	iwaSync3用のJSONは「★プレイリストをjsonファイルから読み込み」、Vizvid用のJSONはVizvidのプレイリストとして読み込んでください。<br>
	<br>
	<label for="playlistUrl">YouTubeプレイリストURL</label>
	<input type="text" id="playlistUrl" placeholder="YouTubeプレイリストのURLを貼り付けてください">
	<label class="nowrap-label">
	  <input type="checkbox" id="ascending"> 昇順で並び替え
	</label>
	<br>
	<label for="format">出力形式</label>
    <select id="format" onchange="updateOptions()">
      <option value="iwasync">iwaSyncのみ</option>
      <option value="vizvid">Vizvidのみ</option>
      <option value="both">両方（JSONファイルを2つ生成）</option>
    </select>
    <fieldset id="iwasyncOptions">
    <legend>iwaSync用オプション</legend>
    <div class="mode-radio-group">
	  <label><input type="radio" name="mode" value="0"> Videoモード</label>
	  <label><input type="radio" name="mode" value="1" checked> Liveモード</label>
	</div>
	</fieldset>
    <fieldset id="vizvidOptions" hidden>
      <legend>Vizvid用オプション</legend>
      <label for="playlistTitle">プレイリスト名</label>
      <input type="text" id="playlistTitle" placeholder="YouTubeプレイリスト" maxlength="200">
      <label for="playerIndex">プレイヤー番号（playerIndex）</label>
      <input type="number" id="playerIndex" value="0" min="0" step="1" aria-describedby="playerHelp">
      <p id="playerHelp">0は見本と同じ設定です。別の番号を使う場合は、使用するワールドのVizvid設定に合わせてください。</p>
      <label><input type="checkbox" id="questSameUrl"> Quest用URLにも同じYouTube URLを設定する</label>
      <p>チェックしない場合、Quest用URLは見本と同じ空欄になります。Questでの再生可否はワールドの設定に依存します。</p>
    </fieldset>
    <button id="convertButton" onclick="convert()">JSONを生成</button>
    <p id="error" role="alert"></p>
    <div id="downloads" aria-live="polite"></div>
	<div id="loading" class="loading" role="status">処理中...</div>

	<script>
	  const downloadUrls = [];
      function clearDownloads() {
        downloadUrls.forEach(url => URL.revokeObjectURL(url));
        downloadUrls.length = 0;
        document.getElementById('downloads').replaceChildren();
      }
      function updateOptions() {
        const format = document.getElementById('format').value;
        document.getElementById('iwasyncOptions').hidden = format === 'vizvid';
        document.getElementById('vizvidOptions').hidden = format === 'iwasync';
        clearDownloads();
      }
      function addDownload(filename, data) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=UTF-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        downloadUrls.push(link.href);
        link.download = filename;
        link.textContent = filename + ' をダウンロード';
        const row = document.createElement('p');
        row.append(link);
        document.getElementById('downloads').append(row);
        return link;
      }
      window.addEventListener('beforeunload', clearDownloads);
      async function convert() {
		const url = document.getElementById('playlistUrl').value;
		const ascending = document.getElementById('ascending').checked;
		const loading = document.getElementById('loading');
		const mode = document.querySelector('input[name="mode"]:checked').value;
        const format = document.getElementById('format').value;
        const playerInput = document.getElementById('playerIndex');
        const button = document.getElementById('convertButton');
        document.getElementById('error').textContent = '';
        clearDownloads();
        if (format !== 'iwasync' && !playerInput.reportValidity()) return;
        const params = new URLSearchParams({
          url, ascending, mode, format,
          playlistTitle: document.getElementById('playlistTitle').value,
          playerIndex: playerInput.value,
          questSameUrl: document.getElementById('questSameUrl').checked
        });

		try {
		  loading.style.display = 'block';
          button.disabled = true;
		  const response = await fetch('/convert?' + params.toString());

		  if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error);
		  }

          const data = await response.json();
          if (format === 'both') {
            data.files.forEach(file => addDownload(file.filename, file.data));
            // Keep two explicit links: browsers may block multiple automatic downloads.
          } else {
            addDownload(format === 'vizvid' ? 'vizvid_playlist.json' : 'playlist.json', data).click();
          }

		} catch (error) {
		  document.getElementById('error').textContent = 'エラーが発生しました: ' + error.message;
		} finally {
		  loading.style.display = 'none';
          button.disabled = false;
		}
	  }
	</script>
  </body>
  </html>
  `;

