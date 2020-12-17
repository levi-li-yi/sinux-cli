// 常量存储文件
const { version } = require('../package.json');
// 模板存储位置
const downloadDirectory = `${process.env[process.platform === 'darwin' ? 'HOME' : 'USERPROFILE']}/.sinuxtemplate`;
// gitlab账号private token
const privateTokenDir = `${process.env[process.platform === 'darwin' ? 'HOME' : 'USERPROFILE']}/.gitlabtoken`;
module.exports = {
  version,
  downloadDirectory,
  privateTokenDir
};