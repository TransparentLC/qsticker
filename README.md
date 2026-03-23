# qsticker

QQ 表情包下载站。

主要功能是将 QQ 的[表情商城](https://zb.vip.qq.com/hybrid/emoticonmall/home)的表情包直接保存为 PNG/GIF 文件（可以长按保存），或将整个表情包保存为 ZIP 文件，方便在 QQ 以外的地方使用。

由于获取表情包的原作者信息需要使用 QQ 登录，因此在这里无法获取和展示这部分内容，请使用 QQ 打开对应的表情商城页面查看。只提供表情包下载，请自行确认使用使用授权。

配置项参见 `config.example.yaml`。

```shell
# 安装依赖
pnpm install
cd frontend
pnpm install
cd ..

# 复制和编辑配置文件 config.yaml
cp config.example.yaml config.yaml

# 编译前端资源
cd frontend
node --run build
cd ..

# 初始化数据库
mkdir database
node --run generate
node --run migrate

# 运行
node --run build
node dist/index.js
```