'use strict';
const path=require('node:path');
function resolveLocale({boot,profile,installAnchor,fallback=Intl.DateTimeFormat().resolvedOptions().locale}) {
  try {
    const loaded=boot.loadProfileDirectory('tanuki',profile,installAnchor);
    const home=path.dirname(path.dirname(profile));
    const patches=boot.loadOptionalPatches('tanuki',path.join(home,'cordis.patch.yml'))??[];
    const entries=boot.composeEntries([...loaded.layers.map(l=>l.patches),loaded.patches,patches]);
    const row=entries.find(e=>e.name==='@deepseek-ai/dsh-client-locale');
    if(row?.config?.preference==='zh'||row?.config?.preference==='en') return row.config.preference;
  }catch{}
  return /^zh/i.test(fallback)?'zh':'en';
}
function failureText(locale) {
  return locale==='zh'
    ? ['黎猫工具箱','保护启动未能完成检查。请使用黎猫一键安装包修复安装，并查看本地保护报告。']
    : ['Tanuki Toolbox','Protected Launch could not finish the check. Repair the installation with the Tanuki installer and inspect the local guard report.'];
}
module.exports={resolveLocale,failureText};
