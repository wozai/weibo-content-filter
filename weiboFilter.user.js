// ==UserScript==
// @name			眼不见心不烦（新浪微博）
// @namespace		http://weibo.com/salviati
// @license			MIT License
// @description		新浪微博（weibo.com）非官方功能增强脚本，具有屏蔽关键词、用户、来源、链接，改造版面等功能
// @features		同时支持旧版和新版微博(V5)；可以使用双栏版式（左边栏并入右边栏）；增加屏蔽用户的功能；可在用户主页启用极简阅读模式；可以调整极简阅读模式的宽度；可设置微博作者与正文间不折行；增加始终显示所有分组的功能；自定义屏蔽改为自定义样式
// @version			1.0b5
// @revision		68
// @author			@富平侯
// @committers		@牛肉火箭, @JoyerHuang_悦
// @grant			GM_getValue
// @grant			GM_setValue
// @grant			GM_addStyle
// @grant			GM_xmlhttpRequest
// @include			http://weibo.com/*
// @include			http://www.weibo.com/*
// @updateURL		https://userscripts.org/scripts/source/114087.meta.js
// @downloadURL		https://userscripts.org/scripts/source/114087.user.js
// ==/UserScript==

// 注意：使用@match替换@include将使GM_xmlhttpRequest()失效

(function () {

// 工具函数
var $ = (function () {
	// 按id选择元素（默认操作）
	var $ = function (id) {
		return document.getElementById(id);
	};
	// 按CSS选择元素
	$.select = function (css, root) {
		if (!root) { root = document; }
		return root.querySelector(css);
	};
	// 如果必要(Chrome)，通过脚本注入获得unsafeWindow
	$.window = (unsafeWindow && unsafeWindow.$CONFIG) ? unsafeWindow :
			(function () {
				var e = document.createElement('p');
				e.setAttribute('onclick', 'return window;');
				return e.onclick();
			})();
	$.config = $.window.$CONFIG;
	if (!$.config) { return undefined; }
	$.uid = $.config && $.config.uid;
	$.V5 = ($.config.any && $.config.any.indexOf('wvr=5') > -1);
	$.STK = $.window.STK;
	// Chrome不支持GM_setValue(), GM_getValue()等，需要使用localStorage重新定义
	// Firefox 2+, Internet Explorer 8+, Safari 4+和Chrome均支持DOM Storage (HTML5)
	if (!GM_getValue || (GM_getValue.toString && GM_getValue.toString().indexOf("not supported") > -1)) {
		var CHROME_KEY_ROOT = 'weiboPlus.';
		$.get = function (name, defval) {
			var val = localStorage.getItem(CHROME_KEY_ROOT + name);
			return val === null ? defval : val;
		};
		$.set = function (name, value) {
			localStorage.setItem(CHROME_KEY_ROOT + name, value);
		};
	} else {
		$.get = GM_getValue;
		$.set = GM_setValue;
	}
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
		return document.body.classList.contains('B_index') ? 1 : document.body.classList.contains($.V5 ? 'B_profile' : 'B_my_profile_other') ? 2 : 0;
	};
	return $;
})();

if (!$) {
	console.warn('不在作用范围内，脚本未运行！');
	return false;
}

function Options() {}

Options.prototype = {
	// 选项类型与默认值
	items : {
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
		readerModeWidth : ['string', 750],
		readerModeBackColor : ['string', 'rgba(100%, 100%, 100%, 0.8)'],
		mergeSidebars : ['bool'],
		clearHotTopic : ['bool'],
		unwrapText : ['bool'],
		showAllGroups : ['bool'],
		overrideMySkin : ['bool'],
		overrideOtherSkin : ['bool'],
		skinID : ['string', 'skinvip001'],
		filterPaused : ['bool'],
		filterSmiley : ['bool'],
		filterDeleted : ['bool'],
		filterFeelings : ['bool'],
		filterDupFwd : ['bool'],
		maxDupFwd : ['string', 1],
		filterFlood : ['bool'],
		maxFlood : ['string', 5],
		autoUpdate : ['bool', true],
		floatBtn : ['bool', true],
		useCustomStyles : ['bool', true],
		customStyles : ['string'],
		hideMods : ['array']
	},
	// 转换为字符串
	toString : function (strip) {
		var stripped = {}, option;
		for (option in this.items) {
			// 如果需要，则去掉所有内部变量
			if (!strip || this.items[option][0] !== 'internal') {
				stripped[option] = this[option];
			}
		}
		return JSON.stringify(stripped);
	},
	// 保存设置
	save : function () {
		// 自动调用toString()
		$.set($.uid.toString(), JSON.stringify(this));
	},
	// 载入/导入设置，输入的str为undefined（首次使用时）或string（非首次使用和导入设置时）
	load : function (str) {
		var parsed = {}, option;
		// 各类型默认值
		var typeDefault = {
			keyword : [],
			string : '',
			bool : false,
			array : [],
			object : {},
			internal : null
		};
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
		for (option in this.items) {
			if (parsed[option] !== undefined) {
				// 优先使用成功读取的值
				this[option] = parsed[option];
			} else if (this.items[option][1] !== undefined) {
				// 使用属性默认值
				this[option] = this.items[option][1];
			} else {
				// 使用类型默认值
				this[option] = typeDefault[this.items[option][0]];
			}
		}
		// == LEGACY CODE START ==
		// 兼容使用Object的旧版设置
		if (this.hideMods instanceof Array === false) {
			var hideModsArray = [];
			for (var module in this.hideMods) {
				if (this.hideMods[module]) { hideModsArray.push(module); }
			}
			this.hideMods = hideModsArray;
		}
		// == LEGACY CODE END ==
		return (str !== null);
	}
};

var $options = new Options();
if (!$options.load($.get($.uid.toString()))) {
	alert('“眼不见心不烦”设置读取失败！\n设置信息格式有问题。');
}

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
				if (!result.responseText.match(/@revision\s+(\d+)/) || RegExp.$1 <= Number('${REV}')) {
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
					window.open('http://userscripts.org/scripts/show/114087');
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

var $dialog = (function () {
	var shown = false, dialog, content;
	var getDom = function (node) {
		return content.getDom(node);
	};
	var bind = function (node, func, event) {
		$.STK.core.evt.addEvent(content.getDom(node), event || 'click', func);
	};
	// 从显示列表建立关键词数组
	var getKeywords = function (id, attr) {
		return Array.prototype.map.call(getDom(id).childNodes, function (keyword) {
			return attr ? keyword.getAttribute(attr) : keyword.textContent;
		});
	};
	// 将关键词添加到显示列表
	var addKeywords = function (id, list, attr) {
		var keywords = list instanceof Array ? list : getDom(list).value.split(' ');
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
				$.STK.common.extra.shine(getDom(list));
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
		var searcher = $.STK.common.trans.relation.getTrans('userCard', { onComplete : 
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
						$.STK.common.extra.shine(getDom(list));
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
		var options = new Options(), option;
		for (option in options.items) {
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
		getDom('settingsString').value = options.toString(true);
		return options;
	};
	// 更新设置窗口内容，exportSettings()的反过程
	var importSettings = function (options) {
		var option;
		for (option in options.items) {
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
		getDom('settingsString').value = options.toString(true);
	};
	// 创建设置窗口
	var createDialog = function () {
		dialog = $.STK.ui.dialog({isHold: true});
		dialog.setTitle('“眼不见心不烦”(v${VER})设置');
		content = ($.STK.module.layer || $.STK.ui.mod.layer)('${HTML}');
		content.getOuter().classList.add($.V5 ? 'wbpV5' : 'wbpV4'); // 版本标识
		if (!$.V5) { // 新旧版微博不同的class
			Array.prototype.forEach.call(
				content.getOuter().querySelectorAll('.W_btn_b'),
				function (button) { button.className = 'W_btn_a'; }
			);
			Array.prototype.forEach.call(
				content.getOuter().querySelectorAll('.wbpShow'),
				function (img) { img.classList.remove('W_ico16'); }
			);
			getDom('OK').className = 'W_btn_b';
			getDom('cancel').className = 'W_btn_a';
		}
		dialog.setContent(content.getOuter());
		// 修改屏蔽提示颜色事件
		bind('tipBackColor', function () {
			getDom('tipSample').style.backgroundColor = this.value;
		}, 'blur');
		bind('tipTextColor', function () {
			getDom('tipSample').style.borderColor = this.value;
			getDom('tipSample').style.color = this.value;
		}, 'blur');
		var events = $.STK.core.evt.delegatedEvent(content.getInner());
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
		bind('checkUpdate', $update);
		bind('OK', function () {
			$options = exportSettings();
			$options.save();
			$filter();
			$page();
			dialog.hide();
		});
		bind('cancel', dialog.hide);
		$.STK.custEvent.add(dialog, 'hide', function () {
			shown = false;
		});
	};
	// 显示设置窗口
	var show = function () {
		if (!dialog) {
			createDialog();
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
			} else if (text.indexOf(keyword.toLowerCase()) > -1) {
				return true;
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
			if ($.V5) { feed.removeChild(feed.firstChild); }
		}
		var mid = feed.getAttribute('mid');
		if (!mid) { return false; } // 动态没有mid
		var scope = $.scope(), isForward = (feed.getAttribute('isforward') === '1');
		if ($.V5) {
			var author = (scope === 1) ? feed.querySelector('.WB_detail>.WB_info>a.WB_name') : null,
				content = feed.querySelector('.WB_detail>.WB_text'),
				source = feed.querySelector('.WB_detail>.WB_func>.WB_from>em+a'),
				fwdAuthor = feed.querySelector('.WB_media_expand .WB_info>a.WB_name'),
				fwdContent = feed.querySelector('.WB_media_expand .WB_text'),
				fwdSource = feed.querySelector('.WB_media_expand>.WB_func>.WB_from>em+a'),
				fwdLink = feed.querySelector('.WB_media_expand .WB_func .WB_time');
		} else {
			var author = (scope === 1) ? feed.querySelector('dd.content>p[node-type="feed_list_content"]>a[usercard]') : null,
				content = feed.querySelector('dd.content>p[node-type="feed_list_content"]' + (scope === 1 ? '>em' : '')),
				source = feed.querySelector('dd.content>p.info>a.date+a'),
				fwdAuthor = feed.querySelector('dd.content>dl.comment>dt[node-type="feed_list_forwardContent"]>a[usercard]'),
				fwdContent = feed.querySelector('dd.content>dl.comment>dt[node-type="feed_list_forwardContent"]>em'),
				fwdSource = feed.querySelector('dd.content>dl.comment>dd.info>a.date + a'),
				fwdLink = feed.querySelector('dd.content>dl.comment>dd.info>a.date');
		}
		var fmid = isForward ? (fwdLink ? fwdLink.href : null) : null,
			uid = author ? author.getAttribute('usercard') : null;

		if (!content) { return false; }
		var text = (scope === 1) ? '@' + author.getAttribute('nick-name') + ': ' : ''; 
		text += getText(content);
		if (isForward && fwdAuthor && fwdContent) {
			// 转发内容
			text += '////@' + fwdAuthor.getAttribute('nick-name') + ': ' + getText(fwdContent);
		}
		console.log(text);

		if ($options.filterPaused || search(text, 'whiteKeywords')) {
			// 白名单条件
		} else if ((function () { // 黑名单条件
			// 屏蔽已删除微博的转发（是转发但无转发作者）
			if ($options.filterDeleted && isForward && !fwdAuthor) {
				console.warn('↑↑↑【已删除微博的转发被屏蔽】↑↑↑');
				return true;
			}
			// 用户黑名单
			if ((scope === 1 && author && $options.userBlacklist.indexOf(author.getAttribute('usercard').match(/id=(\d+)/)[1]) > -1) ||
					(isForward && fwdAuthor && $options.userBlacklist.indexOf(fwdAuthor.getAttribute('usercard').match(/id=(\d+)/)[1]) > -1)) {
				console.warn('↑↑↑【被用户黑名单屏蔽】↑↑↑');
				return true;
			}
			// 屏蔽写心情微博
			if ($options.filterFeelings && feed.querySelector('div.feelingBoxS')) {
				console.warn('↑↑↑【写心情微博被屏蔽】↑↑↑');
				return true;
			}
			// 屏蔽指定来源
			if (searchSource(source, 'sourceKeywords') ||
					(isForward && searchSource(fwdSource, 'sourceKeywords'))) {
				console.warn('↑↑↑【被来源黑名单屏蔽】↑↑↑');
				return true;
			}
			// 反版聊（屏蔽重复转发）
			if ($options.filterDupFwd && fmid && forwardFeeds[fmid]) {
				if (forwardFeeds[fmid].length >= Number($options.maxDupFwd) && forwardFeeds[fmid].indexOf(mid) === -1) {
					console.warn('↑↑↑【被反版聊功能屏蔽】↑↑↑');
					return true;
				}
			}
			// 反刷屏（屏蔽同一用户大量发帖）
			if ($options.filterFlood && uid && floodFeeds[uid]) {
				if (floodFeeds[uid] >= Number($options.maxFlood) && floodFeeds[uid].indexOf(mid) === -1) {
					console.warn('↑↑↑【被反刷屏功能屏蔽】↑↑↑');
					return true;
				}
			}
			// 在微博内容中搜索屏蔽关键词
			if (search(text, 'blackKeywords')) {
				console.warn('↑↑↑【被关键词黑名单屏蔽】↑↑↑');
				return true;
			}
			// 搜索t.cn短链接
			return Array.prototype.some.call(feed.getElementsByTagName('A'), function (link) {
				if (link.href.substring(0, 12) === 'http://t.cn/' && search(link.title, 'URLKeywords')) {
					console.warn('↑↑↑【被链接黑名单屏蔽】↑↑↑');
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
				if ($.V5) {
					var line = document.createElement('div');
					line.className = 'S_line2 wbpTipLine';
					feed.insertBefore(line, feed.firstChild);
					feed.insertBefore(showFeedLink, line);
				} else {
					feed.insertBefore(showFeedLink, feed.firstChild);
				}
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
			Array.prototype.forEach.call(document.querySelectorAll($.V5 ? '.WB_feed_type' : '.feed_list'), apply);
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

	// 如果第一次运行时就在作用范围内，则直接屏蔽关键词（此时页面已载入完成）；
	// 否则交由后面注册的DOMNodeInserted事件处理
	if ($.scope()) {
		bindTipOnClick($.select($.V5 ? '.WB_feed' : '.feed_lists'));
		applyToAll();
	}
	// 处理动态载入的微博
	document.addEventListener('DOMNodeInserted', function (event) {
		if ($.scope() === 0) { return; }
		var node = event.target;
		if (node.tagName === ($.V5 ? 'DIV' : 'DL') && node.classList.contains($.V5 ? 'WB_feed_type' : 'feed_list')) {
			// 处理动态载入的微博
			apply(node);
		} else if (node.tagName === 'DIV' && node.classList.contains('W_loading')) {
			var requestType = node.getAttribute('requesttype');
			// 仅在搜索和翻页时需要初始化反刷屏/反版聊记录
			// 其它情况（新微博：newFeed，同页接续：lazyload）下不需要
			if (requestType === 'search' || requestType === 'page') {
				forwardFeeds = {}; floodFeeds = {};
			}
		} else if (node.tagName === 'DIV' && node.classList.contains($.V5 ? 'WB_feed' : 'feed_lists')) {
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
	var modules = $.V5 ? { 
			Ads : '#plc_main [id^="pl_rightmod_ads"], div[ad-data]',
			Stats : '#pl_rightmod_myinfo .user_atten',
			InterestUser : '#trustPagelet_recom_interestv5',
			Promotion : '#pl_rightmod_yunying',
			Topic : '#trustPagelet_zt_hottopicv5',
			Member : '#trustPagelet_recom_memberv5',
			AllInOne : '#trustPagelet_recom_allinonev5',
			Notice : '#pl_rightmod_noticeboard',
			Footer : 'div.global_footer',
			Activity : '#pl_content_biztips',
			RecommendedTopic : '#pl_content_publisherTop div[node-type="recommendTopic"]',
			App : '#pl_leftnav_app',
			Level : 'span.W_level_ico',
			TopComment : '#pl_content_commentTopNav',
			Medal : '#pl_profile_extraInfo .pf_badge_icon',
			Nofollow : '#pl_profile_unfollow',
			MyRightSidebar : '.B_profile .W_main_c, .B_profile .WB_feed .repeat .input textarea { width: 100% } .W_main_2r',
			ProfCover : '#plc_profile_header { min-height: 250px } #plc_profile_header .pf_head { top: 20px } #plc_profile_header .pf_info { margin-top: 20px } #pl_profile_cover',
			ProfStats : 'div#plc_profile_header { min-height: 195px } #pl_profile_photo .user_atten',
			MyRelation : '#pl_profile_moduleMyRelation',
			Relation : '#pl_profile_moduleHisRelation',
			PublicGroup : '#pl_profile_modulePublicGroup',
			PublicGroupRecom : '#pl_profile_modulePublicGroupRecommend',
			Album : '#pl_profile_modulealbum',
			AppWidget : '#pl_profile_appWidget',
			MemberIcon : '.ico_member:not(.wbpShow), .ico_member_dis:not(.wbpShow)',
			VerifyIcon : '.approve:not(.wbpShow), .approve_co:not(.wbpShow)',
			DarenIcon : '.ico_club:not(.wbpShow)',
			VgirlIcon : '.ico_vlady:not(.wbpShow)'
		} : {
			Ads : '#plc_main .W_main_r [id^="ads_"], div[ad-data]',
			Stats : 'ul.user_atten',
			Topic : '#trustPagelete_zt_hottopic',
			InterestUser : '#trustPagelete_recom_interest',
			AllInOne : '#trustPagelete_recom_allinone',
			Notice : '#pl_rightmod_noticeboard',
			HelpFeedback : '#pl_rightmod_help, #pl_rightmod_feedback, #pl_rightmod_tipstitle',
			Footer : 'div.global_footer',
			Activity : '#pl_content_biztips',
			RecommendedTopic : '#pl_content_publisherTop div[node-type="recommendTopic"]',
			Mood : '#pl_content_mood',
			Medal : '#pl_rightmod_medal, .declist',
			Game : '#pl_leftNav_game',
			App : '#pl_leftNav_app',
			Tasks : '#pl_content_tasks',
			UserGuide : '#pl_guide_oldUser',
			Promotion : '#trustPagelet_ugrowth_invite',
			Level : 'span.W_level_ico',
			Hello : 'div.wbim_hello',
			Balloon : 'div.layer_tips',
			TopComment : '#pl_content_commentTopNav',
			Member : '#trustPagelet_recom_member, #trustPagelet_member_zone',
			MemberIcon : '.ico_member:not(.wbpShow), .ico_member_dis:not(.wbpShow)',
			VerifyIcon : '.approve:not(.wbpShow), .approve_co:not(.wbpShow)',
			DarenIcon : '.ico_club:not(.wbpShow)',
			VgirlIcon : '.ico_vlady:not(.wbpShow)'
		};
	// 显示设置链接
	var showSettingsBtn = function () {
		if (!$('wbpShowSettings')) {
			var groups = $.select($.V5 ? 'ul.sort' : '#pl_content_homeFeed .nfTagB > ul, #pl_content_hisFeed .nfTagB > ul');
			if (!groups) { return false; }
			var tab = document.createElement('li');
			tab.id = 'wbpShowSettings';
			tab.className = 'item';
			tab.innerHTML = $.V5 ? '<a href="javascript:void(0)" class="item_link S_func1">眼不见心不烦</a>' : '<span><em><a href="javascript:void(0)">眼不见心不烦</a></em></span>';
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
				if ($.V5) {
					floatBtn.innerHTML = '<span class="S_line5" style="padding: 4px 0 6px; height: auto">★</span>';
					floatBtn.className = 'W_gotop S_line3';
					floatBtn.style.bottom = '75px';
					floatBtn.style.height = '24px';
				} else {
					floatBtn.innerHTML = '<span style="padding: 0 0 6px;">★</span>';
					floatBtn.className = 'W_gotop';
					floatBtn.style.bottom = '72px';
				}
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
				if ($.V5) { // 新版
					readerModeStyles.innerHTML += '.B_index .W_main_l, .B_index .W_main_r, .B_index #Box_center>div:not(#pl_content_homeFeed), .B_index .group_read, .B_index .global_footer { display: none }\n' +
							'.B_index #pl_content_top, .B_index .WB_global_nav { top: -40px }\n' +
							'.B_index { background-position-y: -40px }\n' +
							'.B_index .W_miniblog { padding-top: 20px; background-position-y: -40px }\n' +
							'.B_index .W_main { width: ' + width + 'px !important; background: ' + $options.readerModeBackColor + ' }\n' +
							'.B_index #Box_center, .B_index .W_main_a { width: auto }\n' +
							'.B_index .WB_feed .repeat .input textarea { width: 100% }\n' +
							'.B_index .WB_feed .WB_screen { margin-left: ' + (width-48) + 'px }\n' +
							'.B_index';
				} else if (!$.config.isnarrow) { // 体验版
					readerModeStyles.innerHTML += '.B_index #Box_left, .B_index #Box_right, .B_index #Box_center>div:not(#pl_content_homeFeed), .B_index .global_footer { display: none }\n' +
							'.B_index .global_header { top: -35px }\n' +
							'.B_index .W_miniblog { background-position-y: -35px }\n' + 
							'.B_index .W_main { padding-top: 17px; width: ' + width + 'px }\n' +
							'.B_index #Box_center { width: auto }\n' +
							'.B_index .W_main_bg { background: ' + $options.readerModeBackColor + ' }\n' +
							'.B_index .feed_list .repeat .input textarea { width: 100% }\n' +
							'.B_index';
							
				} else { // 传统版
					readerModeStyles.innerHTML += '.B_index .W_main_r, .B_index .W_main_c>div:not(.custom_content_bg), .B_index .custom_content_bg>div:not(#pl_content_homeFeed), .B_index .global_footer { display: none }\n' +
							'.B_index .global_header { top: -35px }\n' +
							'.B_index .W_miniblog { background-position-y: -35px }\n' +
							'.B_index #plc_main .custom_content_bg { padding-top: 30px }\n' +
							'.B_index .W_main_narrow { padding-top: 17px; width: ' + width + 'px }\n' +
							'.B_index .W_main_c { width: auto }\n' +
							'.B_index .W_main_narrow_bg { background: ' + $options.readerModeBackColor + ' }\n' +
							'.B_index .feed_list .repeat .input textarea { width: 100% }\n' +
							'.B_index';
				}
			}
			if ($options.readerModeProfile) { // 新版
				if ($.V5) { // 新版
					readerModeStyles.innerHTML += '.B_profile #plc_profile_header, .B_profile #pl_profile_nav, .B_profile .group_read, .B_profile .W_main_2r, .B_profile .group_read, .B_profile .global_footer { display: none }\n' +
							'.B_profile #pl_content_top, .B_profile .WB_global_nav { top: -40px }\n' +
							'.B_profile { background-position-y: -40px }\n' +
							'.B_profile .W_miniblog { padding-top: 20px; background-position-y: -40px }\n' +
							'.B_profile .W_main { width: ' + width + 'px !important; background: ' + $options.readerModeBackColor + ' }\n' +
							'.B_profile .W_main_c { padding-top: 0; width: auto }\n' +
							'.B_profile .WB_feed .repeat .input textarea { width: 100% }\n' +
							'.B_profile';
				} else if (!$.config.isnarrow) { // 体验版
					readerModeStyles.innerHTML += '.B_my_profile_other .W_main_l, .B_my_profile_other .W_main_r, .B_my_profile_other .W_main_c>div:not(#pl_content_hisFeed), .B_my_profile_other .global_footer { display: none }\n' +
							'.B_my_profile_other .global_header { top: -35px }\n' +
							'.B_my_profile_other .W_miniblog { background-position-y: -35px }\n' +
							'.B_my_profile_other .W_main { padding-top: 17px; width: ' + width + 'px }\n' +
							'.B_my_profile_other .W_main_c { width: auto }\n' +
							'.B_my_profile_other .W_main_bg { background: rgba(100%, 100%, 100%, 0.8) }\n' +
							'.B_my_profile_other .feed_list .repeat .input textarea { width: 100% }\n' +
							'.B_my_profile_other';
				} else { // 传统版
					readerModeStyles.innerHTML += '.B_my_profile_other .W_main_r, .B_my_profile_other .W_main_c>div:not(.custom_content_bg), .B_my_profile_other .custom_content_bg>div:not(#pl_content_hisFeed), .B_my_profile_other .global_footer { display: none }\n' +
							'.B_my_profile_other .global_header { top: -35px }\n' +
							'.B_my_profile_other .W_miniblog { background-position-y: -35px }\n' +
							'.B_my_profile_other #plc_main .custom_content_bg { padding-top: 30px }\n' +
							'.B_my_profile_other .W_main_narrow { padding-top: 17px; width: ' + width + 'px }\n' +
							'.B_my_profile_other .W_main_c { width: auto }\n' +
							'.B_my_profile_other .W_main_narrow_bg { background: white }\n' +
							'.B_my_profile_other .feed_list .repeat .input textarea { width: 100% }\n' +
							'.B_my_profile_other';
				}
			}
			readerModeStyles.innerHTML += ' .W_gotop { margin-left: ' + (width/2) + 'px !important }\n';
		} else if (readerModeStyles) {
			$.remove(readerModeStyles);
		}
	};
	// 覆盖当前模板设置
	var overrideSkin = function () {
		var formerStyle = $('custom_style') || $('skin_transformers'),
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
					'/skin' + ($.config.isnarrow ? '_narrow' : '') + ($.config.lang === "zh-tw" ? '_CHT' : '') +
					'.css?version=' + $.config.version;
			formerStyle.disabled = true;
		} else if (skinCSS) {
			$.remove(skinCSS);
			formerStyle.disabled = false;
		}
	};
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
	};
	// 清除在发布框中嵌入的默认话题
	var clearHotTopic = function () {
		if ($options.clearHotTopic && $.scope() === 1) {
			var inputBox = document.querySelector('#pl_content_publisherTop .send_weibo .input textarea');
			if (inputBox && inputBox.classList.contains('topic_color')) {
				// IFRAME载入方式，hotTopic可能尚未启动，直接清除相关属性即可
				inputBox.removeAttribute('hottopic');
				inputBox.removeAttribute('hottopicid');
				// 在发布框中模拟输入，欺骗STK.common.editor.plugin.hotTopic
				inputBox.value = 'DUMMY';
				inputBox.focus();
				inputBox.value = '';
				inputBox.blur();
				inputBox.classList.remove('topic_color');
			}
		}
	};
	// 将左边栏合并到右边栏
	var leftBar = $.select('.W_main_l'), navBar;
	if (leftBar) { navBar = leftBar.querySelector('.WB_left_nav'); }
	var mergeSidebars = function () {
		if (!navBar) { return; }
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
		var cssText = '', styles = $('wbpCustomStyles');
		if (!styles) {
			styles = document.createElement('style');
			styles.type = 'text/css';
			styles.id = 'wbpCustomStyles';
			document.head.appendChild(styles);
		}
		if ($.V5 && $options.showAllGroups) {
			cssText += '#pl_leftnav_group div[node-type="moreList"] { display: block !important } #pl_leftnav_group .levmore { display: none }\n';
		}
		if ($.V5 && $options.unwrapText) {
			cssText += '.WB_info, .WB_text { display: inline } .WB_info+.WB_text:before { content: "：" } .WB_func { margin-top: 5px } .B_index .WB_feed .W_ico16 { vertical-align: -3px !important }\n';
		}
		if ($.V5 && $options.mergeSidebars) {
			cssText += 'body:not(.S_profile) .W_gotop { margin-left: 415px }\n';
		}
		if ($options.useCustomStyles) {
			cssText += $options.customStyles;
		}
		styles.innerHTML = cssText + '\n';
	};
	// 在用户信息气泡上添加屏蔽链接
	var modifyNamecard = function (node) {
		// 获得关注链接
		var userData = node.querySelector('ul.userdata a'),
			toolbar = node.querySelector('.links > p');
		if (!userData || !toolbar) { return false; }
		// “关注”、“粉丝”和“微博”链接中一定使用数字id
		var uid = userData.pathname.split('/')[1];
		if (uid === $.uid) { return false; }
		// 创建分隔符（如果需要）
		if (toolbar.childElementCount) {
			var vline = document.createElement('span');
			vline.className = 'W_vline';
			vline.innerHTML = '|';
			toolbar.appendChild(vline);
		}
		// 创建操作链接
		var link = document.createElement('a');
		link.href = 'javascript:void(0)';
		link.innerHTML = $options.userBlacklist.indexOf(uid) === -1 ? '屏蔽' : '解除屏蔽';
		$.click(link, function () {
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
			while (node.className !== 'W_layer') {
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
		// 清除在发布框中嵌入的默认话题
		clearHotTopic();
		// 覆盖当前模板设置
		overrideSkin();
		// 应用自定义CSS
		customStyles();
	};

	// IFRAME载入不会影响head中的CSS，只添加一次即可
	GM_addStyle('${CSS}');
	// 直接应用页面设置（此时页面已载入完成）
	// 与IFRAME相关的处理在下面注册的DOMNodeInserted事件中完成
	apply();
	// 处理动态载入内容
	document.addEventListener('DOMNodeInserted', function (event) {
		var scope = $.scope(), node = event.target;
		//if (node.tagName !== 'SCRIPT') { console.log(node); }
		if (scope && node.tagName === 'DIV' && ($.V5 ? node.classList.contains('group_read') : node.querySelector('.nfTagB'))) {
			// 重新载入设置按钮
			showSettingsBtn();
		} else if (scope === 1 && node.tagName === 'DIV' && node.classList.contains('send_weibo')) {
			// 清除在发布框中嵌入的默认话题
			clearHotTopic();
		} else if (node.tagName === 'DIV' && node.classList.contains('name_card')) {
			// 用户信息气球
			modifyNamecard(node);
		} else if (node.tagName === 'DIV' && (node.classList.contains('W_main_r') || node.querySelector('.W_main_r'))) {
			// 合并边栏
			mergeSidebars();
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

})();