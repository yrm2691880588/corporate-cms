/**
 * 测试套件入口
 *
 * 引入即注册。新增套件在这里加一行 import。
 */

import "./core";
import "./admin";
import "./publish-pipeline";
import "./scheduled-publish";
import "./auth-ratelimit";
import "./ratelimit-log";

export { runAllTests } from "../helpers/framework";
