import {
  getActiveClusterServer,
  loadClusterStateFromCloud,
  setNoStoreHeaders
} from './_clusterStore';

export default async function handler(req: any, res: any) {
  setNoStoreHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const cluster = await loadClusterStateFromCloud(false);
  const activeSrv = getActiveClusterServer(cluster);

  return res.status(200).json({
    success: true,
    config: {
      gasWebAppUrl:
        process.env.GAS_WEB_APP_URL ||
        'https://script.google.com/macros/s/AKfycbzfsNc4kKa3jcyeC646qmVWhaCyvJKWMlGwvcRRJeDLqaTS61bIIteWEYvVb_Gk_Q/exec',
      databaseMode: 'gas',
      supabaseUrl: activeSrv ? activeSrv.supabaseUrl : '',
      supabaseKey: activeSrv ? activeSrv.supabaseKey : '',
      activeServerId: cluster.activeServerId,
      activeServerPaused: !activeSrv,
      clusterRevision: cluster.clusterRevision
    }
  });
}
