// 1、create功能需求：在命令行中输入"sinux-vue2-cli create project-name"可以建立一个"project-name"的项目，项目中文件时提前建立好的template;

// 2、create功能实现步骤：
// (1) 获取组织下的所有模板；
// (2) 获取当前选择项目的对应版本号；
// (3) 拉取模板存到一个目录下备用；
// (4) 拷贝生成新的项目;

const fs = require('fs');
const path = require('path');

const fse = require('fs-extra');
const axios = require('axios'); // http请求
const ora = require('ora'); // 加载loading进度条
const Inquirer = require('inquirer'); // 监护命令行工具
const { promisify } = require('util');
const chalk = require('chalk'); // 读取所有文件，实现模板渲染
const MetalSmith = require('metalsmith'); // 读取所有文件，实现模板渲染
let { render } = require('consolidate').ejs; // 模板引擎
let downloadGitRepo = require('download-git-repo'); // 在git中下载模板
let ncp = require('ncp'); // 复制文件

render = promisify(render);
downloadGitRepo = promisify(downloadGitRepo);
const { downloadDirectory } = require('./constants');

ncp = promisify(ncp);

let PRIVATETOKEN = '';
let downloadPath = '';
const service = axios.create({
})

const http = (postData) => {
  const params = {
    url: postData.url,
    method: postData.method,
    headers: postData.headers || {},
  };
  return service(params)
}


// 获取仓库列表
const fetchRepoList = async () => {
  // 获取当前组织中所有仓库信息，该仓库存放的都是项目模板
  // const { data } = await axios.get('https://api.github.com/users/levi-li-yi/repos');

  // 获取权限下的所有工程信息：http://192.168.3.11/api/v3/projects
  // 获取groupsID为456分组下的所有工程清单
  const { data } = await http({ url: 'http://192.168.3.11/api/v4/groups/456/projects', metohd: 'get', headers: { 'PRIVATE-TOKEN': PRIVATETOKEN } });
  return data;
};

// 获取项目的版本号 https://api.github.com/repos/levi-li-yi/express_frontend/tags
const fetchTagList = async (repoId) => {
  // console.log(`https://api.github.com/repos/levi-li-yi/${repo}/tags`);
  // const { data } = await axios.get(`https://api.github.com/repos/levi-li-yi/${repo}/tags`);
  const { data } = await http({ url: `http://192.168.3.11/api/v4/projects/${repoId}/repository/tags`, metohd: 'get', headers: { 'PRIVATE-TOKEN': PRIVATETOKEN } });
  return data;
};

// 封装loading
const waitFnloading = (fn, message) => async (...args) => {
  const spinner = ora(message);
  spinner.start();
  const result = await fn(...args);
  spinner.succeed();
  return result;
}

// 下载模板
const download = async (repo, tag) => {
  // let api = `levi-li-yi/${repo}`;
  let sourcePath = `gitlab:http://192.168.3.11:BasicMaterial/${repo}`;
  // http://liyi@192.168.3.11/BasicMaterial/create-vue2-project.git
  // let api = `direct:http://${username}@192.168.3.11/BasicMaterial/${repo}.git`
  if (tag) sourcePath += `#${tag}`;
  console.log(sourcePath);
  // 下载目标地址
  downloadPath = `${downloadDirectory}/${repo}`;
  const dest = downloadPath;
  await downloadGitRepo(sourcePath, dest, { headers: { 'PRIVATE-TOKEN': PRIVATETOKEN } }); // 下载模板存放地址
  return dest;
}

// 逻辑主体
module.exports = async (projectName = 'my-project') => {
  if (fs.existsSync(projectName)) {
    console.log(chalk.red('Folder already exists'));
  } else {
    const { token } = await Inquirer.prompt({
      name: 'token',
      type: 'input',
      message: 'Please enter your gitlab private token',
    });
    PRIVATETOKEN = token;

    // 1、获取组织下的所有模板
    let repos = await waitFnloading(fetchRepoList, 'fetching template...')();
    let list = repos.map((item) => item.name);
    // 选择模板
    const { repo } = await Inquirer.prompt({
      name: 'repo',
      type: 'list',
      message: 'Please chiose a template to create project',
      choices: list
    });
    const repoId = repos.find((item) => item.name === repo).id || '';

    // 获取当前选择项目的对应版本号
    let tags = await waitFnloading(fetchTagList, 'fetching tags...')(repoId);
    console.log(tags);
    let result;
    // 
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
      result = await waitFnloading(download, 'download template...')(repo, tag);
    } else {
      result = await waitFnloading(download, 'download template...')(repo);
    }
    console.log(result);

    if (!fs.existsSync(path.join(result, 'ask.js'))) { // 是否需要输入信息
      try {
        await ncp(result, path.resolve(projectName)); // 把模板复制到projectName
        fse.remove(downloadPath)
        console.log('\r\n', chalk.green(`download success\r\n\n`), chalk.green(`cd ${projectName}\r\n\n`), chalk.yellow('npm install\r\n'))
      } catch (error) {
        console.log(error);
      }
    } else {
      // 需要用户输入信息
      await new Promise((resolve, reject) => {
        MetalSmith(__dirname).source(result)
          .destination(path.resolve(projectName))
          .use(async (files, metal, done) => {
            // 获取填写项
            const args = require(path.join(result, 'ask.js'));
            const select = await Inquirer.prompt(args);
            const meta = metal.metadata(); // 填写结果
            Object.assign(meta, select);
            delete files['ask.js'];
            done();
          })
          .use((files, metal, done) => { // 根据用户输入编写模板
            const obj = metal.metadata();
            Reflect.ownKeys(files).forEach(async (file) => {
              if (file.includes('js') || file.includes('json')) {
                let content = files[file].contents.toString();
                if (content.includes('<%')) {
                  content = await render(content, obj);
                  files[file].content = Buffer.from(content);
                }
              }
            });
            done();
          })
          .build((err) => {
            if (err) {
              reject();
            } else {
              console.log('\r\n', chalk.green(`cd ${projectName}\r\n`, chalk.yellow('npm install\r\n')));
              resolve();
            }
          });
      });
    }
  }
}