// 入口文件
const program = require('commander');
const path = require('path');
const { version } = require('./constants');

// 用于生成的指令数据
const mapAction = {
  create: {
    alias: 'c',
    description: 'create a project',
    examples: [
      'sinux-cli create vue2-demo',
    ],
  },
  '*': {
    alias: '',
    description: 'command not found',
    examples: []
  },
};

// 制定脚手架命令
Reflect.ownKeys(mapAction).forEach((action) => {
  program.command(action) // 命令名字
    .alias(mapAction[action].alias) // 命令别名
    .description(mapAction[action].description) // 命令描述
    .action(() => { // 命令执行的操作
      if (action === '*') {
        console.log(mapAction[action].description);
      } else {
        require(path.resolve(__dirname, action))(...process.argv.slice(3)); // 引入命令应对操作模块
      }
    });
});

// 制定脚手架--help命令打印帮助信息
program.on('--help', () => {
  console.log('\nExample');
  Reflect.ownKeys(mapAction).forEach((action) => {
    mapAction[action].examples.forEach((item) => {
      console.log(item);
    });
  });
});

// process.argv：获取命令行中输入的参数；定义脚手架版本号
program.version(version)
  .parse(process.argv);