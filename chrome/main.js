// 借助自定义事件实现page script（注入页面的主程序）与content script（运行在沙箱中）
//   之间的异步通讯，使前者可以间接调用chrome.* API
document.addEventListener('wbpGet', function (event) {
	event.stopPropagation();
	var name = event.detail.name;
	var post = function (value) {
		//#if DEBUG
		console.log(value);
		//#endif
		// 注意：不能在此处直接调用callback，否则回调函数将在本程序所在的沙箱环境中运行，在Chrome 27及更高版本下会出错
		document.dispatchEvent(new CustomEvent("wbpPost", { detail: {
			value : value,
			id : event.detail.id
		}}));
	};
	if (event.detail.sync) {
		// 一次性读取所有设置
		chrome.storage.sync.get(null, function (items) {
			//#if DEBUG
			console.log(items);
			//#endif
			var i = 0, value = '';
			while ((name + '_' + i) in items) {
				value += items[name + '_' + (i++)]; 
			}
			post(i ? value : event.detail.defVal);
		});
	} else {
		// 注意：使用chrome.storage.StorageArea.get()时，如果通过{name:defVal}的形式传送默认值，
		//   且defVal为null或undefined，即使name存在也会返回空对象{}，详见crbug.com/145081
		chrome.storage.local.get(name, function (items) {
			post(name in items ? items[name] : event.detail.defVal);
		});
	}
});
document.addEventListener('wbpSet', function (event) {
	event.stopPropagation();
	var data = {}, name = event.detail.name, value = event.detail.value;
	data[name] = value;
	// 总是将设置保存在本地
	chrome.storage.local.set(data);
	if (event.detail.sync) {
		// 一次性读取所有设置
		chrome.storage.sync.get(null, function (items) {
			var data = {}, i = 0, errorHandler = function () {
				if (chrome.runtime && chrome.runtime.lastError) {
					alert('将设置保存到云端时发生错误。\n\n' + chrome.runtime.lastError.message);
				}
			};
			// 拆分字符串
			while (value.length) {
				data[name + '_' + (i++)] = value.substr(0, chrome.storage.sync.QUOTA_BYTES_PER_ITEM);
				value = value.substr(chrome.storage.sync.QUOTA_BYTES_PER_ITEM);
			}
			//#if DEBUG
			console.log(data);
			//#endif
			// 保存新的设置
			chrome.storage.sync.set(data, errorHandler);
			// 清除多余的旧设置块
			var keys = [];
			while ((name + '_' + i) in items) {
				keys.push(name + '_' + (i++));
			}
			chrome.storage.sync.remove(keys, errorHandler);
		});
	}
});
//#if DEBUG
document.addEventListener('wbpDebug', function (event) {
	event.stopPropagation();
	try {
		console.log(eval('(function(){' + event.detail.snippet + '})();'));
	} catch (err) {
		console.error(err);
	}
});
//#endif
// 将脚本注入页面环境
var script = document.createElement('script');
script.setAttribute('type', 'text/javascript');
script.src = chrome.extension.getURL("/weiboFilter.js");
document.head.appendChild(script);