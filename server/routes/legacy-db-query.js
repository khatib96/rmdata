'use strict';

function registerLegacyDbQueryRoute(app, deps) {
  const {
    requireAuth,
    assertDbQueryAllowed,
    sqliteToMysql,
    normalizeSqlParams,
    dbAll,
    dbRun,
    assertDbQueryMutationAuthorized,
    handlePermissionMutationSideEffects,
    broadcastDataChange,
  } = deps;

  app.post('/api/db/query', requireAuth, async (req, res) => {
    try {
      const { query, params } = req.body || {};
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing query' });
      }
      assertDbQueryAllowed(query);
      const mysqlQuery = sqliteToMysql(query);
      const args = Array.isArray(params) ? normalizeSqlParams(params) : [];
      const trimmed = mysqlQuery.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH');

      if (isSelect) {
        try {
          const rows = await dbAll(mysqlQuery, args);
          res.json({ success: true, data: rows || [] });
        } catch (err) {
          console.error('Query error:', err);
          res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }

      try {
        await assertDbQueryMutationAuthorized(trimmed, mysqlQuery, req.authSession.userId);
        const result = await dbRun(mysqlQuery, args);
        await handlePermissionMutationSideEffects(mysqlQuery, trimmed, req.authSession.userId);
        const resource = (mysqlQuery.match(/\b(?:INTO|UPDATE|FROM)\s+(\w+)/i) || [])[1] || 'unknown';
        const event = trimmed.startsWith('INSERT') ? 'created' : trimmed.startsWith('DELETE') ? 'deleted' : 'updated';
        broadcastDataChange(event, resource, result.lastID || null);
        res.json({
          success: true,
          data: [],
          lastInsertId: trimmed.startsWith('INSERT') ? (result.lastID || null) : undefined,
          changes: result.changes,
        });
      } catch (err) {
        console.error('Query error:', err);
        res.json({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    } catch (e) {
      const code = e && typeof e === 'object' && 'code' in e && e.code === 'FORBIDDEN' ? 'FORBIDDEN' : null;
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(403).json({ success: false, error: code || msg });
    }
  });
}

module.exports = { registerLegacyDbQueryRoute };
