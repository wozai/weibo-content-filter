// 将脚本注入页面环境
var script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.src = chrome.extension.getURL("/weiboFilter.js");
document.body.appendChild(script);