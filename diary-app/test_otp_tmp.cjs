const cloudbase = require('@cloudbase/js-sdk').default ?? require('@cloudbase/js-sdk');
const app = cloudbase.init({ env: 'possible-wildebeest-d1br6c84180b', region: 'ap-shanghai' });
const auth = app.auth();
(async () => {
  const res = await auth.signInWithOtp({ email: 'jide-test-probe@outlook.com', options: { shouldCreateUser: true } });
  console.log(JSON.stringify(res, null, 2).slice(0, 4000));
})().catch(e => { console.log('THROWN:', e.message, e.code || '', e.stack?.split('\n')[1] || ''); });
