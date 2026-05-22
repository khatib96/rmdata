/**
 * Express middleware: require module.action after requireAuth (Phase 0.8).
 * Emergency: RMDATA_DISABLE_API_PERMISSIONS=1 skips checks (ops only).
 */
'use strict';

const { hasPermission } = require('./permissions-resolver.js');

function requirePermission(module, action) {
  return async (req, res, next) => {
    if (process.env.RMDATA_DISABLE_API_PERMISSIONS === '1') {
      return next();
    }
    try {
      const userId = req.authSession?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      }
      const ok = await hasPermission(userId, module, action);
      if (!ok) {
        return res.status(403).json({ success: false, error: 'FORBIDDEN' });
      }
      next();
    } catch (e) {
      console.error('requirePermission:', e);
      return res.status(500).json({ success: false, error: 'PERMISSION_CHECK_FAILED' });
    }
  };
}

function requireAnyPermission(candidates) {
  return async (req, res, next) => {
    if (process.env.RMDATA_DISABLE_API_PERMISSIONS === '1') {
      return next();
    }
    try {
      const userId = req.authSession?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      }
      for (const [module, action] of candidates || []) {
        if (await hasPermission(userId, module, action)) {
          return next();
        }
      }
      return res.status(403).json({ success: false, error: 'FORBIDDEN' });
    } catch (e) {
      console.error('requireAnyPermission:', e);
      return res.status(500).json({ success: false, error: 'PERMISSION_CHECK_FAILED' });
    }
  };
}

module.exports = { requirePermission, requireAnyPermission };
