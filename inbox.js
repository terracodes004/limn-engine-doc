<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, 0, 0, 0));
}

async function loadInbox() {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  let notifications = [];

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!userError && user) {
      const { data: userDocs, error: docError } = await supabase
        .from('user_documents')
        .select('*')
        .eq('user_id', user.id);

      if (!docError && userDocs) {
        userDocs.forEach(doc => {
          notifications.push({ ...doc, uniqueId: 'doc-' + doc.id, kind: 'doc' });
        });
      }
    }

    const { data: engineUpdates, error: updateError } = await supabase
      .from('engine_updates')
      .select('*');

    if (!updateError && engineUpdates) {
      engineUpdates.forEach(update => {
        notifications.push({ ...update, uniqueId: 'update-' + update.id, kind: 'update' });
      });
    }
  } catch (err) {
    console.log('Error fetching from Supabase');
  }

  try {
    const since = getWeekStart().toISOString();

    const { data: likes } = await supabase
      .from('likes')
      .select('id, game_id, created_at')
      .gte('created_at', since);

    const { data: comments } = await supabase
      .from('comments')
      .select('id, game_id, created_at')
      .gte('created_at', since);

    const { data: games } = await supabase
      .from('games')
      .select('id, slug, title, author_id, author_name, created_at');

    const gameMap = {};
    if (games) for (const g of games) gameMap[g.id] = g;

    const likeCounts = {};
    if (likes) for (const l of likes) {
      likeCounts[l.game_id] = (likeCounts[l.game_id] || 0) + 1;
    }

    const commentCounts = {};
    if (comments) for (const c of comments) {
      commentCounts[c.game_id] = (commentCounts[c.game_id] || 0) + 1;
    }

    const topGames = Object.entries(likeCounts)
      .map(([id, count]) => ({ game: gameMap[id], likes: count, comments: commentCounts[id] || 0 }))
      .filter(x => x.game)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    if (topGames.length > 0) {
      const winner = topGames[0];
      const lines = topGames.map((x, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ' + (i + 1) + '.';
        return medal + ' ' + x.game.title + ' — ♥ ' + x.likes + ' · 💬 ' + x.comments;
      }).join('\n');

      notifications.push({
        uniqueId: 'leaderboard-' + getWeekStart().toISOString(),
        title: '🏆 Weekly Leaderboard',
        content: 'Top games this week:\n' + lines + '\n\nCurrent winner: ' + winner.game.title,
        created_at: getWeekStart().toISOString(),
        kind: 'leaderboard',
        leaderboardData: topGames
      });
    }

    if (user && games) {
      const myGames = games.filter(g => g.author_id === user.id);
      if (myGames.length > 0) {
        const myIds = myGames.map(g => g.id);
        const myLikes = myIds.reduce((sum, id) => sum + (likeCounts[id] || 0), 0);
        const myComments = myIds.reduce((sum, id) => sum + (commentCounts[id] || 0), 0);

        notifications.push({
          uniqueId: 'mystats-' + getWeekStart().toISOString(),
          title: '📊 Your Weekly Stats',
          content: 'You have ' + myGames.length + ' game' + (myGames.length === 1 ? '' : 's') + ' published.\n' +
                   'This week: ♥ ' + myLikes + ' likes · 💬 ' + myComments + ' comments',
          created_at: new Date().toISOString(),
          kind: 'stats'
        });
      }
    }
  } catch (err) {
    console.log('Leaderboard fetch error', err);
  }

  notifications.sort((a, b) => new Date(b.created_at || Date.now()) - new Date(a.created_at || Date.now()));

  const readIds = JSON.parse(localStorage.getItem('limn_read_notifications') || '[]');
  let currentFilter = '';

  function markAllAsRead() {
    notifications.forEach(item => {
      if (!readIds.includes(item.uniqueId)) {
        readIds.push(item.uniqueId);
      }
    });
    localStorage.setItem('limn_read_notifications', JSON.stringify(readIds));
    renderList(currentFilter);
  }

  function renderList(filterQuery = '') {
    currentFilter = filterQuery;
    container.innerHTML = '';

    const filtered = notifications.filter(item => {
      const keys = Object.keys(item);
      const title = String(item.title || item.Title || item.name || item[keys.find(k => k.toLowerCase().includes('title'))] || '').toLowerCase();
      const content = String(item.content || item.Content || item.message || item[keys.find(k => k.toLowerCase().includes('content'))] || '').toLowerCase();
      const query = filterQuery.toLowerCase();
      return title.includes(query) || content.includes(query);
    });

    const unreadCount = notifications.filter(item => !readIds.includes(item.uniqueId)).length;
    if (unreadCount > 0) {
      const markAllDiv = document.createElement('div');
      markAllDiv.style.cssText = 'display: flex; justify-content: flex-end; margin-bottom: 16px;';

      const markAllBtn = document.createElement('button');
      markAllBtn.textContent = '✓ Mark all as read (' + unreadCount + ' unread)';
      markAllBtn.style.cssText = 'background: var(--accent); color: #fff; border: none; border-radius: 20px; padding: 8px 18px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background 0.2s; box-shadow: 0 2px 10px rgba(255, 99, 140, 0.3);';
      markAllBtn.addEventListener('mouseenter', () => { markAllBtn.style.background = 'var(--accent-dark)'; });
      markAllBtn.addEventListener('mouseleave', () => { markAllBtn.style.background = 'var(--accent)'; });
      markAllBtn.addEventListener('click', markAllAsRead);

      markAllDiv.appendChild(markAllBtn);
      container.appendChild(markAllDiv);
    }

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.cssText = 'background: var(--surface); border: 1.5px solid var(--border); border-radius: 14px; padding: 24px; text-align: center; color: var(--muted); margin-bottom: 16px;';
      emptyMsg.textContent = filterQuery ? 'No matching notifications or updates found.' : 'No notifications yet.';
      container.appendChild(emptyMsg);
      appendFooter();
      return;
    }

    filtered.forEach(item => {
      const isRead = readIds.includes(item.uniqueId);
      const dateFormatted = new Date(item.created_at || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

      const keys = Object.keys(item);
      const displayTitle = item.title || item.Title || item.name || item.heading || item[keys.find(k => k.toLowerCase().includes('title') || k.toLowerCase().includes('name'))] || 'Limn Engine Update';
      const displayContent = item.content || item.Content || item.message || item.body || item.text || item[keys.find(k => k.toLowerCase().includes('content') || k.toLowerCase().includes('message') || k.toLowerCase().includes('body'))] || 'New platform update available.';

      const card = document.createElement('div');
      const borderColor = isRead ? 'var(--border)' : 'var(--accent)';
      const bgStyle = isRead ? 'var(--surface)' : 'rgba(255, 99, 140, 0.04)';

      card.style.cssText = 'background: ' + bgStyle + '; border: 1.5px solid ' + borderColor + '; border-radius: 14px; padding: 24px; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); position: relative; margin-bottom: 16px;';

      const unreadDot = !isRead
        ? '<span class="unread-dot" style="height: 10px; width: 10px; background-color: var(--accent); border-radius: 50%; display: inline-block; box-shadow: 0 0 10px var(--accent); margin-right: 8px;"></span>'
        : '';

      let extraHtml = '';

      if (item.kind === 'leaderboard' && item.leaderboardData) {
        extraHtml = '<div style="margin-top: 16px; display: flex; flex-direction: column; gap: 8px;">' +
          item.leaderboardData.map((x, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
            const color = i === 0 ? '#fd3' : i === 1 ? '#bbb' : i === 2 ? '#c85' : '#888';
            return '<a href="/arcade/game.html?slug=' + encodeURIComponent(x.game.slug) + '" style="display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.03); border: 1px solid var(--border); border-radius: 10px; text-decoration: none; color: inherit;">' +
              '<span style="font-size: 1.2rem; font-weight: 700; color: ' + color + '; min-width: 32px;">' + medal + '</span>' +
              '<span style="flex: 1; font-weight: 600; color: #fff;">' + x.game.title + '</span>' +
              '<span style="font-size: 0.9rem; color: var(--accent);">♥ ' + x.likes + '</span>' +
              '<span style="font-size: 0.9rem; color: var(--muted);">💬 ' + x.comments + '</span>' +
            '</a>';
          }).join('') +
        '</div>';
      }

      card.innerHTML =
        '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1.5px solid rgba(255, 99, 140, 0.1); padding-bottom: 10px;">' +
          '<h3 style="margin: 0; font-size: 1.1rem; font-weight: 700; color: #ffffff; display: flex; align-items: center;">' +
            unreadDot + displayTitle +
          '</h3>' +
          '<span style="font-size: 0.8rem; color: var(--accent2); font-family: \'Space Mono\', monospace; background: rgba(127, 255, 178, 0.08); padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(127, 255, 178, 0.2);">' + dateFormatted + '</span>' +
        '</div>' +
        '<div style="font-size: 0.95rem; color: var(--text); line-height: 1.6; white-space: pre-wrap;">' +
          displayContent +
        '</div>' +
        extraHtml;

      if (!isRead) {
        card.addEventListener('click', () => {
          if (!readIds.includes(item.uniqueId)) {
            readIds.push(item.uniqueId);
            localStorage.setItem('limn_read_notifications', JSON.stringify(readIds));
            renderList(currentFilter);
          }
        });
      }

      container.appendChild(card);
    });

    appendFooter();
  }

  function appendFooter() {
    const footerCard = document.createElement('div');
    footerCard.style.cssText = 'background: var(--surface); border: 1.5px solid var(--accent2); border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); margin-top: 20px;';
    footerCard.innerHTML =
      '<p style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--text);">💬 Join our community on Discord: <a href="https://discord.gg/kVpSmYWXr" target="_blank" style="color: var(--accent); text-decoration: underline; font-weight: 600;">discord.gg/kVpSmYWXr</a></p>' +
      '<p style="margin: 0; font-size: 0.95rem; color: var(--text);">Having issues or need help? Message us at <a href="mailto:evolvedtech004@gmail.com" style="color: var(--accent2); text-decoration: underline;">evolvedtech004@gmail.com</a></p>';
    container.appendChild(footerCard);
  }

  renderList('');

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderList(e.target.value);
    });
  }
}

loadInbox();
</script>
