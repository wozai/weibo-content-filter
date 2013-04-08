// 借助自定义事件实现page script（注入页面的主程序）与content script（运行在沙箱中）
//   之间的异步通讯，使前者可以间接调用chrome.* API
document.addEventListener('wbpGet', function (event) {
	event.stopPropagation();
	// 注意：使用chrome.storage.StorageArea.get()时，如果通过{name:defVal}的形式传送默认值，
	//   且defVal为null或undefined，即使name存在也会返回空对象{}，详见crbug.com/145081
	chrome.storage.local.get(event.detail.name, function (items) {
		// 注意：不能在此处直接调用callback，否则回调函数将在本程序所在的沙箱环境中运行，在Chrome 27及更高版本下会出错
		document.dispatchEvent(new CustomEvent("wbpPost", { detail: {
			value : event.detail.name in items ? items[event.detail.name] : event.detail.defVal, 
			id : event.detail.id
		}}));
	});
});
document.addEventListener('wbpSet', function (event) {
	event.stopPropagation();
	var data = {};
	data[event.detail.name] = event.detail.value;
	chrome.storage.local.set(data);
});
//#if DEBUG
chrome.storage.local.get(null, function (items) {
	console.log(items);
});
//#endif
// 将脚本注入页面环境
var script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.src = chrome.extension.getURL("/weiboFilter.js");
document.head.appendChild(script);