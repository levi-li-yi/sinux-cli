// 1、create功能需求：在命令行中输入"sinux-vue2-cli create project-name"可以建立一个"project-name"的项目，项目中文件时提前建立好的template;
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const axios = require('axios');
const ora = require('ora');
const Inquirer = require('inquirer');
const { promisify } = require('util');
const chalk = require('chalk');
let { render } = require('consolidate').ejs;
let downloadGitRepo = require('download-git-repo');
let ncp = require('ncp'); // 复制文件

// 临时安装路径、private token存储路径
const { downloadDirectory, privateTokenDir } = require('./constants');

// promise化render函数、downloadGitRepo函数、ncp函数
render = promisify(render);
downloadGitRepo = promisify(downloadGitRepo);
ncp = promisify(ncp);

let PRIVATETOKEN = ''; // gitlab 用户的私人token
let downloadPath = ''; // 模板临时下载路径
const service = axios.create({}); // 初始化axios实例

// 请求库封装
const http = (postData) => {
  const params = {
    url: postData.url,
    method: postData.method,
    headers: postData.headers || {},
  };
  return service(params)
}

// 获取仓库列表groupsID为456(BasicMaterial)分组下的所有工程清单
// 备注：获取权限下的所有工程信息：http://192.168.3.11/api/v3/projects
const fetchRepoList = async () => {
  const { data } = await http({
    url: 'http://192.168.3.11/api/v4/groups/456/projects',
    metohd: 'get',
    headers: {
      'PRIVATE-TOKEN': PRIVATETOKEN
    }
  });
  return data;
};

// 获取项目的版本tag
const fetchTagList = async (repoId) => {
  const { data } = await http({
    url: `http://192.168.3.11/api/v4/projects/${repoId}/repository/tags`,
    metohd: 'get',
    headers: {
      'PRIVATE-TOKEN': PRIVATETOKEN
    }
  });
  return data;
};

// 封装loading
const waitLoading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
}

// 下载模板
const download = async (repo, tag) => {
  const sourcePath = `gitlab:http://192.168.3.11:BasicMaterial/${repo}`;
  if (tag) sourcePath += `#${tag}`;
  downloadPath = `${downloadDirectory}/${repo}`;
  // 下载工程到指定路径
  await downloadGitRepo(sourcePath, downloadPath, { headers: { 'PRIVATE-TOKEN': PRIVATETOKEN } });
  return downloadPath;
}

// 输入private token
const enterToken = async () => {
  const { token } = await Inquirer.prompt({
    name: 'token',
    type: 'input',
    message: 'Please enter your gitlab private token',
  });
  PRIVATETOKEN = token;
  fse.emptyDirSync(privateTokenDir);
  fse.ensureFileSync(`${privateTokenDir}/token.txt`);
  fs.writeFileSync(`${privateTokenDir}/token.txt`, PRIVATETOKEN);
}

// 逻辑主体
module.exports = async (projectName = 'my-project') => {
  // 判断创建工程目录是否已存在
  if (fs.existsSync(projectName)) {
    return console.log(chalk.red('Folder already exists'));
  }

  // private token的读写
  try {
    const fileContent = fs.readFileSync(`${privateTokenDir}/token.txt`, 'utf-8');
    if (!fileContent.toString()) {
      await enterToken();
    } else {
      PRIVATETOKEN = fileContent.toString();
      console.log('\r\n', chalk.yellow(`Your private token is: ${PRIVATETOKEN}`));
    }
  } catch (err) {
    await enterToken();
  }

  // 获取组织下的所有模板
  const repos = await waitLoading(fetchRepoList, 'fetching template...')();
  const list = repos.map((item) => item.name);
  // 选择模板
  const { repo } = await Inquirer.prompt({
    name: 'repo',
    type: 'list',
    message: 'Please chiose a template to create project',
    choices: list
  });
  const repoId = repos.find((item) => item.name === repo).id || '';

  // 获取当前选择项目的对应版本号
  let tags = await waitLoading(fetchTagList, 'fetching tags...')(repoId);
  let result;
  if (tags.length > 0) {
    tags = tags.map((item) => item.name);
    // 选择模板的变化
    const { tag } = await Inquirer.prompt({
      name: 'tag',
      type: 'list',
      message: 'please choise tags to create project',
      choices: tags
    });
    // 下载模板，拿到缓存模板路径
    result = await waitLoading(download, 'download template...')(repo, tag);
  } else {
    result = await waitLoading(download, 'download template...')(repo);
  }
  // 把模板复制到projectName
  try {
    await ncp(result, path.resolve(projectName));
    fse.remove(downloadPath);
    console.log('\r\n', chalk.green(`cd ${projectName}\r\n\n`), chalk.yellow('npm install\r\n'));
  } catch (error) {
    console.log(error);
    fse.emptyDirSync(privateTokenDir);
  }
}

// 2、create功能实现步骤：
// (1) 获取组织下的所有模板；
// (2) 获取当前选择项目的对应版本号；
// (3) 拉取模板存到一个目录下备用；
// (4) 拷贝生成新的项目;