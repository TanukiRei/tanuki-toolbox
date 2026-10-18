'use strict';
const fs = require('node:fs');
const path = require('node:path');
function writeReport(profile, report) {
  const dir = path.join(profile,'.tanuki-toolbox');
  fs.mkdirSync(dir,{recursive:true});
  const temp=path.join(dir,`status-${process.pid}.tmp`);
  fs.writeFileSync(temp,JSON.stringify({...report,at:new Date().toISOString()},null,2));
  fs.renameSync(temp,path.join(dir,'status.json'));
}
function backup(profile) {
  const dir=path.join(profile,'.tanuki-toolbox','backups',`${Date.now()}-${process.pid}`);
  fs.mkdirSync(dir,{recursive:true});
  for(const name of ['package.json','cordis.patch.yml']) {
    const source=path.join(profile,name);
    if(fs.existsSync(source)) fs.copyFileSync(source,path.join(dir,name));
  }
  return dir;
}
module.exports={writeReport,backup};
