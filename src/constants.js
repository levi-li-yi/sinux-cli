// 常量存储文件
const { version } = require('../package.json');
// 模板存储位置
const downloadDirectory = `${process.env[process.platform === 'darwin' ? 'HOME' : 'USERPROFILE']}/.sinuxtemplate`;
module.exports = {
  version,
  downloadDirectory,
};