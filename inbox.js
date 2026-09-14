import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://pjtpesdhjfvcidfkxord.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqdHBlc2RoamZ2Y2lkZmt4b3JkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNDUyNDUsImV4cCI6MjEwMzcyMTI0NX0.110aDXEqJ4PxjKWNv1Z2YNR8frklg3WW1u0HePDoN38';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

function getWeekStart() {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = (day + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diff, 0, 0, 0));
}

async function loadInbox() {
  const container = document.getElementById('notifications-list');
  if (!container) return;

  container.innerHTML = '<div style="padding:24px;text-align:center;color:#94a3b8">Loading your inbox...</div>';

  const notifications = [];

  try {
    const sessionResult = await withTimeout(supabase.auth.getSession(), 4000);
    const user = sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user : null;

    if (user) {
      try {
        const docResult = await withTimeout(
          supabase.from('user_documents').select('*').eq('user_id', user.id),
          4000
        );
        if (docResult.data) {
          docResult.data.forEach(doc => {
            notifications.push(Object.assign({}, doc, { uniqueId: 'doc-' + doc.id, kind: 'doc' }));
          });
        }
      } catch (e) {
        console.log('user_documents fetch skipped:', e.message);
      }
    }
  } catch (e) {
    console.log('Auth check skipped:', e.message);
  }

  try {
    const updateResult = await withTimeout(
      supabase.from('engine_updates').select('*'),
      4000
    );
    if (updateResult.data) {
      updateResult.data.forEach(update => {
        notifications.push(Object.assign({}, update, { uniqueId: 'update-' + update.id, kind: 'update' }));
      });
    }
  } catch (e) {
    console.log('engine_updates fetch skipped:', e.message);
  }

  try {
    const since = getWeekStart().toISOString();

    const likesResult = await withTimeout(
      supabase.from('likes').select('id, game_id, created_at').gte('created_at', since),
      4000
    );
    const commentsResult = await withTimeout(
      supabase.from('comments').select('id, game_id, created_at').gte('created_at', since),
      4000
    );
    const gamesResult = await withTimeout(
      supabase.from('games').select('id, slug, title, author_id, author_name'),
      4000
    );

    const likes = likesResult.data || [];
    const comments = commentsResult.data || [];
    const games = gamesResult.data || [];

    const gameMap = {};
    games.forEach(g => { gameMap[g.id] = g; });

    const likeCounts = {};
    likes.forEach(l => {
      likeCounts[l.game_id] = (likeCounts[l.game_id] || 0) + 1;
    });

    const commentCounts = {};
    comments.forEach(c => {
      commentCounts[c.game_id] = (commentCounts[c.game_id] || 0) + 1;
    });

    const topGames = Object.keys(likeCounts)
      .map(id => ({ game: gameMap[id], likes: likeCounts[id], comments: commentCounts[id] || 0 }))
      .filter(x => x.game)
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 5);

    if (topGames.length > 0) {
      notifications.push({
        uniqueId: 'leaderboard-' + getWeekStart().toISOString(),
        title: '🏆 Weekly Leaderboard',
        content: 'Top games this week:',
        created_at: getWeekStart().toISOString(),
        kind: 'leaderboard',
        leaderboardData: topGames
      });
    }
  } catch (e) {
    console.log('Leaderboard fetch skipped:', e.message);
  }

  try {
    const sessionResult = await withTimeout(supabase.auth.getSession(), 4000);
    const user = sessionResult.data && sessionResult.data.session ? sessionResult.data.session.user : null;

    if (user) {
      const gamesResult = await withTimeout(
        supabase.from('games').select('id, author_id').eq('author_id', user.id),
        4000
      );
      const myGames = gamesResult.data || [];

      if (myGames.length > 0) {
        const myIds = myGames.map(g => g.id);

        const likesResult = await withTimeout(
          supabase.from('likes').select('game_id').in('game_id', myIds),
          4000
        );
        const commentsResult = await withTimeout(
          supabase.from('comments').select('game_id').in('game_id', myIds),
          4000
        );

        const myLikes = (likesResult.data || []).length;
        const myComments = (commentsResult.data || []).length;

        notifications.push({
          uniqueId: 'mystats-' + getWeekStart().toISOString(),
          title: '📊 Your Stats',
          content: 'You have ' + myGames.length + ' game' + (myGames.length === 1 ? '' : 's') + ' published.\n' +
                   'All-time: ♥ ' + myLikes + ' likes · 💬 ' + myComments + ' comments',
          created_at: new Date().toISOString(),
          kind: 'stats'
        });
      }
    }
  } catch (e) {
    console.log('Stats fetch skipped:', e.message);
  }

  notifications.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  const readIds = JSON.parse(localStorage.getItem('limn_read_notifications') || '[]');
  let currentFilter = '';

  function markAllAsRead() {
    notifications.forEach(item => {
      if (readIds.indexOf(item.uniqueId) === -1) readIds.push(item.uniqueId);
    });
    localStorage.setItem('limn_read_notifications', JSON.stringify(readIds));
    renderList(currentFilter);
  }

  function renderList(filterQuery) {
    filterQuery = filterQuery || '';
    currentFilter = filterQuery;
    container.innerHTML = '';

    const q = filterQuery.toLowerCase();
    const filtered = notifications.filter(item => {
      const title = String(item.title || '').toLowerCase();
      const content = String(item.content || '').toLowerCase();
      return !q || title.indexOf(q) !== -1 || content.indexOf(q) !== -1;
    });

    const unreadCount = notifications.filter(item => readIds.indexOf(item.uniqueId) === -1).length;

    if (unreadCount > 0) {
      const markAllDiv = document.createElement('div');
      markAllDiv.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:16px;';
      const markAllBtn = document.createElement('button');
      markAllBtn.textContent = '✓ Mark all as read (' + unreadCount + ')';
      markAllBtn.style.cssText = 'background:var(--accent);color:#fff;border:none;border-radius:20px;padding:8px 18px;font-size:0.9rem;font-weight:600;cursor:pointer;';
      markAllBtn.addEventListener('click', markAllAsRead);
      markAllDiv.appendChild(markAllBtn);
      container.appendChild(markAllDiv);
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:24px;text-align:center;color:var(--muted);margin-bottom:16px;';
      empty.textContent = q ? 'No matching notifications.' : 'No notifications yet.';
      container.appendChild(empty);
      appendFooter();
      return;
    }

    filtered.forEach(item => {
      const isRead = readIds.indexOf(item.uniqueId) !== -1;
      const dateFormatted = new Date(item.created_at || Date.now()).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });

      const title = item.title || 'Update';
      const content = item.content || '';

      const card = document.createElement('div');
      card.style.cssText = 'background:' + (isRead ? 'var(--surface)' : 'rgba(255,99,140,0.04)') +
        ';border:1.5px solid ' + (isRead ? 'var(--border)' : 'var(--accent)') +
        ';border-radius:14px;padding:24px;cursor:pointer;margin-bottom:16px;';

      const unreadDot = isRead ? '' :
        '<span style="height:10px;width:10px;background-color:var(--accent);border-radius:50%;display:inline-block;margin-right:8px;"></span>';

      let extraHtml = '';
      if (item.kind === 'leaderboard' && item.leaderboardData) {
        extraHtml = '<div style="margin-top:16px;display:flex;flex-direction:column;gap:8px;">' +
          item.leaderboardData.map((x, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '#' + (i + 1);
            return '<a href="/arcade/game.html?slug=' + encodeURIComponent(x.game.slug) +
              '" style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;text-decoration:none;color:inherit;">' +
              '<span style="font-weight:700;min-width:32px;">' + medal + '</span>' +
              '<span style="flex:1;font-weight:600;color:#fff;">' + x.game.title + '</span>' +
              '<span style="color:var(--accent);">♥ ' + x.likes + '</span>' +
              '<span style="color:var(--muted);">💬 ' + x.comments + '</span>' +
            '</a>';
          }).join('') +
        '</div>';
      }

      card.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1.5px solid rgba(255,99,140,0.1);padding-bottom:10px;">' +
          '<h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#fff;">' + unreadDot + title + '</h3>' +
          '<span style="font-size:0.8rem;color:var(--accent2);padding:4px 10px;border-radius:20px;border:1px solid rgba(127,255,178,0.2);">' + dateFormatted + '</span>' +
        '</div>' +
        '<div style="font-size:0.95rem;color:var(--text);line-height:1.6;white-space:pre-wrap;">' + content + '</div>' +
        extraHtml;

      if (!isRead) {
        card.addEventListener('click', () => {
          if (readIds.indexOf(item.uniqueId) === -1) {
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
    const footer = document.createElement('div');
    footer.style.cssText = 'background:var(--surface);border:1.5px solid var(--accent2);border-radius:14px;padding:20px;text-align:center;margin-top:20px;';
    footer.innerHTML =
      '<p style="margin:0 0 10px 0;font-size:0.95rem;color:var(--text);">💬 Join us on Discord: <a href="https://discord.gg/kVpSmYWXr" target="_blank" style="color:var(--accent);">discord.gg/kVpSmYWXr</a></p>' +
      '<p style="margin:0;font-size:0.95rem;color:var(--text);">Need help? <a href="mailto:evolvedtech004@gmail.com" style="color:var(--accent2);">evolvedtech004@gmail.com</a></p>';
    container.appendChild(footer);
  }

  renderList('');

  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', e => renderList(e.target.value));
  }
}

loadInbox();
