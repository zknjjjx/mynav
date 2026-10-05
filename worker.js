/* ============================================================
 * MyNav - 个人导航站 (Cloudflare Workers 单文件版)
 * 功能：公开导航 + 密码保护的私密卡片 + 后台管理页
 * 数据存储：Workers KV (namespace 绑定名为 NAV_KV)
 * 环境变量：ADMIN_SECRET (会话签名密钥，建议设置随机字符串)
 * ============================================================ */

const enc = new TextEncoder();

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken(secret, kind, ttlSec) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = await hmacHex(secret, kind + ':' + exp);
  return kind + '.' + exp + '.' + sig;
}

async function checkToken(secret, kind, token) {
  if (!token) return false;
  const p = token.split('.');
  if (p.length !== 3 || p[0] !== kind) return false;
  const exp = parseInt(p[1], 10);
  if (!exp || exp < Math.floor(Date.now() / 1000)) return false;
  const sig = await hmacHex(secret, kind + ':' + exp);
  return sig === p[2];
}

function getCookies(req) {
  const c = {};
  const h = req.headers.get('Cookie') || '';
  h.split(';').forEach(kv => {
    const i = kv.indexOf('=');
    if (i > 0) c[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  });
  return c;
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {})
  });
}

function setCookie(name, value, maxAge) {
  return name + '=' + value + '; Path=/; Max-Age=' + maxAge + '; HttpOnly; SameSite=Lax; Secure';
}

/* ---------------- 默认配置（KV 为空时播种） ---------------- */
async function defaultConfig() {
  return {
    title: '我的导航',
    categories: [
      { id: 'home', name: 'Home' },
      { id: 'ai', name: 'Ai-stuff' },
      { id: 'cloud', name: 'Cloud' },
      { id: 'container', name: 'Container' },
      { id: 'gameserver', name: 'Game Server' },
      { id: 'software', name: 'Software' },
      { id: 'proxy', name: 'Proxy' },
      { id: 'macos', name: 'Macos' },
      { id: 'tools', name: 'Tools' },
      { id: 'freesms', name: 'Free SMS' },
      { id: 'other', name: 'Other' },
      { id: 'maildomain', name: 'Mail & Domain' },
      { id: 'dev', name: 'Dev' },
      { id: 'zhongzhuan', name: '中转站' }
    ],
    links: [
      { id: 'l1', cat: 'home', name: 'Notification', url: 'https://notification.eooce.xx.kg', desc: '通知管理系统' },
      { id: 'l2', cat: 'home', name: 'Youtube', url: 'https://www.youtube.com', desc: '全球最大的视频社区' },
      { id: 'l3', cat: 'home', name: 'Gmail', url: 'https://mail.google.com', desc: '' },
      { id: 'l4', cat: 'home', name: 'GitHub', url: 'https://github.com', desc: '全球最大的代码托管平台' },
      { id: 'l5', cat: 'home', name: 'ip.sb', url: 'https://ip.ssss.nyc.mn', desc: 'ip地址查询' },
      { id: 'l6', cat: 'home', name: 'Cloudflare', url: 'https://dash.cloudflare.com', desc: '全球最大的cdn服务商' },
      { id: 'l7', cat: 'home', name: '自动访问系统', url: 'https://matte.ct8.pl', desc: '自动访问系统' },
      { id: 'l8', cat: 'home', name: 'Huggingface', url: 'https://huggingface.co', desc: '全球最大的开源模型托管平台' },
      { id: 'l9', cat: 'home', name: 'ITDOG - 在线ping', url: 'https://www.itdog.cn/tcping', desc: '在线tcping' },
      { id: 'l10', cat: 'home', name: 'Ping0', url: 'https://ping0.cc', desc: 'ip地址查询' },
      { id: 'l11', cat: 'home', name: '浏览器指纹', url: 'https://www.browserscan.net/zh', desc: '浏览器指纹查询' },
      { id: 'l12', cat: 'home', name: 'nezha面板', url: 'https://ssss.nyc.mn', desc: 'nezha面板' },
      { id: 'l13', cat: 'home', name: 'Api测试', url: 'https://hoppscotch.io', desc: '在线api测试工具' },
      { id: 'l14', cat: 'home', name: '域名检查', url: 'https://who.cx', desc: '域名可用性查询' },
      { id: 'l15', cat: 'home', name: '域名比价', url: 'https://www.nazhumi.com', desc: '域名价格比较' },
      { id: 'l16', cat: 'home', name: 'NodeSeek', url: 'https://www.nodeseek.com', desc: '主机论坛' },
      { id: 'l17', cat: 'home', name: 'Linux do', url: 'https://linux.do', desc: '新的理想型社区' },
      { id: 'l18', cat: 'home', name: '在线音乐', url: 'https://music.eooce.com', desc: '在线音乐' },
      { id: 'l19', cat: 'home', name: 'Nodeloc', url: 'https://www.nodeloc.com', desc: 'Nodeloc论坛' },
      { id: 'l20', cat: 'home', name: 'Moontv', url: 'https://moontv.cfapps.jp10.hana.ondemand.com', desc: 'Moontv' },
      { id: 'l21', cat: 'home', name: '订阅转换', url: 'https://sublink.eooce.com', desc: '最好用的订阅转换工具' },
      { id: 'l22', cat: 'home', name: 'webssh', url: 'https://ssh.eooce.com', desc: '最好用的webssh终端管理工具' },
      { id: 'l23', cat: 'home', name: '文件快递柜', url: 'https://filebox.nnuu.nyc.mn', desc: '文件输出分享' },
      { id: 'l24', cat: 'home', name: '真实地址生成', url: 'https://address.nnuu.nyc.mn', desc: '基于当前ip生成真实的地址' },
      { id: 'l25', cat: 'ai', name: 'ChatGPT', url: 'https://chat.openai.com', desc: 'OpenAI官方AI对话' },
      { id: 'l26', cat: 'ai', name: 'Claude', url: 'https://claude.ai', desc: 'Anthropic Claude AI' },
      { id: 'l27', cat: 'ai', name: 'Deepseek', url: 'https://www.deepseek.com', desc: 'Deepseek AI搜索' },
      { id: 'l28', cat: 'ai', name: 'Google Gemini', url: 'https://gemini.google.com', desc: 'Google Gemini大模型' },
      { id: 'l29', cat: 'ai', name: '阿里千问', url: 'https://chat.qwenlm.ai', desc: '阿里云千问大模型' },
      { id: 'l30', cat: 'ai', name: 'Kimi', url: 'https://www.kimi.com', desc: '月之暗面Moonshot AI' },
      { id: 'l31', cat: 'ai', name: '问小白', url: 'https://www.wenxiaobai.com/chat', desc: 'Deepseek三方平台' },
      { id: 'l32', cat: 'ai', name: 'Genspark', url: 'https://www.genspark.ai/agents?type=moa_chat', desc: '' },
      { id: 'l33', cat: 'ai', name: 'AkashChat', url: 'https://chat.akash.network', desc: '' },
      { id: 'l34', cat: 'ai', name: 'V0', url: 'https://v0.dev/chat', desc: 'Vercel旗下前端Ai编程工具' },
      { id: 'l35', cat: 'ai', name: 'Same', url: 'https://same.new', desc: 'Ai快速仿站' },
      { id: 'l36', cat: 'ai', name: '响指HaiSnap', url: 'https://www.haisnap.com', desc: '人人都能创造的AI零代码应用平台' },
      { id: 'l37', cat: 'ai', name: 'Readdy', url: 'https://readdy.ai', desc: '' },
      { id: 'l38', cat: 'ai', name: 'Openrouter', url: 'https://openrouter.ai', desc: '开放api平台' },
      { id: 'l39', cat: 'ai', name: 'Manus', url: 'https://manus.im', desc: '全场景Ai Agent' },
      { id: 'l40', cat: 'ai', name: 'Perplexity', url: 'https://www.perplexity.ai', desc: '' },
      { id: 'l41', cat: 'ai', name: 'Grok', url: 'https://grok.com', desc: '马斯克出品的Ai' },
      { id: 'l42', cat: 'ai', name: 'Copilot', url: 'https://copilot.microsoft.com', desc: '微软旗下Ai' },
      { id: 'l43', cat: 'ai', name: '豆包', url: 'https://www.doubao.com/chat/', desc: '字节旗下ai智能助手' },
      { id: 'l44', cat: 'ai', name: '文心一言', url: 'https://yiyan.baidu.com', desc: '百度旗下ai聊天助手' },
      { id: 'l45', cat: 'ai', name: 'Jules', url: 'https://jules.google.com', desc: 'Google旗下ai管理github项目' },
      { id: 'l46', cat: 'ai', name: '硅基流动', url: 'https://cloud.siliconflow.cn', desc: '免费的大模型api平台' },
      { id: 'l47', cat: 'ai', name: 'Kilo Code', url: 'https://www.kilocode.ai', desc: '亚马逊旗下ai编程工具' },
      { id: 'l48', cat: 'ai', name: 'Cursor', url: 'https://cursor.com', desc: '目前很受欢迎的ai编程工具' },
      { id: 'l49', cat: 'ai', name: 'Ai一键换脸', url: 'https://imgai.ai/zh', desc: '' },
      { id: 'l50', cat: 'ai', name: 'Aippt', url: 'https://www.aippt.cn', desc: '' },
      { id: 'l51', cat: 'ai', name: 'Ai照片修复', url: 'https://picwish.cn/photo-enhancer', desc: 'Ai照片修复' },
      { id: 'l52', cat: 'ai', name: 'Bolt', url: 'https://bolt.new', desc: 'Ai前端生成' },
      { id: 'l53', cat: 'ai', name: 'Llamacoder', url: 'https://llamacoder.together.ai', desc: 'Ai生成app' },
      { id: 'l54', cat: 'ai', name: 'Codia', url: 'https://codia.ai', desc: '截图转设计图' },
      { id: 'l55', cat: 'cloud', name: '阿里云', url: 'https://www.aliyun.com', desc: '阿里云官网' },
      { id: 'l56', cat: 'cloud', name: '腾讯云', url: 'https://console.tencentcloud.com', desc: '腾讯云国际版官网' },
      { id: 'l57', cat: 'cloud', name: '甲骨文云', url: 'https://cloud.oracle.com', desc: 'Oracle Cloud提供永久免费的4核24g云服务器' },
      { id: 'l58', cat: 'cloud', name: '亚马逊云', url: 'https://aws.amazon.com', desc: 'Amazon AWS提供免费1年的vps' },
      { id: 'l59', cat: 'cloud', name: 'DigitalOcean', url: 'https://www.digitalocean.com', desc: 'DigitalOcean提供免费2个月的vps' },
      { id: 'l60', cat: 'cloud', name: 'Vultr', url: 'https://www.vultr.com', desc: 'Vultr提供免费1年的vps' },
      { id: 'l61', cat: 'cloud', name: '谷歌云', url: 'https://cloud.google.com', desc: 'Google云提供免费3个月的vps' },
      { id: 'l62', cat: 'cloud', name: 'Azure', url: 'https://azure.microsoft.com/zh-cn/free/', desc: '微软提供免费1年的vps' },
      { id: 'l63', cat: 'cloud', name: 'Linode', url: 'https://www.linode.com', desc: '免费2个月(易风控)' },
      { id: 'l64', cat: 'cloud', name: 'Cloudcone', url: 'https://app.cloudcone.com', desc: '10$每年的廉价vps' },
      { id: 'l65', cat: 'cloud', name: 'Dartnode', url: 'https://dartnode.com', desc: '开源项目可申请的永久免费vps' },
      { id: 'l66', cat: 'cloud', name: 'DMIT', url: 'https://www.dmit.io', desc: '优质vps线路' },
      { id: 'l67', cat: 'cloud', name: 'Bandwagonhost', url: 'https://bandwagonhost.com', desc: 'CN2-GIA优质线路' },
      { id: 'l68', cat: 'cloud', name: 'Racknerd', url: 'https://my.racknerd.com', desc: '10$每年的廉价vps' },
      { id: 'l69', cat: 'cloud', name: 'Atlantic', url: 'https://cloud.atlantic.net/', desc: '免费1年的vps(易风控)' },
      { id: 'l70', cat: 'cloud', name: 'Lightnode', url: 'https://www.lightnode.com', desc: '冷门区域vps' },
      { id: 'l71', cat: 'cloud', name: 'ishosting', url: 'https://www.ishosting.com', desc: '地区多的vps' },
      { id: 'l72', cat: 'cloud', name: 'Diylink', url: 'https://console.diylink.net', desc: '套壳google和aws的vps' },
      { id: 'l73', cat: 'cloud', name: 'IBM', url: 'https://linuxone.cloud.marist.edu', desc: '免费4个月vps(需住宅ip注册)' },
      { id: 'l74', cat: 'cloud', name: 'Sharon', url: 'https://whmcs.sharon.io', desc: '优质3网优化线路' },
      { id: 'l75', cat: 'cloud', name: 'Alice', url: 'https://alicenetworks.net/', desc: '' },
      { id: 'l76', cat: 'cloud', name: 'Yxvm', url: 'https://yxvm.com', desc: '' },
      { id: 'l77', cat: 'cloud', name: 'Cloudforest', url: 'https://cloud.cloudforest.ro', desc: '罗马尼亚免费1个月vps' },
      { id: 'l78', cat: 'cloud', name: '华为云', url: 'https://huaweicloud.com/', desc: '华为提供永久免费的云开发主机' },
      { id: 'l79', cat: 'container', name: 'Koyeb', url: 'https://app.koyeb.com', desc: '免费容器(注册需干净的ip，无需绑卡)' },
      { id: 'l80', cat: 'container', name: 'Render', url: 'https://dashboard.render.com', desc: '免费容器(注册需干净的ip，无需绑卡)' },
      { id: 'l81', cat: 'container', name: 'Fly', url: 'https://fly.io', desc: '免费容器(注册需绑卡)' },
      { id: 'l82', cat: 'container', name: 'Northflank', url: 'https://app.northflank.com', desc: '免费容器(注册需绑卡)' },
      { id: 'l83', cat: 'container', name: 'Choreo', url: 'https://console.choreo.dev', desc: '免费容器(无需绑卡)' },
      { id: 'l84', cat: 'container', name: 'Railway', url: 'https://railway.com', desc: '免费1个月容器(注册需干净的ip，无需绑卡，到期可注销后重复注册)' },
      { id: 'l85', cat: 'container', name: 'Galaxycloud', url: 'https://beta.galaxycloud.app', desc: '免费容器(无需绑卡)' },
      { id: 'l86', cat: 'container', name: 'Azure容器', url: 'https://azure.microsoft.com/en-us/pricing/offers/ms-azr-0144p', desc: '微软免费容器(可以创建10个，az200或edu邮箱注册)' },
      { id: 'l87', cat: 'container', name: 'Codered', url: 'https://app.codered.cloud', desc: '免费Django框架容器(需isp环境注册)' },
      { id: 'l88', cat: 'container', name: 'Shuttle', url: 'https://console.shuttle.dev', desc: '免费的rust容器' },
      { id: 'l89', cat: 'container', name: 'Serv00', url: 'https://www.serv00.com', desc: '免费的波兰容器(目前已停止注册)' },
      { id: 'l90', cat: 'container', name: 'CT8', url: 'https://www.ct8.pl', desc: 'Serv00同款(不定期开放注册)' },
      { id: 'l91', cat: 'container', name: 'Claw', url: 'https://console.run.claw.cloud/signin?link=FZHSTH7HEBTU', desc: '免费容器(半年以上的github账户每月免费5$)' },
      { id: 'l92', cat: 'container', name: 'Cloudcat', url: 'https://cloud.cloudcat.one', desc: 'Claw同款免费容器(每月免费5$)' },
      { id: 'l93', cat: 'container', name: 'Huggingface', url: 'https://huggingface.co', desc: '开源模型社区(免费的space)' },
      { id: 'l94', cat: 'container', name: 'Alwaysdata', url: 'https://admin.alwaysdata.com', desc: '免费容器(干净ip注册免绑卡)' },
      { id: 'l95', cat: 'container', name: 'Vercel', url: 'https://vercel.com/dashboard', desc: '免费静态网页托管' },
      { id: 'l96', cat: 'container', name: 'Netlify', url: 'https://www.netlify.com', desc: '免费静态网页托管' },
      { id: 'l97', cat: 'container', name: 'Modal', url: 'https://modal.com', desc: '每月免费5$(风控严格)' },
      { id: 'l98', cat: 'container', name: 'Scalingo', url: 'https://scalingo.com', desc: '法国家宽容器(风控严格)' },
      { id: 'l99', cat: 'container', name: 'Sevalla', url: 'https://app.sevalla.com', desc: '绑卡免费10个月(风控严格)' },
      { id: 'l100', cat: 'container', name: 'Phala', url: 'https://cloud.phala.network', desc: '免费400$(可用10个月)' },
      { id: 'l101', cat: 'container', name: 'Wasmer', url: 'https://wasmer.io', desc: '免费静态网页托管' },
      { id: 'l102', cat: 'container', name: 'Appwrite', url: 'https://cloud.appwrite.io/console', desc: '免费多地区' },
      { id: 'l103', cat: 'container', name: 'SAP企业版', url: 'https://emea.cockpit.btp.cloud.sap/cockpit/#', desc: 'SAP企业版登录入口' },
      { id: 'l104', cat: 'container', name: 'SAP试用版', url: 'https://account.hanatrial.ondemand.com/trial/#/home/trial', desc: 'SAP试用版登录入口' },
      { id: 'l105', cat: 'container', name: 'Leaflow', url: 'https://www.leafaas.com/dashboard', desc: 'docker容器平台' },
      { id: 'l106', cat: 'container', name: 'Zeabur', url: 'https://dash.zeabur.com/projects', desc: '' },
      { id: 'l107', cat: 'container', name: 'Databricks', url: 'https://www.databricks.com', desc: '' },
      { id: 'l108', cat: 'container', name: 'idx', url: 'https://idx.google.com', desc: 'Google IDX' },
      { id: 'l109', cat: 'gameserver', name: 'Adkynet', url: 'https://manager.adkynet.com', desc: '稳定的node/java/python容器(1月1续)' },
      { id: 'l110', cat: 'gameserver', name: 'Daki', url: 'https://dash.daki.cc/', desc: '游戏机' },
      { id: 'l111', cat: 'gameserver', name: 'Crosmo', url: 'https://host.crosmo.de', desc: '游戏机' },
      { id: 'l112', cat: 'gameserver', name: 'Flexynode', url: 'https://flexynode.com', desc: '64M nodejs/python玩具' },
      { id: 'l113', cat: 'gameserver', name: 'Boxmineworld', url: 'https://dash.boxmineworld.com', desc: '游戏机' },
      { id: 'l114', cat: 'gameserver', name: 'wispbyte', url: 'https://wispbyte.com', desc: '游戏机' },
      { id: 'l115', cat: 'gameserver', name: 'Searcade', url: 'https://searcade.com', desc: '每10天需登录一次' },
      { id: 'l116', cat: 'gameserver', name: 'Echohost', url: 'https://client.echohost.org', desc: '游戏机' },
      { id: 'l117', cat: 'gameserver', name: 'Embotic', url: 'https://dash.embotic.xyz', desc: '游戏机' },
      { id: 'l118', cat: 'gameserver', name: 'Zenix', url: 'https://dash.zenix.sg/dashboard', desc: '' },
      { id: 'l119', cat: 'gameserver', name: 'Waifly', url: 'https://dash.waifly.com', desc: '' },
      { id: 'l120', cat: 'gameserver', name: 'karlo', url: 'https://karlo-hosting.com', desc: '' },
      { id: 'l121', cat: 'gameserver', name: 'solar', url: 'https://account.solarhosting.cc', desc: '' },
      { id: 'l122', cat: 'gameserver', name: 'Berrynodes', url: 'https://dash.berrynodes.com', desc: '' },
      { id: 'l123', cat: 'gameserver', name: 'Spaceify', url: 'https://client.spaceify.eu', desc: '易风控' },
      { id: 'l124', cat: 'gameserver', name: 'Freeserver', url: 'https://dash.freeserver.tw/', desc: '台湾游戏机' },
      { id: 'l125', cat: 'gameserver', name: 'Bot-hosting', url: 'https://bot-hosting.net', desc: '需要赚金币续费' },
      { id: 'l126', cat: 'gameserver', name: 'Atomic', url: 'https://panel.atomicnetworks.co', desc: '稳定多年的游戏机' },
      { id: 'l127', cat: 'gameserver', name: 'Boxmineworld', url: 'https://dash.boxmineworld.com', desc: '稳定的美国游戏机' },
      { id: 'l128', cat: 'gameserver', name: 'Zampto', url: 'https://hosting.zampto.net', desc: '意大利游戏机' },
      { id: 'l129', cat: 'gameserver', name: 'Altare', url: 'https://altare.sh/dashboard', desc: '多地区游戏机' },
      { id: 'l130', cat: 'gameserver', name: 'Skybots', url: 'https://skybots.tech/dashboard/mes-bots', desc: '法国ISPnodejs玩具' },
      { id: 'l131', cat: 'gameserver', name: 'Greathost', url: 'https://greathost.es/dashboard', desc: '' },
      { id: 'l132', cat: 'gameserver', name: 'Lunes', url: 'https://betadash.lunes.host', desc: '' },
      { id: 'l133', cat: 'software', name: 'Hellowindows', url: 'https://hellowindows.cn', desc: 'windows系统及office下载' },
      { id: 'l134', cat: 'software', name: '奇迹秀', url: 'https://www.qijishow.com/down', desc: '设计师的百宝箱' },
      { id: 'l135', cat: 'software', name: '易破解', url: 'https://www.ypojie.com', desc: '精品windows软件' },
      { id: 'l136', cat: 'software', name: 'Cracked Software', url: 'https://topcracked.com', desc: 'windows破解软件' },
      { id: 'l137', cat: 'software', name: 'zTasker', url: 'https://www.everauto.net', desc: '定时|热键|事件|键鼠模拟|操作录制|自动化流程' },
      { id: 'l138', cat: 'software', name: 'incogniton', url: 'https://incogniton.com/zh-hans', desc: '指纹浏览器(10个免费环境)' },
      { id: 'l139', cat: 'software', name: '云萌Win10/11激活', url: 'https://cmwtat.cloudmoe.com/cn.html', desc: 'windows系统激活工具' },
      { id: 'l140', cat: 'software', name: 'Zen-browser', url: 'https://zen-browser.app', desc: '超好用的一款浏览器' },
      { id: 'l141', cat: 'software', name: 'Adspower', url: 'https://activity.adspower.com/ap/dist', desc: '指纹浏览器(3个免费环境)' },
      { id: 'l142', cat: 'software', name: 'Termora', url: 'https://www.termora.app/downloads', desc: '简约好用的SSH软件' },
      { id: 'l143', cat: 'software', name: 'Cherry Studio', url: 'https://www.cherry-ai.com', desc: 'Ai对话客户端' },
      { id: 'l144', cat: 'software', name: 'MusicFree', url: 'https://musicfree.catcat.work', desc: '免费开源的音乐播放器' },
      { id: 'l145', cat: 'software', name: 'LXmusic', url: 'https://lxmusic.toside.cn', desc: '免费开源的音乐播放器' },
      { id: 'l146', cat: 'software', name: 'UU远程', url: 'https://uuyc.163.com', desc: '游戏级远控制(网易出品)' },
      { id: 'l147', cat: 'software', name: 'QtScrcpy', url: 'https://github.com/barry-ran/QtScrcpy/releases/latest', desc: '免费开源的安卓投屏软件' },
      { id: 'l148', cat: 'software', name: '小丸工具箱', url: 'https://maruko.appinn.me', desc: '非常好用的视频音频压缩软件' },
      { id: 'l149', cat: 'software', name: 'Beekeeper studio', url: 'https://www.beekeeperstudio.io', desc: '免费开源的数据库管理软件' },
      { id: 'l150', cat: 'software', name: 'Navicat Premium', url: 'https://pan.baidu.com/s/1HjfAn71Vgp-TeoY755TZOw?pwd=mc73', desc: '头部数据库管理软件(此链接为破解版)' },
      { id: 'l151', cat: 'software', name: 'Geek Uninstaller', url: 'https://geekuninstaller.com/download', desc: '小巧轻便的卸载软件' },
      { id: 'l152', cat: 'software', name: 'Pixpin', url: 'https://pixpin.cn', desc: '非常不错的截图软件' },
      { id: 'l153', cat: 'software', name: 'Mem Reduct', url: 'https://github.com/henrypp/memreduct/releases/latest', desc: '内存自动清理' },
      { id: 'l154', cat: 'software', name: 'phpstudy', url: 'https://www.xp.cn/phpstudy', desc: '本地服务器环境管理' },
      { id: 'l155', cat: 'software', name: 'Requestly', url: 'https://requestly.com', desc: 'api测试/抓包' },
      { id: 'l156', cat: 'software', name: 'Raylink', url: 'https://www.raylink.live', desc: '远程控制' },
      { id: 'l157', cat: 'proxy', name: 'V2rayN', url: 'https://v2rayn.2dust.link', desc: '最受欢迎的代理软件(支持多平台)' },
      { id: 'l158', cat: 'proxy', name: 'Mihomo Party', url: 'https://mihomo.party', desc: 'Mihomo内核最受欢迎的代理软件' },
      { id: 'l159', cat: 'proxy', name: 'GUI.for.SingBox', url: 'https://github.com/GUI-for-Cores/GUI.for.SingBox/releases/latest', desc: '第三方开源sing-box代理工具' },
      { id: 'l160', cat: 'proxy', name: 'FlClash', url: 'https://github.com/chen08209/FlClash/releases/latest', desc: 'Clash系列人气代理软件' },
      { id: 'l161', cat: 'proxy', name: 'Karing', url: 'https://karing.app/download', desc: '新一代全能型代理软件(适配多系统)' },
      { id: 'l162', cat: 'proxy', name: 'Nekobox', url: 'https://nekobox.tools/nekoray', desc: 'windows版本已停止为维护,谨慎使用' },
      { id: 'l163', cat: 'proxy', name: 'FlyClash', url: 'https://github.com/GtxFury/FlyClash/releases/latest', desc: 'Mihomo内核新一代代理软件' },
      { id: 'l164', cat: 'proxy', name: 'ClashBox', url: 'https://github.com/xiaobaigroup/ClashBox', desc: 'HarmonyOS NEXT的代理软件' },
      { id: 'l165', cat: 'proxy', name: 'GUI.for.Clash', url: 'https://github.com/GUI-for-Cores/GUI.for.Clash/releases/latest', desc: '' },
      { id: 'l166', cat: 'macos', name: 'Macwk', url: 'https://www.macwk.com', desc: '多年mac软件老站，精品Mac软件' },
      { id: 'l167', cat: 'macos', name: 'Macsc', url: 'https://mac.macsc.com', desc: '精品Mac软件' },
      { id: 'l168', cat: 'tools', name: 'Argo Tunnel json获取', url: 'https://json.zone.id', desc: 'cloudflared argo tunnel固定隧道json获取' },
      { id: 'l169', cat: 'tools', name: 'base64工具', url: 'https://www.qqxiuzi.cn/bianma/base64.htm', desc: '在线base64编码解码' },
      { id: 'l170', cat: 'tools', name: '二维码生成', url: 'https://cli.im', desc: '二维码生成工具' },
      { id: 'l171', cat: 'tools', name: 'JS / PY / Shell混淆综合站', url: 'https://eooce.dev', desc: '在线Javascript代码混淆' },
      { id: 'l172', cat: 'tools', name: 'Python混淆', url: 'https://obf.eooce.com', desc: '在线python代码混淆' },
      { id: 'l173', cat: 'tools', name: 'Remove.photos', url: 'https://remove.photos/zh-cn', desc: '一键抠图' },
      { id: 'l174', cat: 'tools', name: 'Pagespeed', url: 'https://pagespeed.web.dev', desc: '' },
      { id: 'l175', cat: 'tools', name: '自动访问', url: 'https://matte.ct8.pl', desc: '自动访问保活管理系统' },
      { id: 'l176', cat: 'tools', name: 'Cron-job', url: 'https://console.cron-job.org/jobs', desc: '定时自动访问网页' },
      { id: 'l177', cat: 'tools', name: '网址缩短', url: 'https://short.ssss.nyc.mn', desc: '' },
      { id: 'l178', cat: 'tools', name: 'Linuxmirrors', url: 'https://linuxmirrors.cn', desc: '' },
      { id: 'l179', cat: 'tools', name: 'Vocalremover', url: 'https://vocalremover.org/', desc: '声音分离' },
      { id: 'l180', cat: 'tools', name: 'JSON工具', url: 'https://www.json.cn', desc: 'JSON格式化/校验' },
      { id: 'l181', cat: 'tools', name: '文件格式转换', url: 'https://convertio.co/zh', desc: '超300种文件格式转换' },
      { id: 'l182', cat: 'tools', name: '视频在线下载', url: 'https://tubedown.cn/youtube', desc: '在线视频解析下载' },
      { id: 'l183', cat: 'tools', name: 'it tools', url: 'https://it.idev.dev', desc: '集合多种小工具' },
      { id: 'l184', cat: 'tools', name: 'emoji大全', url: 'https://www.iamwawa.cn/emoji.html', desc: '各类目emoji' },
      { id: 'l185', cat: 'tools', name: '信用卡生成', url: 'https://bincheck.io/zh/credit-card-generator', desc: '信用卡生成器' },
      { id: 'l186', cat: 'tools', name: 'Squoosh', url: 'https://squoosh.app', desc: '图片无损压缩' },
      { id: 'l187', cat: 'tools', name: 'Tool', url: 'https://tool.lu/', desc: '小工具' },
      { id: 'l188', cat: 'tools', name: 'D1tools', url: 'https://d1tools.com', desc: '' },
      { id: 'l189', cat: 'tools', name: 'Lumiproxy', url: 'https://www.lumiproxy.com/zh-hans/online-proxy/proxysite', desc: '在线网页住宅代理' },
      { id: 'l190', cat: 'tools', name: 'Proxyshare', url: 'https://www.proxyshare.com/zh/proxysite', desc: '在线网页住宅代理' },
      { id: 'l191', cat: 'tools', name: 'Dnsleaktest', url: 'https://dnsleaktest.com', desc: 'DNS泄露检测' },
      { id: 'l192', cat: 'tools', name: 'Deobfuscator', url: 'https://dev-coco.github.io/Online-Tools/JavaScript-Deobfuscator.html', desc: 'JS反混淆' },
      { id: 'l193', cat: 'tools', name: 'flexclip', url: 'https://www.flexclip.com/cn/ai/', desc: '' },
      { id: 'l194', cat: 'tools', name: 'shell混淆', url: 'https://zsh.hsk.sk', desc: 'shell混淆' },
      { id: 'l195', cat: 'tools', name: 'Blackace', url: 'https://blackace.app', desc: '网站打包成app' },
      { id: 'l196', cat: 'tools', name: 'PHP混淆加密', url: 'https://www.toolnb.com/tools/phpcarbylamine.html', desc: '' },
      { id: 'l197', cat: 'tools', name: '中文转码', url: 'https://www.bchrt.com/tools/punycode-encoder/', desc: '' },
      { id: 'l198', cat: 'freesms', name: 'smser', url: 'https://smser.net', desc: '' },
      { id: 'l199', cat: 'freesms', name: 'freereceivesms', url: 'https://www.freereceivesms.com', desc: '' },
      { id: 'l200', cat: 'freesms', name: 'sms24', url: 'https://sms24.me/en', desc: '' },
      { id: 'l201', cat: 'freesms', name: 'onlinesim', url: 'https://onlinesim.io/ru/free_numbers', desc: '' },
      { id: 'l202', cat: 'freesms', name: 'smsonline', url: 'https://www.smsonline.cloud/zh', desc: '' },
      { id: 'l203', cat: 'freesms', name: 'receive-sms', url: 'https://wetalkapp.com/receive-sms/', desc: '' },
      { id: 'l204', cat: 'freesms', name: 'supercloudsms', url: 'https://www.supercloudsms.com/country/usa/1.html', desc: '' },
      { id: 'l205', cat: 'freesms', name: 'freephonenum', url: 'https://freephonenum.com', desc: '只有美国和加拿大号码' },
      { id: 'l206', cat: 'freesms', name: 'lubansms', url: 'https://lubansms.com/receiveSms', desc: '' },
      { id: 'l207', cat: 'freesms', name: '7sim', url: 'http://7sim.net', desc: '' },
      { id: 'l208', cat: 'freesms', name: 'receiveasms', url: 'https://www.receiveasms.com/', desc: '' },
      { id: 'l209', cat: 'freesms', name: 'receivesmsonline', url: 'https://www.receivesmsonline.net', desc: '' },
      { id: 'l210', cat: 'freesms', name: 'sms-online', url: 'https://sms-online.co', desc: '' },
      { id: 'l211', cat: 'freesms', name: 'receivefreesms', url: 'https://receivefreesms.net', desc: '' },
      { id: 'l212', cat: 'freesms', name: 'receivesmsonline', url: 'https://receivesmsonline.in/number', desc: '' },
      { id: 'l213', cat: 'freesms', name: 'sms-receive', url: 'https://sms-receive.net', desc: '' },
      { id: 'l214', cat: 'freesms', name: 'jiemahao', url: 'https://jiemahao.com', desc: '接号码' },
      { id: 'l215', cat: 'freesms', name: 'bestsms', url: 'https://bestsms.xyz', desc: '' },
      { id: 'l216', cat: 'freesms', name: 'zusms', url: 'https://www.zusms.com', desc: '有云短信' },
      { id: 'l217', cat: 'freesms', name: 'mytrashmobile', url: 'https://zh.mytrashmobile.com/numbers', desc: '' },
      { id: 'l218', cat: 'freesms', name: 'sms-japan', url: 'https://sms-japan.com', desc: '' },
      { id: 'l219', cat: 'freesms', name: 'online-sim', url: 'https://online-sim.pro/zh', desc: '' },
      { id: 'l220', cat: 'freesms', name: 'temp-number', url: 'https://temp-number.com', desc: '' },
      { id: 'l221', cat: 'freesms', name: 'tiger-sms', url: 'https://tiger-sms.shop/free', desc: '' },
      { id: 'l222', cat: 'freesms', name: 'clearcode', url: 'https://clearcode.cn', desc: '中国号码' },
      { id: 'l223', cat: 'freesms', name: 'tempsmss', url: 'https://tempsmss.com', desc: '' },
      { id: 'l224', cat: 'freesms', name: 'free-numbers', url: 'https://sms-verification-number.com/free-numbers-cn/#activity', desc: '' },
      { id: 'l225', cat: 'freesms', name: 'mianfeijiema', url: 'https://www.mianfeijiema.com', desc: '' },
      { id: 'l226', cat: 'freesms', name: 'receive-smss', url: 'https://receive-smss.com', desc: '' },
      { id: 'l227', cat: 'freesms', name: 'sms-man', url: 'https://sms-man.com/cn/free-numbers', desc: '' },
      { id: 'l228', cat: 'other', name: 'wallpaper', url: 'https://haowallpaper.com', desc: '免费壁纸' },
      { id: 'l229', cat: 'other', name: 'theporndude', url: 'https://theporndude.com/zh', desc: '老司机' },
      { id: 'l230', cat: 'other', name: '星空音乐', url: 'https://www.vh.hk', desc: '星空音乐' },
      { id: 'l231', cat: 'maildomain', name: 'Gmail', url: 'https://mail.google.com', desc: 'Google邮箱' },
      { id: 'l232', cat: 'maildomain', name: 'Outlook', url: 'https://outlook.live.com', desc: '微软Outlook邮箱' },
      { id: 'l233', cat: 'maildomain', name: 'Proton Mail', url: 'https://account.proton.me', desc: '安全加密邮箱' },
      { id: 'l234', cat: 'maildomain', name: '临时域名邮箱', url: 'https://temp-mail.io/zh', desc: '临时域名邮箱' },
      { id: 'l235', cat: 'maildomain', name: '雅虎邮箱', url: 'https://mail.yahoo.com', desc: '雅虎邮箱' },
      { id: 'l236', cat: 'maildomain', name: '10分钟临时邮箱', url: 'https://linshiyouxiang.net', desc: '10分钟临时邮箱' },
      { id: 'l237', cat: 'maildomain', name: '2925无限邮箱', url: 'https://www.2925.com', desc: '' },
      { id: 'l238', cat: 'maildomain', name: '风车临时邮箱', url: 'https://mail.xoxome.online/dashboard', desc: '可长期使用的临时邮箱' },
      { id: 'l239', cat: 'maildomain', name: '88完美邮箱', url: 'https://mail.88.com/mail/#/home', desc: '' },
      { id: 'l240', cat: 'maildomain', name: '临时edu邮箱', url: 'https://tempmail.edu.kg', desc: '' },
      { id: 'l241', cat: 'maildomain', name: 'Tempmail', url: 'https://tempmail.plus/zh/', desc: '' },
      { id: 'l242', cat: 'maildomain', name: '临时邮箱', url: 'https://22.do/zh', desc: '' },
      { id: 'l243', cat: 'maildomain', name: 'nyc.mn域名', url: 'https://dash.publiczone.org/dashboard', desc: '免费二级域名(已取消免费)' },
      { id: 'l244', cat: 'maildomain', name: 'HiDNS', url: 'https://www.hidoha.net', desc: '免费二级域名' },
      { id: 'l245', cat: 'maildomain', name: 'dpdns域名', url: 'https://dash.domain.digitalplat.org', desc: '免费二级域名(dpdns.org/xx.kg/us.kg)' },
      { id: 'l246', cat: 'maildomain', name: 'l53', url: 'https://customer.l53.net', desc: 'ggff.net免费二级域名' },
      { id: 'l247', cat: 'maildomain', name: 'mffac临时邮箱', url: 'https://www.mffac.com/moe', desc: 'mffac临时邮箱' },
      { id: 'l248', cat: 'maildomain', name: 'zabc.net', url: 'https://zabc.net/dashboard', desc: '免费zabc.net二级域名(不可托管cloudflared)' },
      { id: 'l249', cat: 'maildomain', name: 'eu.org', url: 'https://nic.eu.org', desc: '免费eu.org二级域名(已停止注册)' },
      { id: 'l250', cat: 'maildomain', name: 'zone.id', url: 'https://my.zone.id/subdomains', desc: '免费zone.id二级域名(不可托管cloudflared)' },
      { id: 'l251', cat: 'maildomain', name: 'Spaceship', url: 'https://www.spaceship.com', desc: '实惠的域名服务商' },
      { id: 'l252', cat: 'maildomain', name: 'DNSHE', url: 'https://my.dnshe.com/clientarea.php', desc: '永久免费免费域名' },
      { id: 'l253', cat: 'maildomain', name: 'Godaddy', url: 'https://www.godaddy.com', desc: '全球最大的域名服务商(域名较贵)' },
      { id: 'l254', cat: 'maildomain', name: 'Namesilo', url: 'https://www.namesilo.com', desc: '实惠的域名' },
      { id: 'l255', cat: 'maildomain', name: 'netlib.re', url: 'https://www.netlib.re', desc: '永久免费二级域名' },
      { id: 'l256', cat: 'maildomain', name: 'Namecheap', url: 'https://www.namecheap.com', desc: '头部域名服务商' },
      { id: 'l257', cat: 'maildomain', name: 'gv.uy', url: 'https://nic.gv.uy', desc: '永久免费二级域名' },
      { id: 'l258', cat: 'maildomain', name: 'NN.KG', url: 'https://www.idc.lc/', desc: '' },
      { id: 'l259', cat: 'maildomain', name: 'VPS8', url: 'https://vps8.zz.cd', desc: '提供域名托管服务，支持根域名cname' },
      { id: 'l260', cat: 'dev', name: 'igoutu', url: 'https://igoutu.cn/icons', desc: '免费icon图标' },
      { id: 'l261', cat: 'dev', name: 'iconfont', url: 'https://www.iconfont.cn/', desc: '阿里矢量图标库' },
      { id: 'l262', cat: 'dev', name: 'uiverse', url: 'https://uiverse.io/elements', desc: 'UI组件库' },
      { id: 'l263', cat: 'dev', name: 'vueform', url: 'https://vueform.com', desc: 'vue UI组件' },
      { id: 'l264', cat: 'dev', name: 'ghproxy', url: 'https://ghproxy.eooce.xx.kg', desc: 'github加速' },
      { id: 'l265', cat: 'dev', name: 'vitepress', url: 'https://vitejs.cn/vitepress/', desc: 'Markdown生成静态文档站点' },
      { id: 'l266', cat: 'dev', name: 'icon', url: 'https://icon-sets.iconify.design', desc: 'icon图标' },
      { id: 'l267', cat: 'dev', name: '美国免税州地址生成', url: 'https://usaddressgen.com/tax-free-address/', desc: '' },
      { id: 'l268', cat: 'dev', name: '美国各州区号对照表', url: 'https://amon.org/usphone', desc: '' },
      { id: 'l269', cat: 'dev', name: '免费Socks5代理池', url: 'https://proxy.scdn.io', desc: '' },
      { id: 'l270', cat: 'dev', name: 'Gasp', url: 'https://gsap.com', desc: '前端高级动画' },
      { id: 'l271', cat: 'dev', name: 'morphicons', url: 'https://www.morphicons.com', desc: '' },
      { id: 'l272', cat: 'zhongzhuan', name: 'P0', url: 'https://p0.systems', desc: '' },
      { id: 'l273', cat: 'zhongzhuan', name: 'codecraftapi', url: 'https://codecraftapi.com/?ref=CCEHATSE', desc: '' },
      { id: 'l274', cat: 'zhongzhuan', name: 'cline', url: 'https://app.cline.bot', desc: '' },
      { id: 'l275', cat: 'zhongzhuan', name: 'B.AI', url: 'https://chat.b.ai/chat?invite_code=66PHRX', desc: '' },
      { id: 'l276', cat: 'zhongzhuan', name: 'aihubmix', url: 'https://console.aihubmix.com', desc: '' },
      { id: 'l277', cat: 'zhongzhuan', name: 'AMD', url: 'https://developer.amd.com.cn/radeon/tokenfactory', desc: '' },
      { id: 'l278', cat: 'zhongzhuan', name: 'tokenharbor', url: 'https://tokenharbor.ai', desc: '' },
      { id: 'l279', cat: 'zhongzhuan', name: 'claudemix', url: 'https://www.claudemix.com/sign-up?aff=RfMV', desc: '' },
      { id: 'l280', cat: 'zhongzhuan', name: 'Openrouter', url: 'https://nex.sii.edu.cn', desc: '' },
      { id: 'l281', cat: 'zhongzhuan', name: 'sensenova', url: 'https://platform.sensenova.cn', desc: '' },
      { id: 'l282', cat: 'zhongzhuan', name: 'Y-api', url: 'https://y-api.bestvirtualgoods.com', desc: '' },
      { id: 'l283', cat: 'zhongzhuan', name: 'm365', url: 'https://m365.cloud.microsoft', desc: '' },
      { id: 'l284', cat: 'zhongzhuan', name: 'Agnes', url: 'https://platform.agnes-ai.com', desc: '' },
      { id: 'l285', cat: 'zhongzhuan', name: 'freebuff', url: 'https://freebuff.com', desc: '' },
      { id: 'l286', cat: 'zhongzhuan', name: 'freemodel', url: 'https://freemodel.dev/invite/FRE-df23b42e', desc: '' },
      { id: 'l287', cat: 'zhongzhuan', name: 'inceptionlabs', url: 'https://platform.inceptionlabs.ai', desc: '' },
      { id: 'l288', cat: 'zhongzhuan', name: 'bynara', url: 'https://router.bynara.id', desc: '' },
      { id: 'l289', cat: 'zhongzhuan', name: 'NVIDIA', url: 'https://build.nvidia.com/models', desc: '' }
    ],
    privateLinks: [
      { id: 'p1', cat: 'private', name: '示例私密页', url: 'https://example.com', desc: '在后台删掉我，换成你自己的' }
    ],
    auth: {
      // 默认密码：管理 admin123 / 私密 123456，首次登录后请立即修改
      adminHash: await sha256hex('admin123'),
      privateHash: await sha256hex('123456')
    }
  };
}

async function getConfig(env) {
  let cfg = await env.NAV_KV.get('config', 'json');
  if (!cfg) {
    cfg = await defaultConfig();
    await env.NAV_KV.put('config', JSON.stringify(cfg));
  }
  return cfg;
}

function publicConfig(cfg) {
  return { title: cfg.title, categories: cfg.categories, links: cfg.links };
}

/* ---------------- 主入口 ---------------- */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    const secret = env.ADMIN_SECRET || 'please-set-ADMIN_SECRET-env';
    const cookies = getCookies(req);

    // 首页
    if ((path === '/' || path === '/index.html') && req.method === 'GET') {
      return new Response(INDEX_HTML, {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    // 公开配置
    if (path === '/api/config' && req.method === 'GET') {
      const cfg = await getConfig(env);
      return json(publicConfig(cfg));
    }

    // 私密区解锁
    if (path === '/api/private/unlock' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const cfg = await getConfig(env);
      if (await sha256hex(String(body.password || '')) === cfg.auth.privateHash) {
        const tok = await makeToken(secret, 'pv', 12 * 3600);
        return json({ ok: true, links: cfg.privateLinks }, 200,
          { 'Set-Cookie': setCookie('pv', tok, 12 * 3600) });
      }
      return json({ ok: false, msg: '密码错误' }, 401);
    }

    // 私密链接读取（需 cookie）
    if (path === '/api/private' && req.method === 'GET') {
      if (await checkToken(secret, 'pv', cookies.pv)) {
        const cfg = await getConfig(env);
        return json({ links: cfg.privateLinks });
      }
      return json({ ok: false, msg: '未授权' }, 401);
    }

    // 管理登录
    if (path === '/api/admin/login' && req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const cfg = await getConfig(env);
      if (await sha256hex(String(body.password || '')) === cfg.auth.adminHash) {
        const tok = await makeToken(secret, 'adm', 12 * 3600);
        return json({ ok: true }, 200,
          { 'Set-Cookie': setCookie('adm', tok, 12 * 3600) });
      }
      return json({ ok: false, msg: '密码错误' }, 401);
    }

    // 管理登出
    if (path === '/api/admin/logout' && req.method === 'POST') {
      return json({ ok: true }, 200,
        { 'Set-Cookie': setCookie('adm', '', 0) });
    }

    const isAdmin = await checkToken(secret, 'adm', cookies.adm);

    // 管理：读取完整配置
    if (path === '/api/admin/data' && req.method === 'GET') {
      if (!isAdmin) return json({ ok: false, msg: '未授权' }, 401);
      const cfg = await getConfig(env);
      const out = JSON.parse(JSON.stringify(cfg));
      delete out.auth;
      out.usingDefaultSecret = !env.ADMIN_SECRET;
      return json(out);
    }

    // 管理：保存配置（标题/分类/链接/私密链接）
    if (path === '/api/admin/data' && req.method === 'PUT') {
      if (!isAdmin) return json({ ok: false, msg: '未授权' }, 401);
      const body = await req.json().catch(() => null);
      if (!body || !Array.isArray(body.categories) || !Array.isArray(body.links) || !Array.isArray(body.privateLinks)) {
        return json({ ok: false, msg: '数据格式不正确' }, 400);
      }
      const cfg = await getConfig(env);
      cfg.title = String(body.title || '我的导航').slice(0, 60);
      cfg.categories = body.categories.slice(0, 60).map(c => ({
        id: String(c.id || '').slice(0, 32),
        name: String(c.name || '').slice(0, 24)
      })).filter(c => c.id && c.name);
      const cleanLink = l => ({
        id: String(l.id || 'x' + Math.random().toString(36).slice(2, 10)).slice(0, 32),
        cat: String(l.cat || 'home').slice(0, 32),
        name: String(l.name || '').slice(0, 40),
        url: String(l.url || '').slice(0, 500),
        icon: String(l.icon || '').slice(0, 500),
        desc: String(l.desc || '').slice(0, 200)
      });
      cfg.links = body.links.slice(0, 1000).map(cleanLink).filter(l => l.name && l.url);
      cfg.privateLinks = body.privateLinks.slice(0, 1000).map(cleanLink).filter(l => l.name && l.url);
      await env.NAV_KV.put('config', JSON.stringify(cfg));
      return json({ ok: true });
    }

    // 管理：修改密码
    if (path === '/api/admin/password' && req.method === 'POST') {
      if (!isAdmin) return json({ ok: false, msg: '未授权' }, 401);
      const body = await req.json().catch(() => ({}));
      const type = body.type === 'private' ? 'privateHash' : 'adminHash';
      const cfg = await getConfig(env);
      const oldHash = await sha256hex(String(body.oldPassword || ''));
      const curHash = type === 'privateHash' ? cfg.auth.privateHash : cfg.auth.adminHash;
      if (oldHash !== curHash) return json({ ok: false, msg: '原密码不正确' }, 400);
      const np = String(body.newPassword || '');
      if (np.length < 4 || np.length > 64) return json({ ok: false, msg: '新密码长度需在 4~64 位之间' }, 400);
      if (type === 'privateHash') cfg.auth.privateHash = await sha256hex(np);
      else cfg.auth.adminHash = await sha256hex(np);
      await env.NAV_KV.put('config', JSON.stringify(cfg));
      return json({ ok: true });
    }

    return new Response('Not Found', { status: 404 });
  }
};

const INDEX_HTML = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title id="docTitle">我的导航</title>
<link rel="icon" href="https://img.icons8.com/lollipop/100/navigation.png">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--card-bg:rgba(255,255,255,.07);--card-border:rgba(255,255,255,.14);--text:#fff;--dim:rgba(255,255,255,.65);--accent:#4da3ff}
html,body{min-height:100%}
body{font-family:-apple-system,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:var(--text);background:#0b1026;overflow-x:hidden}
.stars{position:fixed;inset:0;z-index:-2;background:radial-gradient(ellipse at 20% 10%,#1b2452 0%,#0b1026 55%,#05070f 100%)}
.stars::before,.stars::after{content:"";position:absolute;inset:0;background-image:radial-gradient(1px 1px at 12% 22%,#fff 100%,transparent 0),radial-gradient(1.5px 1.5px at 68% 8%,#fff 100%,transparent 0),radial-gradient(1px 1px at 84% 34%,#fff 100%,transparent 0),radial-gradient(2px 2px at 42% 66%,#fff 100%,transparent 0),radial-gradient(1px 1px at 8% 78%,#fff 100%,transparent 0),radial-gradient(1.5px 1.5px at 55% 42%,#fff 100%,transparent 0),radial-gradient(1px 1px at 30% 12%,#fff 100%,transparent 0),radial-gradient(1px 1px at 92% 70%,#fff 100%,transparent 0),radial-gradient(2px 2px at 76% 88%,#fff 100%,transparent 0),radial-gradient(1px 1px at 48% 28%,#fff 100%,transparent 0);opacity:.8}
.stars::after{transform:scale(1.6) rotate(8deg);opacity:.5}
.glow{position:fixed;left:-10%;bottom:-30%;width:60%;height:60%;z-index:-1;background:radial-gradient(ellipse,rgba(255,140,60,.28),transparent 65%);pointer-events:none}
header.topnav{position:sticky;top:0;z-index:50;display:flex;justify-content:center;gap:6px;flex-wrap:wrap;padding:14px 12px;background:rgba(8,11,26,.72);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.08)}
.navbtn{background:transparent;border:0;color:var(--dim);font-size:15px;padding:8px 16px;border-radius:999px;cursor:pointer;transition:.2s}
.navbtn:hover{color:#fff;background:rgba(255,255,255,.08)}
.navbtn.active{color:#fff;background:rgba(77,163,255,.22);box-shadow:inset 0 -2px 0 var(--accent)}
.navbtn.lock{color:#ffcf6e}
.searchwrap{max-width:640px;margin:34px auto 8px;padding:0 16px;text-align:center}
.engines{display:flex;justify-content:center;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.eng{font-size:13px;color:var(--dim);border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);padding:5px 14px;border-radius:999px;cursor:pointer}
.eng.active{background:var(--accent);border-color:var(--accent);color:#fff}
.searchbox{display:flex;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);border-radius:999px;overflow:hidden;backdrop-filter:blur(8px)}
.searchbox input{flex:1;background:transparent;border:0;outline:0;color:#fff;font-size:16px;padding:14px 22px}
.searchbox input::placeholder{color:rgba(255,255,255,.4)}
.searchbox button{background:var(--accent);border:0;color:#fff;font-size:17px;padding:0 26px;cursor:pointer}
main{max-width:1200px;margin:26px auto 40px;padding:0 18px}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
@media(max-width:1000px){.grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:640px){.grid{grid-template-columns:repeat(3,1fr)}}
.card{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px 8px;background:var(--card-bg);border:1px solid var(--card-border);border-radius:14px;text-decoration:none;color:var(--text);backdrop-filter:blur(10px);transition:.2s}
.card:hover{transform:translateY(-3px);background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.25)}
.card img{width:34px;height:34px;border-radius:8px;object-fit:contain;background:rgba(255,255,255,.06)}
.card span{font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.sectitle{font-size:15px;color:var(--dim);margin:26px 4px 14px;letter-spacing:2px}
footer{text-align:center;padding:26px;color:var(--dim);font-size:13px}
footer a{color:var(--dim);text-decoration:none;border:1px solid rgba(255,255,255,.2);padding:6px 18px;border-radius:999px;margin-bottom:12px;display:inline-block}
footer a:hover{color:#fff;border-color:#fff}
footer .cp{margin-top:10px}
/* modal */
.modal{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:100;padding:20px}
.modal.show{display:flex}
.dialog{background:#141a35;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:28px;width:100%;max-width:380px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.dialog h3{margin-bottom:16px;font-size:17px}
.dialog input{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:12px 14px;font-size:15px;outline:0;margin-bottom:12px}
.dialog input:focus{border-color:var(--accent)}
.dialog .row{display:flex;gap:10px}
.btn{flex:1;border:0;border-radius:10px;padding:12px;font-size:15px;cursor:pointer}
.btn.primary{background:var(--accent);color:#fff}
.btn.ghost{background:rgba(255,255,255,.08);color:#fff}
.err{color:#ff7b7b;font-size:13px;min-height:20px;margin-bottom:8px}
/* admin */
.admin{max-width:1000px;margin:0 auto;padding:26px 18px 60px}
.admin h2{font-size:20px;margin-bottom:6px}
.admin .sub{color:var(--dim);font-size:13px;margin-bottom:20px}
.tabs{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.tab{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:var(--dim);padding:8px 20px;border-radius:999px;cursor:pointer;font-size:14px}
.tab.active{background:var(--accent);color:#fff;border-color:var(--accent)}
.panel{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:18px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid rgba(255,255,255,.07);vertical-align:middle}
th{color:var(--dim);font-weight:400;font-size:13px}
td img{width:22px;height:22px;border-radius:5px;vertical-align:-5px;margin-right:8px}
td a{color:#9ecbff;text-decoration:none}
.mini{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#fff;border-radius:8px;padding:6px 12px;font-size:13px;cursor:pointer;margin-right:6px}
.mini.danger{color:#ff9b9b;border-color:rgba(255,120,120,.4)}
.mini:hover{background:rgba(255,255,255,.15)}
.formgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
.formgrid .full{grid-column:1/-1}
.field label{display:block;font-size:13px;color:var(--dim);margin-bottom:6px}
.field input,.field select{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:8px;padding:10px 12px;font-size:14px;outline:0}
.field select option{background:#141a35}
.warn{background:rgba(255,180,60,.1);border:1px solid rgba(255,180,60,.4);color:#ffcf8a;border-radius:10px;padding:12px 16px;font-size:13px;margin-bottom:16px}
.loginbox{max-width:380px;margin:60px auto;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:30px}
.loginbox h2{margin-bottom:18px}
.loginbox input{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.2);color:#fff;border-radius:10px;padding:12px 14px;font-size:15px;outline:0;margin-bottom:12px}
.hidden{display:none!important}
.empty{text-align:center;color:var(--dim);padding:40px 0;font-size:14px}
</style>
</head>
<body>
<div class="stars"></div><div class="glow"></div>

<div id="siteView">
  <header class="topnav" id="topnav"></header>
  <div class="searchwrap">
    <div class="engines" id="engines"></div>
    <div class="searchbox">
      <input id="q" placeholder="Google 搜索...">
      <button id="goBtn">🔍</button>
    </div>
  </div>
  <main>
    <div class="sectitle" id="sectitle">首页</div>
    <div class="grid" id="grid"></div>
  </main>
  <footer>
    <div><a href="javascript:void(0)" id="adminEntry">⚙️ 后台管理</a></div>
    <div class="cp" id="copyright"></div>
  </footer>
</div>

<div id="adminView" class="hidden">
  <div id="loginBox" class="loginbox">
    <h2>🔐 后台登录</h2>
    <div class="err" id="loginErr"></div>
    <input type="password" id="adminPw" placeholder="管理密码">
    <button class="btn primary" id="loginBtn" style="width:100%">登录</button>
    <div style="text-align:center;margin-top:14px"><a href="#" id="backHome" style="color:var(--dim);font-size:13px">← 返回导航页</a></div>
  </div>
  <div id="dashBox" class="admin hidden">
    <h2>⚙️ 后台管理</h2>
    <div class="sub"><a href="#" id="backHome2" style="color:var(--dim)">← 返回导航页</a>　·　<a href="javascript:void(0)" id="logoutBtn" style="color:var(--dim)">退出登录</a></div>
    <div id="secWarn"></div>
    <div class="tabs" id="tabs"></div>
    <div class="panel" id="panel"></div>
  </div>
</div>

<div class="modal" id="pvModal">
  <div class="dialog">
    <h3>🔒 私密区域</h3>
    <div class="err" id="pvErr"></div>
    <input type="password" id="pvPw" placeholder="请输入私密访问密码">
    <div class="row">
      <button class="btn ghost" id="pvCancel">取消</button>
      <button class="btn primary" id="pvOk">进入</button>
    </div>
  </div>
</div>

<div class="modal" id="linkModal">
  <div class="dialog" style="max-width:460px">
    <h3 id="lmTitle">添加链接</h3>
    <div class="formgrid">
      <div class="field"><label>名称 *</label><input id="fName" placeholder="如：GitHub"></div>
      <div class="field"><label>网址 *</label><input id="fUrl" placeholder="https://..."></div>
      <div class="field"><label>分类</label><select id="fCat"></select></div>
      <div class="field"><label>图标（留空自动获取）</label><input id="fIcon" placeholder="https://..."></div>
      <div class="field full"><label>描述（悬停提示）</label><input id="fDesc" placeholder="一句话介绍"></div>
    </div>
    <div class="row">
      <button class="btn ghost" id="lmCancel">取消</button>
      <button class="btn primary" id="lmOk">保存</button>
    </div>
  </div>
</div>

<script>
/* ============ 前端逻辑（注意：本段禁用模板字符串） ============ */
function $(id){return document.getElementById(id);}
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function favicon(l){
  if(l.icon) return l.icon;
  var d='';
  try{d=new URL(l.url).hostname;}catch(e){}
  return d?('https://www.google.com/s2/favicons?domain='+d+'&sz=64'):'https://img.icons8.com/lollipop/100/navigation.png';
}
var DEFICON='https://img.icons8.com/lollipop/100/navigation.png';

var ENGINES=[
  {n:'Google',u:'https://www.google.com/search?q=',ph:'Google 搜索...'},
  {n:'百度',u:'https://www.baidu.com/s?wd=',ph:'百度一下...'},
  {n:'Bing',u:'https://www.bing.com/search?q=',ph:'Bing 搜索...'},
  {n:'GitHub',u:'https://github.com/search?q=',ph:'搜索 GitHub...'},
  {n:'站内',u:'',ph:'搜索本站书签...'}
];
var curEng=0, curCat='home', cfg=null, pvLinks=null, pvUnlocked=false;

/* ---------- 站点视图 ---------- */
function loadSite(){
  $('sectitle').textContent='加载中…';
  fetch('/api/config').then(function(r){
    if(!r.ok)throw new Error('http '+r.status);
    return r.json();
  }).then(function(c){
    cfg=c;
    $('docTitle').textContent=c.title;
    $('copyright').textContent='Copyright © 2026 '+c.title;
    renderNav();renderEngines();renderGrid();
  }).catch(function(){
    $('sectitle').textContent='首页';
    $('grid').innerHTML='<div class="empty">数据加载失败，请检查网络连接后刷新重试</div>';
  });
  fetch('/api/private').then(function(r){return r.json();}).then(function(d){
    if(d.links){pvLinks=d.links;pvUnlocked=true;}
  }).catch(function(){});
}
function renderNav(){
  var h=$('topnav');h.innerHTML='';
  cfg.categories.forEach(function(c){
    var b=document.createElement('button');
    b.className='navbtn'+(curCat===c.id?' active':'');
    b.textContent=c.name;
    b.onclick=function(){curCat=c.id;renderNav();renderGrid();};
    h.appendChild(b);
  });
  var p=document.createElement('button');
  p.className='navbtn lock'+(curCat==='__private'?' active':'');
  p.textContent='🔒 私密';
  p.onclick=openPrivate;
  h.appendChild(p);
}
function renderEngines(){
  var h=$('engines');h.innerHTML='';
  ENGINES.forEach(function(e,i){
    var b=document.createElement('button');
    b.className='eng'+(i===curEng?' active':'');
    b.textContent=e.n;
    b.onclick=function(){curEng=i;$('q').placeholder=e.ph;renderEngines();};
    h.appendChild(b);
  });
  $('q').placeholder=ENGINES[curEng].ph;
}
function cardEl(l){
  var a=document.createElement('a');
  a.className='card';a.href=l.url;a.target='_blank';a.rel='noopener';
  a.title=(l.desc||l.name)+'\\n'+l.url;
  var img=document.createElement('img');
  img.src=favicon(l);img.loading='lazy';img.alt='';
  img.onerror=function(){this.onerror=null;this.src=DEFICON;};
  var s=document.createElement('span');s.textContent=l.name;
  a.appendChild(img);a.appendChild(s);
  return a;
}
function renderGrid(){
  var g=$('grid');g.innerHTML='';
  var list, title;
  if(curCat==='__private'){
    title='🔒 私密收藏';list=pvLinks||[];
    if(!pvUnlocked){g.innerHTML='<div class="empty">未解锁</div>';return;}
  }else{
    var c=null;
    cfg.categories.forEach(function(x){if(x.id===curCat)c=x;});
    title=c?c.name:'';
    list=cfg.links.filter(function(l){return l.cat===curCat;});
  }
  $('sectitle').textContent=title;
  if(!list.length){g.innerHTML='<div class="empty">这里还没有链接，去后台添加吧 → 页脚「后台管理」</div>';return;}
  list.forEach(function(l){g.appendChild(cardEl(l));});
}
function doSearch(){
  var kw=$('q').value.trim();
  if(!kw)return;
  var e=ENGINES[curEng];
  if(!e.u){
    var g=$('grid');g.innerHTML='';
    $('sectitle').textContent='站内搜索：'+kw;
    var all=cfg.links.concat(pvUnlocked?(pvLinks||[]):[]);
    var hit=all.filter(function(l){return (l.name+l.desc+l.url).toLowerCase().indexOf(kw.toLowerCase())>=0;});
    if(!hit.length){g.innerHTML='<div class="empty">没有找到相关书签</div>';return;}
    hit.forEach(function(l){g.appendChild(cardEl(l));});
    return;
  }
  window.open(e.u+encodeURIComponent(kw),'_blank');
}
$('goBtn').onclick=doSearch;
$('q').addEventListener('keydown',function(e){if(e.key==='Enter')doSearch();});

/* ---------- 私密区 ---------- */
function openPrivate(){
  if(pvUnlocked){curCat='__private';renderNav();renderGrid();window.scrollTo(0,0);return;}
  $('pvErr').textContent='';$('pvPw').value='';
  $('pvModal').classList.add('show');
  setTimeout(function(){$('pvPw').focus();},50);
}
$('pvCancel').onclick=function(){$('pvModal').classList.remove('show');};
$('pvOk').onclick=function(){
  var pw=$('pvPw').value;
  fetch('/api/private/unlock',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.ok){pvLinks=d.links;pvUnlocked=true;$('pvModal').classList.remove('show');curCat='__private';renderNav();renderGrid();window.scrollTo(0,0);}
    else{$('pvErr').textContent=d.msg||'密码错误';}
  });
};
$('pvPw').addEventListener('keydown',function(e){if(e.key==='Enter')$('pvOk').click();});

/* ---------- 路由 ---------- */
function route(){
  var admin=location.hash==='#admin';
  $('siteView').classList.toggle('hidden',admin);
  $('adminView').classList.toggle('hidden',!admin);
  if(admin){$('loginBox').classList.remove('hidden');$('dashBox').classList.add('hidden');$('adminPw').value='';$('loginErr').textContent='';}
  else if(cfg){renderNav();renderGrid();}
}
window.addEventListener('hashchange',route);
$('backHome').onclick=$('backHome2').onclick=function(e){e.preventDefault();location.hash='#';};
$('adminEntry').onclick=function(){location.hash='#admin';};

/* ---------- 后台 ---------- */
var A=null, aTab='links', editing=null, editingPrivate=false;

$('loginBtn').onclick=function(){
  var pw=$('adminPw').value;
  fetch('/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw})})
  .then(function(r){return r.json();})
  .then(function(d){
    if(d.ok){loadAdmin();}
    else{$('loginErr').textContent=d.msg||'密码错误';}
  });
};
$('adminPw').addEventListener('keydown',function(e){if(e.key==='Enter')$('loginBtn').click();});
$('logoutBtn').onclick=function(){
  fetch('/api/admin/logout',{method:'POST'}).then(function(){location.hash='#';});
};

function loadAdmin(){
  fetch('/api/admin/data').then(function(r){return r.json();}).then(function(d){
    if(d.ok===false){$('loginErr').textContent='登录失效，请重试';return;}
    A=d;
    $('loginBox').classList.add('hidden');
    $('dashBox').classList.remove('hidden');
    var w=$('secWarn');w.innerHTML='';
    if(d.usingDefaultSecret){
      w.innerHTML='<div class="warn">⚠️ 当前使用默认会话密钥，建议在 Worker 环境变量中设置 ADMIN_SECRET（任意随机字符串），然后重新部署。</div>';
    }
    renderTabs();renderPanel();
  });
}
function renderTabs(){
  var tabs=[['links','公开链接'],['private','私密链接'],['cats','分类管理'],['settings','设置']];
  var h=$('tabs');h.innerHTML='';
  tabs.forEach(function(t){
    var b=document.createElement('button');
    b.className='tab'+(aTab===t[0]?' active':'');
    b.textContent=t[1];
    b.onclick=function(){aTab=t[0];renderTabs();renderPanel();};
    h.appendChild(b);
  });
}
function saveAdmin(cb){
  fetch('/api/admin/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:A.title,categories:A.categories,links:A.links,privateLinks:A.privateLinks})})
  .then(function(r){return r.json();})
  .then(function(d){if(d.ok){if(cb)cb();}else{alert('保存失败：'+(d.msg||'未知错误'));}});
}
function catName(id){
  if(id==='private')return '私密';
  var n=id;
  A.categories.forEach(function(c){if(c.id===id)n=c.name;});
  return n;
}
function renderPanel(){
  var p=$('panel');
  if(aTab==='links')return renderLinkTable(p,false);
  if(aTab==='private')return renderLinkTable(p,true);
  if(aTab==='cats')return renderCats(p);
  return renderSettings(p);
}
function renderLinkTable(p,isPv){
  var list=isPv?A.privateLinks:A.links;
  var h='<div style="margin-bottom:14px"><button class="mini" id="addLink">＋ 添加链接</button></div>';
  if(!list.length){h+='<div class="empty">暂无链接，点击上方按钮添加</div>';}
  else{
    h+='<table><tr><th></th><th>名称</th><th>网址</th><th>'+(isPv?'':'分类')+'</th><th>操作</th></tr>';
    list.forEach(function(l,i){
      h+='<tr><td style="width:40px"><img src="'+esc(favicon(l))+'" onerror="this.src=\\\''+DEFICON+'\\\'"></td>'
        +'<td>'+esc(l.name)+'</td>'
        +'<td><a href="'+esc(l.url)+'" target="_blank">'+esc(l.url.length>42?l.url.slice(0,42)+'…':l.url)+'</a></td>'
        +'<td>'+(isPv?'私密':esc(catName(l.cat)))+'</td>'
        +'<td style="white-space:nowrap"><button class="mini" data-e="'+i+'">编辑</button><button class="mini danger" data-d="'+i+'">删除</button></td></tr>';
    });
    h+='</table>';
  }
  p.innerHTML=h;
  $('addLink').onclick=function(){openLinkModal(isPv,null);};
  p.querySelectorAll('[data-e]').forEach(function(b){
    b.onclick=function(){openLinkModal(isPv,parseInt(b.getAttribute('data-e'),10));};
  });
  p.querySelectorAll('[data-d]').forEach(function(b){
    b.onclick=function(){
      var i=parseInt(b.getAttribute('data-d'),10);
      if(!confirm('确定删除「'+list[i].name+'」吗？'))return;
      list.splice(i,1);saveAdmin(renderPanel);
    };
  });
}
function openLinkModal(isPv,idx){
  editing=idx;editingPrivate=isPv;
  $('lmTitle').textContent=(idx==null?'添加':'编辑')+(isPv?'私密':'')+'链接';
  var l=idx==null?{name:'',url:'',cat:'',icon:'',desc:''}:(isPv?A.privateLinks:A.links)[idx];
  $('fName').value=l.name||'';$('fUrl').value=l.url||'';
  $('fIcon').value=l.icon||'';$('fDesc').value=l.desc||'';
  var sel=$('fCat');sel.innerHTML='';
  if(isPv){sel.innerHTML='<option value="private">私密</option>';sel.disabled=true;}
  else{
    sel.disabled=false;
    A.categories.forEach(function(c){
      var o=document.createElement('option');o.value=c.id;o.textContent=c.name;
      if(c.id===(l.cat||A.categories[0].id))o.selected=true;
      sel.appendChild(o);
    });
  }
  $('linkModal').classList.add('show');
}
$('lmCancel').onclick=function(){$('linkModal').classList.remove('show');};
$('lmOk').onclick=function(){
  var name=$('fName').value.trim(),url=$('fUrl').value.trim();
  if(!name||!url){alert('名称和网址不能为空');return;}
  if(!/^https?:\\/\\//i.test(url))url='https://'+url;
  var obj={id:editing==null?('x'+Date.now().toString(36)):((editingPrivate?A.privateLinks:A.links)[editing].id),
    cat:editingPrivate?'private':$('fCat').value,
    name:name,url:url,icon:$('fIcon').value.trim(),desc:$('fDesc').value.trim()};
  var list=editingPrivate?A.privateLinks:A.links;
  if(editing==null)list.push(obj);else list[editing]=obj;
  $('linkModal').classList.remove('show');
  saveAdmin(renderPanel);
};
function renderCats(p){
  var h='<div style="margin-bottom:14px"><button class="mini" id="addCat">＋ 添加分类</button></div>';
  h+='<table><tr><th>分类名</th><th>链接数</th><th>操作</th></tr>';
  A.categories.forEach(function(c,i){
    var n=A.links.filter(function(l){return l.cat===c.id;}).length;
    h+='<tr><td>'+esc(c.name)+'</td><td>'+n+'</td>'
      +'<td style="white-space:nowrap"><button class="mini" data-r="'+i+'">改名</button><button class="mini danger" data-d="'+i+'">删除</button></td></tr>';
  });
  p.innerHTML=h+'</table>';
  $('addCat').onclick=function(){
    var name=prompt('新分类名称：');
    if(!name||!(name=name.trim()))return;
    A.categories.push({id:'c'+Date.now().toString(36),name:name});
    saveAdmin(renderPanel);
  };
  p.querySelectorAll('[data-r]').forEach(function(b){
    b.onclick=function(){
      var i=parseInt(b.getAttribute('data-r'),10);
      var name=prompt('重命名分类：',A.categories[i].name);
      if(!name||!(name=name.trim()))return;
      A.categories[i].name=name;saveAdmin(renderPanel);
    };
  });
  p.querySelectorAll('[data-d]').forEach(function(b){
    b.onclick=function(){
      var i=parseInt(b.getAttribute('data-d'),10);
      var c=A.categories[i];
      var n=A.links.filter(function(l){return l.cat===c.id;}).length;
      if(n>0){alert('该分类下还有 '+n+' 个链接，请先移走或删除它们');return;}
      if(!confirm('确定删除分类「'+c.name+'」吗？'))return;
      A.categories.splice(i,1);saveAdmin(renderPanel);
    };
  });
}
function renderSettings(p){
  var h='<div class="formgrid">'
    +'<div class="field full"><label>网站标题</label><input id="sTitle" value="'+esc(A.title)+'"></div>'
    +'</div><div style="margin-bottom:20px"><button class="mini" id="saveTitle">保存标题</button></div>'
    +'<h3 style="font-size:15px;margin-bottom:12px">修改管理密码</h3>'
    +'<div class="formgrid"><div class="field"><label>原密码</label><input type="password" id="pwOld1"></div>'
    +'<div class="field"><label>新密码（4~64位）</label><input type="password" id="pwNew1"></div></div>'
    +'<div style="margin-bottom:20px"><button class="mini" id="pwBtn1">修改管理密码</button></div>'
    +'<h3 style="font-size:15px;margin-bottom:12px">修改私密访问密码</h3>'
    +'<div class="formgrid"><div class="field"><label>原密码</label><input type="password" id="pwOld2"></div>'
    +'<div class="field"><label>新密码（4~64位）</label><input type="password" id="pwNew2"></div></div>'
    +'<div><button class="mini" id="pwBtn2">修改私密密码</button></div>'
    +'<div class="warn" style="margin-top:20px">🔑 默认密码：管理密码 <b>admin123</b>，私密访问密码 <b>123456</b>。请首次登录后立即修改！</div>';
  p.innerHTML=h;
  $('saveTitle').onclick=function(){
    var t=$('sTitle').value.trim();
    if(!t){alert('标题不能为空');return;}
    A.title=t;saveAdmin(function(){$('docTitle').textContent=t;alert('已保存');});
  };
  function chpw(type){
    var o=$(type==='admin'?'pwOld1':'pwOld2').value;
    var n=$(type==='admin'?'pwNew1':'pwNew2').value;
    fetch('/api/admin/password',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type:type,oldPassword:o,newPassword:n})})
    .then(function(r){return r.json();})
    .then(function(d){alert(d.ok?'修改成功':('修改失败：'+d.msg));if(d.ok)renderPanel();});
  }
  $('pwBtn1').onclick=function(){chpw('admin');};
  $('pwBtn2').onclick=function(){chpw('private');};
}

/* ---------- 启动 ---------- */
loadSite();
route();
</script>
</body>
</html>
`;
