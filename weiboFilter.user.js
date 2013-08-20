(function () {

// 工具函数
var $ = (function () {
	// 按id选择元素（默认操作）
	var $ = function (id) {
		return document.getElementById(id);
	};
	$.version = Number('${REV}');
	// 按CSS选择元素
	$.select = function (css, root) {
		if (!root) { root = document; }
		return root.querySelector(css);
	};
	var CHROME_KEY_ROOT = 'weiboPlus.';
	//#if GREASEMONKEY
	if (window.chrome) {
		if (localStorage.getItem(CHROME_KEY_ROOT + 'chromeExtInstalled')) {
			console.warn('已安装插件版本，脚本停止运行！');
			return undefined; // 如果已经（曾经）安装过插件则不再继续运行脚本
		}
		var version = window.navigator.userAgent.match(/Chrome\/(\d+)/) && RegExp.$1;
		if (!localStorage.getItem(CHROME_KEY_ROOT + 'chromeExtTip') && confirm('以用户脚本方式安装的“眼不见心不烦”插件将在Chrome 27及更高版本下失效。\n\n推荐您【卸载】本插件并到【Chrome应用商店】安装新版插件，点击“确定”即可转入安装页面。\n\n该版本支持更高版本的Chrome，并加入了Chrome浏览器的专属功能（如设置同步）。')) {
			window.open('https://chrome.google.com/webstore/detail/aognaapdfnnldnjglanfbbklaakbpejm', '_blank');
		}
		localStorage.setItem(CHROME_KEY_ROOT + 'chromeExtTip', true); // 以后不再询问
		if (version === null || version >= 27) {
			// Chrome 27开始不再支持通过脚本注入方式获取unsafeWindow，也不再提供unsafeWindow符号
			if (typeof unsafeWindow === 'undefined') {
				console.warn('不支持Chrome ' + version + '，脚本停止运行！');
				return undefined;
			} else { 
				// Chrome 26以上仍然可以通过Tampermonkey获得unsafeWindow
				console.warn('使用第三方扩展提供的unsafeWindow');
				$.window = unsafeWindow;
			}
		} else {
			// Chrome 26及以前版本虽然存在unsafeWindow符号，但实际是沙箱中的window，但可以通过脚本注入方式获取unsafeWindow
			$.window = (function () {
				console.warn('Chrome ' + version + ': 通过注入脚本获取unsafeWindow');
				var div = document.createElement('div');
				div.setAttribute('onclick', 'return window;');
				return div.onclick();
			})();
		}
	} else if (typeof unsafeWindow === 'undefined') {
		alert('当前版本的“眼不见心不烦”(v${VER})不支持您使用的浏览器。\n\n插件目前只对Firefox和Chrome浏览器提供官方支持。');
		return undefined;
	} else {
		$.window = unsafeWindow;
	}
	//#elseif CHROME
	// Chrome插件版本主程序注入页面环境，可直接获取window对象
	$.window = window;
	localStorage.setItem(CHROME_KEY_ROOT + 'chromeExtInstalled', true);
	//#endif
	$.config = $.window.$CONFIG;
	if (!$.config) {
		//#if DEBUG
		console.warn('找不到$CONFIG，脚本停止运行！');
		//#endif
		return undefined;
	}
	$.uid = $.config.uid;
	if (!$.uid) {
		//#if DEBUG
		console.warn('找不到$CONFIG.uid，脚本停止运行！');
		//#endif
		return undefined;
	}
	//#if GREASEMONKEY
	if (!GM_getValue || (GM_getValue.toString && GM_getValue.toString().indexOf("not supported") > -1)) {
		$.get = function (name, defVal, callback) {
			var result = localStorage.getItem(CHROME_KEY_ROOT + name);
			if (result === null) { result = defVal; }
			if (typeof callback === 'function') {
				callback(result);
			} else {
				return result;
			}
		};
		$.set = function (name, value) {
			localStorage.setItem(CHROME_KEY_ROOT + name, value);
		};
	} else {
		$.get = function (name, defVal, callback) {
			var result = GM_getValue(name, defVal);
			if (typeof callback === 'function') {
				callback(result);
			} else {
				return result;
			}
		};
		$.set = GM_setValue;
	}
	//#elseif CHROME
	var callbacks = {}, messageID = 0;
	document.addEventListener('wbpPost', function (event) {
		event.stopPropagation();
		callbacks[event.detail.id](event.detail.value);
		delete callbacks[event.detail.id];
	});
	$.get = function (name, defVal, callback, sync) {
		// == LEGACY CODE START ==
		// 将先前版本插件的设置从localStorage转移到chrome.storage.local
		var lsName = 'weiboPlus.' + name;
		var value = localStorage.getItem(lsName);
		if (value !== null) {
			localStorage.removeItem(lsName);
			$.set(name, value);
			return callback(value);
		}
		// == LEGACY CODE END ==
		callbacks[++messageID] = callback;
		document.dispatchEvent(new CustomEvent('wbpGet', { detail: { 
			name : name,
			defVal : defVal,
			id : messageID,
			sync : sync
		}}));
	};
	$.set = function (name, value, sync) {
		document.dispatchEvent(new CustomEvent('wbpSet', { detail: {
			name : name,
			value : value,
			sync : sync
		}}));
	};
	//#endif
	// 删除节点
	$.remove = function (el) {
		if (el) { el.parentNode.removeChild(el); }
	};
	// 绑定click事件
	$.click = function (el, handler) {
		if (el) { el.addEventListener('click', handler, false); }
	};
	// 返回当前页面的位置
	$.scope = function () {
		return document.body.classList.contains('B_index') ? 1 : document.body.classList.contains('B_profile') ? 2 : 0;
	};
	return $;
})();

if (!$) { return false; }

// == LEGACY CODE START ==
// 如果正在运行旧版微博则停止运行并显示提示
if ($.config.any && $.config.any.indexOf('wvr=5') === -1) {
	if (confirm('您使用的“眼不见心不烦”版本(v${VER})不支持旧版微博。\n请升级到新版微博（V5），或使用较低版本（v1.0.6）的“眼不见心不烦”插件。\n如果您希望安装旧版“眼不见心不烦”，请点击“确认”。')) {
		window.open('http://code.google.com/p/weibo-content-filter/downloads/list', '_blank');
	}
	return false;
}
// == LEGACY CODE END ==

function Options () {
	// 各类型默认值
	var typeDefault = {
		keyword : [],
		string : '',
		bool : false,
		array : [],
		object : {},
		internal : null
	};
	for (var option in this.items) {
		if (this.items[option].length > 1) {
			// 使用属性默认值
			this[option] = this.items[option][1];
		} else {
			// 使用类型默认值
			this[option] = typeDefault[this.items[option][0]];
		}
	}
}

Options.prototype = {
	// 选项类型与默认值
	items : {
		version : ['internal', 0], // 内部变量：不在设置界面出现，不随设置导出
		whiteKeywords : ['keyword'],
		blackKeywords : ['keyword'],
		grayKeywords : ['keyword'],
		URLKeywords : ['keyword'],
		sourceKeywords : ['keyword'],
		sourceGrayKeywords : ['keyword'],
		userBlacklist : ['array'],
		tipBackColor : ['string', '#FFD0D0'],
		tipTextColor : ['string', '#FF8080'],
		readerModeIndex : ['bool'],
		readerModeProfile : ['bool'],
		readerModeTip : ['internal', false], // 内部变量：不在设置界面出现，不随设置导出
		readerModeWidth : ['string', 750],
		readerModeBackColor : ['string', 'rgba(100%,100%,100%,0.8)'],
		mergeSidebars : ['bool'],
		floatSidebar : ['bool'],
		unwrapText : ['bool'],
		directBigImg : ['bool'],
		showAllGroups : ['bool'],
		showAllMsgNav : ['bool'],
		noDefaultFwd : ['bool'],
		noDefaultGroupPub : ['bool'],
		clearDefTopic : ['bool'],
		overrideMyBack : ['bool'],
		overrideOtherBack : ['bool'],
		backColor : ['string', 'rgba(100%,100%,100%,0.2)'],
		overrideMySkin : ['bool'],
		overrideOtherSkin : ['bool'],
		skinID : ['string', 'skinvip001'],
		filterOthersOnly : ['bool'],
		filterPaused : ['bool'],
		filterSmiley : ['bool'],
		filterPromotions : ['bool', true],
		filterDeleted : ['bool'],
		filterFeelings : ['bool'],
		filterDupFwd : ['bool'],
		maxDupFwd : ['string', 1],
		filterFlood : ['bool'],
		maxFlood : ['string', 5],
		//#if GREASEMONKEY
		autoUpdate : ['bool', true],
		//#endif
		updateNotify : ['bool', true],
		//#if CHROME
		autoSync : ['bool', true],
		//#endif
		floatBtn : ['bool', true],
		useCustomStyles : ['bool', true],
		customStyles : ['string'],
		hideMods : ['array']
	},
	// 去除内部变量并转换为字符串
	strip : function () {
		var stripped = {};
		for (var option in this.items) {
			if (this.items[option][0] !== 'internal') {
				stripped[option] = this[option];
			}
		}
		return JSON.stringify(stripped);
	},
	// 保存设置
	save : function (noSync) {
		$.set($.uid.toString(), JSON.stringify(this));
		//#if CHROME
		if (!noSync && $options.autoSync) {
			// 不必同步内部变量
			$.set($.uid.toString(), this.strip(), true);
		}
		//#endif
	},
	// 载入/导入设置，输入的str为undefined（首次使用时）或string（非首次使用和导入设置时）
	load : function (str, strip) {
		var parsed = {};
		if (str) {
			try {
				parsed = JSON.parse(str.replace(/\n/g, ''));
				if (typeof parsed !== 'object') { throw 0; }
			} catch (e) {
				parsed = {};
				str = null; // 出错，最后返回false
			}
		}
		// 填充选项
		for (var option in this.items) {
			if (option in parsed) {
				this[option] = parsed[option];
			}
		}
		return (str !== null);
	}
};

var $options = new Options();

//#if GREASEMONKEY
var $update = (function () {
	// 检查更新
	var checkUpdate = function (event) {
		GM_xmlhttpRequest({
			method: 'GET',
			// 只载入metadata
			url: 'http://userscripts.org/scripts/source/114087.meta.js?' + new Date().getTime(),
			headers: {'Cache-Control': 'no-cache'},
			onload: function (result) {
				if (!result.responseText.match(/@version\s+(.*)/)) { return; }
				$.set('lastCheckUpdateSuccess', new Date().getTime().toString());
				var ver = RegExp.$1;
				if (!result.responseText.match(/@revision\s+(\d+)/) || RegExp.$1 <= $.version) {
					// 自动检查更新且并无新版本时不必提示
					// 用户手动检查时event是click事件对象
					if (event) { alert('您使用的“眼不见心不烦”(v${VER})已经是最新版。'); }
					return;
				}
				var features = '';
				if (result.responseText.match(/@features\s+(.*)/)) {
					features = '- ' + RegExp.$1.split('；').join('\n- ') + '\n\n';
				}
				// 显示更新提示
				if (confirm('“眼不见心不烦”新版本v' + ver + '可用。\n\n' + features + '如果您希望更新，请点击“确认”打开插件主页。')) {
					window.open('http://userscripts.org/scripts/show/114087', '_blank');
				}
			}
		});
	};
	// 自动检查更新
	if ($options.autoUpdate) {
		// 部分自动更新代码改写自http://loonyone.livejournal.com/
		// 防止重复检查（同时打开多个窗口时），间隔至少两分钟
		var DoS_PREVENTION_TIME = 2 * 60 * 1000;
		var lastAttempt = $.get('lastCheckUpdateAttempt', 0);
		var now = new Date().getTime();
		if (now - lastAttempt > DoS_PREVENTION_TIME) {
			$.set('lastCheckUpdateAttempt', now.toString());
			// 每周检查一次，避免频繁升级
			var ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
			var lastSuccess = $.get('lastCheckUpdateSuccess', 0);
			if (now - lastSuccess > ONE_WEEK) { checkUpdate(); }
		}
	}
	return checkUpdate;
})();
//#endif

var $dialog = (function () {
	var shown = false, dialog, content, STK;
	var getDom = function (node) {
		return content.getDom(node);
	};
	var bind = function (node, func, event) {
		STK.core.evt.addEvent(content.getDom(node), event || 'click', func);
	};
	// 从显示列表建立关键词数组
	var getKeywords = function (id, attr) {
		return Array.prototype.map.call(getDom(id).childNodes, function (keyword) {
			return attr ? keyword.getAttribute(attr) : keyword.textContent;
		});
	};
	// 将关键词添加到显示列表
	var addKeywords = function (id, list, attr) {
		var keywords;
		if (list instanceof Array) {
			keywords = list;
		} else {
			keywords = []; 
			var str = ' ' + getDom(list).value + ' ', regex = new RegExp('(\\s"([^"]+)"\\s|\\s([^\\s]+)\\s)', 'g'), result;
			while ((result = regex.exec(str)) !== null) {
				keywords.push(result[2] || result[3]); // 提取关键词
				--regex.lastIndex;
			}
		}
		var illegalRegex = keywords.filter(function (keyword) {
			if (!keyword || getKeywords(id, attr).indexOf(keyword) > -1) { return false; }
			var keywordLink = document.createElement('a');
			// 关键词是正则表达式？
			if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
				try {
					// 尝试创建正则表达式，检验正则表达式的有效性
					// 调用test()是必须的，否则浏览器可能跳过该语句
					RegExp(keyword.substring(1, keyword.length - 1)).test('');
				} catch (e) {
					return true;
				}
				keywordLink.className = 'regex';
			}
			keywordLink.title = '点击删除';
			keywordLink.setAttribute('action-type', 'remove');
			if (attr) { keywordLink.setAttribute(attr, keyword); }
			keywordLink.href = 'javascript:void(0)';
			keywordLink.textContent = keyword;
			getDom(id).appendChild(keywordLink);
			return false;
		});
		if (!(list instanceof Array)) {
			// 在文本框中显示无效的正则表达式并闪烁提示
			getDom(list).value = illegalRegex.join(' ');
			if (illegalRegex.length) {
				STK.common.extra.shine(getDom(list));
			}
		}
	};
	var usercardLoaded = false;
	// 将用户添加到屏蔽用户列表
	var addUsers = function (id, list) {
		var updateOnly = !list, div = getDom(id);
		// 整个列表只载入一次
		if (updateOnly && usercardLoaded) { return; }
		var users = updateOnly ? getKeywords(id, 'uid') : getDom(list).value.split(' '),
			unprocessed = users.length, unfound = [];
		var searcher = STK.common.trans.relation.getTrans('userCard', { onComplete : 
			function (result, data) {
				var link;
				if (updateOnly) {
					link = div.querySelector('a[uid="' + data.id + '"]');
				} else {
					link = document.createElement('a');
				}
				if (result.code === '100000') { // 成功
					var img = result.data.match(/<img[^>]+>/)[0];
					if (!updateOnly) { data.id = img.match(/uid="([^"]+)"/)[1]; }
					// 防止重复添加
					if (updateOnly || getKeywords(id, 'uid').indexOf(data.id) === -1) {
						link.innerHTML = '<img ' + img.match(/src="[^"]+"/)[0] + ' /><br />' + img.match(/title="([^"]+)"/)[1];
						if (!updateOnly) {
							// 添加新的用户
							link.title = '点击删除';
							link.href = 'javascript:void(0)';
							link.setAttribute('uid', data.id);
							link.setAttribute('action-type', 'remove');
							div.appendChild(link);
						}
					}
				} else if (updateOnly) {
					link.innerHTML += '<br />（未找到）';
				} else {
					unfound.push(data.name);
				}
				if (--unprocessed === 0) {
					// 全部处理完成，在文本框中显示未被添加的用户并闪烁提示
					getDom(list).value = unfound.join(' ');
					if (unfound.length) {
						STK.common.extra.shine(getDom(list));
					}
				}
			} });
		users.forEach(function (user) {
			var request = { type : 1 };
			if (updateOnly) {
				request.id = user;
			} else {
				request.name = user;
			}
			searcher.request(request);
		});
		usercardLoaded = true;
	};
	// 返回当前设置（可能未保存）
	var exportSettings = function () {
		var options = new Options();
		for (var option in options.items) {
			switch (options.items[option][0]) {
			case 'keyword':
				options[option] = getKeywords(option + 'List');
				break;
			case 'string':
				options[option] = getDom(option).value;
				break;
			case 'bool':
				options[option] = getDom(option).checked;
				break;
			case 'array':
				options[option] = [];
				break;
			case 'object':
				options[option] = {};
				break;
			case 'internal':
				// 内部变量保持不变
				// WARNING: 内部变量如果是数组或对象，以下的浅拷贝方式可能导致设置的意外改变
				options[option] = $options[option];
				break;
			}
		}
		options.userBlacklist = getKeywords('userBlacklist', 'uid');
		for (var module in $page.modules) {
			if (getDom('hide' + module).checked) {
				options.hideMods.push(module);
			}
		}
		getDom('settingsString').value = options.strip();
		return options;
	};
	// 更新设置窗口内容，exportSettings()的反过程
	var importSettings = function (options) {
		for (var option in options.items) {
			switch (options.items[option][0]) {
			case 'keyword':
				getDom(option).value = '';
				getDom(option + 'List').innerHTML = '';
				addKeywords(option + 'List', options[option]);
				break;
			case 'string':
				getDom(option).value = options[option];
				break;
			case 'bool':
				getDom(option).checked = options[option];
				break;
			}
		}
		getDom('userBlacklistNew').value = '';
		getDom('userBlacklist').innerHTML = '';
		addKeywords('userBlacklist', options.userBlacklist, 'uid');
		usercardLoaded = false;
		var tipBackColor = getDom('tipBackColor').value,
			tipTextColor = getDom('tipTextColor').value,
			tipSample = getDom('tipSample');
		tipSample.style.backgroundColor = tipBackColor;
		tipSample.style.borderColor = tipTextColor;
		tipSample.style.color = tipTextColor;
		for (var module in $page.modules) {
			getDom('hide' + module).checked = (options.hideMods.indexOf(module) > -1);
		}
		getDom('settingsString').value = options.strip();
	};
	// 创建设置窗口
	var createDialog = function () {
		// 由于操作是异步进行的，脚本载入时STK可能尚未载入，尤其是在Firefox中
		// 鉴于只有$dialog使用STK，将其设置为内部变量，仅在打开设置窗口时载入
		STK = $.window.STK;
		if (!STK) {
			console.warn('页面尚未载入完成，无法打开设置页面！')
			return false;
		}
		dialog = STK.ui.dialog({isHold: true});
		dialog.setTitle('“眼不见心不烦”(v${VER})设置');
		content = (STK.module.layer || STK.ui.mod.layer)('${HTML}');
		dialog.setContent(content.getOuter());
		// 修改屏蔽提示颜色事件
		bind('tipBackColor', function () {
			getDom('tipSample').style.backgroundColor = this.value;
		}, 'blur');
		bind('tipTextColor', function () {
			getDom('tipSample').style.borderColor = this.value;
			getDom('tipSample').style.color = this.value;
		}, 'blur');
		var events = STK.core.evt.delegatedEvent(content.getInner());
		// 添加关键词按钮点击事件
		events.add('add', 'click', function (action) {
			addKeywords(action.data.list, action.data.text);
		});
		// 清空关键词按钮点击事件
		events.add('clear', 'click', function (action) {
			getDom(action.data.list).innerHTML = '';
		});
		// 删除关键词事件
		events.add('remove', 'click', function (action) {
			$.remove(action.el);
		});
		// 添加用户按钮点击事件
		events.add('addUser', 'click', function (action) {
			addUsers(action.data.list, action.data.text);
		});
		// 复选框标签点击事件
		bind('inner', function (event) {
			var node = event.target;
			// 标签下可能有span等元素
			if (node.parentNode && node.parentNode.tagName === 'LABEL') {
				node = node.parentNode;
			}
			if (node.tagName === 'LABEL') {
				event.preventDefault();
				event.stopPropagation();
				if (node.getAttribute('for')) {
					// 有for属性则使用之
					getDom(node.getAttribute('for')).click();
				} else {
					// 默认目标在标签之前（同级）
					node.previousSibling.click();
				}
			}
		});
		// 标签点击事件
		bind('tabHeaders', function (event) {
			var node = event.target;
			if (node && node.tagName === 'A') {
				node.className = 'current';
				getDom(node.getAttribute('tab')).style.display = '';
				Array.prototype.forEach.call(this.childNodes, function (child) {
					if (node !== child) {
						child.className = '';
						getDom(child.getAttribute('tab')).style.display = 'none';
					}
				});
			}
		});
		// 点击“设置导入/导出”标签时更新内容
		bind('tabHeaderSettings', exportSettings);
		// 点击“用户”标签时载入用户黑名单头像
		bind('tabHeaderUser', function () { addUsers('userBlacklist'); });
		bind('hideAll', function () {
			for (var module in $page.modules) {
				getDom('hide' + module).checked = true;
			}
		});
		bind('hideInvert', function () {
			for (var module in $page.modules) {
				var item = getDom('hide' + module);
				item.checked = !item.checked;
			}
		});
		// 对话框按钮点击事件
		bind('import', function () {
			var options = new Options();
			if (options.load(getDom('settingsString').value)) {
				importSettings(options);
				alert('设置导入成功！');
			} else {
				alert('设置导入失败！\n设置信息格式有问题。');
			}
		});
		//#if DEBUG
		bind('execute', function () {
			var snippet = getDom('debugSnippet').value;
			//#if CHROME
			if (getDom('extScope').checked) {
				document.dispatchEvent(new CustomEvent('wbpDebug', { detail: { 
					snippet : snippet
				}}));
				return;
			}
			//#endif
			try {
				console.log(eval('(function(){' + snippet + '})();'));
			} catch (err) {
				console.error(err);
			}
		});
		//#endif
		//#if GREASEMONKEY
		bind('checkUpdate', $update);
		//#endif
		bind('OK', function () {
			$options = exportSettings();
			$options.save();
			$filter();
			$page();
			dialog.hide();
		});
		bind('cancel', dialog.hide);
		STK.custEvent.add(dialog, 'hide', function () {
			shown = false;
		});
		return true;
	};
	// 显示设置窗口
	var show = function () {
		if (!dialog && !createDialog()) {
			return;
		}
		shown = true;
		importSettings($options);
		if (getDom('tabHeaderUser').classList.contains('current')) {
			addUsers('userBlacklist');
		}
		dialog.show().setMiddle();
	};
	show.shown = function () {
		return shown;
	};

	return show;
})();

// 关键词过滤器
var $filter = (function () {
	var forwardFeeds = {}, floodFeeds = {};
	// 搜索指定文本中是否包含列表中的关键词
	var search = function  (str, key) {
		var text = str.toLowerCase(), keywords = $options[key];
		if (str === '' || keywords.length === 0) { return ''; }
		var matched = keywords.filter(function (keyword) {
			if (!keyword) { return false; }
			if (keyword.length > 2 && keyword.charAt(0) === '/' && keyword.charAt(keyword.length - 1) === '/') {
				try {
					// 尝试匹配正则表达式
					return (RegExp(keyword.substring(1, keyword.length - 1)).test(str));
				} catch (e) { }
			} else {
				return keyword.split('+').every(function (k) { return text.indexOf(k.toLowerCase()) > -1; });
			}
			return false;
		});
		return matched.length ? matched[0] : '';
	};
	// 获取微博正文
	var converter = document.createElement('div');
	var getText = function (content) {
		// 替换表情，去掉标签
		if ($options.filterSmiley) {
			converter.innerHTML = content.innerHTML.replace(/<img[^>]+alt="(\[[^\]">]+\])"[^>]*>/g, '$1')
					.replace(/<\/?[^>]+>/g, '').replace(/[\r\n\t]/g, '').trim();
			// 利用未插入文档的div进行HTML反转义
			return converter.textContent;
		}
		return content.textContent.replace(/[\r\n\t]/g, '').trim();
	};
	// 过滤微博来源
	var searchSource = function (source, keywords) {
		if (!source) {
			source = '未通过审核应用';
		} else {
			// 过长的应用名称会被压缩，完整名称存放在title属性中
			source = source.title || source.textContent;
		}
		return search(source, keywords);
	};
	// 过滤单条微博
	var apply = function (feed) {
		if (feed.firstChild && feed.firstChild.className === 'wbpTip') {
			// 已被灰名单屏蔽过，移除屏蔽提示和分隔线
			feed.removeChild(feed.firstChild);
			feed.removeChild(feed.firstChild);
		}
		var mid = feed.getAttribute('mid');
		if (!mid) { return false; } // 动态没有mid
		var scope = $.scope(), isForward = (feed.getAttribute('isforward') === '1');
		var author = (scope === 1) ? feed.querySelector('.WB_detail>.WB_info .WB_name') : null,
			content = feed.querySelector('.WB_detail>.WB_text'),
			source = feed.querySelector('.WB_detail>.WB_func .WB_from>em+a'),
			fwdAuthor = feed.querySelector('.WB_media_expand .WB_info .WB_name'),
			fwdContent = feed.querySelector('.WB_media_expand .WB_text'),
			fwdSource = feed.querySelector('.WB_media_expand .WB_func .WB_from>em+a'),
			fwdLink = feed.querySelector('.WB_media_expand .WB_func .WB_time'),
			fmid = isForward ? (fwdLink ? fwdLink.href : null) : null,
			uid = author ? author.getAttribute('usercard') : null;

		if (!content) { return false; }
		var text = (scope === 1) ? '@' + author.getAttribute('nick-name') + ': ' : ''; 
		text += getText(content);
		if (isForward && fwdAuthor && fwdContent) {
			// 转发内容
			text += '////@' + fwdAuthor.getAttribute('nick-name') + ': ' + getText(fwdContent);
		}
		//#if DEBUG
		console.log(text);
		//#endif

		if ($options.filterPaused || // 暂停屏蔽
			($options.filterOthersOnly && feed.querySelector('.WB_detail>.WB_func>.WB_handle a[action-type="feed_list_delete"]')) || // 不要屏蔽自己的微博（判据：工具栏是否有“删除”）
			search(text, 'whiteKeywords')) { // 白名单条件
			//#if DEBUG
			console.warn('↑↑↑【白名单微博不会被屏蔽】↑↑↑');
			//#endif
		} else if ((function () { // 黑名单条件
			// 屏蔽推广微博
			if (scope === 1 && $options.filterPromotions && feed.getAttribute('feedtype') === 'ad') {
				//#if DEBUG
				console.warn('↑↑↑【推广微博被屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 屏蔽已删除微博的转发（是转发但无转发作者）
			if ($options.filterDeleted && isForward && !fwdAuthor) {
				//#if DEBUG
				console.warn('↑↑↑【已删除微博的转发被屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 用户黑名单
			if ((scope === 1 && author && $options.userBlacklist.indexOf(author.getAttribute('usercard').match(/id=(\d+)/)[1]) > -1) ||
					(isForward && fwdAuthor && $options.userBlacklist.indexOf(fwdAuthor.getAttribute('usercard').match(/id=(\d+)/)[1]) > -1)) {
				//#if DEBUG
				console.warn('↑↑↑【被用户黑名单屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 屏蔽写心情微博
			if ($options.filterFeelings && feed.querySelector('div.feelingBoxS')) {
				//#if DEBUG
				console.warn('↑↑↑【写心情微博被屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 屏蔽指定来源
			if (searchSource(source, 'sourceKeywords') ||
					(isForward && searchSource(fwdSource, 'sourceKeywords'))) {
				//#if DEBUG
				console.warn('↑↑↑【被来源黑名单屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 反版聊（屏蔽重复转发）
			if ($options.filterDupFwd && fmid && forwardFeeds[fmid]) {
				if (forwardFeeds[fmid].length >= Number($options.maxDupFwd) && forwardFeeds[fmid].indexOf(mid) === -1) {
					//#if DEBUG
					console.warn('↑↑↑【被反版聊功能屏蔽】↑↑↑');
					//#endif
					return true;
				}
			}
			// 反刷屏（屏蔽同一用户大量发帖）
			if ($options.filterFlood && uid && floodFeeds[uid]) {
				if (floodFeeds[uid] >= Number($options.maxFlood) && floodFeeds[uid].indexOf(mid) === -1) {
					//#if DEBUG
					console.warn('↑↑↑【被反刷屏功能屏蔽】↑↑↑');
					//#endif
					return true;
				}
			}
			// 在微博内容中搜索屏蔽关键词
			if (search(text, 'blackKeywords')) {
				//#if DEBUG
				console.warn('↑↑↑【被关键词黑名单屏蔽】↑↑↑');
				//#endif
				return true;
			}
			// 搜索t.cn短链接
			return Array.prototype.some.call(feed.getElementsByTagName('A'), function (link) {
				if (link.href.substring(0, 12) === 'http://t.cn/' && search(link.title, 'URLKeywords')) {
					//#if DEBUG
					console.warn('↑↑↑【被链接黑名单屏蔽】↑↑↑');
					//#endif
					return true;
				}
				return false;
			});
		})()) {
			feed.style.display = 'none'; // 直接隐藏，不显示屏蔽提示
			return true;
		} else { // 灰名单条件
			// 搜索来源灰名单
			var sourceKeyword = searchSource(source, 'sourceGrayKeywords'), 
				keyword = search(text, 'grayKeywords');
			if (!sourceKeyword && isForward) {
				sourceKeyword = searchSource(fwdSource, 'sourceGrayKeywords');
			}
			if (keyword || sourceKeyword) {
				// 找到了待隐藏的微博
				var authorClone;
				if (scope === 1) {
					// 添加隐藏提示链接
					authorClone = author.cloneNode(false);
					authorClone.textContent = '@' + author.getAttribute('nick-name');
					authorClone.className = '';
				}
				var showFeedLink = document.createElement('a');
				showFeedLink.href = 'javascript:void(0)';
				showFeedLink.className = 'wbpTip';
				var keywordLink = document.createElement('a');
				keywordLink.href = 'javascript:void(0)';
				keywordLink.className = 'wbpTipKeyword';
				keywordLink.textContent = keyword || sourceKeyword;
				if (scope === 1) {
					showFeedLink.appendChild(document.createTextNode('本条来自'));
					showFeedLink.appendChild(authorClone);
					showFeedLink.appendChild(document.createTextNode('的微博因'));
				} else if (scope === 2) {
					showFeedLink.appendChild(document.createTextNode('本条微博因'));
				}
				showFeedLink.appendChild(document.createTextNode(keyword ? '内容包含“' : '来源名称包含“'));
				showFeedLink.appendChild(keywordLink);
				showFeedLink.appendChild(document.createTextNode('”而被隐藏，点击显示'));
				var line = document.createElement('div');
				line.className = 'S_line2 wbpTipLine';
				feed.insertBefore(line, feed.firstChild);
				feed.insertBefore(showFeedLink, line);
				return true;
			}
		}
		// 显示微博并记录
		feed.style.display = '';
		if (!$options.filterPaused) {
			if ($options.filterDupFwd && fmid) {
				if (!forwardFeeds[fmid]) {
					forwardFeeds[fmid] = [];
				}
				if (forwardFeeds[fmid].indexOf(mid) === -1) {
					forwardFeeds[fmid].push(mid);
				}
			}
			if ($options.filterFlood && uid) {
				if (!floodFeeds[uid]) {
					floodFeeds[uid] = [];
				}
				if (floodFeeds[uid].indexOf(mid) === -1) {
					floodFeeds[uid].push(mid);
				}
			}
		}
		return false;
	};
	// 过滤所有微博
	var applyToAll = function () {
		// 过滤所有微博
		if ($.scope()) {
			forwardFeeds = {}; floodFeeds = {};
			Array.prototype.forEach.call(document.querySelectorAll('.WB_feed_type'), apply);
		}
	};
	// 屏蔽提示相关事件的冒泡处理
	var bindTipOnClick = function (node) { 
		if (!node) { return; }
		$.click(node, function (event) {
			var node = event.target;
			if (node && node.tagName === 'A') {
				if (node.className === 'wbpTipKeyword') {
					$dialog();
					event.stopPropagation(); // 防止事件冒泡触发屏蔽提示的onclick事件
				} else if (node.className === 'wbpTip') {
					$.remove(node.nextSibling); // 分隔线
					$.remove(node);
				}
			}
		});
	};

	// 处理动态载入的微博
	if ($.scope()) {
		bindTipOnClick($.select('.WB_feed'));
	}
	// 点击“查看大图”事件拦截处理
	document.addEventListener('click', function (event) {
		if (!$options.directBigImg) { return true; }
		var node = event.target;
		if (node && node.getAttribute('action-type') === 'images_view_tobig' &&
				node.getAttribute('action-data').match(/pid=(\w+)&mid=(\d+)&uid=(\d+)/)) {
			window.open('http://photo.weibo.com/' + RegExp.$3 + 
				'/wbphotos/large/mid/' + RegExp.$2 +
				'/pid/' + RegExp.$1, '_blank');
			event.stopPropagation();
		}
	}, true); // 使用事件捕捉以尽早触发事件，避免与新浪自带事件撞车
	document.addEventListener('DOMNodeInserted', function (event) {
		if ($.scope() === 0) { return; }
		var node = event.target;
		if (node.tagName === 'DIV' && node.classList.contains('WB_feed_type')) {
			// 处理动态载入的微博
			apply(node);
		} else if (node.tagName === 'DIV' && node.classList.contains('W_loading')) {
			var requestType = node.getAttribute('requesttype');
			// 仅在搜索和翻页时需要初始化反刷屏/反版聊记录
			// 其它情况（新微博：newFeed，同页接续：lazyload）下不需要
			if (requestType === 'search' || requestType === 'page') {
				forwardFeeds = {}; floodFeeds = {};
			}
		} else if (node.tagName === 'DIV' && node.classList.contains('WB_feed')) {
			// 微博列表作为pagelet被一次性载入
			bindTipOnClick(node);
			applyToAll();
		}
	}, false);

	return applyToAll;
})();

// 修改页面
var $page = (function () {
	// 模块屏蔽设置
	var modules = {
			Ads : '#plc_main [id^="pl_rightmod_ads"], #Box_right [id^="ads_"], #trustPagelet_indexright_recom .hot_topicad, div[ad-data], .WB_feed .popular_buss',
			Stats : '#pl_rightmod_myinfo .user_atten',
			InterestUser : '#trustPagelet_recom_interestv5', // 动态右边栏
			Topic : '#trustPagelet_zt_hottopicv5', // 动态右边栏
			Member : '#trustPagelet_recom_memberv5',
			WeibaRecom : '#trustPagelet_recom_weiba', // 动态右边栏
			AppRecom : '#trustPagelet_recom_app', // 动态右边栏
			Notice : '#pl_rightmod_noticeboard',
			Footer : 'div.global_footer',
			RecommendedTopic : '#pl_content_publisherTop div[node-type="recommendTopic"]',
			App : '#pl_leftnav_app',
			Level : 'span.W_level_ico',
			CommentTip : 'div[node-type="feed_privateset_tip"]',
			MemberTip : 'div[node-type="feed_list_shieldKeyword"]',
			TimelineMods : '.B_index .WB_feed .WB_feed_type:not([mid])',
			FollowGuide : '.layer_userguide_brief',
			TopComment : '#pl_content_commentTopNav',
			Medal : '.pf_badge_icon',
			RecomFeed : 'div[node-type="feed_list_recommend"]',
			Nofollow : '#pl_profile_unfollow',
			MyRightSidebar : '.B_profile .W_main_c, .B_profile .WB_feed .repeat .input textarea { width: 100% } .B_profile .W_main_2r',
			ProfCover : '#plc_profile_header { min-height: 250px } #plc_profile_header .pf_head { top: 10px } #plc_profile_header .pf_info { margin-top: 20px } #plc_profile_header .S_bg5 { background-color: transparent !important } #pl_profile_cover',
			ProfStats : '#plc_profile_header { min-height: 195px } #pl_profile_photo .user_atten',
			MyRelation : '#pl_profile_moduleMyRelation',
			Relation : '#pl_profile_moduleHisRelation',
			Album : '#pl_profile_modulealbum',
			AppWidget : '#pl_profile_appWidget, #trustPagelet_profile_openApplist',
			FeedRecom : '.B_onefeed #trustPagelet_biz_recommend',
			MemberIcon : '.ico_member, .ico_member_dis',
			VerifyIcon : '.approve, .approve_co',
			DarenIcon : '.ico_club',
			VgirlIcon : '.ico_vlady',
			TravelIcon : '.ico_airball'
		};
	// 显示设置链接
	var showSettingsBtn = function () {
		if (!$('wbpShowSettings')) {
			var groups = $.select('ul.sort');
			if (!groups) { return false; }
			var tab = document.createElement('li');
			tab.id = 'wbpShowSettings';
			tab.className = 'item';
			tab.innerHTML = '<a href="javascript:void(0)" class="item_link S_func1">眼不见心不烦</a>';
			$.click(tab, $dialog);
			groups.appendChild(tab);
		}
		return true;
	};
	// 应用浮动按钮设置
	var toggleFloatSettingsBtn = (function () {
		var floatBtn = null, lastTime = null, lastTimerID = null;
		// 仿照STK.comp.content.scrollToTop延时100ms显示/隐藏，防止scroll事件调用过于频繁
		function scrollDelayTimer() {
			if ((lastTime !== null && (new Date()).getTime() - lastTime < 500)) {
				clearTimeout(lastTimerID);
				lastTimerID = null;
			}
			lastTime = (new Date()).getTime();
			lastTimerID = setTimeout(function () {
				if (floatBtn) {
					floatBtn.style.visibility = window.scrollY > 0 ? 'visible' : 'hidden';
				}
			}, 100);
		}
		return function () {
			if (!$options.floatBtn && floatBtn) {
				window.removeEventListener('scroll', scrollDelayTimer, false);
				$.remove(floatBtn);
				floatBtn = null;
				return true;
			} else if ($options.floatBtn && !floatBtn) {
				var scrollToTop = $('base_scrollToTop');
				if (!scrollToTop) { return false; }
				floatBtn = document.createElement('a');
				floatBtn.href = 'javascript:void(0)';
				floatBtn.title = '眼不见心不烦';
				floatBtn.id = 'wbpFloatBtn';
				floatBtn.innerHTML = '<span class="S_line5" style="padding: 4px 0 6px; height: auto">★</span>';
				floatBtn.className = 'W_gotop S_line3';
				floatBtn.style.bottom = '75px';
				floatBtn.style.height = '24px';
				$.click(floatBtn, $dialog);
				scrollToTop.parentNode.appendChild(floatBtn);
				window.addEventListener('scroll', scrollDelayTimer, false);
				scrollDelayTimer();
				return true;
			}
			return false;
		};
	})();
	// 极简阅读模式（仅在个人首页生效）
	var toggleReaderMode = function () {
		var readerModeStyles = $('wbpReaderModeStyles');
		if ($options.readerModeIndex || $options.readerModeProfile) {
			if (!readerModeStyles) {
				readerModeStyles = document.createElement('style');
				readerModeStyles.type = 'text/css';
				readerModeStyles.id = 'wbpReaderModeStyles';
				document.head.appendChild(readerModeStyles);
			}
			var width = Number($options.readerModeWidth);
			readerModeStyles.innerHTML = '';
			if ($options.readerModeIndex) {
				readerModeStyles.innerHTML += '.B_index .W_main_l, .B_index .W_main_r, .B_index #Box_center>div:not(#pl_content_homeFeed), .B_index .group_read, .B_index .global_footer { display: none }\n' +
						'.B_index #pl_content_top, .B_index .WB_global_nav { top: -40px }\n' +
						'.B_index { background-position-y: -40px }\n' +
						'.B_index .W_miniblog { padding-top: 20px; background-position-y: -40px }\n' +
						'.B_index .W_main { width: ' + width + 'px !important; background: ' + $options.readerModeBackColor + ' }\n' +
						'.B_index #Box_center, .B_index .W_main_a { width: ' + width + 'px }\n' +
						'.B_index .WB_feed .repeat .input textarea { width: 100% }\n' +
						'.B_index .WB_feed .WB_screen { margin-left: ' + (width-48) + 'px }\n' +
						'.B_index .W_gotop { margin-left: ' + (width/2) + 'px !important }\n';
			}
			if ($options.readerModeProfile) { // 个人主页
				readerModeStyles.innerHTML += '.B_profile #plc_profile_header, .B_profile #pl_profile_nav, .B_profile #pl_profile_cover, .B_profile .group_read, .B_profile .W_main_2r, .B_profile .group_read, .B_profile .global_footer { display: none }\n' +
						'.B_profile #pl_content_top, .B_profile .WB_global_nav { top: -40px }\n' +
						'.B_profile { background-position-y: -40px }\n' +
						'.B_profile .W_miniblog { padding-top: 20px; background-position-y: -40px }\n' +
						'.B_profile .W_main { width: ' + width + 'px !important; background: ' + $options.readerModeBackColor + ' }\n' +
						'.B_profile .W_main_c { padding-top: 0; width: ' + width + 'px }\n' +
						'.B_profile .WB_feed .repeat .input textarea { width: 100% }\n' +
						'.B_profile .W_gotop { margin-left: ' + (width/2) + 'px !important }\n';
			}
			if (!$options.readerModeTip && (
					($.scope() === 1 && $options.readerModeIndex) ||
					($.scope() === 2 && $options.readerModeProfile))) {
				alert('欢迎进入极简阅读模式！\n\n您可以按【F8】键快速开关本模式，也可以在“眼不见心不烦”插件设置“改造版面”页进行选择。');
				$options.readerModeTip = true;
				$options.save(true);
			}
		} else if (readerModeStyles) {
			$.remove(readerModeStyles);
		}
	};
	// 覆盖当前模板设置
	var overrideSkin = function () {
		var formerStyle = $('custom_style') || document.head.querySelector('link:not([id])[href*="/skin/"]'),
			skinCSS = $('wbpOverrideSkin');
		if (!formerStyle) { return; }
		if (($.uid === $.config.oid && $options.overrideMySkin) ||
			($.uid !== $.config.oid && $options.overrideOtherSkin)) {
			if (!skinCSS) {
				skinCSS = document.createElement('link');
				skinCSS.id = 'wbpOverrideSkin';
				skinCSS.type = 'text/css';
				skinCSS.rel = 'stylesheet';
				skinCSS.charset = 'utf-8';
				document.head.insertBefore(skinCSS, formerStyle);
			}
			skinCSS.href = $.config.cssPath + 'skin/' + $options.skinID + 
					'/skin' + ($.config.lang !== 'zh-cn' ? '_CHT' : '') +
					'.css?version=' + $.config.version;
			formerStyle.disabled = true;
		} else if (skinCSS) {
			$.remove(skinCSS);
			formerStyle.disabled = false;
		}
	};
	// 2013年6月起右边栏模块不再有固定ID，为其打上ID
	var tagRightbarMods = function (rightBar) {
		var hrefs = {
			'http://huati.weibo.com/?refer=index_hot' : 'Topic',
			'http://weibo.com/find/i' : 'InterestUser',
			'http://weiba.weibo.com/' : 'WeibaRecom',
			'http://app.weibo.com/' : 'AppRecom'
		}, mods = rightBar.querySelectorAll('.WB_right_module'), title;
		for (var i = 0; i < mods.length; ++i) {
			title = mods[i].querySelector('.right_title a');
			if (title && title.href in hrefs) {
				mods[i].id = modules[hrefs[title.href]].substring(1);
			}
		}		
	}
	// 屏蔽模块
	var hideModules = function () {
		var cssText = '';
		$options.hideMods.forEach(function (module) {
			if (modules[module]) {
				cssText += modules[module] + ' { display: none !important }\n';
			}
		});
		// 屏蔽提示相关CSS
		var tipBackColor = $options.tipBackColor;
		var tipTextColor = $options.tipTextColor;
		cssText += '.wbpTip:not(:hover) { background-color: ' + tipBackColor + '; border-color: ' + tipTextColor + '; color: ' + tipTextColor + '; }';
		// 更新CSS
		var styles = $('wbpModuleStyles');
		if (!styles) {
			styles = document.createElement('style');
			styles.type = 'text/css';
			styles.id = 'wbpModuleStyles';
			document.head.appendChild(styles);
		}
		styles.innerHTML = cssText + '\n';
		// 单独处理“为你推荐”弹窗
		if ($options.hideMods.indexOf('FollowGuide') > -1) {
			// 载入页面时，如果DOM中包含#pl_guide_homeguide > div[node-type="follow_dialog"]则会弹出
			// 如果能抢在pl.guide.homeguide.index()之前去除，可以避免弹窗出现
			$.remove($.select('#pl_guide_homeguide > div[node-type="follow_dialog"]'));
			// 如果弹窗已经显示，则关闭之
			//var closeBtn = $.select('.layer_userguide_brief .W_close');
			//if (closeBtn) { closeBtn.click(); }
			// 模拟点击关闭按钮会导致页面刷新，改为去除弹窗DOM及其下的overlay
			var followGuide = $.select('.layer_userguide_brief');
			if (followGuide) {
				while (!followGuide.classList.contains('W_layer')) { followGuide = followGuide.parentNode; }
				if (followGuide.previousSibling.style.zIndex === followGuide.style.zIndex) {
					$.remove(followGuide.previousSibling); // 覆盖层
				}
				$.remove(followGuide);
			}
		}
	};
	// 禁止默认选中“同时转发到我的微博”
	var disableDefaultForward = function (node) {
		if (!$options.noDefaultFwd) { return; }
		var fwdCheckbox = node.querySelector('.commoned_list .W_checkbox[name="forward"]');
		if (fwdCheckbox && fwdCheckbox.checked) {
			fwdCheckbox.checked = false;
		}
	};
	// 禁止默认发布新微博到当前浏览的分组
	var disableDefaultGroupPub = function (node) {
		if (!$options.noDefaultGroupPub) { return; }
		var groupLink = node.querySelector('.limits a[node-type="showPublishTo"]');
		if (groupLink) {
			groupLink.firstChild.innerHTML = '公开';
			groupLink.setAttribute('action-data', 'rank=0');
		}
	};
	// 清除发布框中的默认话题
	var clearDefTopic = function () {
		if ($options.clearDefTopic && $.scope() === 1) {
			var inputBox = document.querySelector('#pl_content_publisherTop .send_weibo .input textarea');
			if (inputBox && inputBox.hasAttribute('hottopic')) {
				// IFRAME载入方式，hotTopic可能尚未启动，直接清除相关属性即可
				inputBox.removeAttribute('hottopic');
				inputBox.removeAttribute('hottopicid');
				// 在发布框中模拟输入，欺骗STK.common.editor.plugin.hotTopic
				inputBox.value = 'DUMMY';
				inputBox.focus();
				inputBox.value = '';
				inputBox.blur();
			}
		}
	};
	// 将左边栏合并到右边栏
	var leftBar = $.select('.W_main_l'), navBar;
	if (leftBar) { navBar = leftBar.querySelector('.WB_left_nav'); }
	var mergeSidebars = function () {
		// 不要作用于“我关注的人”页面
		if (!navBar || navBar.id === 'pl_leftNav_relation') { return; }
		if ($options.mergeSidebars && !navBar.id) {
			var rightBar = $.select('.W_main_r'), myInfo = $('pl_rightmod_myinfo');
			if (!rightBar) { return; }
			leftBar.style.display = 'none';
			navBar.id = 'wbpNavBar';
			// 注意：Firefox不支持background-position-x
			$.select('.W_main').style.cssText = 'width: 830px; background-position: -150px 0';
			// 左边栏移动到右边栏
			rightBar.insertBefore(navBar, myInfo ? myInfo.nextSibling : rightBar.firstChild);
		} else if (!$options.mergeSidebars && navBar.id) {
			navBar.id = '';
			leftBar.style.display = 'none';
			$.select('.W_main').style.cssText = '';
			// 移动回原位置
			leftBar.appendChild(navBar);
			leftBar.style.display = '';
		}
	};
	// 用户自定义样式及程序附加样式
	var customStyles = function () {
		var cssText = '.W_person_info { margin: 0 20px 20px !important }\n', styles = $('wbpCustomStyles');
		if (!styles) {
			styles = document.createElement('style');
			styles.type = 'text/css';
			styles.id = 'wbpCustomStyles';
			document.head.appendChild(styles);
		}
		if ($options.showAllGroups) {
			cssText += '#pl_leftnav_group div[node-type="moreList"] { display: block !important } #pl_leftnav_group .level_2_Box > .levmore { display: none }\n';
		}
		if ($options.showAllMsgNav) {
			cssText += '#pl_leftnav_common > .level_1_Box > .lev2_new { display: block !important }\n';
		}
		if ($options.unwrapText) {
			cssText += '.WB_info, .WB_text { display: inline } .WB_info+.WB_text:before { content: "：" } .WB_func { margin-top: 5px } .B_index .WB_feed .W_ico16 { vertical-align: -3px !important }\n';
		}
		if ($options.mergeSidebars) {
			cssText += 'body:not(.S_profile) .W_gotop { margin-left: 415px }\n';
		}
		if ($options.floatSidebar) {
			if ($options.mergeSidebars) {
				cssText += 'body:not(.S_profile) .W_main_r { position: fixed; margin-left: 600px; } body:not(.S_profile) .W_main_r > div { display: none } body:not(.S_profile) #wbpNavBar, #pl_rightmod_myinfo { display: block !important }\n';
			} else {
				cssText += 'body:not(.S_profile) .WB_left_nav { position: fixed; width: 150px }\n';
			}
		}
		if ($options.overrideMyBack) {
			cssText += 'body:not(.S_profile) .W_main { background: none ' + $options.backColor + ' !important } body:not(.S_profile) .S_bg4, body:not(.S_profile) .W_main_a, body:not(.S_profile) .W_main_bg { background: none transparent !important }\n';
		}
		if ($options.overrideOtherBack) {
			cssText += '.S_profile .W_profile_bg { background-color: ' + $options.backColor + ' } .S_profile .S_bg4:not(.W_profile_bg), .S_profile .S_bg5, .S_profile .profile_tabbig { background: none transparent !important }\n';
		}
		if ($options.useCustomStyles) {
			cssText += $options.customStyles;
		}
		styles.innerHTML = cssText + '\n';
	};
	// 在用户信息气泡上添加屏蔽链接
	var modifyNamecard = function (node) {
		// 获得关注链接
		var userData = node.querySelector('.related_info>.name a[uid]'),
			toolbar = node.querySelector('.btn_item[node-type="followBtnBox"] span');
		if (!userData || !toolbar) { return false; }
		var uid = userData.getAttribute('uid');
		if (uid === $.uid) { return false; }
		// 创建分隔符
		var vline = document.createElement('em');
		vline.className = 'W_vline';
		vline.innerHTML = '|';
		toolbar.appendChild(vline);
		// 创建操作链接
		var link = document.createElement('a');
		link.href = 'javascript:void(0)';
		link.innerHTML = $options.userBlacklist.indexOf(uid) === -1 ? '屏蔽' : '解除屏蔽';
		$.click(link, function (event) {
			event.stopPropagation(); // 防止事件冒泡触发上级按钮onclick事件
			// 切换屏蔽状态
			var i = $options.userBlacklist.indexOf(uid);
			if (i === -1) {
				$options.userBlacklist.push(uid);
			} else {
				$options.userBlacklist.splice(i, 1);
			}
			$options.save();
			$filter();
			// 回溯到顶层，关闭信息气球
			while (node.className !== 'WB_global_personcard') {
				node = node.parentNode;
			}
			node.style.display = 'none';
		});
		toolbar.appendChild(link);
	};
	// 根据当前设置修改页面
	var apply = function () {
		// 极简阅读模式
		toggleReaderMode();
		// 设置链接
		showSettingsBtn();
		// 浮动设置按钮
		toggleFloatSettingsBtn();
		// 合并边栏
		mergeSidebars();
		// 屏蔽版面模块
		hideModules();
		// 清除发布框中的默认话题
		clearDefTopic();
		// 覆盖当前模板设置
		overrideSkin();
		// 应用自定义CSS
		customStyles();
		// 禁止默认选中“同时转发到我的微博”
		disableDefaultForward(document);
		// 禁止默认发布新微博到当前浏览的分组
		disableDefaultGroupPub(document);
	};

	// IFRAME载入不会影响head中的CSS，只添加一次即可
	var myStyles = document.createElement('style');
	myStyles.type = 'text/css';
	myStyles.id = 'wbpStyles';
	myStyles.innerHTML = '${CSS}';
	document.head.appendChild(myStyles);
	// 处理动态载入内容
	document.addEventListener('DOMNodeInserted', function (event) {
		var scope = $.scope(), node = event.target;
		//if (node.tagName !== 'SCRIPT') { console.log(node); }
		if (node.tagName !== 'DIV') { return; }
		if (scope && node.classList.contains('group_read')) {
			// 重新载入设置按钮
			showSettingsBtn();
		} else if (node.classList.contains('name_card_new')) {
			// 用户信息气球
			modifyNamecard(node);
		} else if (node.classList.contains('W_main_r') || node.querySelector('.W_main_r')) {
			// 合并边栏
			mergeSidebars();
		} else if (node.tagName === 'DIV' && node.getAttribute('node-type') === 'follow_dialog' && $options.hideMods.indexOf('FollowGuide') > -1) {
			// 动态载入的div[node-type="follow_dialog"]会使后续运行的pl.guide.homeguide.index显示“为你推荐”弹窗
			$.remove(node);
		} else if (node.querySelector('.commoned_list')) {
			// 禁止默认选中“同时转发到我的微博”
			disableDefaultForward(node);
		} else if (node.tagName === 'DIV' && node.classList.contains('send_weibo')) {
			// 禁止默认发布新微博到当前浏览的分组
			disableDefaultGroupPub(node);
			// 清除发布框中的默认话题
			clearDefTopic();
		} else if (node.tagName === 'DIV' && node.hasAttribute('ucardconf') && node.parentNode.id === 'trustPagelet_indexright_recom') {
			// 微博新首页右边栏模块处理
			tagRightbarMods(node.parentNode);
		}
	}, false);
	document.addEventListener('DOMNodeRemoved', function (event) {
		if (!navBar || !navBar.id) { return; }
		var node = event.target;
		if (node.tagName === 'DIV' && node.querySelector('#wbpNavBar')) {
			// 原左边栏所属模块即将随着右边栏被移除，需要将其暂时移动回左边栏（必须在DOM中时刻保持一个副本）
			navBar.id = '';
			leftBar.appendChild(navBar);
		}
	});
	// 检测按键，开关极简阅读模式
	document.addEventListener('keyup', function onKeyPress(event) {
		if ($dialog.shown()) { return; }
		var scope = $.scope();
		if (scope && event.keyCode === 119) {
			if (scope === 1) {
				$options.readerModeIndex = !$options.readerModeIndex;
			} else {
				$options.readerModeProfile = !$options.readerModeProfile;
			}
			$options.save();
			toggleReaderMode();
		}
	}, false);

	apply.modules = modules;
	return apply;
})();

// 先读取本地设置
$.get($.uid.toString(), undefined, function (options) {
	var init = function () {
		// 如果第一次运行时就在作用范围内，则直接屏蔽关键词（此时页面已载入完成）；
		// 否则交由$filter中注册的DOMNodeInserted事件处理
		if ($.scope()) { $filter(); }
		// 直接应用页面设置（此时页面已载入完成）
		// 与IFRAME相关的处理由$page中注册的DOMNodeInserted事件完成
		$page();
	};
	if (!$options.load(options)) {
		alert('“眼不见心不烦”设置读取失败！\n设置信息格式有问题。');
	} else if (options && $options.version < $.version) {
		$options.version = $.version;
		$options.save(true);
		if ($options.updateNotify) {
			alert('您已更新到“眼不见心不烦”v${VER}：\n\n- ' + '${FEATURES}'.split('；').join('\n- '));
		}
	}
	//#if CHROME
	if ($options.autoSync) {
		// 如果本地设置中开启了设置同步，则读取云端设置
		return $.get($.uid.toString(), undefined, function (options) {
				if (options) {
					$options.load(options);
				} else {
					// 如果云端尚无设置，则将本地设置保存至云端
					$options.save();
				}
				init();
			}, true);
	}
	//#endif
	init();
});

})();